"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { CustomerInvoiceWarning } from "@/lib/customer-invoices/types";

export interface InvoiceWarningsListProps {
  warnings: CustomerInvoiceWarning[];
  /** Job ids listed on this invoice, so a warning can link to the job's row */
  jobIds: number[];
}

const XERO_MAPPING_PATH = "/settings/admin/xero";

/**
 * Where to fix a Xero mapping warning: the customers tab for a contact, the
 * invoice settings for break, toll and fuel levy items (which have no job),
 * and the truck and company mappings for job items.
 */
function getXeroMappingHref({ warning }: { warning: CustomerInvoiceWarning }): string | null {
  if (warning.code === "unmapped_contact") return `${XERO_MAPPING_PATH}?tab=customers`;
  if (warning.code !== "unmapped_item") return null;
  return warning.jobId === null ? `${XERO_MAPPING_PATH}?tab=settings` : XERO_MAPPING_PATH;
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
        {warnings.map((warning, index) => {
          const mappingHref = getXeroMappingHref({ warning });
          return (
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
              {mappingHref && (
                <>
                  {" "}
                  <Link
                    id={`invoice-warning-${index}-xero-link`}
                    href={mappingHref}
                    className="whitespace-nowrap font-medium text-primary underline underline-offset-2"
                    aria-label={`Fix in Xero mapping: ${warning.message}`}
                  >
                    Fix in Xero mapping
                  </Link>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
