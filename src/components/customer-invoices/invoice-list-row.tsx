"use client";

import type { KeyboardEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/utils";
import type { CustomerInvoiceView } from "@/lib/customer-invoices/types";

export interface InvoiceListRowProps {
  invoice: CustomerInvoiceView;
  isSelected: boolean;
  onSelect: ({ invoiceKey }: { invoiceKey: string }) => void;
}

/** The DOM id for an invoice, from its key (e.g. "saved:12" or "auto:acme:...") */
export function getInvoiceDomId({ invoiceKey }: { invoiceKey: string }): string {
  return invoiceKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** One invoice in the week's list; selecting it toggles its detail below */
export function InvoiceListRow({ invoice, isSelected, onSelect }: InvoiceListRowProps) {
  const warningCount = invoice.warnings.length;
  const jobCount = invoice.jobs.length;
  const domId = getInvoiceDomId({ invoiceKey: invoice.key });

  return (
    <div
      id={`invoice-row-${domId}`}
      role="button"
      tabIndex={0}
      aria-expanded={isSelected}
      aria-label={`${invoice.customerName} ${invoice.reference}`}
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-sm cursor-pointer sm:flex-row sm:items-center sm:justify-between",
        isSelected && "border-primary bg-accent",
      )}
      onClick={() => onSelect({ invoiceKey: invoice.key })}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect({ invoiceKey: invoice.key });
        }
      }}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{invoice.customerName}</span>
          {invoice.isSaved ? (
            <Badge variant="default">Saved</Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
          {warningCount > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500 text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {warningCount} warning{warningCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Bill to {invoice.billTo || "-"} · Ref {invoice.reference || "-"} · {jobCount} job
          {jobCount === 1 ? "" : "s"}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-x-4 text-right text-sm sm:min-w-[18rem]">
        <div>
          <dt className="text-xs text-muted-foreground">Subtotal</dt>
          <dd>{formatCurrency({ amount: invoice.totals.subtotal })}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">GST</dt>
          <dd>{formatCurrency({ amount: invoice.totals.gst })}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="font-bold">{formatCurrency({ amount: invoice.totals.total })}</dd>
        </div>
      </dl>
    </div>
  );
}
