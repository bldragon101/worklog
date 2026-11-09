"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useXeroMutations, type XeroVehicleMappingInput } from "@/hooks/use-xero";
import {
  XeroClearButton,
  XeroEmptyRows,
  XeroMappingToolbar,
  XeroMissingItemBadge,
  XeroSuggestion,
  getErrorMessage,
} from "@/components/xero/xero-mapping-controls";
import { XeroOptionCombobox } from "@/components/xero/xero-option-combobox";
import {
  buildVehicleItemOptions,
  matchesSearch,
  toKebabId,
} from "@/components/xero/xero-options";
import type { XeroItemOption, XeroVehicleMappingRow } from "@/lib/xero/types";

export interface XeroVehicleMappingsProps {
  vehicles: XeroVehicleMappingRow[];
  items: XeroItemOption[];
}

function isUnmapped({ row }: { row: XeroVehicleMappingRow }): boolean {
  return row.itemCode === null || row.isItemMissing;
}

function hasNewSuggestion({ row }: { row: XeroVehicleMappingRow }): boolean {
  return row.suggestedItemCode !== null && row.suggestedItemCode !== row.itemCode;
}

/** Company trucks, each mapped to the Xero item its jobs are invoiced with */
export function XeroVehicleMappings({ vehicles, items }: XeroVehicleMappingsProps) {
  const { toast } = useToast();
  const { saveVehicles } = useXeroMutations();
  const [search, setSearch] = useState("");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const isSaving = saveVehicles.isPending;

  const options = buildVehicleItemOptions({ items });
  const visibleRows = vehicles.filter(
    (row) =>
      (!showUnmappedOnly || isUnmapped({ row })) &&
      matchesSearch({
        search,
        values: [row.registration, row.description, row.itemCode ?? ""],
      }),
  );
  const suggestions: XeroVehicleMappingInput[] = visibleRows
    .filter((row) => hasNewSuggestion({ row }))
    .map((row) => ({ registration: row.registration, itemCode: row.suggestedItemCode }));

  const save = async ({
    mappings,
    successMessage,
  }: {
    mappings: XeroVehicleMappingInput[];
    successMessage?: string;
  }) => {
    try {
      await saveVehicles.mutateAsync({ mappings });
      if (successMessage) toast({ title: "Mappings saved", description: successMessage });
    } catch (error) {
      toast({
        title: "Could not save the truck mapping",
        description: getErrorMessage({ error }),
        variant: "destructive",
      });
    }
  };

  const saveRow = ({ registration, itemCode }: XeroVehicleMappingInput) => {
    void save({ mappings: [{ registration, itemCode }] });
  };

  return (
    <div className="space-y-4">
      <XeroMappingToolbar
        idPrefix="xero-trucks"
        noun="trucks"
        unmappedCount={vehicles.filter((row) => isUnmapped({ row })).length}
        totalCount={vehicles.length}
        showUnmappedOnly={showUnmappedOnly}
        search={search}
        searchPlaceholder="Search trucks"
        suggestionCount={suggestions.length}
        disabled={isSaving}
        onShowUnmappedOnlyChange={({ value }) => setShowUnmappedOnly(value)}
        onSearchChange={({ value }) => setSearch(value)}
        onAcceptAll={() =>
          void save({
            mappings: suggestions,
            successMessage: `Accepted ${suggestions.length} suggested truck item${suggestions.length === 1 ? "" : "s"}`,
          })
        }
      />

      {visibleRows.length === 0 ? (
        <XeroEmptyRows hasRows={vehicles.length > 0} noun="trucks" />
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Company truck mappings">
          <li
            aria-hidden="true"
            className="hidden bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-4"
          >
            <span>Truck</span>
            <span>Xero item</span>
          </li>
          {visibleRows.map((row) => {
            const rowId = toKebabId({ value: row.key });
            return (
              <li
                key={row.key}
                data-testid={`xero-truck-row-${rowId}`}
                className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{row.registration}</p>
                  {row.description && (
                    <p className="truncate text-sm text-muted-foreground">{row.description}</p>
                  )}
                  {row.isItemMissing && <XeroMissingItemBadge code={row.itemCode} />}
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-1">
                    <XeroOptionCombobox
                      id={`xero-truck-${rowId}-item-select`}
                      ariaLabel={`Xero item for ${row.registration}`}
                      value={row.itemCode}
                      options={options}
                      placeholder="Choose an item"
                      searchPlaceholder="Search items by code or name"
                      disabled={isSaving}
                      onSelect={({ value }) =>
                        saveRow({ registration: row.registration, itemCode: value })
                      }
                    />
                    <XeroClearButton
                      id={`xero-truck-${rowId}-clear-btn`}
                      target={row.registration}
                      disabled={isSaving || row.itemCode === null}
                      onClear={() => saveRow({ registration: row.registration, itemCode: null })}
                    />
                  </div>
                  {hasNewSuggestion({ row }) && row.suggestedItemCode && (
                    <XeroSuggestion
                      id={`xero-truck-${rowId}-accept-btn`}
                      label={row.suggestedItemCode}
                      target={row.registration}
                      disabled={isSaving}
                      onAccept={() =>
                        saveRow({ registration: row.registration, itemCode: row.suggestedItemCode })
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
