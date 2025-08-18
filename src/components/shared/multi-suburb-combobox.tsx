"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface SuburbOption {
  value: string;
  label: string;
  postcode: number;
  name: string;
}

interface MultiSuburbComboboxProps {
  values?: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxSelections?: number;
  id?: string;
  loading?: boolean;
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
}: MultiSuburbComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [suburbs, setSuburbs] = React.useState<SuburbOption[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const fetchSuburbs = React.useCallback((query: string) => {
    setSearching(true);
    fetch(`/api/suburbs?q=${encodeURIComponent(query)}`)
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to fetch');
      })
      .then(data => {
        setSuburbs(data);
      })
      .catch(error => {
        console.error("Error fetching suburbs:", error);
        setSuburbs([]);
      })
      .finally(() => {
        setSearching(false);
      });
  }, []);

  // Debounce search to avoid too many API calls
  const debouncedSearch = React.useCallback((query: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (query.trim().length >= 2) {
        fetchSuburbs(query.trim());
      } else {
        setSuburbs([]);
      }
    }, 300);
  }, [fetchSuburbs]);

  const handleSearchChange = (query: string) => {
    if (isDisabled) return;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleSelect = (selectedValue: string) => {
    if (isDisabled) return;
    
    // Check if already selected
    const selectedSuburb = suburbs.find((suburb) => suburb.value === selectedValue);
    const suburbName = selectedSuburb ? selectedSuburb.name : selectedValue || searchQuery;
    
    if (values.includes(suburbName)) {
      // Remove if already selected
      onChange(values.filter(v => v !== suburbName));
    } else {
      // Add if not selected (and within max limit if set)
      if (!maxSelections || values.length < maxSelections) {
        onChange([...values, suburbName]);
      }
    }
    
    setSearchQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDisabled) return;
    // Allow Enter to add custom value
    if (e.key === "Enter" && searchQuery && !suburbs.some(s => s.value.toLowerCase() === searchQuery.toLowerCase())) {
      e.preventDefault();
      if (!values.includes(searchQuery) && (!maxSelections || values.length < maxSelections)) {
        onChange([...values, searchQuery]);
        setSearchQuery("");
      }
    }
  };

  const removeValue = (valueToRemove: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDisabled) return;
    onChange(values.filter(v => v !== valueToRemove));
  };

  const displayText = React.useMemo(() => {
    if (values.length === 0) return placeholder;
    if (values.length === 1) return values[0];
    return `${values.length} suburbs selected`;
  }, [values, placeholder]);

  const isDisabled = disabled || loading;

  return (
    <Popover open={open && !isDisabled} onOpenChange={(newOpen) => !isDisabled && setOpen(newOpen)}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
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
                    className="text-xs py-0 px-2 h-5"
                  >
                    <span className="max-w-[100px] truncate">{value}</span>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => removeValue(value, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          removeValue(value, e as unknown as React.MouseEvent);
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
              <span className="text-muted-foreground truncate">{placeholder}</span>
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
              <div className="p-2 text-sm text-muted-foreground">Searching...</div>
            ) : (
              <>
                <CommandEmpty>
                  {searchQuery.length >= 2 ? (
                    <div className="p-2">
                      <div className="text-sm text-muted-foreground mb-2">
                        No suburbs found.
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Press Enter to add &quot;{searchQuery}&quot; as custom input.
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      Type at least 2 characters to search suburbs.
                    </div>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {suburbs.map((suburb) => {
                    const isSelected = values.includes(suburb.name);
                    return (
                      <CommandItem
                        key={`${suburb.name}-${suburb.postcode}`}
                        value={suburb.value}
                        onSelect={handleSelect}
                        disabled={isDisabled}
                        className={isSelected ? "bg-accent text-accent-foreground" : ""}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {suburb.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}