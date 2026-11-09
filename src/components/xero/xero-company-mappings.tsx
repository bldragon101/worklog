"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useXeroMutations, type XeroCompanyMappingInput } from "@/hooks/use-xero";
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
  TRUCK_CLASSES,
  buildCompanyItemOptions,
  matchesSearch,
  toKebabId,
} from "@/components/xero/xero-options";
import type { TruckClass } from "@/lib/customer-invoices/types";
import type { XeroCompanyMappingRow, XeroItemOption } from "@/lib/xero/types";

export interface XeroCompanyMappingsProps {
  companies: XeroCompanyMappingRow[];
  items: XeroItemOption[];
}

/** A company is unmapped until it has an item for some truck class, or when a mapped item has gone */
function isUnmapped({ row }: { row: XeroCompanyMappingRow }): boolean {
  return (
    TRUCK_CLASSES.every(({ truckClass }) => row.itemCodes[truckClass] === null) ||
    row.missingItemClasses.length > 0
  );
}

function getNewSuggestion({
  row,
  truckClass,
}: {
  row: XeroCompanyMappingRow;
  truckClass: TruckClass;
}): string | null {
  const suggestion = row.suggestedItemCodes[truckClass];
  return suggestion !== null && suggestion !== row.itemCodes[truckClass] ? suggestion : null;
}

function CompanyDrivers({ row }: { row: XeroCompanyMappingRow }) {
  if (row.drivers.length === 0) {
    return <p className="text-xs text-muted-foreground">No drivers</p>;
  }
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground" aria-label={`Drivers of ${row.name}`}>
      {row.drivers.map((driver) => (
        <li key={driver.id} className="flex flex-wrap items-center gap-1">
          <span>
            {driver.name} ({driver.type})
          </span>
          {!driver.hasBusinessName && (
            <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              No business name
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Contractor and subcontractor companies, mapped to an item for each truck class */
export function XeroCompanyMappings({ companies, items }: XeroCompanyMappingsProps) {
  const { toast } = useToast();
  const { saveCompanies } = useXeroMutations();
  const [search, setSearch] = useState("");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const isSaving = saveCompanies.isPending;

  const classOptions = TRUCK_CLASSES.map(({ truckClass, label }) => ({
    truckClass,
    label,
    ...buildCompanyItemOptions({ items, truckClass }),
  }));
  const visibleRows = companies.filter(
    (row) =>
      (!showUnmappedOnly || isUnmapped({ row })) &&
      matchesSearch({ search, values: [row.name, ...row.drivers.map((driver) => driver.name)] }),
  );
  const suggestions: XeroCompanyMappingInput[] = visibleRows.flatMap((row) =>
    TRUCK_CLASSES.flatMap(({ truckClass }) => {
      const itemCode = getNewSuggestion({ row, truckClass });
      return itemCode ? [{ companyName: row.name, truckClass, itemCode }] : [];
    }),
  );
  const hasDriversWithoutBusinessName = companies.some((row) =>
    row.drivers.some((driver) => !driver.hasBusinessName),
  );

  const save = async ({
    mappings,
    successMessage,
  }: {
    mappings: XeroCompanyMappingInput[];
    successMessage?: string;
  }) => {
    try {
      await saveCompanies.mutateAsync({ mappings });
      if (successMessage) toast({ title: "Mappings saved", description: successMessage });
    } catch (error) {
      toast({
        title: "Could not save the company mapping",
        description: getErrorMessage({ error }),
        variant: "destructive",
      });
    }
  };

  const saveCell = (mapping: XeroCompanyMappingInput) => {
    void save({ mappings: [mapping] });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Jobs by contractors and subcontractors are invoiced with their company&apos;s item for the
        job&apos;s truck class. Drivers are grouped by business name.
        {hasDriversWithoutBusinessName &&
          " Drivers flagged with no business name are grouped by their truck field (subcontractors) or full name (contractors) instead; add a business name on the Drivers page to group them properly."}
      </p>

      <XeroMappingToolbar
        idPrefix="xero-companies"
        noun="companies"
        unmappedCount={companies.filter((row) => isUnmapped({ row })).length}
        totalCount={companies.length}
        showUnmappedOnly={showUnmappedOnly}
        search={search}
        searchPlaceholder="Search companies or drivers"
        suggestionCount={suggestions.length}
        disabled={isSaving}
        onShowUnmappedOnlyChange={({ value }) => setShowUnmappedOnly(value)}
        onSearchChange={({ value }) => setSearch(value)}
        onAcceptAll={() =>
          void save({
            mappings: suggestions,
            successMessage: `Accepted ${suggestions.length} suggested company item${suggestions.length === 1 ? "" : "s"}`,
          })
        }
      />

      {visibleRows.length === 0 ? (
        <XeroEmptyRows hasRows={companies.length > 0} noun="companies" />
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Company mappings">
          {visibleRows.map((row) => {
            const rowId = toKebabId({ value: row.key });
            return (
              <li
                key={row.key}
                data-testid={`xero-company-row-${rowId}`}
                className="grid gap-3 px-4 py-3 xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] xl:gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{row.name}</p>
                  <CompanyDrivers row={row} />
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  {classOptions.map(({ truckClass, label, options, otherOptions }) => {
                    const itemCode = row.itemCodes[truckClass];
                    const suggestion = getNewSuggestion({ row, truckClass });
                    const cellId = `xero-company-${rowId}-${toKebabId({ value: truckClass })}`;
                    const target = `${row.name} ${label}`;
                    return (
                      <div key={truckClass} className="min-w-0 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                        <div className="flex items-center gap-1">
                          <XeroOptionCombobox
                            id={`${cellId}-item-select`}
                            ariaLabel={`Xero ${label} item for ${row.name}`}
                            value={itemCode}
                            options={options}
                            otherOptions={otherOptions}
                            placeholder="Choose an item"
                            searchPlaceholder={`Search ${label} items`}
                            disabled={isSaving}
                            onSelect={({ value }) =>
                              saveCell({ companyName: row.name, truckClass, itemCode: value })
                            }
                          />
                          <XeroClearButton
                            id={`${cellId}-clear-btn`}
                            target={target}
                            disabled={isSaving || itemCode === null}
                            onClear={() =>
                              saveCell({ companyName: row.name, truckClass, itemCode: null })
                            }
                          />
                        </div>
                        {row.missingItemClasses.includes(truckClass) && (
                          <XeroMissingItemBadge code={itemCode} />
                        )}
                        {suggestion && (
                          <XeroSuggestion
                            id={`${cellId}-accept-btn`}
                            label={suggestion}
                            target={target}
                            disabled={isSaving}
                            onAccept={() =>
                              saveCell({ companyName: row.name, truckClass, itemCode: suggestion })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {companies.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Tip</Badge>
          Leave a truck class empty when the company never runs that kind of truck.
        </p>
      )}
    </div>
  );
}
