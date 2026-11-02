"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/utils";
import { describeBreakKey } from "@/components/customer-invoices/invoice-week";
import type { CustomerInvoiceView } from "@/lib/customer-invoices/types";

export interface InvoiceLinesTableProps {
  invoice: CustomerInvoiceView;
  /** Break deductions can only be removed or restored on a saved invoice */
  canEditBreaks: boolean;
  isPending: boolean;
  onToggleBreak: ({ breakKey }: { breakKey: string }) => void;
}

function formatQuantity({ quantity }: { quantity: number }): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
}

/** The invoice lines with totals, and the break deductions removed from it */
export function InvoiceLinesTable({
  invoice,
  canEditBreaks,
  isPending,
  onToggleBreak,
}: InvoiceLinesTableProps) {
  const waivedBreaks = invoice.waivedBreakDeductions;

  return (
    <section aria-labelledby="invoice-lines-heading" className="rounded-lg border bg-card">
      <div className="border-b bg-muted/20 p-4">
        <h3 id="invoice-lines-heading" className="text-base font-semibold">
          Invoice lines
        </h3>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full text-sm" aria-label="Invoice lines">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2 font-medium">Description</th>
              <th className="w-20 p-2 text-right font-medium">Qty</th>
              <th className="w-28 p-2 text-right font-medium">Unit amount</th>
              <th className="w-32 p-2 text-right font-medium">Amount ex GST</th>
              {canEditBreaks && <th className="w-24 p-2 font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {invoice.lines.length === 0 && (
              <tr>
                <td colSpan={canEditBreaks ? 5 : 4} className="p-4 text-center text-muted-foreground">
                  No lines on this invoice
                </td>
              </tr>
            )}
            {invoice.lines.map((line, index) => (
              <tr
                key={`${line.kind}-${line.jobId ?? line.breakKey ?? line.tollRoad ?? index}`}
                className={cn("border-b last:border-b-0", line.kind === "break" && "text-muted-foreground")}
              >
                <td className="whitespace-pre-line p-2">{line.description}</td>
                <td className="p-2 text-right">{formatQuantity({ quantity: line.quantity })}</td>
                <td className="p-2 text-right">{formatCurrency({ amount: line.unitAmount })}</td>
                <td className="p-2 text-right">{formatCurrency({ amount: line.amountExGst })}</td>
                {canEditBreaks && (
                  <td className="p-2">
                    {line.kind === "break" && line.breakKey && (
                      <Button
                        id={`waive-break-${index}-btn`}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={isPending}
                        aria-label={`Remove break deduction ${line.description}`}
                        onClick={() => onToggleBreak({ breakKey: line.breakKey ?? "" })}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td colSpan={3} className="p-2 text-right font-medium">
                Subtotal
              </td>
              <td className="p-2 text-right" data-testid="invoice-subtotal">
                {formatCurrency({ amount: invoice.totals.subtotal })}
              </td>
              {canEditBreaks && <td />}
            </tr>
            <tr>
              <td colSpan={3} className="p-2 text-right font-medium">
                GST
              </td>
              <td className="p-2 text-right" data-testid="invoice-gst">
                {formatCurrency({ amount: invoice.totals.gst })}
              </td>
              {canEditBreaks && <td />}
            </tr>
            <tr>
              <td colSpan={3} className="p-2 text-right font-semibold">
                Total
              </td>
              <td className="p-2 text-right font-bold" data-testid="invoice-total">
                {formatCurrency({ amount: invoice.totals.total })}
              </td>
              {canEditBreaks && <td />}
            </tr>
          </tfoot>
        </table>

        {canEditBreaks && waivedBreaks.length > 0 && (
          <div className="mt-4 rounded border border-dashed p-3">
            <p className="text-sm font-medium">Removed break deductions</p>
            <ul className="mt-2 space-y-1">
              {waivedBreaks.map((breakKey, index) => (
                <li key={breakKey} className="flex items-center justify-between gap-2 text-sm">
                  <span>Breaks - {describeBreakKey({ breakKey })}</span>
                  <Button
                    id={`restore-break-${index}-btn`}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={isPending}
                    aria-label={`Restore break deduction ${describeBreakKey({ breakKey })}`}
                    onClick={() => onToggleBreak({ breakKey })}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
