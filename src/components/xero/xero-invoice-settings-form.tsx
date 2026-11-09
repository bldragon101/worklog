"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useXeroMutations, useXeroSettings } from "@/hooks/use-xero";
import { getErrorMessage } from "@/components/xero/xero-mapping-controls";
import { XeroOptionCombobox } from "@/components/xero/xero-option-combobox";
import { buildAllItemOptions } from "@/components/xero/xero-options";
import type { XeroItemOption, XeroSettingsView } from "@/lib/xero/types";

type ItemCodeField = "breakItemCode" | "eastlinkItemCode" | "citylinkItemCode" | "fuelLevyItemCode";

const ITEM_FIELDS: ReadonlyArray<{ field: ItemCodeField; label: string; help: string }> = [
  { field: "breakItemCode", label: "Break item", help: "Used for break deduction lines." },
  { field: "eastlinkItemCode", label: "Eastlink item", help: "Used for Eastlink toll lines." },
  { field: "citylinkItemCode", label: "CityLink item", help: "Used for CityLink toll lines." },
  {
    field: "fuelLevyItemCode",
    label: "Fallback fuel levy item",
    help: "Used when no Fuel Levy item matches the customer's percentage.",
  },
];

const FIELD_IDS: Record<ItemCodeField, string> = {
  breakItemCode: "xero-settings-break-item-select",
  eastlinkItemCode: "xero-settings-eastlink-item-select",
  citylinkItemCode: "xero-settings-citylink-item-select",
  fuelLevyItemCode: "xero-settings-fuel-levy-item-select",
};

interface SettingsFieldsProps {
  settings: XeroSettingsView;
  items: XeroItemOption[];
}

function SettingsFields({ settings, items }: SettingsFieldsProps) {
  const { toast } = useToast();
  const { saveSettings } = useXeroMutations();
  const [draft, setDraft] = useState<XeroSettingsView>(settings);
  const isSaving = saveSettings.isPending;
  const options = buildAllItemOptions({ items });

  const salesAccountCode = draft.salesAccountCode.trim();
  const taxType = draft.taxType.trim();
  const isValid = salesAccountCode !== "" && taxType !== "";
  const hasChanges = JSON.stringify({ ...draft, salesAccountCode, taxType }) !== JSON.stringify(settings);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid) return;
    try {
      await saveSettings.mutateAsync({ settings: { ...draft, salesAccountCode, taxType } });
      toast({ title: "Invoice settings saved", description: "Invoices now use the new Xero settings" });
    } catch (error) {
      toast({
        title: "Could not save the invoice settings",
        description: getErrorMessage({ error }),
        variant: "destructive",
      });
    }
  };

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(event)} aria-label="Xero invoice settings">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="xero-settings-sales-account-input">Sales account code</Label>
          <Input
            id="xero-settings-sales-account-input"
            value={draft.salesAccountCode}
            disabled={isSaving}
            aria-invalid={salesAccountCode === ""}
            onChange={(event) => setDraft({ ...draft, salesAccountCode: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">The revenue account invoice lines are posted to, e.g. 200.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="xero-settings-tax-type-input">Tax type</Label>
          <Input
            id="xero-settings-tax-type-input"
            value={draft.taxType}
            disabled={isSaving}
            aria-invalid={taxType === ""}
            onChange={(event) => setDraft({ ...draft, taxType: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">The Xero tax type for lines, e.g. OUTPUT for GST on income.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ITEM_FIELDS.map(({ field, label, help }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={FIELD_IDS[field]}>{label}</Label>
            <XeroOptionCombobox
              id={FIELD_IDS[field]}
              ariaLabel={label}
              value={draft[field]}
              options={options}
              placeholder="None"
              searchPlaceholder="Search items by code or name"
              noneLabel="None"
              disabled={isSaving}
              onSelect={({ value }) => setDraft({ ...draft, [field]: value })}
            />
            <p className="text-xs text-muted-foreground">{help}</p>
          </div>
        ))}
      </div>

      <Alert>
        <AlertDescription>
          A Xero item named <span className="font-medium">Fuel Levy N%</span> (for example Fuel Levy 12%) is used
          automatically when it matches the customer&apos;s fuel levy percentage. The fallback item is only used
          when there is no matching item.
        </AlertDescription>
      </Alert>

      {!isValid && (
        <p className="text-sm text-destructive" role="alert">
          Enter a sales account code and a tax type.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          id="xero-settings-reset-btn"
          type="button"
          variant="outline"
          disabled={isSaving || !hasChanges}
          onClick={() => setDraft(settings)}
        >
          Reset
        </Button>
        <Button id="xero-settings-save-btn" type="submit" disabled={isSaving || !isValid || !hasChanges}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Save settings
        </Button>
      </div>
    </form>
  );
}

/** Sales account, tax type and the items used for breaks, tolls and the fuel levy */
export function XeroInvoiceSettingsForm({ items }: { items: XeroItemOption[] }) {
  const { data: settings, isLoading, isError, error, refetch } = useXeroSettings();

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading invoice settings...
      </p>
    );
  }
  if (isError || !settings) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {getErrorMessage({ error })}
          <Button id="xero-settings-retry-btn" type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return <SettingsFields key={JSON.stringify(settings)} settings={settings} items={items} />;
}
