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

interface DynamicSelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
}

export function DynamicSelect({
  value = "",
  onChange,
  options,
  placeholder = "Select an option...",
  className,
  disabled = false,
  loading = false,
  id,
}: DynamicSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    return options.filter(option =>
      option.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const handleSelect = (selectedValue: string) => {
    if (disabled) return;
    onChange(selectedValue === value ? "" : selectedValue);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    // Allow Enter to set custom value if no exact match
    if (e.key === "Enter" && searchQuery && !options.some(opt => opt.toLowerCase() === searchQuery.toLowerCase())) {
      e.preventDefault();
      onChange(searchQuery);
      setOpen(false);
    }
  };

  return (
    <Popover open={open && !disabled} onOpenChange={(newOpen) => !disabled && setOpen(newOpen)}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled || loading}
        >
          <span className="truncate">
            {loading ? "Loading..." : (value || placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${placeholder.toLowerCase()}...`}
            value={searchQuery}
            onValueChange={setSearchQuery}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          <CommandList 
            className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
            onWheel={(e) => {
              e.stopPropagation();
              const target = e.currentTarget;
              target.scrollTop += e.deltaY;
            }}
          >
            {loading ? (
              <div className="p-2 text-sm text-muted-foreground">Loading options...</div>
            ) : (
              <>
                <CommandEmpty>
                  {searchQuery ? (
                    <div className="p-2">
                      <div className="text-sm text-muted-foreground mb-2">
                        No options found.
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Press Enter to use &quot;{searchQuery}&quot; as custom input.
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      No options available.
                    </div>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={handleSelect}
                      disabled={disabled}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option}
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