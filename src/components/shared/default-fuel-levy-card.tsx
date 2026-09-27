"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Fuel, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FuelLevySelect } from "@/components/shared/fuel-levy-select";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_FUEL_LEVY_QUERY_KEY,
  useDefaultFuelLevy,
} from "@/hooks/use-default-fuel-levy";
import { isFuelLevyInRange, parseFuelLevy } from "@/lib/utils/fuel-levy";

/**
 * Admin card for configuring the default fuel levy shown in the sidebar and
 * used to prefill new customers.
 */
export function DefaultFuelLevyCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: savedFuelLevy, isLoading } = useDefaultFuelLevy();
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const savedValue =
    savedFuelLevy === null || savedFuelLevy === undefined
      ? ""
      : savedFuelLevy.toString();
  const value = draft ?? savedValue;
  const hasChanges = draft !== null && draft !== savedValue;

  const saveFuelLevy = async ({ input }: { input: string }) => {
    const parsed = parseFuelLevy({ value: input });
    if (input !== "" && (parsed === null || !isFuelLevyInRange({ value: parsed }))) {
      toast({
        title: "Invalid fuel levy",
        description: "Enter a percentage between 0 and 100.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/fuel-levy-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultFuelLevy: parsed }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update default fuel levy");
      }

      queryClient.setQueryData(
        DEFAULT_FUEL_LEVY_QUERY_KEY,
        result.defaultFuelLevy,
      );
      setDraft(null);
      toast({
        title: "Setting Updated",
        description:
          result.defaultFuelLevy === null
            ? "Default fuel levy cleared"
            : `Default fuel levy set to ${result.defaultFuelLevy}%`,
      });
    } catch (error) {
      console.error("Error updating default fuel levy:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update default fuel levy",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Fuel className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <CardTitle>Fuel Levy</CardTitle>
        </div>
        <CardDescription>
          Set the current default fuel levy. It is shown in the sidebar for all
          users and prefilled when adding a new customer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 pr-4">
            <Label
              htmlFor="default-fuel-levy-select"
              className="text-base font-medium"
            >
              Default fuel levy
            </Label>
            <p className="text-sm text-muted-foreground">
              Changing this does not update existing customers.
            </p>
          </div>
          <div className="w-full space-y-2 sm:w-48">
            {isLoading ? (
              <div className="flex h-9 items-center">
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-label="Loading"
                />
              </div>
            ) : (
              <FuelLevySelect
                id="default-fuel-levy-select"
                value={value}
                onChange={(next) => setDraft(next)}
                disabled={isSaving}
              />
            )}
            <div className="flex gap-2">
              <Button
                id="save-default-fuel-levy-btn"
                type="button"
                size="sm"
                className="flex-1"
                onClick={() => saveFuelLevy({ input: value })}
                disabled={isSaving || isLoading || !hasChanges}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" />
                ) : (
                  "Save"
                )}
              </Button>
              {savedValue !== "" && (
                <Button
                  id="clear-default-fuel-levy-btn"
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => saveFuelLevy({ input: "" })}
                  disabled={isSaving || isLoading}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
