"use client";

import type { KeyboardEvent } from "react";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { getStatusBadge } from "@/components/shared/status-badge";
import { SentBadge } from "@/components/shared/sent-badge";
import { formatCurrency } from "@/lib/utils/currency";
import type { Rcti } from "@/lib/types";

export interface RctiListRowProps {
  rcti: Rcti;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: ({ rcti }: { rcti: Rcti }) => void;
  onToggleChecked: ({ rctiId }: { rctiId: number }) => void;
}

export function RctiListRow({
  rcti,
  isSelected,
  isChecked,
  onSelect,
  onToggleChecked,
}: RctiListRowProps) {
  const isPayable = rcti.status === "finalised";

  return (
    <div
      id={`rcti-row-${rcti.id}`}
      role="button"
      tabIndex={0}
      className={`flex items-center justify-between gap-3 p-3 bg-card border rounded-lg cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all ${
        isSelected ? "border-primary bg-accent" : ""
      }`}
      onClick={() => onSelect({ rcti })}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect({ rcti });
        }
      }}
    >
      {isPayable && (
        <Checkbox
          id={`select-rcti-${rcti.id}`}
          className="shrink-0"
          checked={isChecked}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={() => onToggleChecked({ rctiId: rcti.id })}
          aria-label={`Select ${rcti.invoiceNumber} for bulk payment`}
        />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{rcti.invoiceNumber}</span>
          {getStatusBadge({ status: rcti.status })}
          <SentBadge sentAt={rcti.sentAt} />
        </div>
        <p className="text-sm text-muted-foreground">
          {rcti.driverName} - Week ending{" "}
          {format(new Date(rcti.weekEnding), "MMM d, yyyy")}
        </p>
      </div>
      <div className="text-right">
        <p className="font-bold">{formatCurrency({ amount: rcti.total })}</p>
        <p className="text-sm text-muted-foreground">
          {rcti.lines?.length || 0} lines
        </p>
      </div>
    </div>
  );
}
