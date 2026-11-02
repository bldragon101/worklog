import { NextResponse } from "next/server";
import { apiRoute, idParams } from "@/lib/api-route";
import { getSavedCustomerInvoiceView } from "@/lib/customer-invoices/service";
import { removeJobsFromCustomerInvoice } from "@/lib/customer-invoices/mutations";
import { parseJsonBody, removeCustomerInvoiceJobsSchema } from "@/lib/customer-invoices/schemas";

/**
 * POST /api/customer-invoices/[id]/remove-jobs
 * Take jobs off a saved invoice, back to the automatic drafts. An invoice
 * left with no jobs is deleted.
 */
export const POST = apiRoute({
  auth: { permission: "manage_invoices" },
  params: idParams({ message: "Invalid invoice ID" }),
  errorMessage: "Error removing jobs from customer invoice",
  responseMessage: "Failed to remove jobs from customer invoice",
  validationMessage: "Invalid job selection",
  handler: async ({ request, params: { id } }) => {
    const { jobIds } = await parseJsonBody({ request, schema: removeCustomerInvoiceJobsSchema });
    const { deleted } = await removeJobsFromCustomerInvoice({ id, jobIds, request });

    if (deleted) return NextResponse.json({ deleted: true, invoice: null });

    const invoice = await getSavedCustomerInvoiceView({ id });
    return NextResponse.json({ deleted: false, invoice });
  },
});
