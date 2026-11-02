"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface InvoiceDetailsFormProps {
  reference: string;
  notes: string | null;
  isPending: boolean;
  onSave: ({ reference, notes }: { reference: string; notes: string | null }) => void;
}

/**
 * Reference and notes of a saved invoice. Render it with a key built from the
 * saved values so the fields reset when the invoice changes.
 */
export function InvoiceDetailsForm({ reference, notes, isPending, onSave }: InvoiceDetailsFormProps) {
  const [referenceValue, setReferenceValue] = useState(reference);
  const [notesValue, setNotesValue] = useState(notes ?? "");

  const trimmedReference = referenceValue.trim();
  const trimmedNotes = notesValue.trim();
  const hasChanges = trimmedReference !== reference || trimmedNotes !== (notes ?? "");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedReference || !hasChanges) return;
    onSave({ reference: trimmedReference, notes: trimmedNotes || null });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="invoice-reference-input">Reference</Label>
        <Input
          id="invoice-reference-input"
          value={referenceValue}
          onChange={(event) => setReferenceValue(event.target.value)}
          required
          disabled={isPending}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="invoice-notes-input">Notes</Label>
        <Textarea
          id="invoice-notes-input"
          value={notesValue}
          onChange={(event) => setNotesValue(event.target.value)}
          rows={1}
          className="min-h-9"
          placeholder="Optional notes for this invoice"
          disabled={isPending}
        />
      </div>
      <Button
        id="save-invoice-details-btn"
        type="submit"
        size="sm"
        disabled={isPending || !hasChanges || !trimmedReference}
      >
        Save details
      </Button>
    </form>
  );
}
