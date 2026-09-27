"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOM_VALUE = "custom";

export const FUEL_LEVY_PRESETS = ["0", "5", "10", "15", "20", "25", "30"];

const FUEL_LEVY_INPUT_PATTERN = /^\d{0,3}(\.\d{0,2})?$/;

/**
 * Converts a fuel levy form value into a percentage rounded to two decimal
 * places, or null when empty or invalid.
 */
export function parseFuelLevy({ value }: { value: string }): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) return null;
  return Math.round(Math.max(0, parsed) * 100) / 100;
}

interface FuelLevySelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Fuel levy picker offering preset percentages (0-30% in 5% steps) plus a
 * custom percentage with up to two decimal places.
 */
export function FuelLevySelect({
  id,
  value,
  onChange,
  disabled = false,
}: FuelLevySelectProps) {
  const [customMode, setCustomMode] = useState(false);
  const isCustom =
    customMode || (value !== "" && !FUEL_LEVY_PRESETS.includes(value));

  const handleSelectChange = (selected: string) => {
    if (selected === CUSTOM_VALUE) {
      setCustomMode(true);
      onChange("");
      return;
    }
    setCustomMode(false);
    onChange(selected);
  };

  const handleCustomChange = (input: string) => {
    if (FUEL_LEVY_INPUT_PATTERN.test(input)) {
      onChange(input);
    }
  };

  return (
    <div className="space-y-2">
      <Select
        value={isCustom ? CUSTOM_VALUE : value}
        onValueChange={handleSelectChange}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="rounded">
          <SelectValue placeholder="Select percentage" />
        </SelectTrigger>
        <SelectContent>
          {FUEL_LEVY_PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {preset}%
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>Custom</SelectItem>
        </SelectContent>
      </Select>
      {isCustom && (
        <div className="relative">
          <Input
            id={`${id}-custom`}
            className="rounded pr-8"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="e.g. 15.69"
            aria-label="Custom fuel levy percentage"
            disabled={disabled}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            %
          </span>
        </div>
      )}
    </div>
  );
}
