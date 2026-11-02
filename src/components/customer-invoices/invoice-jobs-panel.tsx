"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateDDMMYYYY } from "@/lib/utils/jobs-report-dates";
import { getSplitReference } from "@/components/customer-invoices/invoice-week";
import type { CustomerInvoiceView } from "@/lib/customer-invoices/types";

export interface InvoiceJobsPanelProps {
  invoice: CustomerInvoiceView;
  isPending: boolean;
  onSplit: ({ jobIds, reference }: { jobIds: number[]; reference: string }) => void;
  onRemove: ({ jobIds }: { jobIds: number[] }) => void;
}

/**
 * The invoice's jobs with checkboxes, to split selected jobs into a new
 * invoice or (on a saved invoice) remove them.
 */
export function InvoiceJobsPanel({ invoice, isPending, onSplit, onRemove }: InvoiceJobsPanelProps) {
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [splitReference, setSplitReference] = useState(() =>
    getSplitReference({ reference: invoice.reference }),
  );

  const jobIds = invoice.jobs.map((job) => job.id);
  // Jobs that moved off the invoice are no longer selectable
  const selectedIds = checkedIds.filter((id) => jobIds.includes(id));
  const selectedCount = selectedIds.length;
  const allSelected = jobIds.length > 0 && selectedCount === jobIds.length;
  const isSplitDisabled = isPending || selectedCount === 0 || allSelected;

  const toggleJob = ({ jobId, checked }: { jobId: number; checked: boolean }) => {
    setCheckedIds((previous) =>
      checked ? [...previous.filter((id) => id !== jobId), jobId] : previous.filter((id) => id !== jobId),
    );
  };

  return (
    <section aria-labelledby="invoice-jobs-heading" className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 p-4">
        <h3 id="invoice-jobs-heading" className="text-base font-semibold">
          Jobs ({invoice.jobs.length})
        </h3>
        {invoice.jobs.length > 0 && (
          <label
            htmlFor="select-all-invoice-jobs"
            className="flex cursor-pointer select-none items-center gap-2 text-sm"
          >
            <Checkbox
              id="select-all-invoice-jobs"
              checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false}
              onCheckedChange={(checked) => setCheckedIds(checked === true ? jobIds : [])}
              aria-label="Select all jobs"
            />
            Select all
          </label>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-b bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground sm:mr-auto">
            {selectedCount} job{selectedCount === 1 ? "" : "s"} selected
          </p>
          <div className="space-y-1">
            <Label htmlFor="split-invoice-reference-input" className="text-xs">
              New invoice reference
            </Label>
            <Input
              id="split-invoice-reference-input"
              className="h-8 w-56"
              value={splitReference}
              onChange={(event) => setSplitReference(event.target.value)}
              disabled={isPending}
            />
          </div>
          <Button
            id="split-invoice-jobs-btn"
            type="button"
            size="sm"
            className="h-8"
            disabled={isSplitDisabled}
            title={allSelected ? "Select only the jobs to move to a new invoice" : undefined}
            onClick={() => onSplit({ jobIds: selectedIds, reference: splitReference.trim() })}
          >
            Split selected jobs into new invoice
          </Button>
          {invoice.isSaved && (
            <Button
              id="remove-invoice-jobs-btn"
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={isPending}
              onClick={() => onRemove({ jobIds: selectedIds })}
            >
              Remove selected jobs
            </Button>
          )}
        </div>
      )}

      <ul className="divide-y">
        {invoice.jobs.map((job) => {
          const checkboxId = `select-invoice-job-${job.id}`;
          return (
            <li key={job.id} id={`invoice-job-${job.id}`} className="flex items-start gap-3 p-3 text-sm">
              <Checkbox
                id={checkboxId}
                className="mt-0.5"
                checked={selectedIds.includes(job.id)}
                onCheckedChange={(checked) => toggleJob({ jobId: job.id, checked: checked === true })}
                aria-label={`Select job ${job.id}`}
              />
              <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer">
                <span className="font-medium">
                  {formatDateDDMMYYYY({ isoString: job.date })} · {job.driver} · {job.registration}
                </span>
                <span className="block text-muted-foreground">
                  {job.truckType}
                  {job.jobReference ? ` · Ref ${job.jobReference}` : ""} · {job.pickup}
                  {job.dropoff ? ` to ${job.dropoff}` : ""}
                </span>
              </label>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <div>{job.chargedHours === null ? "No hours" : `${job.chargedHours}h`}</div>
                <div>{job.hasRunsheet ? "Runsheet" : "No runsheet"}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
