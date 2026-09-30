"use client";

import { Briefcase, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getStatusBadge } from "@/components/shared/status-badge";
import { SentBadge } from "@/components/shared/sent-badge";
import { formatDateDDMMYYYY } from "@/lib/utils/jobs-report-dates";
import type { Driver, JobsReport } from "@/lib/types";

export interface JobsReportByDriverViewProps {
  employeeDrivers: Driver[];
  contractorDrivers: Driver[];
  subcontractorDrivers: Driver[];
  selectedDriverId: string;
  onSelectDriver: (value: string) => void;
  isLoading: boolean;
  reportCount: number;
  groupedReports: { year: number; reports: JobsReport[] }[];
  expandedYears: Set<number>;
  onToggleYear: ({ year }: { year: number }) => void;
  onOpenReport: ({ report }: { report: JobsReport }) => void;
}

/**
 * Lists a chosen driver's jobs reports grouped by year, each linking back to
 * the week view.
 */
export function JobsReportByDriverView({
  employeeDrivers,
  contractorDrivers,
  subcontractorDrivers,
  selectedDriverId,
  onSelectDriver,
  isLoading,
  reportCount,
  groupedReports,
  expandedYears,
  onToggleYear,
  onOpenReport,
}: JobsReportByDriverViewProps) {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-base">Select a Driver</h3>
        <Select value={selectedDriverId} onValueChange={onSelectDriver}>
          <SelectTrigger id="by-driver-select" className="w-full">
            <SelectValue placeholder="Choose a driver to view their reports..." />
          </SelectTrigger>
          <SelectContent>
            {employeeDrivers.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                  Employees
                </div>
                {employeeDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.id.toString()}>
                    {d.driver}
                  </SelectItem>
                ))}
              </>
            )}
            {contractorDrivers.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                  Contractors
                </div>
                {contractorDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.id.toString()}>
                    {d.driver}
                  </SelectItem>
                ))}
              </>
            )}
            {subcontractorDrivers.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-bold text-primary uppercase tracking-wide">
                  Subcontractors
                </div>
                {subcontractorDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.id.toString()}>
                    {d.driver}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <LoadingSkeleton count={3} variant="card" />}

      {!isLoading && selectedDriverId && reportCount === 0 && (
        <div className="bg-card border rounded-lg p-10 text-center">
          <FileText
            className="h-10 w-10 text-muted-foreground mx-auto mb-3"
            aria-hidden="true"
          />
          <p className="text-muted-foreground text-sm">
            No reports found for this driver
          </p>
        </div>
      )}

      {!isLoading && groupedReports.length > 0 && (
        <div className="space-y-3">
          {groupedReports.map(({ year, reports: yearReports }) => {
            const isExpanded = expandedYears.has(year);
            return (
              <div
                key={year}
                className="bg-card border rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  id={`driver-year-${year}-toggle`}
                  className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => onToggleYear({ year })}
                >
                  <span className="font-semibold text-base">{year}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">
                      {yearReports.length} report
                      {yearReports.length !== 1 ? "s" : ""}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="divide-y">
                    {yearReports.map((r) => (
                      <div
                        key={r.id}
                        className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {r.reportNumber}
                            </span>
                            {getStatusBadge({ status: r.status })}
                            <SentBadge sentAt={r.sentAt} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Week ending{" "}
                            {formatDateDDMMYYYY({
                              isoString: r.weekEnding,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <Briefcase
                              className="inline h-3 w-3 mr-1"
                              aria-hidden="true"
                            />
                            {r.lines?.length ?? 0} job
                            {(r.lines?.length ?? 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <Button
                            type="button"
                            id={`by-driver-open-${r.id}`}
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenReport({ report: r })}
                          >
                            Open
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
