"use client";

import { useRef } from "react";
import { TableCell, TableRow } from "@/components/custom/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { InlineCellSelect } from "./inline-cell-select";
import { extractTimeFromISO } from "@/lib/utils/time-utils";
import type { Job } from "@/lib/types";

interface QuickEditRowProps {
  row: Partial<Job>;
  rowKey: string;
  isNew: boolean;
  isDeleted: boolean;
  cellErrors: Record<string, string>;
  onCellChange: (args: {
    rowKey: string;
    field: keyof Job;
    value: unknown;
  }) => void;
  onDeleteRow: (args: { rowKey: string }) => void;
  activeCell: string | null;
  onCellFocus: (args: { cellId: string }) => void;
  options: {
    customerOptions: string[];
    billToOptions: string[];
    registrationOptions: string[];
    truckTypeOptions: string[];
    driverOptions: string[];
    customerToBillTo: Record<string, string>;
    registrationToType: Record<string, string>;
    driverToTruck: Record<string, string>;
    selectsLoading: boolean;
  };
}

function formatDateForInput({
  dateStr,
}: {
  dateStr: string | undefined;
}): string {
  if (!dateStr) return "";
  if (dateStr.includes("T")) {
    return dateStr.split("T")[0];
  }
  return dateStr;
}

export function QuickEditRow({
  row,
  rowKey,
  isNew,
  isDeleted,
  cellErrors,
  onCellChange,
  onDeleteRow,
  activeCell,
  onCellFocus,
  options,
}: QuickEditRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);

  const getCellId = ({ field }: { field: string }) => `${rowKey}:${field}`;
  const hasError = ({ field }: { field: string }) =>
    !!cellErrors[getCellId({ field })];

  const cellClasses = ({ field }: { field: string }) =>
    cn(
      "border-b border-border/50 p-0.5",
      hasError({ field }) && "ring-2 ring-inset ring-destructive",
      isDeleted && "opacity-40 line-through pointer-events-none",
      activeCell === getCellId({ field }) && "ring-2 ring-inset ring-primary",
    );

  const handleCustomerChange = ({ value }: { value: string }) => {
    onCellChange({ rowKey, field: "customer", value });
    const billTo = options.customerToBillTo[value];
    if (billTo) {
      onCellChange({ rowKey, field: "billTo", value: billTo });
    }
  };

  const handleDriverChange = ({ value }: { value: string }) => {
    onCellChange({ rowKey, field: "driver", value });
    const truck = options.driverToTruck[value];
    if (truck) {
      onCellChange({ rowKey, field: "registration", value: truck });
      const truckType = options.registrationToType[truck];
      if (truckType) {
        onCellChange({ rowKey, field: "truckType", value: truckType });
      }
    }
  };

  const handleRegistrationChange = ({ value }: { value: string }) => {
    onCellChange({ rowKey, field: "registration", value });
    const truckType = options.registrationToType[value];
    if (truckType) {
      onCellChange({ rowKey, field: "truckType", value: truckType });
    }
  };

  const startTimeDisplay = row.startTime
    ? extractTimeFromISO(row.startTime)
    : "";
  const finishTimeDisplay = row.finishTime
    ? extractTimeFromISO(row.finishTime)
    : "";

  const handleTimeChange = ({
    field,
    timeValue,
  }: {
    field: "startTime" | "finishTime";
    timeValue: string;
  }) => {
    const dateStr =
      formatDateForInput({ dateStr: row.date }) ||
      new Date().toISOString().split("T")[0];
    const isoVal = timeValue ? `${dateStr}T${timeValue}:00.000Z` : null;
    onCellChange({ rowKey, field, value: isoVal });

    const startVal = field === "startTime" ? timeValue : startTimeDisplay;
    const finishVal = field === "finishTime" ? timeValue : finishTimeDisplay;

    if (startVal && finishVal) {
      const start = new Date(`1970-01-01T${startVal.padStart(5, "0")}:00`);
      const finish = new Date(`1970-01-01T${finishVal.padStart(5, "0")}:00`);

      if (finish < start) {
        finish.setDate(finish.getDate() + 1);
      }

      const diffMs = finish.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours > 0) {
        onCellChange({
          rowKey,
          field: "chargedHours",
          value: Math.round(diffHours * 100) / 100,
        });
      }
    }
  };

  return (
    <TableRow
      ref={rowRef}
      className={cn(
        isNew && "bg-primary/5",
        isDeleted && "bg-destructive/5",
      )}
    >
      {/* Date */}
      <TableCell className={cellClasses({ field: "date" })}>
        <Input
          id={getCellId({ field: "date" })}
          type="date"
          value={formatDateForInput({ dateStr: row.date })}
          onChange={(e) =>
            onCellChange({ rowKey, field: "date", value: e.target.value })
          }
          onFocus={() => onCellFocus({ cellId: getCellId({ field: "date" }) })}
          className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-0 rounded-none px-1"
        />
      </TableCell>

      {/* Driver */}
      <TableCell className={cellClasses({ field: "driver" })}>
        <InlineCellSelect
          id={getCellId({ field: "driver" })}
          value={row.driver || ""}
          options={options.driverOptions}
          onChange={(v) => handleDriverChange({ value: v })}
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "driver" }) })
          }
          loading={options.selectsLoading}
        />
      </TableCell>

      {/* Customer */}
      <TableCell className={cellClasses({ field: "customer" })}>
        <InlineCellSelect
          id={getCellId({ field: "customer" })}
          value={row.customer || ""}
          options={options.customerOptions}
          onChange={(v) => handleCustomerChange({ value: v })}
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "customer" }) })
          }
          loading={options.selectsLoading}
        />
      </TableCell>

      {/* Bill To */}
      <TableCell className={cellClasses({ field: "billTo" })}>
        <InlineCellSelect
          id={getCellId({ field: "billTo" })}
          value={row.billTo || ""}
          options={options.billToOptions}
          onChange={(v) => onCellChange({ rowKey, field: "billTo", value: v })}
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "billTo" }) })
          }
          loading={options.selectsLoading}
        />
      </TableCell>

      {/* Registration */}
      <TableCell className={cellClasses({ field: "registration" })}>
        <InlineCellSelect
          id={getCellId({ field: "registration" })}
          value={row.registration || ""}
          options={options.registrationOptions}
          onChange={(v) => handleRegistrationChange({ value: v })}
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "registration" }) })
          }
          loading={options.selectsLoading}
        />
      </TableCell>

      {/* Truck Type */}
      <TableCell className={cellClasses({ field: "truckType" })}>
        <InlineCellSelect
          id={getCellId({ field: "truckType" })}
          value={row.truckType || ""}
          options={options.truckTypeOptions}
          onChange={(v) =>
            onCellChange({ rowKey, field: "truckType", value: v })
          }
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "truckType" }) })
          }
          loading={options.selectsLoading}
        />
      </TableCell>

      {/* Pickup */}
      <TableCell className={cellClasses({ field: "pickup" })}>
        <Input
          id={getCellId({ field: "pickup" })}
          value={row.pickup || ""}
          onChange={(e) =>
            onCellChange({ rowKey, field: "pickup", value: e.target.value })
          }
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "pickup" }) })
          }
          className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-0 rounded-none px-1"
          placeholder="Pickup"
        />
      </TableCell>

      {/* Dropoff */}
      <TableCell className={cellClasses({ field: "dropoff" })}>
        <Input
          id={getCellId({ field: "dropoff" })}
          value={row.dropoff || ""}
          onChange={(e) =>
            onCellChange({ rowKey, field: "dropoff", value: e.target.value })
          }
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "dropoff" }) })
          }
          className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-0 rounded-none px-1"
          placeholder="Dropoff"
        />
      </TableCell>

      {/* Status (runsheet + invoiced) */}
      <TableCell className={cn("border-b border-border/50 p-1")}>
        <div className="flex flex-col gap-0.5">
          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
            <Checkbox
              id={getCellId({ field: "runsheet" })}
              checked={row.runsheet === true}
              onCheckedChange={(checked) =>
                onCellChange({
                  rowKey,
                  field: "runsheet",
                  value: checked === true,
                })
              }
              className="h-3 w-3"
            />
            R
          </label>
          <label className="flex items-center gap-1 text-[10px] cursor-pointer">
            <Checkbox
              id={getCellId({ field: "invoiced" })}
              checked={row.invoiced === true}
              onCheckedChange={(checked) =>
                onCellChange({
                  rowKey,
                  field: "invoiced",
                  value: checked === true,
                })
              }
              className="h-3 w-3"
            />
            I
          </label>
        </div>
      </TableCell>

      {/* Start Time */}
      <TableCell className={cellClasses({ field: "startTime" })}>
        <Input
          id={getCellId({ field: "startTime" })}
          type="time"
          step="900"
          value={startTimeDisplay}
          onChange={(e) =>
            handleTimeChange({ field: "startTime", timeValue: e.target.value })
          }
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "startTime" }) })
          }
          className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-0 rounded-none px-1"
        />
      </TableCell>

      {/* Finish Time */}
      <TableCell className={cellClasses({ field: "finishTime" })}>
        <Input
          id={getCellId({ field: "finishTime" })}
          type="time"
          step="900"
          value={finishTimeDisplay}
          onChange={(e) =>
            handleTimeChange({ field: "finishTime", timeValue: e.target.value })
          }
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "finishTime" }) })
          }
          className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-0 rounded-none px-1"
        />
      </TableCell>

      {/* Charged Hours */}
      <TableCell className={cellClasses({ field: "chargedHours" })}>
        <Input
          id={getCellId({ field: "chargedHours" })}
          type="number"
          step="0.25"
          value={row.chargedHours ?? ""}
          onChange={(e) =>
            onCellChange({
              rowKey,
              field: "chargedHours",
              value: e.target.value === "" ? null : parseFloat(e.target.value),
            })
          }
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "chargedHours" }) })
          }
          className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-0 rounded-none px-1 text-right"
        />
      </TableCell>

      {/* Eastlink */}
      <TableCell className={cellClasses({ field: "eastlink" })}>
        <Input
          id={getCellId({ field: "eastlink" })}
          type="number"
          min="0"
          max="10"
          step="1"
          value={row.eastlink ?? ""}
          onChange={(e) =>
            onCellChange({
              rowKey,
              field: "eastlink",
              value:
                e.target.value === "" ? null : parseInt(e.target.value, 10),
            })
          }
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "eastlink" }) })
          }
          className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-0 rounded-none px-1 text-right"
        />
      </TableCell>

      {/* Citylink */}
      <TableCell className={cellClasses({ field: "citylink" })}>
        <Input
          id={getCellId({ field: "citylink" })}
          type="number"
          min="0"
          max="10"
          step="1"
          value={row.citylink ?? ""}
          onChange={(e) =>
            onCellChange({
              rowKey,
              field: "citylink",
              value:
                e.target.value === "" ? null : parseInt(e.target.value, 10),
            })
          }
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "citylink" }) })
          }
          className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-0 rounded-none px-1 text-right"
        />
      </TableCell>

      {/* Comments */}
      <TableCell className={cellClasses({ field: "comments" })}>
        <Input
          id={getCellId({ field: "comments" })}
          value={row.comments || ""}
          onChange={(e) =>
            onCellChange({ rowKey, field: "comments", value: e.target.value })
          }
          onFocus={() =>
            onCellFocus({ cellId: getCellId({ field: "comments" }) })
          }
          className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-0 rounded-none px-1"
          placeholder="Comments"
        />
      </TableCell>

      {/* Delete action */}
      <TableCell className="border-b border-border/50 p-0.5 w-8">
        <Button
          id={`quick-edit-delete-${rowKey}`}
          variant="ghost"
          size="sm"
          type="button"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDeleteRow({ rowKey })}
          onKeyUp={(e) => {
            if (e.key === "Enter") onDeleteRow({ rowKey });
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
