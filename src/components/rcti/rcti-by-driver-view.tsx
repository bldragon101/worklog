"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton, Spinner } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  DollarSign,
  Lock,
  CheckCircle,
  Download,
  ChevronDown,
  ChevronRight,
  Calendar,
  ExternalLink,
  Mail,
} from "lucide-react";
import { format, getYear } from "date-fns";
import type { Rcti, Driver } from "@/lib/types";
import { EmailRctiDialog } from "@/components/rcti/email-rcti-dialog";

interface RctiByDriverViewProps {
  drivers: Driver[];
  onNavigateToRcti: ({
    rcti,
    weekEnding,
  }: {
    rcti: Rcti;
    weekEnding: Date;
  }) => void;
}

export function RctiByDriverView({
  drivers,
  onNavigateToRcti,
}: RctiByDriverViewProps) {
  const { toast } = useToast();
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [driverRctis, setDriverRctis] = useState<Rcti[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);
  const [emailDialogRcti, setEmailDialogRcti] = useState<Rcti | null>(null);

  // Filter to only show contractors and subcontractors
  const eligibleDrivers = useMemo(() => {
    return drivers.filter(
      (d) => d.type === "Contractor" || d.type === "Subcontractor",
    );
  }, [drivers]);

  // Group RCTIs by year
  const rctisByYear = useMemo(() => {
    const grouped = new Map<number, Rcti[]>();

    for (const rcti of driverRctis) {
      const year = getYear(new Date(rcti.weekEnding));
      const existing = grouped.get(year) || [];
      existing.push(rcti);
      grouped.set(year, existing);
    }

    // Sort years descending, and RCTIs within each year by weekEnding descending
    const sortedYears = Array.from(grouped.keys()).sort((a, b) => b - a);
    const result: { year: number; rctis: Rcti[] }[] = [];

    for (const year of sortedYears) {
      const yearRctis = grouped.get(year) || [];
      yearRctis.sort(
        (a, b) =>
          new Date(b.weekEnding).getTime() - new Date(a.weekEnding).getTime(),
      );
      result.push({ year, rctis: yearRctis });
    }

    return result;
  }, [driverRctis]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const total = driverRctis.length;
    const draft = driverRctis.filter((r) => r.status === "draft").length;
    const finalised = driverRctis.filter(
      (r) => r.status === "finalised",
    ).length;
    const paid = driverRctis.filter((r) => r.status === "paid").length;
    const totalAmount = driverRctis.reduce(
      (sum, r) => sum + Number(r.total),
      0,
    );
    const paidAmount = driverRctis
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + Number(r.total), 0);
    const outstandingAmount = driverRctis
      .filter((r) => r.status === "finalised")
      .reduce((sum, r) => sum + Number(r.total), 0);

    return {
      total,
      draft,
      finalised,
      paid,
      totalAmount,
      paidAmount,
      outstandingAmount,
    };
  }, [driverRctis]);

  const fetchDriverRctis = async ({ driverId }: { driverId: string }) => {
    if (!driverId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/rcti?driverId=${driverId}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to fetch RCTIs");
      const data = await response.json();
      setDriverRctis(Array.isArray(data) ? data : []);

      // Expand the most recent year by default
      if (data.length > 0) {
        const years = data.map((r: Rcti) => getYear(new Date(r.weekEnding)));
        const maxYear = Math.max(...years);
        setExpandedYears(new Set([maxYear]));
      }
    } catch (error) {
      console.error("Error fetching driver RCTIs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch RCTIs for this driver",
        variant: "destructive",
      });
      setDriverRctis([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDriverChange = (driverId: string) => {
    setSelectedDriverId(driverId);
    setDriverRctis([]);
    setExpandedYears(new Set());
    if (driverId) {
      fetchDriverRctis({ driverId });
    }
  };

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  const handleDownloadPdf = async ({ rcti }: { rcti: Rcti }) => {
    setDownloadingPdfId(rcti.id);
    try {
      const response = await fetch(`/api/rcti/${rcti.id}/pdf`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename = rcti.invoiceNumber.toUpperCase().startsWith("RCTI")
        ? `${rcti.invoiceNumber}.pdf`
        : `RCTI-${rcti.invoiceNumber}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "finalised":
        return <Badge variant="default">Finalised</Badge>;
      case "paid":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-100"
          >
            Paid
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const selectedDriver = eligibleDrivers.find(
    (d) => d.id.toString() === selectedDriverId,
  );

  return (
    <div className="space-y-5">
      {/* Driver Selection */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <label
              htmlFor="driver-select"
              className="text-sm font-medium text-muted-foreground mb-2 block"
            >
              Select Driver
            </label>
            <Select value={selectedDriverId} onValueChange={handleDriverChange}>
              <SelectTrigger id="driver-select" className="w-full sm:w-[300px]">
                <SelectValue placeholder="Choose a driver..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleDrivers.length === 0 ? (
                  <SelectItem id="driver-none" value="__none__" disabled>
                    No contractors or subcontractors found
                  </SelectItem>
                ) : (
                  eligibleDrivers.map((driver) => (
                    <SelectItem
                      id={`driver-${driver.id}`}
                      key={driver.id}
                      value={driver.id.toString()}
                    >
                      {driver.driver}{" "}
                      <span className="text-muted-foreground">
                        ({driver.type})
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedDriver && (
            <div className="text-sm text-muted-foreground">
              <p>
                <span className="font-medium">Business:</span>{" "}
                {selectedDriver.businessName || "N/A"}
              </p>
              <p>
                <span className="font-medium">ABN:</span>{" "}
                {selectedDriver.abn || "N/A"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Content based on selection */}
      {!selectedDriverId ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">
            Select a driver to view their RCTIs
          </p>
          <p className="text-sm">
            Choose a contractor or subcontractor from the dropdown above
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          <LoadingSkeleton count={3} variant="card" />
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total RCTIs
                </span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{summaryStats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total Paid
                </span>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                ${summaryStats.paidAmount.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summaryStats.paid} RCTIs
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Outstanding
                </span>
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-600">
                ${summaryStats.outstandingAmount.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summaryStats.finalised} finalised
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total Amount
                </span>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                ${summaryStats.totalAmount.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summaryStats.draft} draft
              </p>
            </div>
          </div>

          {/* RCTIs by Year */}
          {driverRctis.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No RCTIs found</p>
              <p className="text-sm">This driver has no RCTIs generated yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">RCTIs by Year</h2>
                <p className="text-sm text-muted-foreground">
                  Click on a year to expand/collapse, or click an RCTI to view
                  details
                </p>
              </div>

              <div className="space-y-2">
                {rctisByYear.map(({ year, rctis }) => {
                  const isExpanded = expandedYears.has(year);
                  const yearTotal = rctis.reduce(
                    (sum, r) => sum + Number(r.total),
                    0,
                  );
                  const yearPaid = rctis.filter(
                    (r) => r.status === "paid",
                  ).length;
                  const yearFinalised = rctis.filter(
                    (r) => r.status === "finalised",
                  ).length;
                  const yearDraft = rctis.filter(
                    (r) => r.status === "draft",
                  ).length;

                  return (
                    <Collapsible
                      key={year}
                      open={isExpanded}
                      onOpenChange={() => toggleYear(year)}
                    >
                      <CollapsibleTrigger asChild>
                        <div
                          id={`year-${year}`}
                          className="flex items-center justify-between p-4 bg-card border rounded-lg cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <span className="text-lg font-semibold">
                                {year}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-muted-foreground">
                                  {rctis.length} RCTIs
                                </span>
                                {yearPaid > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-100 text-xs"
                                  >
                                    {yearPaid} paid
                                  </Badge>
                                )}
                                {yearFinalised > 0 && (
                                  <Badge variant="default" className="text-xs">
                                    {yearFinalised} finalised
                                  </Badge>
                                )}
                                {yearDraft > 0 && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {yearDraft} draft
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">${yearTotal.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              Total
                            </p>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 ml-8 space-y-2">
                          {rctis.map((rcti) => (
                            <div
                              key={rcti.id}
                              className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {rcti.invoiceNumber}
                                  </span>
                                  {getStatusBadge(rcti.status)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Week ending{" "}
                                  {format(
                                    new Date(rcti.weekEnding),
                                    "MMM d, yyyy",
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="font-bold">
                                    ${Number(rcti.total).toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {rcti.lines?.length || 0} lines
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadPdf({ rcti });
                                    }}
                                    disabled={downloadingPdfId === rcti.id}
                                    id={`download-pdf-${rcti.id}`}
                                    title="Download PDF"
                                  >
                                    {downloadingPdfId === rcti.id ? (
                                      <Spinner size="sm" />
                                    ) : (
                                      <Download className="h-4 w-4" />
                                    )}
                                  </Button>
                                  {(rcti.status === "finalised" ||
                                    rcti.status === "paid") && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEmailDialogRcti(rcti);
                                      }}
                                      id={`email-rcti-${rcti.id}`}
                                      title="Email RCTI to driver"
                                    >
                                      <Mail className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigateToRcti({
                                        rcti,
                                        weekEnding: new Date(rcti.weekEnding),
                                      });
                                    }}
                                    id={`view-rcti-${rcti.id}`}
                                    title="View in Week Ending view"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      {/* Email RCTI Confirmation Dialog */}
      <EmailRctiDialog
        open={!!emailDialogRcti}
        onOpenChange={(open) => {
          if (!open) setEmailDialogRcti(null);
        }}
        rcti={emailDialogRcti}
        driverEmail={selectedDriver?.email ?? null}
      />
    </div>
  );
}
