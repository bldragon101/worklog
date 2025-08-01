"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

interface SuburbComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SuburbCombobox({
  value = "",
  onChange,
  placeholder = "Search suburbs...",
  className,
  disabled = false,
}: SuburbComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [suburbs, setSuburbs] = React.useState<SuburbOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const fetchSuburbs = React.useCallback((query: string) => {
    setLoading(true);
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
        setLoading(false);
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
    if (disabled) return;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleSelect = (selectedValue: string) => {
    if (disabled) return;
    // If the selected value matches a suburb from our list, use the suburb name
    const selectedSuburb = suburbs.find((suburb) => suburb.value === selectedValue);
    if (selectedSuburb) {
      onChange(selectedSuburb.name);
    } else {
      // Allow custom input - use the search query or selected value
      onChange(selectedValue || searchQuery);
    }
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    // Allow Enter to set custom value
    if (e.key === "Enter" && searchQuery && !suburbs.some(s => s.value.toLowerCase() === searchQuery.toLowerCase())) {
      e.preventDefault();
      onChange(searchQuery);
      setOpen(false);
    }
  };

  // Find display value - either from suburbs list or use the current value
  const displayValue = React.useMemo(() => {
    if (!value) return "";
    
    // Check if current value matches a suburb in our list
    const matchingSuburb = suburbs.find(
      (suburb) => suburb.name.toLowerCase() === value.toLowerCase()
    );
    
    return matchingSuburb ? matchingSuburb.label : value;
  }, [value, suburbs]);

  return (
    <Popover open={open && !disabled} onOpenChange={(newOpen) => !disabled && setOpen(newOpen)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled}
        >
          <span className="truncate">
            {displayValue || placeholder}
          </span>
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
            disabled={disabled}
          />
          <CommandList>
            {loading ? (
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
                        Press Enter to use &quot;{searchQuery}&quot; as custom input.
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      Type at least 2 characters to search suburbs.
                    </div>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {suburbs.map((suburb) => (
                    <CommandItem
                      key={`${suburb.name}-${suburb.postcode}`}
                      value={suburb.value}
                      onSelect={handleSelect}
                      disabled={disabled}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === suburb.name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {suburb.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
