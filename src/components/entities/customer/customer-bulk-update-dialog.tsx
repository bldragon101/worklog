"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FuelLevySelect } from "@/components/shared/fuel-levy-select";
import { useDefaultFuelLevy } from "@/hooks/use-default-fuel-levy";
import { useToast } from "@/hooks/use-toast";
import { isFuelLevyInRange, parseFuelLevy } from "@/lib/utils/fuel-levy";
import { CUSTOMER_BULK_UPDATE_MAX } from "@/lib/validation";
import type { Customer } from "@/lib/types";

const RATE_FIELDS = [
  { field: "tray", label: "Tray" },
  { field: "crane", label: "Crane" },
  { field: "semi", label: "Semi" },
  { field: "semiCrane", label: "Semi Crane" },
] as const;

type RateField = (typeof RATE_FIELDS)[number]["field"];
type BulkField = RateField | "fuelLevy" | "tolls";

interface BulkUpdates {
  tray?: number;
  crane?: number;
  semi?: number;
  semiCrane?: number;
  fuelLevy?: number;
  tolls?: boolean;
}

const EMPTY_RATES: Record<RateField, string> = {
  tray: "",
  crane: "",
  semi: "",
  semiCrane: "",
};

/**
 * Builds the update payload from the ticked fields, or returns an error
 * message when a ticked field has an invalid value.
 */
function buildUpdates({
  enabled,
  rates,
  fuelLevy,
  tolls,
}: {
  enabled: Set<BulkField>;
  rates: Record<RateField, string>;
  fuelLevy: string;
  tolls: boolean;
}): { updates: BulkUpdates } | { error: string } {
  const updates: BulkUpdates = {};

  for (const { field, label } of RATE_FIELDS) {
    if (!enabled.has(field)) continue;
    const value = Number(rates[field]);
    if (!rates[field] || !Number.isInteger(value) || value <= 0) {
      return { error: `${label} rate must be a whole number above zero` };
    }
    updates[field] = value;
  }

  if (enabled.has("fuelLevy")) {
    const parsed = parseFuelLevy({ value: fuelLevy });
    if (parsed === null || !isFuelLevyInRange({ value: parsed })) {
      return { error: "Fuel levy must be a percentage between 0 and 100" };
    }
    updates.fuelLevy = parsed;
  }

  if (enabled.has("tolls")) {
    updates.tolls = tolls;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "Tick at least one field to update" };
  }

  return { updates };
}

interface CustomerBulkUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  onSuccess: () => void;
}

/**
 * Admin dialog for applying truck type rates, fuel levy and tolls to several
 * customers at once. Only ticked fields are changed.
 */
export function CustomerBulkUpdateDialog({
  open,
  onOpenChange,
  customers,
  onSuccess,
}: CustomerBulkUpdateDialogProps) {
  const { toast } = useToast();
  const { data: defaultFuelLevy } = useDefaultFuelLevy();
  const [enabled, setEnabled] = useState<Set<BulkField>>(new Set());
  const [rates, setRates] = useState<Record<RateField, string>>(EMPTY_RATES);
  const [fuelLevy, setFuelLevy] = useState("");
  const [tolls, setTolls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasDefaultFuelLevy =
    defaultFuelLevy !== null && defaultFuelLevy !== undefined;

  const resetForm = () => {
    setEnabled(new Set());
    setRates(EMPTY_RATES);
    setFuelLevy("");
    setTolls(true);
    setError(null);
  };

  const handleOpenChange = ({ nextOpen }: { nextOpen: boolean }) => {
    if (isSaving) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const toggleField = ({
    field,
    checked,
  }: {
    field: BulkField;
    checked: boolean;
  }) => {
    setError(null);
    setEnabled((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(field);
      } else {
        next.delete(field);
      }
      return next;
    });
    if (field === "fuelLevy" && checked && fuelLevy === "" && hasDefaultFuelLevy) {
      setFuelLevy(defaultFuelLevy.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const built = buildUpdates({ enabled, rates, fuelLevy, tolls });
    if ("error" in built) {
      setError(built.error);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/customers/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: customers.map((c) => c.id),
          updates: built.updates,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update customers");
      }

      toast({
        title: "Customers updated",
        description: `Updated ${result.updatedCount} customer${result.updatedCount === 1 ? "" : "s"}`,
      });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error("Error bulk updating customers:", err);
      setError(err instanceof Error ? err.message : "Failed to update customers");
    } finally {
      setIsSaving(false);
    }
  };

  const count = customers.length;
  const isOverLimit = count > CUSTOMER_BULK_UPDATE_MAX;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => handleOpenChange({ nextOpen })}
    >
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Update Customers</DialogTitle>
          <DialogDescription>
            Tick the fields to apply to the {count} selected customer
            {count === 1 ? "" : "s"}. Unticked fields are left unchanged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Truck Rates ($)</legend>
            <div className="grid grid-cols-2 gap-3">
              {RATE_FIELDS.map(({ field, label }) => (
                <div key={field} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`bulk-${field}-enabled`}
                      checked={enabled.has(field)}
                      onCheckedChange={(checked) =>
                        toggleField({ field, checked: checked === true })
                      }
                      disabled={isSaving}
                      className="rounded-none"
                    />
                    <label
                      htmlFor={`bulk-${field}-enabled`}
                      className="text-sm"
                    >
                      {label}
                    </label>
                  </div>
                  <Input
                    id={`bulk-${field}-input`}
                    aria-label={`${label} rate`}
                    className="rounded"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Enter amount"
                    value={rates[field]}
                    onChange={(e) => {
                      setError(null);
                      setRates((prev) => ({ ...prev, [field]: e.target.value }));
                    }}
                    disabled={isSaving || !enabled.has(field)}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-fuel-levy-enabled"
                checked={enabled.has("fuelLevy")}
                onCheckedChange={(checked) =>
                  toggleField({ field: "fuelLevy", checked: checked === true })
                }
                disabled={isSaving}
                className="rounded-none"
              />
              <label
                htmlFor="bulk-fuel-levy-enabled"
                className="text-sm font-medium"
              >
                Fuel Levy
              </label>
            </div>
            <FuelLevySelect
              id="bulk-fuel-levy-select"
              value={fuelLevy}
              onChange={(value) => {
                setError(null);
                setFuelLevy(value);
              }}
              disabled={isSaving || !enabled.has("fuelLevy")}
            />
            {hasDefaultFuelLevy && (
              <p className="text-xs text-muted-foreground">
                Default fuel levy is {defaultFuelLevy}%
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-tolls-enabled"
                checked={enabled.has("tolls")}
                onCheckedChange={(checked) =>
                  toggleField({ field: "tolls", checked: checked === true })
                }
                disabled={isSaving}
                className="rounded-none"
              />
              <label
                htmlFor="bulk-tolls-enabled"
                className="text-sm font-medium"
              >
                Tolls
              </label>
            </div>
            <div className="flex items-center gap-2 pl-6">
              <Switch
                id="bulk-tolls-switch"
                checked={tolls}
                onCheckedChange={(checked) => setTolls(checked)}
                disabled={isSaving || !enabled.has("tolls")}
                aria-label="Include tolls"
              />
              <label htmlFor="bulk-tolls-switch" className="text-sm">
                {tolls ? "Include tolls" : "Exclude tolls"}
              </label>
            </div>
          </div>

          {isOverLimit && (
            <p className="text-sm text-destructive" role="alert">
              You can update up to {CUSTOMER_BULK_UPDATE_MAX} customers at a
              time. Deselect {count - CUSTOMER_BULK_UPDATE_MAX} and try again.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              id="bulk-update-cancel-btn"
              type="button"
              variant="outline"
              className="rounded"
              onClick={() => handleOpenChange({ nextOpen: false })}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              id="bulk-update-submit-btn"
              type="submit"
              className="rounded"
              disabled={isSaving || isOverLimit || enabled.size === 0}
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </div>
              ) : (
                `Update ${count} Customer${count === 1 ? "" : "s"}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
