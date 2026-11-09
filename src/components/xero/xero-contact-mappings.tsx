"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useXeroMutations, type XeroContactMappingInput } from "@/hooks/use-xero";
import {
  XeroClearButton,
  XeroEmptyRows,
  XeroMappingToolbar,
  XeroSuggestion,
  getErrorMessage,
} from "@/components/xero/xero-mapping-controls";
import { XeroOptionCombobox } from "@/components/xero/xero-option-combobox";
import {
  buildContactOptions,
  matchesSearch,
  toKebabId,
} from "@/components/xero/xero-options";
import type { XeroContactMappingRow, XeroContactOption } from "@/lib/xero/types";

export interface XeroContactMappingsProps {
  contactMappings: XeroContactMappingRow[];
  contacts: XeroContactOption[];
}

function hasNewSuggestion({ row }: { row: XeroContactMappingRow }): boolean {
  return row.suggestedContactId !== null && row.suggestedContactId !== row.contactId;
}

/** Customer bill to names, each linked to the Xero contact invoices are addressed to */
export function XeroContactMappings({ contactMappings, contacts }: XeroContactMappingsProps) {
  const { toast } = useToast();
  const { saveContacts } = useXeroMutations();
  const [search, setSearch] = useState("");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const isSaving = saveContacts.isPending;

  const options = buildContactOptions({ contacts });
  const contactNames = new Map(contacts.map((contact) => [contact.contactId, contact.name]));
  const visibleRows = contactMappings.filter(
    (row) =>
      (!showUnmappedOnly || row.contactId === null) &&
      matchesSearch({ search, values: [row.billTo, ...row.customers, row.contactName ?? ""] }),
  );
  const suggestions: XeroContactMappingInput[] = visibleRows
    .filter((row) => hasNewSuggestion({ row }))
    .map((row) => ({ billTo: row.billTo, contactId: row.suggestedContactId }));

  const save = async ({
    mappings,
    successMessage,
  }: {
    mappings: XeroContactMappingInput[];
    successMessage?: string;
  }) => {
    try {
      await saveContacts.mutateAsync({ mappings });
      if (successMessage) toast({ title: "Mappings saved", description: successMessage });
    } catch (error) {
      toast({
        title: "Could not save the contact mapping",
        description: getErrorMessage({ error }),
        variant: "destructive",
      });
    }
  };

  const saveRow = (mapping: XeroContactMappingInput) => {
    void save({ mappings: [mapping] });
  };

  return (
    <div className="space-y-4">
      <XeroMappingToolbar
        idPrefix="xero-customers"
        noun="bill to names"
        unmappedCount={contactMappings.filter((row) => row.contactId === null).length}
        totalCount={contactMappings.length}
        showUnmappedOnly={showUnmappedOnly}
        search={search}
        searchPlaceholder="Search bill to or customers"
        suggestionCount={suggestions.length}
        disabled={isSaving}
        onShowUnmappedOnlyChange={({ value }) => setShowUnmappedOnly(value)}
        onSearchChange={({ value }) => setSearch(value)}
        onAcceptAll={() =>
          void save({
            mappings: suggestions,
            successMessage: `Accepted ${suggestions.length} suggested contact${suggestions.length === 1 ? "" : "s"}`,
          })
        }
      />

      {visibleRows.length === 0 ? (
        <XeroEmptyRows hasRows={contactMappings.length > 0} noun="bill to names" />
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Customer contact mappings">
          <li
            aria-hidden="true"
            className="hidden bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-4"
          >
            <span>Bill to</span>
            <span>Xero contact</span>
          </li>
          {visibleRows.map((row) => {
            const rowId = toKebabId({ value: row.key });
            const suggestedName = row.suggestedContactId
              ? (contactNames.get(row.suggestedContactId) ?? row.suggestedContactId)
              : null;
            const billTo = row.billTo || "(no bill to)";
            return (
              <li
                key={row.key}
                data-testid={`xero-customer-row-${rowId}`}
                className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{billTo}</p>
                  {row.customers.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Customers: {row.customers.join(", ")}
                    </p>
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-1">
                    <XeroOptionCombobox
                      id={`xero-customer-${rowId}-contact-select`}
                      ariaLabel={`Xero contact for ${billTo}`}
                      value={row.contactId}
                      fallbackLabel={row.contactName}
                      options={options}
                      placeholder="Choose a contact"
                      searchPlaceholder="Search contacts"
                      disabled={isSaving}
                      onSelect={({ value }) => saveRow({ billTo: row.billTo, contactId: value })}
                    />
                    <XeroClearButton
                      id={`xero-customer-${rowId}-clear-btn`}
                      target={billTo}
                      disabled={isSaving || row.contactId === null}
                      onClear={() => saveRow({ billTo: row.billTo, contactId: null })}
                    />
                  </div>
                  {hasNewSuggestion({ row }) && suggestedName && (
                    <XeroSuggestion
                      id={`xero-customer-${rowId}-accept-btn`}
                      label={suggestedName}
                      target={billTo}
                      disabled={isSaving}
                      onAccept={() =>
                        saveRow({ billTo: row.billTo, contactId: row.suggestedContactId })
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
