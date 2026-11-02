import { CustomerInvoicesPage } from "@/components/customer-invoices/customer-invoices-page";
import { normaliseInvoiceWeekEnding } from "@/components/customer-invoices/invoice-week";

/** Customer invoices; `?weekEnding=YYYY-MM-DD` opens a given week */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { weekEnding } = await searchParams;
  const initialWeekEnding = normaliseInvoiceWeekEnding({
    value: typeof weekEnding === "string" ? weekEnding : null,
  });

  return (
    <CustomerInvoicesPage
      key={initialWeekEnding ?? "latest"}
      initialWeekEnding={initialWeekEnding}
    />
  );
}
