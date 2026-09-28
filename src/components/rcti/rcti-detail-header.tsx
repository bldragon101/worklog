"use client";

import type { KeyboardEvent } from "react";
import { format } from "date-fns";
import {
  CheckCircle,
  Download,
  Lock,
  Mail,
  RefreshCw,
  Save,
  Trash2,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/skeleton";
import { getStatusBadge } from "@/components/shared/status-badge";
import type { Rcti } from "@/lib/types";

export interface RctiDetailHeaderProps {
  rcti: Rcti;
  isRefreshing: boolean;
  onRefresh: () => void;
  isDownloadingPdf: boolean;
  onDownloadPdf: () => void;
  onOpenEmailDialog: () => void;
  onToggleSent: ({ rcti }: { rcti: Rcti }) => void;
  isSaving: boolean;
  onSave: () => void;
  isFinalising: boolean;
  onFinalise: () => void;
  onDelete: () => void;
  onUnfinalise: () => void;
  onMarkAsPaid: () => void;
  onOpenRevertDialog: () => void;
}

export function RctiDetailHeader({
  rcti,
  isRefreshing,
  onRefresh,
  isDownloadingPdf,
  onDownloadPdf,
  onOpenEmailDialog,
  onToggleSent,
  isSaving,
  onSave,
  isFinalising,
  onFinalise,
  onDelete,
  onUnfinalise,
  onMarkAsPaid,
  onOpenRevertDialog,
}: RctiDetailHeaderProps) {
  return (
    <div className="pb-3 border-b">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>
            {rcti.invoiceNumber} -{" "}
            {getStatusBadge({
              status: rcti.status,
            })}
          </CardTitle>
          <CardDescription>
            {rcti.driverName} - Week ending{" "}
            {format(new Date(rcti.weekEnding), "MMM d, yyyy")}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {rcti.status === "draft" && (
            <Button
              type="button"
              id="refresh-rcti-btn"
              onClick={() => onRefresh()}
              disabled={isRefreshing}
              size="sm"
              variant="outline"
              title="Refresh RCTI data from database"
            >
              {isRefreshing ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          )}
          <Button
            type="button"
            id="download-rcti-pdf-btn"
            onClick={() => onDownloadPdf()}
            disabled={isDownloadingPdf}
            size="sm"
            variant="outline"
          >
            {isDownloadingPdf ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
          {(rcti.status === "finalised" || rcti.status === "paid") && (
            <Button
              type="button"
              id="email-rcti-btn"
              onClick={() => onOpenEmailDialog()}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenEmailDialog();
                }
              }}
              size="sm"
              variant="outline"
              title="Email RCTI to driver"
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
          )}
          <Button
            type="button"
            id="toggle-sent-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSent({
                rcti,
              });
            }}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleSent({
                  rcti,
                });
              }
            }}
            size="sm"
            variant={rcti.sentAt ? "outline" : "secondary"}
            title={
              rcti.sentAt
                ? "Mark as unsent"
                : "Mark as sent (for previously emailed RCTIs)"
            }
          >
            <Mail className="mr-2 h-4 w-4" />
            {rcti.sentAt ? "Mark Unsent" : "Mark Sent"}
          </Button>
          {rcti.status === "draft" && (
            <>
              <Button
                type="button"
                id="save-rcti-btn"
                onClick={() => onSave()}
                disabled={isSaving}
                size="sm"
              >
                {isSaving ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
              <Button
                type="button"
                id="finalize-rcti-btn"
                onClick={() => onFinalise()}
                disabled={isFinalising}
                size="sm"
                variant="default"
              >
                {isFinalising ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Finalising...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Finalise
                  </>
                )}
              </Button>
              <Button
                type="button"
                id="delete-rcti-btn"
                onClick={() => onDelete()}
                disabled={isSaving}
                size="sm"
                variant="destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          {rcti.status === "finalised" && (
            <>
              <Button
                type="button"
                id="unfinalize-rcti-btn"
                onClick={() => onUnfinalise()}
                disabled={isSaving}
                size="sm"
                variant="outline"
              >
                <Unlock className="mr-2 h-4 w-4" />
                Unfinalise
              </Button>
              <Button
                type="button"
                id="mark-paid-btn"
                onClick={() => onMarkAsPaid()}
                disabled={isSaving}
                size="sm"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Paid
              </Button>
            </>
          )}
          {rcti.status === "paid" && (
            <Button
              type="button"
              id="revert-to-draft-btn"
              onClick={() => onOpenRevertDialog()}
              disabled={isSaving}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Revert to Draft
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
