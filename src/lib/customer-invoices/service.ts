import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getTollRates } from "@/lib/toll-rates";
import type { TollRates } from "@/lib/utils/toll-rates";
import {
  buildCustomerInvoiceLines,
  calculateInvoiceTotals,
  type InvoiceCustomerInput,
  type InvoiceJobInput,
} from "@/lib/customer-invoices/line-builder";
import {
  buildInvoiceReference,
  getInvoiceWeekEnding,
  getInvoiceWeekRange,
  groupJobsIntoAutomaticInvoices,
  normaliseName,
  toIsoDate,
  weekEndingToDate,
} from "@/lib/customer-invoices/grouping";
import type {
  CustomerInvoiceJob,
  CustomerInvoiceView,
  CustomerInvoiceWarning,
} from "@/lib/customer-invoices/types";

export const invoiceJobSelect = {
  id: true,
  date: true,
  customer: true,
  billTo: true,
  driver: true,
  registration: true,
  truckType: true,
  chargedHours: true,
  startTime: true,
  finishTime: true,
  eastlink: true,
  citylink: true,
  countryRunValue: true,
  countryRunUnit: true,
  jobReference: true,
  pickup: true,
  dropoff: true,
  attachmentRunsheet: true,
} as const satisfies Prisma.JobsSelect;

export type InvoiceJobRow = Prisma.JobsGetPayload<{ select: typeof invoiceJobSelect }>;

export const invoiceCustomerSelect = {
  id: true,
  customer: true,
  billTo: true,
  tray: true,
  crane: true,
  semi: true,
  semiCrane: true,
  fuelLevy: true,
  tolls: true,
  breakDeduction: true,
  separateInvoicesByReference: true,
} as const satisfies Prisma.CustomerSelect;

export type InvoiceCustomerRow = Prisma.CustomerGetPayload<{
  select: typeof invoiceCustomerSelect;
}>;

/**
 * Jobs that can go on a customer invoice: not already marked invoiced (e.g.
 * invoiced by hand in Xero) and not driver-only. Nullable flags are matched
 * explicitly, as a `not: true` filter would also exclude nulls.
 */
export const invoiceableJobWhere = {
  AND: [
    { OR: [{ invoiced: false }, { invoiced: null }] },
    { OR: [{ driverOnly: false }, { driverOnly: null }] },
  ],
} as const satisfies Prisma.JobsWhereInput;

/** Customer records by normalised name, the first record winning on duplicates */
export function buildCustomerLookup({
  customers,
}: {
  customers: InvoiceCustomerRow[];
}): Map<string, InvoiceCustomerRow> {
  const lookup = new Map<string, InvoiceCustomerRow>();
  for (const customer of customers) {
    const key = normaliseName({ value: customer.customer });
    if (!lookup.has(key)) lookup.set(key, customer);
  }
  return lookup;
}

const NO_CUSTOMER_RATES: InvoiceCustomerInput = {
  tray: null,
  crane: null,
  semi: null,
  semiCrane: null,
  fuelLevy: null,
  tolls: false,
  breakDeduction: null,
};

function toInvoiceJobInput({ job }: { job: InvoiceJobRow }): InvoiceJobInput {
  return {
    id: job.id,
    date: toIsoDate({ date: job.date }),
    driver: job.driver,
    registration: job.registration,
    truckType: job.truckType,
    chargedHours: job.chargedHours,
    startTime: job.startTime,
    finishTime: job.finishTime,
    eastlink: job.eastlink,
    citylink: job.citylink,
    countryRunValue: job.countryRunValue,
    countryRunUnit: job.countryRunUnit,
    hasRunsheet: job.attachmentRunsheet.length > 0,
  };
}

function toCustomerInvoiceJob({ job }: { job: InvoiceJobRow }): CustomerInvoiceJob {
  return {
    id: job.id,
    date: toIsoDate({ date: job.date }),
    driver: job.driver,
    registration: job.registration,
    truckType: job.truckType,
    jobReference: job.jobReference,
    pickup: job.pickup,
    dropoff: job.dropoff,
    chargedHours: job.chargedHours,
    hasRunsheet: job.attachmentRunsheet.length > 0,
  };
}

function buildView({
  key,
  id,
  customer,
  customerName,
  weekEnding,
  jobReference,
  reference,
  notes,
  waivedBreakDeductions,
  jobs,
  tollRates,
  extraWarnings = [],
}: {
  key: string;
  id: number | null;
  customer: InvoiceCustomerRow | null;
  customerName: string;
  weekEnding: string;
  jobReference: string | null;
  reference: string;
  notes: string | null;
  waivedBreakDeductions: string[];
  jobs: InvoiceJobRow[];
  tollRates: TollRates;
  extraWarnings?: CustomerInvoiceWarning[];
}): CustomerInvoiceView {
  const { lines, warnings } = buildCustomerInvoiceLines({
    jobs: jobs.map((job) => toInvoiceJobInput({ job })),
    customer: customer ?? NO_CUSTOMER_RATES,
    tollRates,
    waivedBreakDeductions,
  });

  const customerWarnings: CustomerInvoiceWarning[] = customer
    ? []
    : [
        {
          code: "unknown_customer",
          jobId: null,
          message: `No customer record named "${customerName}", so these jobs have no rates`,
        },
      ];

  return {
    key,
    id,
    isSaved: id !== null,
    customerId: customer?.id ?? null,
    customerName: customer?.customer ?? customerName,
    billTo: customer?.billTo ?? jobs[0]?.billTo ?? "",
    weekEnding,
    jobReference,
    reference,
    notes,
    waivedBreakDeductions,
    jobs: jobs
      .map((job) => toCustomerInvoiceJob({ job }))
      .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date.localeCompare(b.date))),
    lines,
    totals: calculateInvoiceTotals({ lines }),
    warnings: [...customerWarnings, ...extraWarnings, ...warnings],
  };
}

type SavedInvoiceRow = Prisma.CustomerInvoiceGetPayload<{
  include: {
    customer: { select: typeof invoiceCustomerSelect };
    jobs: { select: typeof invoiceJobSelect };
  };
}>;

const savedInvoiceInclude = {
  customer: { select: invoiceCustomerSelect },
  jobs: { select: invoiceJobSelect },
} as const satisfies Prisma.CustomerInvoiceInclude;

function buildSavedView({
  invoice,
  tollRates,
}: {
  invoice: SavedInvoiceRow;
  tollRates: TollRates;
}): CustomerInvoiceView {
  const weekEnding = toIsoDate({ date: invoice.weekEnding });
  const customerKey = normaliseName({ value: invoice.customer.customer });

  const movedWarnings: CustomerInvoiceWarning[] = invoice.jobs.flatMap((job) => {
    if (normaliseName({ value: job.customer }) !== customerKey) {
      return [
        {
          code: "job_moved" as const,
          jobId: job.id,
          message: `The job is now for "${job.customer}", not this customer`,
        },
      ];
    }
    if (getInvoiceWeekEnding({ jobDate: job.date }) !== weekEnding) {
      return [
        {
          code: "job_moved" as const,
          jobId: job.id,
          message: "The job's date is no longer in this invoice's week",
        },
      ];
    }
    return [];
  });

  return buildView({
    key: `saved:${invoice.id}`,
    id: invoice.id,
    customer: invoice.customer,
    customerName: invoice.customer.customer,
    weekEnding,
    jobReference: invoice.jobReference,
    reference: invoice.reference,
    notes: invoice.notes,
    waivedBreakDeductions: invoice.waivedBreakDeductions,
    jobs: invoice.jobs,
    tollRates,
    extraWarnings: movedWarnings,
  });
}

/**
 * Every invoice for a week: the saved invoices, then an automatic draft for
 * each customer (and job reference, for customers split by reference) with
 * uninvoiced jobs that are not on a saved invoice. Sorted by customer, then
 * reference.
 */
export async function getCustomerInvoicesForWeek({
  weekEnding,
}: {
  weekEnding: string;
}): Promise<CustomerInvoiceView[]> {
  const [customers, tollRates, savedInvoices, unassignedJobs] = await Promise.all([
    prisma.customer.findMany({ select: invoiceCustomerSelect, orderBy: { id: "asc" } }),
    getTollRates(),
    prisma.customerInvoice.findMany({
      where: { weekEnding: weekEndingToDate({ weekEnding }) },
      include: savedInvoiceInclude,
      orderBy: { id: "asc" },
    }),
    prisma.jobs.findMany({
      where: {
        ...invoiceableJobWhere,
        date: getInvoiceWeekRange({ weekEnding }),
        customerInvoiceId: null,
      },
      select: invoiceJobSelect,
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
  ]);

  const customerLookup = buildCustomerLookup({ customers });
  const automaticGroups = groupJobsIntoAutomaticInvoices({
    jobs: unassignedJobs,
    weekEnding,
    isSeparatedByReference: ({ customerKey }) =>
      customerLookup.get(customerKey)?.separateInvoicesByReference ?? false,
  });

  const automaticViews = automaticGroups.map((group) => {
    const customer = customerLookup.get(group.customerKey) ?? null;
    const customerName = customer?.customer ?? group.jobs[0].customer.trim();
    return buildView({
      key: group.key,
      id: null,
      customer,
      customerName,
      weekEnding,
      jobReference: group.jobReference,
      reference: buildInvoiceReference({
        label: group.jobReference ?? customerName,
        weekEnding,
      }),
      notes: null,
      waivedBreakDeductions: [],
      jobs: group.jobs,
      tollRates,
    });
  });

  const savedViews = savedInvoices.map((invoice) => buildSavedView({ invoice, tollRates }));

  return [...savedViews, ...automaticViews].sort(
    (a, b) =>
      a.customerName.localeCompare(b.customerName) ||
      a.reference.localeCompare(b.reference) ||
      Number(b.isSaved) - Number(a.isSaved),
  );
}

/** A saved invoice's view, or null when it does not exist */
export async function getSavedCustomerInvoiceView({
  id,
}: {
  id: number;
}): Promise<CustomerInvoiceView | null> {
  const [invoice, tollRates] = await Promise.all([
    prisma.customerInvoice.findUnique({ where: { id }, include: savedInvoiceInclude }),
    getTollRates(),
  ]);
  return invoice ? buildSavedView({ invoice, tollRates }) : null;
}
