"use client";

import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { DriverFilterPopover } from "@/components/shared/driver-filter-popover";
import { StatusFilterPopover } from "@/components/shared/status-filter-popover";
import type { Driver } from "@/lib/types";

export interface JobsReportFiltersBarProps {
  employeeDrivers: Driver[];
  contractorDrivers: Driver[];
  subcontractorDrivers: Driver[];
  allDrivers: Driver[];
  selectedDriverIds: string[];
  onToggleDriver: ({ driverId }: { driverId: string }) => void;
  onSelectAllDrivers: () => void;
  onClearDrivers: () => void;
  statusFilter: string;
  onStatusChange: ({ status }: { status: string }) => void;
  onCreateReport: () => void;
  isCreating: boolean;
  isMonthView: boolean;
  onDownloadAllPdfs: () => void;
  isDownloadingAllPdfs: boolean;
  hasReports: boolean;
}

/**
 * Driver and status filters with the create and download-all actions for the
 * jobs report week view.
 */
export function JobsReportFiltersBar({
  employeeDrivers,
  contractorDrivers,
  subcontractorDrivers,
  allDrivers,
  selectedDriverIds,
  onToggleDriver,
  onSelectAllDrivers,
  onClearDrivers,
  statusFilter,
  onStatusChange,
  onCreateReport,
  isCreating,
  isMonthView,
  onDownloadAllPdfs,
  isDownloadingAllPdfs,
  hasReports,
}: JobsReportFiltersBarProps) {
  return (
    <div className="bg-card border rounded-lg p-3">
      <div className="flex flex-wrap items-center gap-2">
        <DriverFilterPopover
          driverGroups={[
            { label: "Employees", drivers: employeeDrivers },
            { label: "Contractors", drivers: contractorDrivers },
            {
              label: "Subcontractors",
              drivers: subcontractorDrivers,
            },
          ]}
          selectedDriverIds={selectedDriverIds}
          totalDriverCount={allDrivers.length}
          onToggleDriver={onToggleDriver}
          onSelectAll={onSelectAllDrivers}
          onClear={onClearDrivers}
          idPrefix="jr"
          allDrivers={allDrivers}
        />

        <StatusFilterPopover
          statuses={[
            { value: "all", label: "All Statuses" },
            { value: "draft", label: "Draft" },
            { value: "finalised", label: "Finalised" },
          ]}
          statusFilter={statusFilter}
          onStatusChange={onStatusChange}
          idPrefix="jr"
        />

        <Button
          type="button"
          id="jr-create-report-btn"
          size="sm"
          className="h-8"
          disabled={selectedDriverIds.length === 0 || isCreating || isMonthView}
          onClick={() => onCreateReport()}
        >
          {isCreating ? (
            <Spinner className="mr-2 h-4 w-4" />
          ) : (
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {selectedDriverIds.length > 1
            ? `Create ${selectedDriverIds.length} Reports`
            : "Create Report"}
        </Button>

        <Button
          type="button"
          id="jr-download-all-pdfs-btn"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={isDownloadingAllPdfs || !hasReports}
          onClick={() => onDownloadAllPdfs()}
        >
          {isDownloadingAllPdfs ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Download All PDFs
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
