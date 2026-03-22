"use client";

import { useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils/utils";
import { Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface InlineCellSelectProps {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onFocus?: () => void;
  loading?: boolean;
  placeholder?: string;
}

export function InlineCellSelect({
  id,
  value,
  options,
  onChange,
  onFocus,
  loading = false,
  placeholder = "",
}: InlineCellSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    return options.filter((opt) =>
      opt.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [options, searchQuery]);

  const handleOpenChange = ({ isOpen }: { isOpen: boolean }) => {
    setOpen(isOpen);
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(-1);
      onFocus?.();
    }
  };

  const handleSelect = ({ selected }: { selected: string }) => {
    onChange(selected);
    setOpen(false);
    setSearchQuery("");
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
          handleSelect({ selected: filteredOptions[selectedIndex] });
        } else if (searchQuery) {
          handleSelect({ selected: searchQuery });
        }
        break;
      case "Escape":
        setOpen(false);
        setSearchQuery("");
        setSelectedIndex(-1);
        break;
      case "Tab":
        setOpen(false);
        setSearchQuery("");
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => handleOpenChange({ isOpen })}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "flex items-center justify-between w-full h-7 px-1 text-xs text-left",
            "bg-transparent hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary",
            "truncate font-mono",
          )}
          onClick={() => handleOpenChange({ isOpen: true })}
          onKeyUp={(e) => {
            if (e.key === "Enter" || e.key === " ")
              handleOpenChange({ isOpen: true });
          }}
          onFocus={onFocus}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-40" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="border-b p-1.5">
          <Input
            ref={inputRef}
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
            autoFocus
          />
        </div>
        <div
          ref={scrollRef}
          role="listbox"
          className="max-h-[180px] overflow-auto p-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {loading ? (
            <div className="p-2 text-xs text-muted-foreground">Loading...</div>
          ) : filteredOptions.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">
              {searchQuery
                ? "No matches. Press Enter to use typed value."
                : "No options."}
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option}
                role="option"
                aria-selected={value === option}
                tabIndex={-1}
                className={cn(
                  "flex items-center gap-1.5 px-1.5 py-1 text-xs cursor-pointer rounded-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  value === option && "bg-accent/50",
                  selectedIndex === index && "bg-muted",
                )}
                onClick={() => handleSelect({ selected: option })}
                onMouseEnter={() => setSelectedIndex(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect({ selected: option });
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                      prev < filteredOptions.length - 1 ? prev + 1 : prev,
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
                  }
                }}
              >
                <Check
                  className={cn(
                    "h-3 w-3 shrink-0",
                    value === option ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="truncate">{option}</span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
