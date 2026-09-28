"use client";

import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import {
  calculateLineAmounts,
  getLineDriverHoursBreakdown,
  getTotalDriverHours,
  isNonTimeRctiLine,
} from "@/lib/utils/rcti-calculations";
import { formatCurrency } from "@/lib/utils/currency";
import type {
  RctiLineEditField,
  RctiLineEdits,
} from "@/lib/utils/rcti-live-totals";
import type { Rcti, RctiLine } from "@/lib/types";

export interface RctiLineRowProps {
  rcti: Rcti;
  line: RctiLine;
  edits: RctiLineEdits | undefined;
  deletingLineId: number | null;
  onLineEdit: ({
    lineId,
    field,
    value,
  }: {
    lineId: number;
    field: RctiLineEditField;
    value: number | string;
  }) => void;
  onRemoveLine: ({ lineId }: { lineId: number }) => void;
}

export function RctiLineRow({
  rcti,
  line,
  edits,
  deletingLineId,
  onLineEdit,
  onRemoveLine,
}: RctiLineRowProps) {
  // Show skeleton for line being deleted
  if (deletingLineId === line.id) {
    return (
      <tr className="border-b">
        <td colSpan={rcti.status === "draft" ? 11 : 10} className="p-2">
          <LoadingSkeleton count={1} variant="list" />
        </td>
      </tr>
    );
  }

  const isNonTimeLine = isNonTimeRctiLine({
    customer: line.customer,
  });
  const hours =
    edits?.chargedHours !== undefined
      ? edits.chargedHours
      : Number(line.chargedHours);
  const numericHours =
    typeof hours === "string" ? parseFloat(hours) || 0 : hours;
  const numericTravelHours = Number(line.travelTimeHours ?? 0);
  const hoursChanged = edits?.chargedHours !== undefined;
  const storedBreakdown = getLineDriverHoursBreakdown({
    chargedHours: Number(line.chargedHours),
    travelTimeHours: line.travelTimeHours ?? null,
    driverCharge: line.driverCharge ?? null,
  });
  // Editing the hours keeps the deduction the line carries.
  const totalDriverHours = hoursChanged
    ? getTotalDriverHours({
        chargedHours: numericHours,
        travelTimeHours: numericTravelHours,
        driverCharge: null,
        hoursAdjustment: storedBreakdown.adjustmentFromBase,
      })
    : storedBreakdown.totalDriverHours;
  // Driver hours below job plus travel hours are a deduction folded into
  // this line's amount.
  const driverHoursDeduction = Math.max(
    0,
    numericHours + numericTravelHours - totalDriverHours,
  );
  const driverHoursAddition = Math.max(
    0,
    totalDriverHours - numericHours - numericTravelHours,
  );
  const rate =
    edits?.ratePerHour !== undefined
      ? edits.ratePerHour
      : Number(line.ratePerHour);
  const jobDate =
    edits?.jobDate ?? format(new Date(line.jobDate), "yyyy-MM-dd");
  const customer = edits?.customer ?? line.customer;
  const truckType = edits?.truckType ?? line.truckType;
  const description = edits?.description ?? line.description ?? "";

  // Calculate amounts live if hours or rate have been edited
  const amounts =
    hoursChanged || edits?.ratePerHour !== undefined
      ? calculateLineAmounts({
          chargedHours: totalDriverHours,
          ratePerHour:
            typeof rate === "string" ? parseFloat(rate) || 0 : rate,
          gstStatus: rcti.gstStatus as "registered" | "not_registered",
          gstMode: rcti.gstMode as "exclusive" | "inclusive",
        })
      : {
          amountExGst: Number(line.amountExGst),
          gstAmount: Number(line.gstAmount),
          amountIncGst: Number(line.amountIncGst),
        };

  return (
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="p-2 text-sm w-32">
        {rcti.status === "draft" ? (
          <Input
            type="date"
            value={jobDate}
            onChange={(e) =>
              onLineEdit({
                lineId: line.id,
                field: "jobDate",
                value: e.target.value,
              })
            }
            className="w-full"
          />
        ) : (
          format(new Date(line.jobDate), "MMM d")
        )}
      </td>
      <td className="p-2 text-sm">
        {rcti.status === "draft" ? (
          <Input
            type="text"
            value={customer}
            onChange={(e) =>
              onLineEdit({
                lineId: line.id,
                field: "customer",
                value: e.target.value,
              })
            }
            className="w-full"
          />
        ) : (
          line.customer
        )}
      </td>
      <td className="p-2 text-sm w-28">
        {rcti.status === "draft" ? (
          <Input
            type="text"
            value={truckType}
            onChange={(e) =>
              onLineEdit({
                lineId: line.id,
                field: "truckType",
                value: e.target.value,
              })
            }
            className="w-full"
          />
        ) : (
          line.truckType
        )}
      </td>
      <td className="p-2 text-sm">
        {rcti.status === "draft" ? (
          <Input
            type="text"
            value={description}
            onChange={(e) =>
              onLineEdit({
                lineId: line.id,
                field: "description",
                value: e.target.value,
              })
            }
            className="w-full"
          />
        ) : (
          line.description
        )}
      </td>
      <td className="p-2 text-right text-sm w-24">
        {isNonTimeLine ? (
          "—"
        ) : rcti.status === "draft" ? (
          <Input
            id={`rcti-line-${line.id}-hours`}
            aria-label="Hours"
            type="number"
            step="0.25"
            value={hours}
            onChange={(e) =>
              onLineEdit({
                lineId: line.id,
                field: "chargedHours",
                value: e.target.value,
              })
            }
            className="w-full text-right"
          />
        ) : typeof hours === "number" ? (
          hours.toFixed(2)
        ) : (
          hours
        )}
      </td>
      <td className="p-2 text-right text-sm w-28">
        {isNonTimeLine ? (
          "—"
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span>{totalDriverHours.toFixed(2)}</span>
            {numericTravelHours > 0.001 ? (
              <span
                title={`${numericTravelHours.toFixed(2)} travel hours added to ${numericHours.toFixed(2)} job hours`}
                className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] leading-none text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              >
                +{numericTravelHours.toFixed(2)} travel
              </span>
            ) : null}
            {driverHoursAddition > 0.001 ? (
              <span
                title={`${driverHoursAddition.toFixed(2)} extra hours paid to the driver on top of ${(numericHours + numericTravelHours).toFixed(2)} job plus travel hours`}
                className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] leading-none text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              >
                +{driverHoursAddition.toFixed(2)} driver
              </span>
            ) : null}
            {driverHoursDeduction > 0.001 ? (
              <span
                title={`${driverHoursDeduction.toFixed(2)} hours deducted from ${(numericHours + numericTravelHours).toFixed(2)} job plus travel hours`}
                className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] leading-none text-red-700 dark:bg-red-950/50 dark:text-red-300"
              >
                -{driverHoursDeduction.toFixed(2)} deduction
              </span>
            ) : null}
          </div>
        )}
      </td>
      <td className="p-2 text-right text-sm w-28">
        {rcti.status === "draft" ? (
          <Input
            id={`rcti-line-${line.id}-rate`}
            aria-label="Rate"
            type="number"
            step="0.25"
            value={rate}
            onChange={(e) =>
              onLineEdit({
                lineId: line.id,
                field: "ratePerHour",
                value: e.target.value,
              })
            }
            className="w-full text-right"
          />
        ) : (
          formatCurrency({ amount: rate })
        )}
      </td>
      <td className="p-2 text-right text-sm font-medium w-28">
        {formatCurrency({ amount: amounts.amountExGst })}
      </td>
      <td className="p-2 text-right text-sm w-24">
        {formatCurrency({ amount: amounts.gstAmount })}
      </td>
      <td className="p-2 text-right text-sm font-medium w-28">
        {formatCurrency({ amount: amounts.amountIncGst })}
      </td>
      {rcti.status === "draft" && (
        <td className="p-2 w-16">
          <Button
            type="button"
            id={`remove-rcti-line-${line.id}`}
            aria-label="Remove line"
            title="Remove line"
            variant="ghost"
            size="icon"
            onClick={() => onRemoveLine({ lineId: line.id })}
            disabled={deletingLineId !== null}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </td>
      )}
    </tr>
  );
}
