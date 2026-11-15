"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { companySettingsQuery } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils/currency";
import {
  buildRctiStatement,
  buildRctiStatementEmailSubject,
  formatStatementDate,
  formatStatementPeriod,
  MAX_STATEMENT_RCTIS,
} from "@/lib/rcti-statement";
import type { Rcti } from "@/lib/types";
import {
  AlertCircle,
  Download,
  FileText,
  Mail,
  Printer,
  User,
} from "lucide-react";

export type RctiStatementMode = "print" | "email";

type PendingAction = "print" | "download" | "email" | null;

interface StatementRequestBody {
  driverId: number;
  rctiIds: number[];
  includeStatement: boolean;
  includeRctis: boolean;
}

interface RctiStatementDialogProps {
  mode: RctiStatementMode | null;
  onOpenChange: (open: boolean) => void;
  driverId: number;
  driverName: string;
  driverEmail: string | null;
  rctis: Rcti[];
  onSent?: ({
    sentAt,
    sentRctiIds,
  }: {
    sentAt: string | null;
    sentRctiIds: number[];
  }) => void;
}

async function readErrorMessage({
  response,
  fallback,
}: {
  response: Response;
  fallback: string;
}): Promise<string> {
  const body = await response.json().catch(() => null);
  return body && typeof body.error === "string" ? body.error : fallback;
}

async function fetchStatementPdf({
  body,
}: {
  body: StatementRequestBody;
}): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch("/api/rcti/statement/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage({
        response,
        fallback: "Failed to generate statement PDF",
      }),
    );
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? "Statement.pdf";
  return { blob: await response.blob(), filename };
}

function downloadBlob({ blob, filename }: { blob: Blob; filename: string }) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Prints, saves or emails a statement for a driver's selected RCTIs, and can
 * include (or re-send) each full RCTI alongside it.
 */
export function RctiStatementDialog({
  mode,
  onOpenChange,
  driverId,
  driverName,
  driverEmail,
  rctis,
  onSent,
}: RctiStatementDialogProps) {
  const { toast } = useToast();
  const open = mode !== null;
  const [includeStatement, setIncludeStatement] = useState(true);
  const [includeRctis, setIncludeRctis] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const settingsQuery = useQuery({
    ...companySettingsQuery,
    enabled: open && mode === "email",
  });

  const statement = buildRctiStatement({
    rctis: rctis.map((rcti) => ({
      id: rcti.id,
      invoiceNumber: rcti.invoiceNumber,
      weekEnding: rcti.weekEnding,
      status: rcti.status,
      paidAt: rcti.paidAt,
      subtotal: Number(rcti.subtotal),
      gst: Number(rcti.gst),
      total: Number(rcti.total),
    })),
  });
  const period = formatStatementPeriod({
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
  });

  const isBusy = pendingAction !== null;
  const tooMany = rctis.length > MAX_STATEMENT_RCTIS;
  const nothingIncluded = !includeStatement && !includeRctis;
  const canSubmit = rctis.length > 0 && !tooMany && !nothingIncluded;
  const hasEmail = !!driverEmail;

  const requestBody: StatementRequestBody = {
    driverId,
    rctiIds: rctis.map(({ id }) => id),
    includeStatement,
    includeRctis,
  };

  const handleOpenChange = ({ open: nextOpen }: { open: boolean }) => {
    if (isBusy) return;
    if (!nextOpen) {
      setIncludeStatement(true);
      setIncludeRctis(false);
    }
    onOpenChange(nextOpen);
  };

  const handlePrint = async () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.title = "Generating PDF...";
      printWindow.document.body.textContent = "Generating PDF...";
    }
    setPendingAction("print");
    try {
      const { blob, filename } = await fetchStatementPdf({ body: requestBody });
      if (printWindow && !printWindow.closed) {
        const url = window.URL.createObjectURL(blob);
        printWindow.location.href = url;
        window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
      } else {
        downloadBlob({ blob, filename });
        toast({
          title: "PDF downloaded",
          description:
            "The new tab was blocked, so the PDF was downloaded instead",
        });
      }
    } catch (error) {
      printWindow?.close();
      console.error("Error opening statement PDF:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate statement PDF",
        variant: "destructive",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleDownload = async () => {
    setPendingAction("download");
    try {
      const { blob, filename } = await fetchStatementPdf({ body: requestBody });
      downloadBlob({ blob, filename });
      toast({ title: "Success", description: "PDF downloaded successfully" });
    } catch (error) {
      console.error("Error downloading statement PDF:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate statement PDF",
        variant: "destructive",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleSend = async () => {
    setPendingAction("email");
    try {
      const response = await fetch("/api/rcti/statement/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorMessage({
            response,
            fallback: "Failed to send email",
          }),
        );
      }

      const result = await response.json();
      toast({
        title: "Email Sent",
        description: `${includeStatement ? "Statement" : "RCTIs"} emailed successfully to ${result.sentTo}`,
      });
      onSent?.({
        sentAt: result.sentAt ?? null,
        sentRctiIds: Array.isArray(result.sentRctiIds)
          ? result.sentRctiIds
          : [],
      });
      setPendingAction(null);
      handleOpenChange({ open: false });
    } catch (error) {
      console.error("Error emailing statement:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
      });
      setPendingAction(null);
    }
  };

  const subject = buildRctiStatementEmailSubject({
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    companyName: settingsQuery.data?.companyName ?? null,
    includeStatement,
  });

  const rctiCountLabel = `${rctis.length} RCTI${rctis.length === 1 ? "" : "s"}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => handleOpenChange({ open: nextOpen })}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {mode === "email" ? (
              <Mail className="h-5 w-5 text-blue-600" />
            ) : (
              <Printer className="h-5 w-5 text-blue-600" />
            )}
            <DialogTitle>
              {mode === "email"
                ? "Email Statement / Re-send RCTIs"
                : "Print or Save Statement"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {rctiCountLabel} for {driverName}
            {period ? ` (${period})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode === "email" && !hasEmail && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-destructive">
                  No email address configured
                </p>
                <p className="mt-1 text-muted-foreground">
                  Please add an email address to <strong>{driverName}</strong>
                  &apos;s driver record before sending.
                </p>
              </div>
            </div>
          )}

          {tooMany && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-destructive">
                A statement can include at most {MAX_STATEMENT_RCTIS} RCTIs.
                Deselect {rctis.length - MAX_STATEMENT_RCTIS} to continue.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total Payable</p>
              <p className="font-semibold">
                {formatCurrency({ amount: statement.totals.amountPayable })}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="font-semibold text-green-600">
                {formatCurrency({ amount: statement.totals.paid })}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-semibold text-amber-600">
                {formatCurrency({ amount: statement.totals.outstanding })}
              </p>
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">Selected RCTIs</caption>
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">
                    Invoice
                  </th>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">
                    Week Ending
                  </th>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-1.5 text-right font-medium"
                  >
                    Payable
                  </th>
                </tr>
              </thead>
              <tbody>
                {statement.rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-1.5 font-medium">
                      {row.invoiceNumber}
                    </td>
                    <td className="px-3 py-1.5">
                      {formatStatementDate({ isoString: row.weekEnding })}
                    </td>
                    <td className="px-3 py-1.5 capitalize">{row.status}</td>
                    <td className="px-3 py-1.5 text-right">
                      {formatCurrency({ amount: row.amountPayable })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator />

          <fieldset className="space-y-3">
            <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {mode === "email" ? "Attach" : "Include"}
            </legend>
            <div className="flex items-start gap-3">
              <Checkbox
                id="statement-include-summary"
                checked={includeStatement}
                onCheckedChange={(checked) =>
                  setIncludeStatement(checked === true)
                }
                disabled={isBusy}
                className="mt-0.5"
              />
              <label
                htmlFor="statement-include-summary"
                className="cursor-pointer text-sm"
              >
                <span className="font-medium">Statement</span>
                <span className="block text-muted-foreground">
                  One summary listing each RCTI with totals paid and
                  outstanding
                </span>
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="statement-include-rctis"
                checked={includeRctis}
                onCheckedChange={(checked) => setIncludeRctis(checked === true)}
                disabled={isBusy}
                className="mt-0.5"
              />
              <label
                htmlFor="statement-include-rctis"
                className="cursor-pointer text-sm"
              >
                <span className="font-medium">
                  {mode === "email"
                    ? "Re-send each RCTI"
                    : "Full RCTI for each week"}
                </span>
                <span className="block text-muted-foreground">
                  {mode === "email"
                    ? "Attach a copy of each selected RCTI and mark them as sent"
                    : "Add each selected RCTI in full, after the statement"}
                </span>
              </label>
            </div>
            {nothingIncluded && (
              <p className="text-sm text-destructive">
                Choose the statement, the RCTIs, or both.
              </p>
            )}
          </fieldset>

          {mode === "email" && (
            <>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{driverName}</p>
                    <p
                      className={
                        hasEmail
                          ? "truncate text-muted-foreground"
                          : "text-destructive"
                      }
                    >
                      {driverEmail ?? "No email address"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="font-medium">
                    {settingsQuery.isLoading ? (
                      <span className="text-muted-foreground">Loading...</span>
                    ) : (
                      subject
                    )}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange({ open: false })}
            disabled={isBusy}
            id="cancel-rcti-statement-btn"
          >
            Cancel
          </Button>
          {mode === "email" ? (
            <Button
              type="button"
              onClick={handleSend}
              disabled={isBusy || !canSubmit || !hasEmail}
              id="send-rcti-statement-btn"
            >
              {pendingAction === "email" ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {pendingAction === "email" ? "Sending..." : "Send Email"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownload}
                disabled={isBusy || !canSubmit}
                id="download-rcti-statement-btn"
              >
                {pendingAction === "download" ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Save PDF
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                disabled={isBusy || !canSubmit}
                id="print-rcti-statement-btn"
              >
                {pendingAction === "print" ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                Open to Print
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
