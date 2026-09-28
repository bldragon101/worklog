"use client";

import { Download, Lock, Mail, Trash2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { getStatusBadge } from "@/components/shared/status-badge";
import { SentBadge } from "@/components/shared/sent-badge";
import { formatWeekEndingLong } from "@/lib/utils/jobs-report-dates";
import type { JobsReport } from "@/lib/types";

export interface JobsReportDetailHeaderProps {
  report: JobsReport;
  isFinalising: boolean;
  onFinalise: () => void;
  onUnfinalise: () => void;
  isDownloadingPdf: boolean;
  onDownloadPdf: () => void;
  onOpenEmailDialog: () => void;
  onOpenDeleteDialog: () => void;
}

/**
 * The selected report's title, status and action buttons.
 */
export function JobsReportDetailHeader({
  report,
  isFinalising,
  onFinalise,
  onUnfinalise,
  isDownloadingPdf,
  onDownloadPdf,
  onOpenEmailDialog,
  onOpenDeleteDialog,
}: JobsReportDetailHeaderProps) {
  return (
    <div className="p-5 border-b">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{report.reportNumber}</h2>
            {getStatusBadge({
              status: report.status,
            })}
            <SentBadge sentAt={report.sentAt} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {report.driverName}
          </p>
          <p className="text-sm text-muted-foreground">
            Week ending{" "}
            {formatWeekEndingLong({
              isoString: report.weekEnding,
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {report.status === "draft" && (
            <Button
              type="button"
              id="jr-finalise-btn"
              size="sm"
              onClick={() => onFinalise()}
              disabled={isFinalising}
            >
              {isFinalising ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Finalising...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
                  Finalise Report
                </>
              )}
            </Button>
          )}

          {report.status === "finalised" && (
            <Button
              type="button"
              id="jr-unfinalise-btn"
              size="sm"
              variant="outline"
              onClick={() => onUnfinalise()}
              disabled={isFinalising}
            >
              {isFinalising ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Reverting...
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" aria-hidden="true" />
                  Unfinalise
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            id="jr-download-pdf-btn"
            size="sm"
            variant="outline"
            onClick={() => onDownloadPdf()}
            disabled={isDownloadingPdf}
          >
            {isDownloadingPdf ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download PDF
              </>
            )}
          </Button>

          {report.status === "finalised" && (
            <Button
              type="button"
              id="jr-email-btn"
              size="sm"
              variant="outline"
              title="Email report to driver"
              onClick={() => onOpenEmailDialog()}
            >
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
              Email Report
            </Button>
          )}

          {report.status === "draft" && (
            <Button
              type="button"
              id="jr-delete-btn"
              size="sm"
              variant="destructive"
              title="Delete draft report"
              onClick={() => onOpenDeleteDialog()}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
