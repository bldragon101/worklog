"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useCustomerInvoiceMutations,
  type CustomerInvoiceChanges,
} from "@/hooks/use-customer-invoices";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateDDMMYYYY } from "@/lib/utils/jobs-report-dates";
import { DeleteInvoiceDialog } from "@/components/customer-invoices/delete-invoice-dialog";
import { InvoiceDetailsForm } from "@/components/customer-invoices/invoice-details-form";
import { InvoiceJobsPanel } from "@/components/customer-invoices/invoice-jobs-panel";
import { InvoiceLinesTable } from "@/components/customer-invoices/invoice-lines-table";
import { InvoiceWarningsList } from "@/components/customer-invoices/invoice-warnings-list";
import type { CustomerInvoiceView } from "@/lib/customer-invoices/types";

export interface InvoiceDetailProps {
  invoice: CustomerInvoiceView;
  /** Select another invoice in the list, e.g. one just saved */
  onSelectInvoice: ({ invoiceKey }: { invoiceKey: string }) => void;
  /** Called once this invoice no longer exists */
  onInvoiceDeleted: () => void;
}

function getErrorMessage({ error }: { error: unknown }): string {
  return error instanceof Error && error.message ? error.message : "Please try again";
}

function pluraliseJobs({ count }: { count: number }): string {
  return `${count} job${count === 1 ? "" : "s"}`;
}

/**
 * Lines, warnings and jobs of one invoice with its actions. Mutations use
 * mutateAsync so their toasts still show when the invoice leaves the list
 * (e.g. a draft that has been saved).
 */
export function InvoiceDetail({ invoice, onSelectInvoice, onInvoiceDeleted }: InvoiceDetailProps) {
  const { toast } = useToast();
  const { createInvoice, updateInvoice, deleteInvoice, removeJobs, isPending } =
    useCustomerInvoiceMutations();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const savedId = invoice.id;
  const jobIds = invoice.jobs.map((job) => job.id);

  const showError = ({ title, error }: { title: string; error: unknown }) => {
    toast({ title, description: getErrorMessage({ error }), variant: "destructive" });
  };

  const handleSaveDraft = async () => {
    try {
      const saved = await createInvoice.mutateAsync({ jobIds });
      toast({
        title: "Invoice saved",
        description: `${saved.reference} saved with ${pluraliseJobs({ count: saved.jobs.length })}`,
      });
      onSelectInvoice({ invoiceKey: saved.key });
    } catch (error) {
      showError({ title: "Could not save invoice", error });
    }
  };

  const handleSplit = async ({ jobIds: splitJobIds, reference }: { jobIds: number[]; reference: string }) => {
    try {
      const created = await createInvoice.mutateAsync({
        jobIds: splitJobIds,
        reference: reference || undefined,
      });
      toast({
        title: "Invoice created",
        description: `${pluraliseJobs({ count: splitJobIds.length })} moved to ${created.reference}`,
      });
    } catch (error) {
      showError({ title: "Could not split invoice", error });
    }
  };

  const handleRemoveJobs = async ({ jobIds: removedJobIds }: { jobIds: number[] }) => {
    if (savedId === null) return;
    try {
      const result = await removeJobs.mutateAsync({ id: savedId, jobIds: removedJobIds });
      if (result.deleted) {
        toast({
          title: "Invoice deleted",
          description: "No jobs were left on the invoice, so it was deleted and the jobs returned to the draft",
        });
        onInvoiceDeleted();
        return;
      }
      toast({
        title: "Jobs removed",
        description: `${pluraliseJobs({ count: removedJobIds.length })} returned to the automatic draft`,
      });
    } catch (error) {
      showError({ title: "Could not remove jobs", error });
    }
  };

  const updateSavedInvoice = async ({
    changes,
    successTitle,
    errorTitle,
  }: {
    changes: CustomerInvoiceChanges;
    successTitle: string;
    errorTitle: string;
  }) => {
    if (savedId === null) return;
    try {
      const updated = await updateInvoice.mutateAsync({ id: savedId, changes });
      toast({ title: successTitle, description: `Total is now ${formatCurrency({ amount: updated.totals.total })}` });
    } catch (error) {
      showError({ title: errorTitle, error });
    }
  };

  const handleToggleBreak = ({ breakKey }: { breakKey: string }) => {
    const waived = invoice.waivedBreakDeductions;
    const isWaived = waived.includes(breakKey);
    void updateSavedInvoice({
      changes: {
        waivedBreakDeductions: isWaived
          ? waived.filter((key) => key !== breakKey)
          : [...waived, breakKey],
      },
      successTitle: isWaived ? "Break deduction restored" : "Break deduction removed",
      errorTitle: isWaived ? "Could not restore break deduction" : "Could not remove break deduction",
    });
  };

  const handleSaveDetails = ({ reference, notes }: { reference: string; notes: string | null }) => {
    void updateSavedInvoice({
      changes: { reference, notes },
      successTitle: "Invoice details saved",
      errorTitle: "Could not save invoice details",
    });
  };

  const handleDelete = async () => {
    if (savedId === null) return;
    try {
      await deleteInvoice.mutateAsync({ id: savedId });
      setIsDeleteOpen(false);
      toast({
        title: "Invoice deleted",
        description: "Its jobs returned to the automatic draft",
      });
      onInvoiceDeleted();
    } catch (error) {
      showError({ title: "Could not delete invoice", error });
    }
  };

  return (
    <div className="space-y-4" id="invoice-detail">
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{invoice.reference || invoice.customerName}</h2>
              {invoice.isSaved ? <Badge>Saved</Badge> : <Badge variant="outline">Draft</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {invoice.customerName} · Bill to {invoice.billTo || "-"} · Week ending{" "}
              {formatDateDDMMYYYY({ isoString: invoice.weekEnding })}
              {invoice.jobReference ? ` · Job reference ${invoice.jobReference}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {invoice.isSaved ? (
              <Button
                id="delete-invoice-btn"
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={isPending}
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Delete invoice
              </Button>
            ) : (
              <Button
                id="save-draft-invoice-btn"
                type="button"
                size="sm"
                disabled={isPending || jobIds.length === 0}
                onClick={() => void handleSaveDraft()}
              >
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                Save invoice
              </Button>
            )}
          </div>
        </div>

        {invoice.isSaved ? (
          <InvoiceDetailsForm
            key={`${invoice.key}:${invoice.reference}:${invoice.notes ?? ""}`}
            reference={invoice.reference}
            notes={invoice.notes}
            isPending={isPending}
            onSave={handleSaveDetails}
          />
        ) : (
          <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
            This is an automatic draft built from the week&apos;s uninvoiced jobs. Save the invoice
            to edit its reference or notes, or to remove break deductions.
          </p>
        )}
      </div>

      <InvoiceWarningsList warnings={invoice.warnings} jobIds={jobIds} />

      <InvoiceLinesTable
        invoice={invoice}
        canEditBreaks={invoice.isSaved}
        isPending={isPending}
        onToggleBreak={handleToggleBreak}
      />

      <InvoiceJobsPanel
        key={`${invoice.key}:${invoice.reference}`}
        invoice={invoice}
        isPending={isPending}
        onSplit={(split) => void handleSplit(split)}
        onRemove={(removal) => void handleRemoveJobs(removal)}
      />

      {invoice.isSaved && (
        <DeleteInvoiceDialog
          open={isDeleteOpen}
          reference={invoice.reference}
          isPending={isPending}
          onOpenChange={setIsDeleteOpen}
          onConfirm={() => void handleDelete()}
        />
      )}
    </div>
  );
}
