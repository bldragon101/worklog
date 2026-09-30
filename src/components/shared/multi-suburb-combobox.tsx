"use client";

import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { REGIONAL_BADGE_CLASS } from "@/components/shared/regional-badge-styles";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

interface SuburbOption {
  value: string;
  label: string;
  postcode: number;
  name: string;
}

const EMPTY_SUBURBS: SuburbOption[] = [];

// Build a deterministic kebab-case fragment for interactive element ids.
const toKebabId = ({ value }: { value: string }): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");


interface MultiSuburbComboboxProps {
  values?: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxSelections?: number;
  id?: string;
  loading?: boolean;
  regionalValues?: string[];
  describedBy?: string;
}

export function MultiSuburbCombobox({
  values = [],
  onChange,
  placeholder = "Search suburbs...",
  className,
  disabled = false,
  maxSelections,
  id,
  loading = false,
  regionalValues = [],
  describedBy,
}: MultiSuburbComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // The trimmed search term, updated after the user pauses typing
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const suburbsQuery = useQuery({
    queryKey: queryKeys.suburbs.search({ query: debouncedQuery }),
    queryFn: async () => {
      try {
        return await fetchJson<SuburbOption[]>({
          url: `/api/suburbs?q=${encodeURIComponent(debouncedQuery)}`,
          fallbackMessage: "Failed to fetch",
        });
      } catch (error) {
        console.error("Error fetching suburbs:", error);
        throw error;
      }
    },
    enabled: debouncedQuery.length >= 2,
  });
  const suburbs =
    debouncedQuery.length >= 2 && suburbsQuery.data
      ? suburbsQuery.data
      : EMPTY_SUBURBS;
  const searching = suburbsQuery.isFetching;

  // Debounce search to avoid too many API calls
  const debouncedSearch = (query: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
  };

  const handleSearchChange = (query: string) => {
    if (isDisabled) return;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleSelect = (selectedValue: string) => {
    if (isDisabled) return;

    // Check if already selected
    const selectedSuburb = suburbs.find(
      (suburb) => suburb.value === selectedValue,
    );
    const suburbName = selectedSuburb
      ? selectedSuburb.name
      : selectedValue || searchQuery;

    if (values.includes(suburbName)) {
      // Remove if already selected
      onChange(values.filter((v) => v !== suburbName));
    } else {
      // Add if not selected (and within max limit if set)
      if (!maxSelections || values.length < maxSelections) {
        onChange([...values, suburbName]);
      }
    }

    setSearchQuery("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (isDisabled) return;
    // Allow Enter to add custom value
    if (
      e.key === "Enter" &&
      searchQuery &&
      !suburbs.some((s) => s.value.toLowerCase() === searchQuery.toLowerCase())
    ) {
      e.preventDefault();
      if (
        !values.includes(searchQuery) &&
        (!maxSelections || values.length < maxSelections)
      ) {
        onChange([...values, searchQuery]);
        setSearchQuery("");
      }
    }
  };

  const removeValue = (valueToRemove: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDisabled) return;
    onChange(values.filter((v) => v !== valueToRemove));
  };

  const handleRemoveSelected = ({ value }: { value: string }) => {
    if (isDisabled) return;
    onChange(values.filter((v) => v !== value));
  };

  const displayText = useMemo(() => {
    if (values.length === 0) return placeholder;
    if (values.length === 1) return values[0];
    return `${values.length} suburbs selected`;
  }, [values, placeholder]);

  const isDisabled = disabled || loading;
  const isSearchActive = searchQuery.trim().length >= 2;

  return (
    <Popover
      open={open && !isDisabled}
      onOpenChange={(newOpen) => !isDisabled && setOpen(newOpen)}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-describedby={describedBy}
          className={cn("justify-between min-h-10", className)}
          disabled={isDisabled}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {values.length > 0 ? (
              values.length <= 3 ? (
                values.map((value) => (
                  <Badge
                    key={value}
                    variant="secondary"
                    title={
                      regionalValues.includes(value)
                        ? `${value} (regional suburb)`
                        : undefined
                    }
                    className={cn(
                      "text-xs py-0 px-2 h-5",
                      regionalValues.includes(value) &&
                        REGIONAL_BADGE_CLASS,
                    )}
                  >
                    <span className="max-w-[100px] truncate">{value}</span>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => removeValue(value, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          removeValue(value, e as unknown as MouseEvent);
                        }
                      }}
                      className="ml-1 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <X className="h-3 w-3" />
                    </div>
                  </Badge>
                ))
              ) : (
                <span className="truncate text-sm">{displayText}</span>
              )
            ) : (
              <span className="text-muted-foreground truncate">
                {placeholder}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={searchQuery}
            onValueChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
          />
          <CommandList>
            {searching ? (
              <div className="p-2 text-sm text-muted-foreground">
                Searching...
              </div>
            ) : (
              <>
                {/* When not actively searching, list the currently selected
                    suburbs so they can be reviewed and removed directly,
                    without having to search for each one again. */}
                {!isSearchActive && values.length > 0 && (
                  <CommandGroup heading="Selected (click to remove)">
                    {values.map((value) => (
                      <CommandItem
                        key={`selected-${value}`}
                        id={`suburb-selected-${toKebabId({ value })}`}
                        value={`selected-${value}`}
                        onSelect={() => handleRemoveSelected({ value })}
                        disabled={isDisabled}
                        className="bg-accent/40 aria-selected:bg-accent"
                      >
                        <Check className="mr-2 h-4 w-4 shrink-0 opacity-100" />
                        <span className="flex-1 truncate">{value}</span>
                        {regionalValues.includes(value) && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "ml-2 h-5 px-1.5 py-0 text-[10px]",
                              REGIONAL_BADGE_CLASS,
                            )}
                          >
                            Regional
                          </Badge>
                        )}
                        <X className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {isSearchActive ? (
                  <>
                    <CommandEmpty>
                      <div className="p-2">
                        <div className="text-sm text-muted-foreground mb-2">
                          No suburbs found.
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Press Enter to add &quot;{searchQuery}&quot; as custom
                          input.
                        </div>
                      </div>
                    </CommandEmpty>
                    <CommandGroup
                      heading={values.length > 0 ? "Results" : undefined}
                    >
                      {suburbs.map((suburb) => {
                        const isSelected = values.includes(suburb.name);
                        return (
                          <CommandItem
                            key={`${suburb.name}-${suburb.postcode}`}
                            id={`suburb-option-${toKebabId({ value: suburb.name })}-${suburb.postcode}`}
                            value={suburb.value}
                            onSelect={handleSelect}
                            disabled={isDisabled}
                            className={
                              isSelected
                                ? "bg-accent text-accent-foreground"
                                : ""
                            }
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {suburb.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </>
                ) : (
                  values.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground">
                      Type at least 2 characters to search suburbs.
                    </div>
                  )
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
