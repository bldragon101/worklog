import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { getCustomerInvoicesForWeek, getSavedCustomerInvoiceView } from "@/lib/customer-invoices/service";
import { createCustomerInvoiceFromJobs } from "@/lib/customer-invoices/mutations";
import {
  createCustomerInvoiceSchema,
  customerInvoicesQuerySchema,
  parseJsonBody,
} from "@/lib/customer-invoices/schemas";
import type { CustomerInvoicesWeekResponse } from "@/lib/customer-invoices/types";

/**
 * GET /api/customer-invoices?weekEnding=YYYY-MM-DD
 * Every customer invoice for a week: saved invoices and automatic drafts
 */
export const GET = apiRoute({
  auth: { permission: "manage_invoices" },
  errorMessage: "Error fetching customer invoices",
  responseMessage: "Failed to fetch customer invoices",
  validationMessage: "Invalid week ending",
  handler: async ({ request }) => {
    const { weekEnding } = customerInvoicesQuerySchema.parse({
      weekEnding: request.nextUrl.searchParams.get("weekEnding") ?? undefined,
    });

    const invoices = await getCustomerInvoicesForWeek({ weekEnding });
    const body: CustomerInvoicesWeekResponse = { weekEnding, invoices };
    return NextResponse.json(body);
  },
});

/**
 * POST /api/customer-invoices
 * Save an invoice from the given jobs, split out of a draft or picked by hand
 */
export const POST = apiRoute({
  auth: { permission: "manage_invoices" },
  errorMessage: "Error creating customer invoice",
  responseMessage: "Failed to create customer invoice",
  validationMessage: "Invalid invoice data",
  handler: async ({ request, userId }) => {
    const input = await parseJsonBody({ request, schema: createCustomerInvoiceSchema });
    const { id } = await createCustomerInvoiceFromJobs({ input, userId, request });

    const invoice = await getSavedCustomerInvoiceView({ id });
    return NextResponse.json(invoice, { status: 201 });
  },
});
