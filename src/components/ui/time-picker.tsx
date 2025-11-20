"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Clock } from "lucide-react";
import { extractTimeFromISO } from "@/lib/time-utils";

interface TimePickerProps {
  value?: string; // HH:mm format
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

// Generate static options outside component to avoid re-renders
const hourOptions = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0"),
);

// Only 15-minute intervals: 00, 15, 30, 45
const minuteOptions = ["00", "15", "30", "45"];

export function TimePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Select time",
  className,
  id,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedHours, setSelectedHours] = React.useState("08");
  const [selectedMinutes, setSelectedMinutes] = React.useState("00");

  // Refs for scrolling to selected items
  const hoursScrollRef = React.useRef<HTMLDivElement>(null);
  const minutesScrollRef = React.useRef<HTMLDivElement>(null);

  // Parse initial value and set dialog state
  React.useEffect(() => {
    if (value) {
      let timeString = value;

      // If value is a full datetime string, extract just the time part without timezone conversion
      if (value.includes("T") || value.match(/^\d{4}-\d{2}-\d{2}/)) {
        timeString = extractTimeFromISO(value);
      }

      if (timeString && timeString.includes(":")) {
        const [h, m] = timeString.split(":");
        setSelectedHours(h.padStart(2, "0") || "08");
        setSelectedMinutes(m || "00");
      }
    }
  }, [value]);

  // Auto-scroll to selected items when dialog opens
  React.useEffect(() => {
    if (open) {
      const timeoutId = setTimeout(() => {
        // Scroll hours to selected value
        const hourIndex = hourOptions.findIndex((h) => h === selectedHours);
        if (hourIndex !== -1 && hoursScrollRef.current) {
          hoursScrollRef.current.scrollTop = hourIndex * 32 - 96; // 32px per item, center in view with more space
        }

        // Scroll minutes to selected value
        const minuteIndex = minuteOptions.findIndex(
          (m) => m === selectedMinutes,
        );
        if (minuteIndex !== -1 && minutesScrollRef.current) {
          minutesScrollRef.current.scrollTop = minuteIndex * 32 - 48;
        }
      }, 50); // Small delay to ensure DOM is ready

      return () => clearTimeout(timeoutId);
    }
  }, [open, selectedHours, selectedMinutes]);

  const handleOkClick = () => {
    const formattedTime = `${selectedHours}:${selectedMinutes}`;
    onChange?.(formattedTime);
    setOpen(false);
  };

  const handleClear = () => {
    onChange?.("");
    setOpen(false);
  };

  // Create display text from current value
  const displayText = value || placeholder;

  return (
    <>
      <Button
        id={id}
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-normal",
          !value && "text-muted-foreground",
          className,
        )}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Clock className="mr-2 h-4 w-4" />
        {displayText}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Select Time</DialogTitle>
          </DialogHeader>

          <div className="flex justify-center space-x-4 py-6">
            {/* Hours Scroll */}
            <div className="text-center">
              <label className="text-sm font-medium mb-2 block">Hours</label>
              <div className="h-48 w-16 border rounded overflow-hidden">
                <div
                  className="h-full overflow-y-auto scrollbar-thin"
                  ref={hoursScrollRef}
                >
                  {hourOptions.map((hour) => (
                    <button
                      key={hour}
                      className={cn(
                        "w-full h-8 flex items-center justify-center text-sm hover:bg-accent transition-colors",
                        selectedHours === hour &&
                          "bg-primary text-primary-foreground",
                      )}
                      onClick={() => setSelectedHours(hour)}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center text-2xl font-bold pt-6">:</div>

            {/* Minutes Scroll */}
            <div className="text-center">
              <label className="text-sm font-medium mb-2 block">Minutes</label>
              <div className="h-32 w-16 border rounded overflow-hidden">
                <div
                  className="h-full overflow-y-auto scrollbar-thin"
                  ref={minutesScrollRef}
                >
                  {minuteOptions.map((minute) => (
                    <button
                      key={minute}
                      className={cn(
                        "w-full h-8 flex items-center justify-center text-sm hover:bg-accent transition-colors",
                        selectedMinutes === minute &&
                          "bg-primary text-primary-foreground",
                      )}
                      onClick={() => setSelectedMinutes(minute)}
                    >
                      {minute}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center mb-4">
            <div className="text-lg font-mono bg-muted px-3 py-1 rounded">
              {selectedHours}:{selectedMinutes}
            </div>
          </div>

          <DialogFooter className="flex space-x-2">
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
            <Button onClick={handleOkClick}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
