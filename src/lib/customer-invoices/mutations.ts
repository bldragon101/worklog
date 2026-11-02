import type { NextRequest } from "next/server";
import { Prisma, type CustomerInvoiceStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { logActivity } from "@/lib/activity-logger";
import {
  buildInvoiceReference,
  getInvoiceWeekEnding,
  getReferenceGroup,
  normaliseName,
  toIsoDate,
  weekEndingToDate,
} from "@/lib/customer-invoices/grouping";
import {
  buildCustomerLookup,
  invoiceCustomerSelect,
  invoiceJobSelect,
} from "@/lib/customer-invoices/service";
import type {
  CreateCustomerInvoiceInput,
  UpdateCustomerInvoiceInput,
} from "@/lib/customer-invoices/schemas";

const TABLE_NAME = "CustomerInvoice";

export const CUSTOMER_INVOICE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

const lockedJobSelect = {
  ...invoiceJobSelect,
  customerInvoiceId: true,
  invoiced: true,
  driverOnly: true,
} as const satisfies Prisma.JobsSelect;

/** "Job 4" or "Jobs 4, 7", for error messages */
function describeJobs({ ids }: { ids: number[] }): string {
  const sorted = [...ids].sort((a, b) => a - b);
  return sorted.length === 1 ? `Job ${sorted[0]}` : `Jobs ${sorted.join(", ")}`;
}

function isOrAre({ ids }: { ids: number[] }): string {
  return ids.length === 1 ? "is" : "are";
}

/**
 * Locks the given job rows until the transaction ends, in id order to avoid
 * deadlocks. Every customer invoice mutation locks jobs before invoices.
 */
async function lockJobs({
  tx,
  jobIds,
}: {
  tx: Prisma.TransactionClient;
  jobIds: number[];
}): Promise<void> {
  if (jobIds.length === 0) return;
  await tx.$queryRaw`SELECT id FROM "Jobs" WHERE id IN (${Prisma.join(jobIds)}) ORDER BY id FOR UPDATE`;
}

/** Locks the given invoice rows, in id order, and returns their statuses */
async function lockInvoices({
  tx,
  invoiceIds,
}: {
  tx: Prisma.TransactionClient;
  invoiceIds: number[];
}): Promise<Array<{ id: number; status: CustomerInvoiceStatus }>> {
  if (invoiceIds.length === 0) return [];
  return tx.$queryRaw<Array<{ id: number; status: CustomerInvoiceStatus }>>`
    SELECT id, status FROM "CustomerInvoice" WHERE id IN (${Prisma.join(invoiceIds)}) ORDER BY id FOR UPDATE
  `;
}

function assertDraftInvoices({
  invoices,
}: {
  invoices: Array<{ id: number; status: CustomerInvoiceStatus }>;
}): void {
  const notDraft = invoices.filter((invoice) => invoice.status !== "draft").map(({ id }) => id);
  if (notDraft.length > 0) {
    throw new ApiError({
      status: 400,
      message: `Invoice ${notDraft.join(", ")} is not a draft, so its jobs cannot be changed`,
    });
  }
}

/**
 * Saves a customer invoice holding the given jobs, either split out of an
 * automatic draft or another saved invoice, or picked by hand. Jobs on another
 * saved draft invoice move to the new one, and a source invoice left with no
 * jobs is deleted.
 * @returns The new invoice's id.
 */
export async function createCustomerInvoiceFromJobs({
  input,
  userId,
  request,
}: {
  input: CreateCustomerInvoiceInput;
  userId: string;
  request?: NextRequest;
}): Promise<{ id: number }> {
  const { jobIds } = input;

  const result = await prisma.$transaction(async (tx) => {
    await lockJobs({ tx, jobIds });
    const jobs = await tx.jobs.findMany({
      where: { id: { in: jobIds } },
      select: lockedJobSelect,
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    const foundIds = new Set(jobs.map((job) => job.id));
    const missingIds = jobIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new ApiError({
        status: 404,
        message: `${describeJobs({ ids: missingIds })} not found`,
      });
    }

    const invoicedIds = jobs.filter((job) => job.invoiced === true).map(({ id }) => id);
    if (invoicedIds.length > 0) {
      throw new ApiError({
        status: 400,
        message: `${describeJobs({ ids: invoicedIds })} ${isOrAre({ ids: invoicedIds })} already marked as invoiced`,
      });
    }

    const driverOnlyIds = jobs.filter((job) => job.driverOnly === true).map(({ id }) => id);
    if (driverOnlyIds.length > 0) {
      throw new ApiError({
        status: 400,
        message: `${describeJobs({ ids: driverOnlyIds })} ${isOrAre({ ids: driverOnlyIds })} driver only and cannot be invoiced`,
      });
    }

    const customerKeys = new Set(jobs.map((job) => normaliseName({ value: job.customer })));
    if (customerKeys.size > 1) {
      throw new ApiError({ status: 400, message: "Jobs must all be for the same customer" });
    }

    const customers = await tx.customer.findMany({
      select: invoiceCustomerSelect,
      orderBy: { id: "asc" },
    });
    const customer = buildCustomerLookup({ customers }).get(
      normaliseName({ value: jobs[0].customer }),
    );
    if (!customer) {
      throw new ApiError({
        status: 400,
        message: `No customer record named "${jobs[0].customer.trim()}"`,
      });
    }

    const weekEndings = new Set(jobs.map((job) => getInvoiceWeekEnding({ jobDate: job.date })));
    if (weekEndings.size > 1) {
      throw new ApiError({ status: 400, message: "Jobs must all be in the same week" });
    }
    const weekEnding = getInvoiceWeekEnding({ jobDate: jobs[0].date });

    const referenceGroups = new Set(
      jobs.map((job) =>
        getReferenceGroup({
          jobReference: job.jobReference,
          separateInvoicesByReference: customer.separateInvoicesByReference,
        }),
      ),
    );
    const jobReference =
      referenceGroups.size === 1 && !referenceGroups.has(null)
        ? (jobs[0].jobReference?.trim() ?? null)
        : null;

    const sourceInvoiceIds = [
      ...new Set(jobs.flatMap((job) => (job.customerInvoiceId === null ? [] : [job.customerInvoiceId]))),
    ];
    assertDraftInvoices({ invoices: await lockInvoices({ tx, invoiceIds: sourceInvoiceIds }) });

    const invoice = await tx.customerInvoice.create({
      data: {
        customerId: customer.id,
        weekEnding: weekEndingToDate({ weekEnding }),
        jobReference,
        reference:
          input.reference ??
          buildInvoiceReference({ label: jobReference ?? customer.customer, weekEnding }),
        createdBy: userId,
      },
      select: { id: true, reference: true, jobReference: true },
    });

    await tx.jobs.updateMany({
      where: { id: { in: jobIds } },
      data: { customerInvoiceId: invoice.id },
    });

    const emptiedInvoices =
      sourceInvoiceIds.length === 0
        ? []
        : await tx.customerInvoice.findMany({
            where: { id: { in: sourceInvoiceIds }, jobs: { none: {} } },
            select: { id: true, reference: true, customerId: true, weekEnding: true },
          });
    if (emptiedInvoices.length > 0) {
      await tx.customerInvoice.deleteMany({
        where: { id: { in: emptiedInvoices.map(({ id }) => id) } },
      });
    }

    return {
      invoice,
      customer,
      weekEnding,
      sourceInvoiceIds,
      emptiedInvoices,
      jobIds: jobs.map(({ id }) => id),
    };
  }, CUSTOMER_INVOICE_TRANSACTION_OPTIONS);

  await Promise.all([
    logActivity({
      action: "CREATE",
      tableName: TABLE_NAME,
      recordId: String(result.invoice.id),
      newData: {
        id: result.invoice.id,
        customerId: result.customer.id,
        customer: result.customer.customer,
        weekEnding: result.weekEnding,
        jobReference: result.invoice.jobReference,
        reference: result.invoice.reference,
        jobIds: result.jobIds,
        movedFromInvoiceIds: result.sourceInvoiceIds,
      },
      description: `Created customer invoice ${result.invoice.reference} with ${result.jobIds.length} job(s)`,
      request,
    }),
    ...result.emptiedInvoices.map((emptied) =>
      logActivity({
        action: "DELETE",
        tableName: TABLE_NAME,
        recordId: String(emptied.id),
        oldData: {
          id: emptied.id,
          customerId: emptied.customerId,
          weekEnding: toIsoDate({ date: emptied.weekEnding }),
          reference: emptied.reference,
        },
        description: `Deleted customer invoice ${emptied.reference}: all its jobs moved to ${result.invoice.reference}`,
        request,
      }),
    ),
  ]);

  return { id: result.invoice.id };
}

const editableInvoiceSelect = {
  id: true,
  reference: true,
  notes: true,
  waivedBreakDeductions: true,
} as const satisfies Prisma.CustomerInvoiceSelect;

/** Updates a saved invoice's reference, notes or waived break deductions */
export async function updateCustomerInvoice({
  id,
  input,
  request,
}: {
  id: number;
  input: UpdateCustomerInvoiceInput;
  request?: NextRequest;
}): Promise<void> {
  const existing = await prisma.customerInvoice.findUnique({
    where: { id },
    select: editableInvoiceSelect,
  });
  if (!existing) throw new ApiError({ status: 404, message: "Invoice not found" });

  const updated = await prisma.customerInvoice.update({
    where: { id },
    data: {
      reference: input.reference,
      notes: input.notes,
      waivedBreakDeductions: input.waivedBreakDeductions,
    },
    select: editableInvoiceSelect,
  });

  await logActivity({
    action: "UPDATE",
    tableName: TABLE_NAME,
    recordId: String(id),
    oldData: existing,
    newData: updated,
    description: `Updated customer invoice ${updated.reference}`,
    request,
  });
}

/**
 * Deletes a saved draft invoice. Its jobs go back to the automatic drafts, as
 * the foreign key sets their invoice to null.
 */
export async function deleteCustomerInvoice({
  id,
  request,
}: {
  id: number;
  request?: NextRequest;
}): Promise<void> {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Jobs" WHERE "customerInvoiceId" = ${id} ORDER BY id FOR UPDATE`;
    const locked = await lockInvoices({ tx, invoiceIds: [id] });
    if (locked.length === 0) throw new ApiError({ status: 404, message: "Invoice not found" });
    assertDraftInvoices({ invoices: locked });

    return tx.customerInvoice.delete({
      where: { id },
      select: {
        id: true,
        customerId: true,
        weekEnding: true,
        jobReference: true,
        reference: true,
        notes: true,
        waivedBreakDeductions: true,
        jobs: { select: { id: true } },
      },
    });
  }, CUSTOMER_INVOICE_TRANSACTION_OPTIONS);

  const { jobs, weekEnding, ...details } = deleted;
  await logActivity({
    action: "DELETE",
    tableName: TABLE_NAME,
    recordId: String(id),
    oldData: {
      ...details,
      weekEnding: toIsoDate({ date: weekEnding }),
      jobIds: jobs.map((job) => job.id),
    },
    description: `Deleted customer invoice ${deleted.reference}`,
    request,
  });
}

/**
 * Takes jobs off a saved draft invoice, back to the automatic drafts. An
 * invoice left with no jobs is deleted.
 * @returns Whether the invoice was deleted.
 */
export async function removeJobsFromCustomerInvoice({
  id,
  jobIds,
  request,
}: {
  id: number;
  jobIds: number[];
  request?: NextRequest;
}): Promise<{ deleted: boolean }> {
  const result = await prisma.$transaction(async (tx) => {
    await lockJobs({ tx, jobIds });
    const locked = await lockInvoices({ tx, invoiceIds: [id] });
    if (locked.length === 0) throw new ApiError({ status: 404, message: "Invoice not found" });
    assertDraftInvoices({ invoices: locked });

    const onInvoice = await tx.jobs.findMany({
      where: { id: { in: jobIds }, customerInvoiceId: id },
      select: { id: true },
    });
    const onInvoiceIds = new Set(onInvoice.map((job) => job.id));
    const notOnInvoice = jobIds.filter((jobId) => !onInvoiceIds.has(jobId));
    if (notOnInvoice.length > 0) {
      throw new ApiError({
        status: 400,
        message: `${describeJobs({ ids: notOnInvoice })} ${isOrAre({ ids: notOnInvoice })} not on this invoice`,
      });
    }

    await tx.jobs.updateMany({
      where: { id: { in: jobIds }, customerInvoiceId: id },
      data: { customerInvoiceId: null },
    });

    const remaining = await tx.jobs.count({ where: { customerInvoiceId: id } });
    const invoice =
      remaining === 0
        ? await tx.customerInvoice.delete({ where: { id }, select: { reference: true } })
        : await tx.customerInvoice.findUniqueOrThrow({ where: { id }, select: { reference: true } });

    return { deleted: remaining === 0, reference: invoice.reference };
  }, CUSTOMER_INVOICE_TRANSACTION_OPTIONS);

  const removed = describeJobs({ ids: jobIds });
  await logActivity(
    result.deleted
      ? {
          action: "DELETE",
          tableName: TABLE_NAME,
          recordId: String(id),
          oldData: { id, reference: result.reference, jobIds },
          description: `Deleted customer invoice ${result.reference}: its last jobs were removed (${removed})`,
          request,
        }
      : {
          action: "UPDATE",
          tableName: TABLE_NAME,
          recordId: String(id),
          oldData: { customerInvoiceId: id, jobIds },
          newData: { customerInvoiceId: null, jobIds },
          description: `Removed ${removed} from customer invoice ${result.reference}`,
          request,
        },
  );

  return { deleted: result.deleted };
}
