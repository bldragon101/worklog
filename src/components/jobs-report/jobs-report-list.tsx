"use client";

import { FileText } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { getStatusBadge } from "@/components/shared/status-badge";
import { SentBadge } from "@/components/shared/sent-badge";
import type { JobsReport } from "@/lib/types";

export interface JobsReportListProps {
  reports: JobsReport[];
  isLoading: boolean;
  hasDriverFilter: boolean;
  selectedReportId: number | null;
  onSelectReport: ({ report }: { report: JobsReport }) => void;
}

/**
 * The selectable list of jobs reports for the current period and filters.
 */
export function JobsReportList({
  reports,
  isLoading,
  hasDriverFilter,
  selectedReportId,
  onSelectReport,
}: JobsReportListProps) {
  if (isLoading) {
    return <LoadingSkeleton count={3} variant="card" />;
  }

  if (reports.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center">
        <FileText
          className="h-8 w-8 text-muted-foreground mx-auto mb-2"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">
          {hasDriverFilter
            ? "No reports found for selected drivers this period"
            : "No reports found for this period"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reports.map((report) => (
        <div
          key={report.id}
          role="button"
          tabIndex={0}
          id={`jr-report-item-${report.id}`}
          className={`flex items-center justify-between p-3 bg-card border rounded-lg cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all ${
            selectedReportId === report.id ? "border-primary bg-accent" : ""
          }`}
          onClick={() => onSelectReport({ report })}
          onKeyUp={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelectReport({ report });
          }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{report.reportNumber}</span>
              {getStatusBadge({ status: report.status })}
              <SentBadge sentAt={report.sentAt} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {report.driverName}
            </p>
          </div>
          <div className="text-right ml-2 flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {report.lines?.length ?? 0} job
              {(report.lines?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
