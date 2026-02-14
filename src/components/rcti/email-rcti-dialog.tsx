"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  User,
  FileText,
  Calendar,
  DollarSign,
  AlertCircle,
} from "lucide-react";

interface EmailRctiDialogRcti {
  id: number;
  invoiceNumber: string;
  weekEnding: string;
  total: number;
  driverName: string;
  driverId: number;
  status: string;
  lines?: { length: number } | Array<unknown>;
}

interface EmailRctiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rcti: EmailRctiDialogRcti | null;
  driverEmail: string | null;
  onSent?: ({ sentTo }: { sentTo: string }) => void;
}

function formatWeekEndingDisplay({
  dateString,
}: {
  dateString: string;
}): string {
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

function formatWeekEndingLong({
  dateString,
}: {
  dateString: string;
}): string {
  const date = new Date(dateString);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function EmailRctiDialog({
  open,
  onOpenChange,
  rcti,
  driverEmail,
  onSent,
}: EmailRctiDialogProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");
  const [isFetchingSettings, setIsFetchingSettings] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchCompanyName = async () => {
        setIsFetchingSettings(true);
        try {
          const response = await fetch("/api/company-settings");
          if (response.ok) {
            const data = await response.json();
            setCompanyName(data.companyName || "");
          }
        } catch (error) {
          console.error("Error fetching company settings:", error);
        } finally {
          setIsFetchingSettings(false);
        }
      };

      fetchCompanyName();
    }
  }, [open]);

  const handleSend = async () => {
    if (!rcti) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/rcti/${rcti.id}/email`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send email");
      }

      const result = await response.json();

      toast({
        title: "Email Sent",
        description: `RCTI emailed successfully to ${result.sentTo}`,
      });

      onSent?.({ sentTo: result.sentTo });
      onOpenChange(false);
    } catch (error) {
      console.error("Error emailing RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send RCTI email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!rcti) return null;

  const weekEndingFormatted = formatWeekEndingDisplay({
    dateString: rcti.weekEnding,
  });
  const weekEndingLong = formatWeekEndingLong({ dateString: rcti.weekEnding });

  const subject = companyName
    ? `RCTI W/E ${weekEndingFormatted} from ${companyName}`
    : `RCTI W/E ${weekEndingFormatted}`;

  const statusLabel =
    rcti.status === "finalised"
      ? "Finalised"
      : rcti.status === "paid"
        ? "Paid"
        : rcti.status;

  const statusVariant =
    rcti.status === "paid"
      ? "outline"
      : rcti.status === "finalised"
        ? "default"
        : "secondary";

  const lineCount = rcti.lines
    ? Array.isArray(rcti.lines)
      ? rcti.lines.length
      : rcti.lines.length
    : 0;

  const hasEmail = !!driverEmail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <DialogTitle>Email RCTI</DialogTitle>
          </div>
          <DialogDescription>
            Review the details below before sending the RCTI to the driver.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* No email warning */}
          {!hasEmail && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-destructive">
                  No email address configured
                </p>
                <p className="text-muted-foreground mt-1">
                  Please add an email address to{" "}
                  <strong>{rcti.driverName}</strong>&apos;s driver record before
                  sending.
                </p>
              </div>
            </div>
          )}

          {/* Recipient */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Recipient
            </label>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {rcti.driverName}
                </p>
                {hasEmail ? (
                  <p className="text-sm text-muted-foreground truncate">
                    {driverEmail}
                  </p>
                ) : (
                  <p className="text-sm text-destructive">
                    No email address
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Subject
            </label>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm font-medium">
                {isFetchingSettings ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : (
                  subject
                )}
              </p>
            </div>
          </div>

          <Separator />

          {/* RCTI Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              RCTI Details
            </label>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {rcti.invoiceNumber}
                  </span>
                </div>
                <Badge
                  variant={statusVariant}
                  className={
                    rcti.status === "paid"
                      ? "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-100"
                      : ""
                  }
                >
                  {statusLabel}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Week Ending
                    </p>
                    <p className="font-medium">{weekEndingLong}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Total</p>
                    <p className="font-medium">
                      ${Number(rcti.total).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {lineCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {lineCount} line{lineCount !== 1 ? "s" : ""} &middot; PDF will
                  be attached
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            id="cancel-email-rcti-btn"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending || !hasEmail}
            id="confirm-send-email-rcti-btn"
          >
            {isSending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
