import { NextResponse } from "next/server";
import { ApiError, apiRoute, idParams } from "@/lib/api-route";
import { getSavedCustomerInvoiceView } from "@/lib/customer-invoices/service";
import { deleteCustomerInvoice, updateCustomerInvoice } from "@/lib/customer-invoices/mutations";
import { parseJsonBody, updateCustomerInvoiceSchema } from "@/lib/customer-invoices/schemas";

const invoiceIdParams = idParams({ message: "Invalid invoice ID" });

/**
 * GET /api/customer-invoices/[id]
 * A saved customer invoice with its jobs, lines and totals
 */
export const GET = apiRoute({
  auth: { permission: "manage_invoices" },
  params: invoiceIdParams,
  errorMessage: "Error fetching customer invoice",
  responseMessage: "Failed to fetch customer invoice",
  handler: async ({ params: { id } }) => {
    const invoice = await getSavedCustomerInvoiceView({ id });
    if (!invoice) throw new ApiError({ status: 404, message: "Invoice not found" });

    return NextResponse.json(invoice);
  },
});

/**
 * PATCH /api/customer-invoices/[id]
 * Update a saved invoice's reference, notes or waived break deductions
 */
export const PATCH = apiRoute({
  auth: { permission: "manage_invoices" },
  params: invoiceIdParams,
  errorMessage: "Error updating customer invoice",
  responseMessage: "Failed to update customer invoice",
  validationMessage: "Invalid invoice data",
  handler: async ({ request, params: { id } }) => {
    const input = await parseJsonBody({ request, schema: updateCustomerInvoiceSchema });
    await updateCustomerInvoice({ id, input, request });

    const invoice = await getSavedCustomerInvoiceView({ id });
    if (!invoice) throw new ApiError({ status: 404, message: "Invoice not found" });

    return NextResponse.json(invoice);
  },
});

/**
 * DELETE /api/customer-invoices/[id]
 * Delete a saved invoice; its jobs go back to the automatic drafts
 */
export const DELETE = apiRoute({
  auth: { permission: "manage_invoices" },
  params: invoiceIdParams,
  errorMessage: "Error deleting customer invoice",
  responseMessage: "Failed to delete customer invoice",
  handler: async ({ request, params: { id } }) => {
    await deleteCustomerInvoice({ id, request });

    return NextResponse.json({ success: true });
  },
});
