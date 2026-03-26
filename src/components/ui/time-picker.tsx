"use client";

import * as React from "react";
import { cn } from "@/lib/utils/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Clock } from "lucide-react";
import { extractTimeFromISO } from "@/lib/utils/time-utils";

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

// 15-minute intervals only
const minuteOptions = ["00", "15", "30", "45"];

// Round minutes to the nearest 15-minute interval
const roundToQuarter = (minutes: string): string => {
  const m = parseInt(minutes, 10);
  if (isNaN(m)) return "00";
  const rounded = Math.round(m / 15) * 15;
  // 60 rounds back to 00
  return (rounded % 60).toString().padStart(2, "0");
};

const TIME_REGEX = /^([01]\d|2[0-3]):(00|15|30|45)$/;

export function TimePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Select time",
  className,
  id,
}: TimePickerProps) {
  const baseId = id || "time-picker";

  const [open, setOpen] = React.useState(false);
  const [selectedHours, setSelectedHours] = React.useState("08");
  const [selectedMinutes, setSelectedMinutes] = React.useState("00");
  const [directInput, setDirectInput] = React.useState("");
  const [inputError, setInputError] = React.useState(false);

  // Refs for scrolling to selected items
  const hoursScrollRef = React.useRef<HTMLDivElement>(null);
  const minutesScrollRef = React.useRef<HTMLDivElement>(null);

  // Parse initial value and set dialog state
  const parseAndSetTime = ({ timeValue }: { timeValue: string }) => {
    let timeString = timeValue;

    // If value is a full datetime string, extract just the time part without timezone conversion
    if (timeValue.includes("T") || timeValue.match(/^\d{4}-\d{2}-\d{2}/)) {
      timeString = extractTimeFromISO(timeValue);
    }

    if (timeString && timeString.includes(":")) {
      const [h, m] = timeString.split(":");
      const hours = h.padStart(2, "0") || "08";
      const minutes = roundToQuarter(m || "00");
      setSelectedHours(hours);
      setSelectedMinutes(minutes);
      setDirectInput(`${hours}:${minutes}`);
    }
  };

  React.useEffect(() => {
    if (value) {
      parseAndSetTime({ timeValue: value });
      return;
    }
    setSelectedHours("08");
    setSelectedMinutes("00");
    setDirectInput("");
    setInputError(false);
  }, [value]);

  // Update direct input when scrolling selectors change
  const syncInputFromSelectors = ({
    hours,
    minutes,
  }: {
    hours: string;
    minutes: string;
  }) => {
    setDirectInput(`${hours}:${minutes}`);
    setInputError(false);
  };

  const scrollToTime = ({
    hours,
    minutes,
  }: {
    hours: string;
    minutes: string;
  }) => {
    const hourIndex = hourOptions.findIndex((h) => h === hours);
    if (hourIndex !== -1 && hoursScrollRef.current) {
      hoursScrollRef.current.scrollTop = hourIndex * 32 - 96; // 32px per item, centre in view
    }
    const minuteIndex = minuteOptions.findIndex((m) => m === minutes);
    if (minuteIndex !== -1 && minutesScrollRef.current) {
      minutesScrollRef.current.scrollTop = minuteIndex * 32 - 48;
    }
  };

  // Auto-scroll to selected items when dialog opens
  React.useEffect(() => {
    if (open) {
      const timeoutId = setTimeout(() => {
        scrollToTime({ hours: selectedHours, minutes: selectedMinutes });
      }, 50); // Small delay to ensure DOM is ready

      return () => clearTimeout(timeoutId);
    }
  }, [open, selectedHours, selectedMinutes]);

  const handleHourSelect = ({ hour }: { hour: string }) => {
    setSelectedHours(hour);
    syncInputFromSelectors({ hours: hour, minutes: selectedMinutes });
  };

  const handleMinuteSelect = ({ minute }: { minute: string }) => {
    setSelectedMinutes(minute);
    syncInputFromSelectors({ hours: selectedHours, minutes: minute });
  };

  const handleDirectInputChange = ({ inputValue }: { inputValue: string }) => {
    // Strip any non-digit/colon chars, collapse multiple colons, limit to one colon
    const stripped = inputValue.replace(/[^\d:]/g, "");
    const parts = stripped.split(":");
    const cleaned =
      parts.length > 1 ? `${parts[0]}:${parts.slice(1).join("")}` : parts[0];

    // Auto-insert colon after 2 digits if user hasn't typed one
    let formatted = cleaned;
    if (
      cleaned.length === 2 &&
      !cleaned.includes(":") &&
      inputValue.length > directInput.length
    ) {
      formatted = `${cleaned}:`;
    }

    // Cap at 5 characters (HH:MM)
    formatted = formatted.slice(0, 5);

    // Always store the sanitised value
    setDirectInput(formatted);

    // Validate and sync with selectors if we have a full valid time
    if (TIME_REGEX.test(formatted)) {
      const [h, m] = formatted.split(":");
      setSelectedHours(h);
      setSelectedMinutes(m);
      setInputError(false);

      scrollToTime({ hours: h, minutes: m });
    } else if (formatted.length >= 5) {
      setInputError(true);
    } else {
      setInputError(false);
    }
  };

  const handleDirectInputKeyDown = ({ key }: { key: string }) => {
    if (key === "Enter") {
      if (TIME_REGEX.test(directInput)) {
        handleOkClick();
      }
    }
  };

  const handleOkClick = () => {
    // If direct input has a valid time, use it
    if (TIME_REGEX.test(directInput)) {
      const [h, m] = directInput.split(":");
      const formattedTime = `${h}:${m}`;
      onChange?.(formattedTime);
    } else if (directInput === "") {
      // Empty input means use the selector values
      const formattedTime = `${selectedHours}:${selectedMinutes}`;
      onChange?.(formattedTime);
    } else {
      // Invalid input - show error and don't close
      setInputError(true);
      return;
    }
    setOpen(false);
  };

  const handleClear = () => {
    onChange?.("");
    setOpen(false);
  };

  // Create display text from current value
  const displayText = (() => {
    if (!value) return placeholder;
    if (value.includes("T") || value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return extractTimeFromISO(value) || value;
    }
    return value;
  })();

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
        onClick={() => {
          setDirectInput(`${selectedHours}:${selectedMinutes}`);
          setInputError(false);
          setOpen(true);
        }}
        type="button"
      >
        <Clock className="mr-2 h-4 w-4" />
        {displayText}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <DialogTitle>Select Time</DialogTitle>
          </DialogHeader>

          {/* Direct time input */}
          <div className="flex justify-center px-4">
            <div className="w-full max-w-50">
              <label
                htmlFor={`${baseId}-direct-input`}
                className="text-xs font-medium text-muted-foreground mb-1 block text-center"
              >
                Type time (HH:MM)
              </label>
              <input
                id={`${baseId}-direct-input`}
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="HH:MM"
                value={directInput}
                onChange={(e) =>
                  handleDirectInputChange({ inputValue: e.target.value })
                }
                onKeyDown={(e) => handleDirectInputKeyDown({ key: e.key })}
                className={cn(
                  "w-full text-center font-mono text-lg px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring",
                  inputError && "border-destructive focus:ring-destructive",
                )}
              />
              {inputError && (
                <p className="text-xs text-destructive text-center mt-1">
                  Enter a valid time in 15-min intervals (e.g. 14:00, 14:15)
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 py-1">
            <div className="h-px w-16 bg-border" />
            <span className="text-xs text-muted-foreground">
              or select below
            </span>
            <div className="h-px w-16 bg-border" />
          </div>

          <div className="flex justify-center space-x-4 pb-4">
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
                      id={`${baseId}-hour-btn-${hour}`}
                      type="button"
                      className={cn(
                        "w-full h-8 flex items-center justify-center text-sm hover:bg-accent transition-colors",
                        selectedHours === hour &&
                          "bg-primary text-primary-foreground",
                      )}
                      onClick={() => handleHourSelect({ hour })}
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
                      id={`${baseId}-minute-btn-${minute}`}
                      type="button"
                      className={cn(
                        "w-full h-8 flex items-center justify-center text-sm hover:bg-accent transition-colors",
                        selectedMinutes === minute &&
                          "bg-primary text-primary-foreground",
                      )}
                      onClick={() => handleMinuteSelect({ minute })}
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
            <Button
              id={`${baseId}-clear-btn`}
              type="button"
              variant="outline"
              onClick={handleClear}
            >
              Clear
            </Button>
            <Button
              id={`${baseId}-ok-btn`}
              type="button"
              onClick={handleOkClick}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
