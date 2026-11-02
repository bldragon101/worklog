"use client";

import { AlertTriangle } from "lucide-react";
import type { CustomerInvoiceWarning } from "@/lib/customer-invoices/types";

export interface InvoiceWarningsListProps {
  warnings: CustomerInvoiceWarning[];
  /** Job ids listed on this invoice, so a warning can link to the job's row */
  jobIds: number[];
}

/** Warnings about the invoice, linking each job warning to the job below */
export function InvoiceWarningsList({ warnings, jobIds }: InvoiceWarningsListProps) {
  if (warnings.length === 0) return null;

  return (
    <section
      aria-labelledby="invoice-warnings-heading"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30"
    >
      <h3
        id="invoice-warnings-heading"
        className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Warnings ({warnings.length})
      </h3>
      <ul className="mt-2 space-y-1 text-sm">
        {warnings.map((warning, index) => (
          <li key={`${warning.code}-${warning.jobId ?? "invoice"}-${index}`}>
            {warning.jobId !== null && jobIds.includes(warning.jobId) ? (
              <a
                id={`invoice-warning-${index}-link`}
                href={`#invoice-job-${warning.jobId}`}
                className="underline underline-offset-2 hover:text-primary"
              >
                {warning.message}
              </a>
            ) : (
              warning.message
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
