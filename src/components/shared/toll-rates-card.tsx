"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Route } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  TOLL_RATES_QUERY_KEY,
  type TollRateSettings,
  useTollRateSettings,
} from "@/hooks/use-toll-rates";
import { tollRateValueSchema } from "@/lib/validation";

type TollRoad = "eastlink" | "citylink";

const TOLL_ROADS: ReadonlyArray<{ road: TollRoad; label: string }> = [
  { road: "eastlink", label: "Eastlink" },
  { road: "citylink", label: "CityLink" },
];

function formatRate({ value }: { value: number | undefined }): string {
  return value === undefined ? "" : value.toFixed(2);
}

/**
 * Parses a toll rate input, returning null when it is empty, not a number,
 * negative, too large or has more than two decimal places.
 */
function parseTollRate({ value }: { value: string }): number | null {
  if (value.trim() === "") return null;
  const result = tollRateValueSchema.safeParse(Number(value));
  return result.success ? result.data : null;
}

/**
 * Admin card for the Eastlink and CityLink rates per crossing, used for
 * customer invoices, RCTIs and the jobs stats.
 */
export function TollRatesCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useTollRateSettings();
  const canSave = settings?.companySettingsConfigured ?? false;
  const [drafts, setDrafts] = useState<Partial<Record<TollRoad, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const savedValues: Record<TollRoad, string> = {
    eastlink: formatRate({ value: settings?.eastlink }),
    citylink: formatRate({ value: settings?.citylink }),
  };
  const values: Record<TollRoad, string> = {
    eastlink: drafts.eastlink ?? savedValues.eastlink,
    citylink: drafts.citylink ?? savedValues.citylink,
  };
  const hasChanges = TOLL_ROADS.some(
    ({ road }) => parseTollRate({ value: values[road] }) !== settings?.[road],
  );

  const saveTollRates = async () => {
    const eastlink = parseTollRate({ value: values.eastlink });
    const citylink = parseTollRate({ value: values.citylink });
    if (eastlink === null || citylink === null) {
      toast({
        title: "Invalid toll rate",
        description: "Enter a dollar amount with up to two decimal places.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/toll-rate-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eastlink, citylink }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update toll rates");
      }

      queryClient.setQueryData<TollRateSettings>(TOLL_RATES_QUERY_KEY, result);
      setDrafts({});
      toast({
        title: "Setting Updated",
        description: `Toll rates set to $${result.eastlink.toFixed(2)} (Eastlink) and $${result.citylink.toFixed(2)} (CityLink)`,
      });
    } catch (error) {
      console.error("Error updating toll rates:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update toll rates",
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
          <Route className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <CardTitle>Toll Rates</CardTitle>
        </div>
        <CardDescription>
          The amount per crossing, charged to customers and paid on RCTIs.
          Also used for the toll totals in the jobs stats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 pr-4">
            <p className="text-base font-medium">Rate per crossing</p>
            <p className="text-sm text-muted-foreground">
              New and refreshed draft RCTIs use these rates. Finalised RCTIs
              keep their amounts.
            </p>
          </div>
          <div className="w-full space-y-3 sm:w-48">
            {isLoading ? (
              <div className="flex h-9 items-center">
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-label="Loading"
                />
              </div>
            ) : (
              TOLL_ROADS.map(({ road, label }) => (
                <div key={road} className="space-y-1">
                  <Label htmlFor={`toll-rate-${road}-input`}>{label} ($)</Label>
                  <Input
                    id={`toll-rate-${road}-input`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={values[road]}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [road]: event.target.value }))
                    }
                    disabled={isSaving || !canSave}
                  />
                </div>
              ))
            )}
            <Button
              id="save-toll-rates-btn"
              type="button"
              size="sm"
              className="w-full"
              onClick={saveTollRates}
              disabled={isSaving || isLoading || !canSave || !hasChanges}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
        {!isLoading && !canSave && (
          <p
            id="toll-rates-prerequisite"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
          >
            Save your company details in{" "}
            <Link
              id="toll-rates-company-settings-link"
              href="/settings/company"
              className="font-medium underline underline-offset-2"
            >
              Company Settings
            </Link>{" "}
            before setting toll rates.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
