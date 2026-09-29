"use client";

import { CheckCircle, Download, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { DriverFilterPopover } from "@/components/shared/driver-filter-popover";
import { StatusFilterPopover } from "@/components/shared/status-filter-popover";
import type { Driver, Rcti } from "@/lib/types";
import { getDownloadableRctis } from "@/lib/utils/rcti-downloads";

export interface RctiFiltersBarProps {
  contractorDrivers: Driver[];
  subcontractorDrivers: Driver[];
  selectedDriverIds: string[];
  onToggleDriver: ({ driverId }: { driverId: string }) => void;
  onSelectAllDrivers: () => void;
  onClearDrivers: () => void;
  statusFilter: string;
  onStatusChange: ({ status }: { status: string }) => void;
  onOpenSettings: () => void;
  onCreateRcti: () => void;
  isSaving: boolean;
  isMonthView: boolean;
  rctis: Rcti[];
  onDownloadAllPdfs: () => void;
  isDownloadingAllPdfs: boolean;
  selectedRctiCount: number;
  onMarkSelectedAsPaid: () => void;
  isBulkPaying: boolean;
}

export function RctiFiltersBar({
  contractorDrivers,
  subcontractorDrivers,
  selectedDriverIds,
  onToggleDriver,
  onSelectAllDrivers,
  onClearDrivers,
  statusFilter,
  onStatusChange,
  onOpenSettings,
  onCreateRcti,
  isSaving,
  isMonthView,
  rctis,
  onDownloadAllPdfs,
  isDownloadingAllPdfs,
  selectedRctiCount,
  onMarkSelectedAsPaid,
  isBulkPaying,
}: RctiFiltersBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filters & Actions</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenSettings()}
            id="rcti-settings-button"
          >
            <Settings className="h-4 w-4 mr-2" />
            Company Settings
          </Button>
        </div>
      </div>
      <div className="bg-card border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DriverFilterPopover
            driverGroups={[
              { label: "Contractors", drivers: contractorDrivers },
              {
                label: "Subcontractors",
                drivers: subcontractorDrivers,
              },
            ]}
            selectedDriverIds={selectedDriverIds}
            totalDriverCount={
              [...contractorDrivers, ...subcontractorDrivers].length
            }
            onToggleDriver={onToggleDriver}
            onSelectAll={onSelectAllDrivers}
            onClear={onClearDrivers}
            allDrivers={[...contractorDrivers, ...subcontractorDrivers]}
          />

          <StatusFilterPopover
            statuses={[
              { value: "all", label: "All Statuses" },
              { value: "draft", label: "Draft" },
              { value: "finalised", label: "Finalised" },
              { value: "paid", label: "Paid" },
            ]}
            statusFilter={statusFilter}
            onStatusChange={onStatusChange}
          />

          <Button
            type="button"
            id="create-rcti-btn"
            onClick={() => onCreateRcti()}
            disabled={selectedDriverIds.length === 0 || isSaving || isMonthView}
            size="sm"
            className="h-8"
          >
            {isSaving ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {selectedDriverIds.length === 0
              ? "Create RCTI"
              : selectedDriverIds.length === 1
                ? "Create RCTI"
                : `Create ${selectedDriverIds.length} RCTIs`}
          </Button>

          <Button
            type="button"
            id="download-all-pdfs-btn"
            onClick={() => onDownloadAllPdfs()}
            disabled={
              isDownloadingAllPdfs ||
              getDownloadableRctis({ rctis, selectedDriverIds, statusFilter })
                .length === 0
            }
            size="sm"
            variant="outline"
            className="h-8"
          >
            {isDownloadingAllPdfs ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download All PDFs
              </>
            )}
          </Button>

          {selectedRctiCount > 0 && (
            <Button
              type="button"
              id="bulk-mark-paid-btn"
              onClick={() => onMarkSelectedAsPaid()}
              disabled={isBulkPaying}
              size="sm"
              className="h-8"
            >
              {isBulkPaying ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Marking...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark {selectedRctiCount} as Paid
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
