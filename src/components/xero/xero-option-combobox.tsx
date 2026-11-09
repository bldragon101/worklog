"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils/utils";
import { matchesSearch, type XeroComboboxOption } from "@/components/xero/xero-options";

/** At most this many matches are listed, so hundreds of contacts stay quick */
const MAX_VISIBLE_OPTIONS = 100;
const NONE_VALUE = "__none__";

export interface XeroOptionComboboxProps {
  id: string;
  /** Accessible name of the trigger button */
  ariaLabel: string;
  value: string | null;
  /** Shown when the value is not among the options, e.g. a contact no longer synced */
  fallbackLabel?: string | null;
  options: XeroComboboxOption[];
  /** Offered behind a "Show all items" button, e.g. items of other truck classes */
  otherOptions?: XeroComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  /** When set, a "none" option clears the value */
  noneLabel?: string;
  disabled?: boolean;
  className?: string;
  onSelect: ({ value }: { value: string | null }) => void;
}

function groupOptions({ options }: { options: XeroComboboxOption[] }) {
  const groups: Array<{ name: string; options: XeroComboboxOption[] }> = [];
  for (const option of options) {
    const group = groups.find(({ name }) => name === option.group);
    if (group) {
      group.options.push(option);
    } else {
      groups.push({ name: option.group, options: [option] });
    }
  }
  return groups;
}

/** A searchable list of Xero items or contacts */
export function XeroOptionCombobox({
  id,
  ariaLabel,
  value,
  fallbackLabel = null,
  options,
  otherOptions = [],
  placeholder,
  searchPlaceholder,
  noneLabel,
  disabled = false,
  className,
  onSelect,
}: XeroOptionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showOther, setShowOther] = useState(false);

  const allOptions = showOther ? [...options, ...otherOptions] : options;
  const selected =
    value === null
      ? null
      : (options.find((option) => option.value === value) ??
        otherOptions.find((option) => option.value === value) ??
        null);
  const matches = allOptions.filter((option) =>
    matchesSearch({ search, values: [option.label, option.detail ?? ""] }),
  );
  const visible = matches.slice(0, MAX_VISIBLE_OPTIONS);
  const hiddenCount = matches.length - visible.length;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  const choose = ({ nextValue }: { nextValue: string | null }) => {
    handleOpenChange(false);
    if (nextValue !== value) onSelect({ value: nextValue });
  };

  const triggerText = selected
    ? selected.detail
      ? `${selected.label} - ${selected.detail}`
      : selected.label
    : value !== null
      ? (fallbackLabel ?? value)
      : placeholder;

  return (
    <Popover open={open && !disabled} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn("w-full justify-between overflow-hidden font-normal", className)}
        >
          <span className={cn("truncate text-left", value === null && "text-muted-foreground")}>
            {triggerText}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false} label={searchPlaceholder}>
          <CommandInput
            id={`${id}-search`}
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No matches found.</CommandEmpty>
            {noneLabel && !search && (
              <CommandGroup>
                <CommandItem
                  id={`${id}-none-option`}
                  value={NONE_VALUE}
                  onSelect={() => choose({ nextValue: null })}
                >
                  <Check className={cn("h-4 w-4", value === null ? "opacity-100" : "opacity-0")} />
                  <span className="text-muted-foreground">{noneLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {groupOptions({ options: visible }).map((group) => (
              <CommandGroup key={group.name} heading={group.name}>
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => choose({ nextValue: option.value })}
                  >
                    <Check
                      className={cn("h-4 w-4", option.value === value ? "opacity-100" : "opacity-0")}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.detail && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.detail}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          {(hiddenCount > 0 || (otherOptions.length > 0 && !showOther)) && (
            <div className="space-y-1 border-t p-2 text-xs text-muted-foreground">
              {hiddenCount > 0 && <p>{hiddenCount} more - type to narrow the list.</p>}
              {otherOptions.length > 0 && !showOther && (
                <Button
                  id={`${id}-show-all-btn`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full"
                  onClick={() => setShowOther(true)}
                >
                  Show all items
                </Button>
              )}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
