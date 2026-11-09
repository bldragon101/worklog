"use client";

import { AlertTriangle, CheckCheck, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface XeroMappingToolbarProps {
  idPrefix: string;
  /** Plural noun for the rows, e.g. "trucks" */
  noun: string;
  unmappedCount: number;
  totalCount: number;
  showUnmappedOnly: boolean;
  search: string;
  searchPlaceholder: string;
  /** Suggestions on the visible rows that differ from the current mapping */
  suggestionCount: number;
  disabled: boolean;
  onShowUnmappedOnlyChange: ({ value }: { value: boolean }) => void;
  onSearchChange: ({ value }: { value: string }) => void;
  onAcceptAll: () => void;
}

/** Unmapped count, filters and "Accept all suggestions" above a mapping list */
export function XeroMappingToolbar({
  idPrefix,
  noun,
  unmappedCount,
  totalCount,
  showUnmappedOnly,
  search,
  searchPlaceholder,
  suggestionCount,
  disabled,
  onShowUnmappedOnlyChange,
  onSearchChange,
  onAcceptAll,
}: XeroMappingToolbarProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant={unmappedCount > 0 ? "destructive" : "secondary"}
          data-testid={`${idPrefix}-unmapped-count`}
        >
          {unmappedCount} of {totalCount} {noun} unmapped
        </Badge>
        <div className="flex items-center gap-2">
          <Switch
            id={`${idPrefix}-unmapped-only-switch`}
            checked={showUnmappedOnly}
            onCheckedChange={(value) => onShowUnmappedOnlyChange({ value })}
          />
          <Label htmlFor={`${idPrefix}-unmapped-only-switch`} className="text-sm">
            Show unmapped only
          </Label>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-64">
          <Search
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${idPrefix}-search-input`}
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange({ value: event.target.value })}
            className="pl-8"
          />
        </div>
        <Button
          id={`${idPrefix}-accept-all-btn`}
          type="button"
          variant="outline"
          disabled={disabled || suggestionCount === 0}
          onClick={onAcceptAll}
        >
          <CheckCheck className="mr-2 h-4 w-4" aria-hidden="true" />
          Accept all suggestions{suggestionCount > 0 ? ` (${suggestionCount})` : ""}
        </Button>
      </div>
    </div>
  );
}

/** "Suggested: CODE" with a button to accept it */
export function XeroSuggestion({
  id,
  label,
  target,
  disabled,
  onAccept,
}: {
  id: string;
  label: string;
  /** What the suggestion is for, for the button's accessible name */
  target: string;
  disabled: boolean;
  onAccept: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded border border-dashed border-primary/50 bg-primary/5 px-2 py-0.5">
        Suggested: <span className="font-medium">{label}</span>
      </span>
      <Button
        id={id}
        type="button"
        size="sm"
        variant="secondary"
        className="h-6 px-2 text-xs"
        disabled={disabled}
        aria-label={`Accept suggestion ${label} for ${target}`}
        onClick={onAccept}
      >
        Accept
      </Button>
    </div>
  );
}

/** Icon button that clears a mapping */
export function XeroClearButton({
  id,
  target,
  disabled,
  onClear,
}: {
  id: string;
  target: string;
  disabled: boolean;
  onClear: () => void;
}) {
  return (
    <Button
      id={id}
      type="button"
      size="icon"
      variant="ghost"
      className="h-9 w-9 shrink-0"
      disabled={disabled}
      aria-label={`Clear mapping for ${target}`}
      title={`Clear mapping for ${target}`}
      onClick={onClear}
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

/** Warning that the mapped item is no longer among the synced Xero items */
export function XeroMissingItemBadge({ code }: { code: string | null }) {
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      {code ? `${code} is not in Xero` : "Item not in Xero"}
    </Badge>
  );
}

/** Message shown when a filtered mapping list has no rows */
export function XeroEmptyRows({ hasRows, noun }: { hasRows: boolean; noun: string }) {
  return (
    <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
      {hasRows ? `No ${noun} match the filters.` : `No ${noun} to map.`}
    </p>
  );
}

export function getErrorMessage({ error }: { error: unknown }): string {
  return error instanceof Error && error.message ? error.message : "Please try again";
}
