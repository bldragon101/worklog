"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/custom/table";
import { Button } from "@/components/ui/button";
import { Plus, Save, Undo2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { QuickEditRow } from "./quick-edit-row";
import { useJobFormOptions } from "@/hooks/use-job-form-options";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@/lib/types";

interface QuickEditTableProps {
  jobs: Job[];
  onBatchSaveComplete: () => void;
  onHasChanges?: (hasChanges: boolean) => void;
}

interface PendingCreate {
  tempId: string;
  data: Partial<Job>;
}

function generateTempId(): string {
  return `new:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const REQUIRED_FIELDS: (keyof Job)[] = [
  "date",
  "driver",
  "customer",
  "billTo",
  "truckType",
  "registration",
  "pickup",
];

const COLUMN_HEADERS = [
  { label: "Date", width: "w-[100px]" },
  { label: "Driver", width: "w-[100px]" },
  { label: "Customer", width: "w-[100px]" },
  { label: "Bill To", width: "w-[90px]" },
  { label: "Reg", width: "w-[80px]" },
  { label: "Truck", width: "w-[80px]" },
  { label: "Pickup", width: "w-[90px]" },
  { label: "Dropoff", width: "w-[90px]" },
  { label: "Status", width: "w-[55px]" },
  { label: "Start", width: "w-[80px]" },
  { label: "Finish", width: "w-[80px]" },
  { label: "Hours", width: "w-[65px]" },
  { label: "Eastlink", width: "w-[65px]" },
  { label: "Citylink", width: "w-[65px]" },
  { label: "Comments", width: "w-[100px]" },
  { label: "", width: "w-[32px]" },
];

export function QuickEditTable({
  jobs,
  onBatchSaveComplete,
  onHasChanges,
}: QuickEditTableProps) {
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  const [pendingCreates, setPendingCreates] = useState<PendingCreate[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<
    Record<number, Partial<Job>>
  >({});
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set());
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [activeCell, setActiveCell] = useState<string | null>(null);

  const {
    customerOptions,
    billToOptions,
    registrationOptions,
    truckTypeOptions,
    driverOptions,
    selectsLoading,
    customerToBillTo,
    registrationToType,
    driverToTruck,
  } = useJobFormOptions(true);

  const selectOptions = {
    customerOptions,
    billToOptions,
    registrationOptions,
    truckTypeOptions,
    driverOptions,
    selectsLoading,
    customerToBillTo,
    registrationToType,
    driverToTruck,
  };

  const hasUnsavedChanges = useMemo(() => {
    return (
      pendingCreates.length > 0 ||
      Object.keys(pendingUpdates).length > 0 ||
      pendingDeletes.size > 0
    );
  }, [pendingCreates.length, pendingUpdates, pendingDeletes.size]);

  useEffect(() => {
    onHasChanges?.(hasUnsavedChanges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges]);

  const changeCount = useMemo(() => {
    return (
      pendingCreates.length +
      Object.keys(pendingUpdates).length +
      pendingDeletes.size
    );
  }, [pendingCreates.length, pendingUpdates, pendingDeletes.size]);

  const handleCellChange = ({
    rowKey,
    field,
    value,
  }: {
    rowKey: string;
    field: keyof Job;
    value: unknown;
  }) => {
    setCellErrors((prev) => {
      const key = `${rowKey}:${field as string}`;
      if (prev[key]) {
        const next = { ...prev };
        next[key] = "";
        return next;
      }
      return prev;
    });

    if (rowKey.startsWith("new:")) {
      setPendingCreates((prev) =>
        prev.map((item) =>
          item.tempId === rowKey
            ? { ...item, data: { ...item.data, [field]: value } }
            : item,
        ),
      );
      return;
    }

    const id = Number(rowKey);
    setPendingUpdates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const handleDeleteRow = ({ rowKey }: { rowKey: string }) => {
    if (rowKey.startsWith("new:")) {
      setPendingCreates((prev) =>
        prev.filter((item) => item.tempId !== rowKey),
      );
      return;
    }

    const id = Number(rowKey);
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddRow = () => {
    const tempId = generateTempId();
    setPendingCreates((prev) => [...prev, { tempId, data: {} }]);
  };

  const handleCellFocus = ({ cellId }: { cellId: string }) => {
    setActiveCell(cellId);
  };

  const validatePending = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    for (const item of pendingCreates) {
      for (const field of REQUIRED_FIELDS) {
        const val = item.data[field];
        if (!val || (typeof val === "string" && val.trim() === "")) {
          errors[`${item.tempId}:${field}`] = "Required";
          isValid = false;
        }
      }
    }

    for (const [idStr, data] of Object.entries(pendingUpdates)) {
      const id = Number(idStr);
      const originalJob = jobs.find((j) => j.id === id);
      if (!originalJob) continue;

      for (const field of REQUIRED_FIELDS) {
        if (field in data) {
          const val = data[field as keyof typeof data];
          if (!val || (typeof val === "string" && val.trim() === "")) {
            errors[`${idStr}:${field}`] = "Required";
            isValid = false;
          }
        }
      }
    }

    setCellErrors(errors);
    return isValid;
  };

  const handleBatchSave = async () => {
    if (!validatePending()) {
      toast({
        title: "Validation required",
        description: "Please fix the highlighted fields before saving",
        variant: "destructive",
      });
      return;
    }

    setIsBatchSaving(true);
    try {
      const response = await fetch("/api/jobs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creates: pendingCreates.map((item) => item.data),
          updates: Object.entries(pendingUpdates).map(([id, data]) => ({
            id: Number(id),
            data,
          })),
          deletes: Array.from(pendingDeletes),
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Batch save failed");
      }

      setPendingCreates([]);
      setPendingUpdates({});
      setPendingDeletes(new Set());
      setCellErrors({});
      onBatchSaveComplete();

      toast({
        title: "Changes saved",
        description: `Created: ${payload.createdCount}, Updated: ${payload.updatedCount}, Deleted: ${payload.deletedCount}`,
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsBatchSaving(false);
    }
  };

  const handleDiscard = () => {
    setPendingCreates([]);
    setPendingUpdates({});
    setPendingDeletes(new Set());
    setCellErrors({});
    setActiveCell(null);
  };

  const getEditedRow = ({ job }: { job: Job }): Partial<Job> => {
    const updates = pendingUpdates[job.id];
    if (!updates) return job;
    return { ...job, ...updates };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeCell) return;

    const allCellIds: string[] = [];
    for (const job of jobs) {
      if (pendingDeletes.has(job.id)) continue;
      for (const col of COLUMN_HEADERS) {
        if (col.label) {
          const field = col.label.toLowerCase().replace(/ /g, "");
          allCellIds.push(`${job.id}:${field}`);
        }
      }
    }
    for (const item of pendingCreates) {
      for (const col of COLUMN_HEADERS) {
        if (col.label) {
          const field = col.label.toLowerCase().replace(/ /g, "");
          allCellIds.push(`${item.tempId}:${field}`);
        }
      }
    }

    const currentIndex = allCellIds.indexOf(activeCell);
    if (currentIndex === -1) return;

    const colCount = COLUMN_HEADERS.filter((h) => h.label).length;

    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const nextIndex = currentIndex + 1;
      if (nextIndex < allCellIds.length) {
        setActiveCell(allCellIds[nextIndex]);
        const el = document.getElementById(allCellIds[nextIndex]);
        el?.focus();
      }
    }

    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        setActiveCell(allCellIds[prevIndex]);
        const el = document.getElementById(allCellIds[prevIndex]);
        el?.focus();
      }
    }

    if (e.key === "Enter") {
      const nextIndex = currentIndex + colCount;
      if (nextIndex < allCellIds.length) {
        setActiveCell(allCellIds[nextIndex]);
        const el = document.getElementById(allCellIds[nextIndex]);
        el?.focus();
      }
    }

    if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      const nextIndex = currentIndex + colCount;
      if (nextIndex < allCellIds.length) {
        setActiveCell(allCellIds[nextIndex]);
        const el = document.getElementById(allCellIds[nextIndex]);
        el?.focus();
      }
    }

    if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      const prevIndex = currentIndex - colCount;
      if (prevIndex >= 0) {
        setActiveCell(allCellIds[prevIndex]);
        const el = document.getElementById(allCellIds[prevIndex]);
        el?.focus();
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Floating save/discard bar */}
      {hasUnsavedChanges && (
        <div className="sticky top-0 z-30 flex items-center justify-between bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm px-4 py-2">
          <span className="text-sm font-medium text-foreground">
            {changeCount} unsaved change{changeCount === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              id="quick-edit-discard-btn"
              variant="outline"
              size="sm"
              type="button"
              onClick={handleDiscard}
              disabled={isBatchSaving}
              className="h-7"
            >
              <Undo2 className="mr-1 h-3 w-3" />
              Discard
            </Button>
            <Button
              id="quick-edit-save-btn"
              size="sm"
              type="button"
              onClick={handleBatchSave}
              disabled={isBatchSaving}
              className="h-7"
            >
              {isBatchSaving ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-1 h-3 w-3" />
              )}
              Save All
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        ref={tableRef}
        className="flex-1 overflow-auto"
        onKeyDown={handleKeyDown}
      >
        <Table className="">
          <TableHeader className="sticky top-0 z-20 bg-background/80 backdrop-blur-md">
            <TableRow className="bg-transparent hover:bg-muted/20 ">
              {COLUMN_HEADERS.map((col, i) => (
                <TableHead
                  key={i}
                  className={cn(
                    "border-b border-border/50 text-xs font-medium select-none",
                    col.width,
                  )}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <QuickEditRow
                key={job.id}
                row={getEditedRow({ job })}
                rowKey={String(job.id)}
                isNew={false}
                isDeleted={pendingDeletes.has(job.id)}
                cellErrors={cellErrors}
                onCellChange={handleCellChange}
                onDeleteRow={handleDeleteRow}
                activeCell={activeCell}
                onCellFocus={handleCellFocus}
                options={selectOptions}
              />
            ))}
            {pendingCreates.map((item) => (
              <QuickEditRow
                key={item.tempId}
                row={item.data}
                rowKey={item.tempId}
                isNew={true}
                isDeleted={false}
                cellErrors={cellErrors}
                onCellChange={handleCellChange}
                onDeleteRow={handleDeleteRow}
                activeCell={activeCell}
                onCellFocus={handleCellFocus}
                options={selectOptions}
              />
            ))}
            {/* Add row button */}
            <TableRow>
              <TableCell
                colSpan={COLUMN_HEADERS.length}
                className="border-b border-border/50 p-1"
              >
                <Button
                  id="quick-edit-add-row-btn"
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="h-7 w-full text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleAddRow}
                  onKeyUp={(e) => {
                    if (e.key === "Enter") handleAddRow();
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Row
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
