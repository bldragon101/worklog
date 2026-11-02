"use client";

import { useState } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { useCustomerInvoicesWeek } from "@/hooks/use-customer-invoices";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateDDMMYYYY } from "@/lib/utils/jobs-report-dates";
import { cn } from "@/lib/utils/utils";
import { InvoiceDetail } from "@/components/customer-invoices/invoice-detail";
import { InvoiceListRow } from "@/components/customer-invoices/invoice-list-row";
import { InvoiceWeekSelector } from "@/components/customer-invoices/invoice-week-selector";
import { getDefaultInvoiceWeekEnding } from "@/components/customer-invoices/invoice-week";
import type { CustomerInvoiceView } from "@/lib/customer-invoices/types";

export interface CustomerInvoicesPageProps {
  /** Week ending Sunday (YYYY-MM-DD) to open on, e.g. from a link after creating an invoice */
  initialWeekEnding: string | null;
}

const EMPTY_INVOICES: CustomerInvoiceView[] = [];

function InvoiceWeekSummary({ invoices }: { invoices: CustomerInvoiceView[] }) {
  const savedCount = invoices.filter((invoice) => invoice.isSaved).length;
  const draftCount = invoices.length - savedCount;
  const total = invoices.reduce((sum, invoice) => sum + invoice.totals.total, 0);
  const warningCount = invoices.reduce((sum, invoice) => sum + invoice.warnings.length, 0);

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Week summary">
      {[
        { label: "Saved", value: String(savedCount) },
        { label: "Drafts", value: String(draftCount) },
        { label: "Warnings", value: String(warningCount) },
        { label: "Week total (inc GST)", value: formatCurrency({ amount: total }) },
      ].map((stat) => (
        <div key={stat.label} className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="text-lg font-semibold">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CustomerInvoicesContent({ initialWeekEnding }: CustomerInvoicesPageProps) {
  const [defaultWeekEnding] = useState(getDefaultInvoiceWeekEnding);
  const [weekEnding, setWeekEnding] = useState(initialWeekEnding ?? defaultWeekEnding);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data, isLoading, isError, isPlaceholderData, refetch } = useCustomerInvoicesWeek({
    weekEnding,
  });
  const invoices = data?.invoices ?? EMPTY_INVOICES;
  const isFirstLoad = isLoading && !data;
  const loadFailed = isError && !data;

  const handleWeekEndingChange = ({ weekEnding: nextWeekEnding }: { weekEnding: string }) => {
    setWeekEnding(nextWeekEnding);
    setSelectedKey(null);
  };

  const handleSelect = ({ invoiceKey }: { invoiceKey: string }) => {
    setSelectedKey((current) => (current === invoiceKey ? null : invoiceKey));
  };

  return (
    <>
      <div className="sticky top-0 z-30 border-b bg-white px-4 py-3 dark:bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Invoices</h1>
            <p className="text-sm text-muted-foreground">
              Customer invoices for jobs in the week ending Sunday
            </p>
          </div>
          <InvoiceWeekSelector
            weekEnding={weekEnding}
            defaultWeekEnding={defaultWeekEnding}
            isLoading={isPlaceholderData}
            onWeekEndingChange={handleWeekEndingChange}
          />
        </div>
      </div>

      <div
        id="customer-invoices-content"
        aria-busy={isPlaceholderData}
        className={cn(
          "container mx-auto space-y-5 px-4 py-6 transition-opacity duration-150",
          isPlaceholderData && "pointer-events-none opacity-50",
        )}
      >
        {isFirstLoad && <LoadingSkeleton count={3} variant="card" />}

        {loadFailed && (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-red-600">Could not load invoices for this week.</p>
            <Button
              id="retry-load-invoices-btn"
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          </div>
        )}

        {data && invoices.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">No invoices for this week</p>
            <p className="text-sm text-muted-foreground">
              There are no uninvoiced jobs or saved invoices for the week ending{" "}
              {formatDateDDMMYYYY({ isoString: weekEnding })}.
            </p>
          </div>
        )}

        {data && invoices.length > 0 && (
          <>
            <InvoiceWeekSummary invoices={invoices} />
            <div className="space-y-2" role="list" aria-label="Invoices">
              {invoices.map((invoice) => (
                <div key={invoice.key} role="listitem" className="space-y-3">
                  <InvoiceListRow
                    invoice={invoice}
                    isSelected={selectedKey === invoice.key}
                    onSelect={handleSelect}
                  />
                  {selectedKey === invoice.key && (
                    <InvoiceDetail
                      key={invoice.key}
                      invoice={invoice}
                      onSelectInvoice={({ invoiceKey }) => setSelectedKey(invoiceKey)}
                      onInvoiceDeleted={() => setSelectedKey(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Customer invoices for a week: saved invoices and automatic drafts. The
 * invoices load only once the manage_invoices permission is confirmed.
 */
export function CustomerInvoicesPage({ initialWeekEnding }: CustomerInvoicesPageProps) {
  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredPermission="manage_invoices"
        fallbackTitle="Admin Access Required"
        fallbackDescription="You need administrator permission to manage customer invoices."
      >
        <CustomerInvoicesContent initialWeekEnding={initialWeekEnding} />
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
