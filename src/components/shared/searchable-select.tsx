"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SearchableSelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
}

export function SearchableSelect({
  value = "",
  onChange,
  options,
  placeholder = "Select an option...",
  className,
  disabled = false,
  loading = false,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    return options.filter(option =>
      option.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const handleSelect = (selectedValue: string) => {
    if (disabled) return;
    onChange(selectedValue);
    setOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
          onChange(filteredOptions[selectedIndex]);
          setOpen(false);
          setSearchQuery("");
          setSelectedIndex(-1);
        } else if (searchQuery && !options.some(opt => opt.toLowerCase() === searchQuery.toLowerCase())) {
          onChange(searchQuery);
          setOpen(false);
          setSearchQuery("");
          setSelectedIndex(-1);
        }
        break;
      case "Escape":
        setOpen(false);
        setSearchQuery("");
        setSelectedIndex(-1);
        break;
    }
  };

  // Reset selected index when options change
  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [filteredOptions]);

  // Scroll selected item into view
  React.useEffect(() => {
    if (selectedIndex >= 0 && scrollContainerRef.current) {
      const selectedElement = scrollContainerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

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
          <div className="flex items-center gap-1">
            {value && !loading && (
              <X 
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" 
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
      >
        <div className="border-b p-2">
          <Input
            placeholder={`Search ${placeholder.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="h-8"
            autoFocus
          />
        </div>
        <div 
          ref={scrollContainerRef}
          className="max-h-[200px] p-1" 
          style={{
            overflow: 'auto',
            overflowY: 'scroll',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
          tabIndex={0}
          onWheel={(e) => {
            e.stopPropagation();
          }}
        >
          {loading ? (
            <div className="p-2 text-sm text-muted-foreground">Loading options...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="p-2">
              {searchQuery ? (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">
                    No options found.
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Press Enter to use &quot;{searchQuery}&quot; as custom input.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No options available.
                </div>
              )}
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-accent hover:text-accent-foreground",
                  value === option && "bg-accent text-accent-foreground",
                  selectedIndex === index && "bg-muted"
                )}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    value === option ? "opacity-100" : "opacity-0"
                  )}
                />
                {option}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}