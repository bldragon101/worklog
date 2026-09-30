"use client";

import type { Dispatch, SetStateAction } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RctiManualLineData } from "@/hooks/use-rcti-lines";

export interface RctiManualLineRowProps {
  manualLineData: RctiManualLineData;
  setManualLineData: Dispatch<SetStateAction<RctiManualLineData>>;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function RctiManualLineRow({
  manualLineData,
  setManualLineData,
  onSave,
  onCancel,
  isSaving,
}: RctiManualLineRowProps) {
  return (
    <tr className="border-b bg-accent/50">
      <td className="p-2 w-32">
        <Input
          type="date"
          value={manualLineData.jobDate}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              jobDate: e.target.value,
            })
          }
          className="w-full"
          id="manual-line-date"
        />
      </td>
      <td className="p-2">
        <Input
          type="text"
          placeholder="Customer"
          value={manualLineData.customer}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              customer: e.target.value,
            })
          }
          className="w-full"
          id="manual-line-customer"
        />
      </td>
      <td className="p-2 w-28">
        <Input
          type="text"
          placeholder="Truck Type"
          value={manualLineData.truckType}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              truckType: e.target.value,
            })
          }
          className="w-full"
          id="manual-line-truck-type"
        />
      </td>
      <td className="p-2">
        <Input
          type="text"
          placeholder="Description"
          value={manualLineData.description}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              description: e.target.value,
            })
          }
          className="w-full"
          id="manual-line-description"
        />
      </td>
      <td className="p-2 w-24">
        <Input
          type="number"
          step="0.25"
          placeholder="Hours"
          value={manualLineData.chargedHours}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              chargedHours: e.target.value,
            })
          }
          className="w-full text-right"
          id="manual-line-hours"
        />
      </td>
      <td className="p-2 text-right text-sm">
        {(parseFloat(manualLineData.chargedHours) || 0).toFixed(2)}
      </td>
      <td className="p-2 w-28">
        <Input
          type="number"
          step="0.25"
          placeholder="Rate"
          value={manualLineData.ratePerHour}
          onChange={(e) =>
            setManualLineData({
              ...manualLineData,
              ratePerHour: e.target.value,
            })
          }
          className="w-full text-right"
          id="manual-line-rate"
        />
      </td>
      <td className="p-2 text-right text-sm text-muted-foreground">-</td>
      <td className="p-2 text-right text-sm text-muted-foreground">-</td>
      <td className="p-2 text-right text-sm text-muted-foreground">-</td>
      <td className="p-2">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onSave()}
            disabled={isSaving}
            id="save-manual-line-btn"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onCancel()}
            disabled={isSaving}
            id="cancel-manual-line-btn"
          >
            ×
          </Button>
        </div>
      </td>
    </tr>
  );
}
