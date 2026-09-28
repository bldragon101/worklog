"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */

import { useState, useEffect, useMemo } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useJobsReportByDriver } from "@/hooks/use-jobs-report-by-driver";
import { useJobsReportManualLines } from "@/hooks/use-jobs-report-manual-lines";
import { useJobsReportPdfDownloads } from "@/hooks/use-jobs-report-pdf-downloads";
import { EmailJobsReportDialog } from "@/components/jobs-report/email-jobs-report-dialog";
import { JobsReportByDriverView } from "@/components/jobs-report/jobs-report-by-driver-view";
import { JobsReportSummaryStats } from "@/components/jobs-report/jobs-report-summary-stats";
import { JobsReportFiltersBar } from "@/components/jobs-report/jobs-report-filters-bar";
import { JobsReportList } from "@/components/jobs-report/jobs-report-list";
import { JobsReportDetailHeader } from "@/components/jobs-report/jobs-report-detail-header";
import { JobsReportNotes } from "@/components/jobs-report/jobs-report-notes";
import { JobsReportLinesTable } from "@/components/jobs-report/jobs-report-lines-table";
import { JobsReportDeleteDialog } from "@/components/jobs-report/jobs-report-delete-dialog";
import { PageControls } from "@/components/layout/page-controls";
import { Calendar, FileText, User } from "lucide-react";
import type { Driver, Job, JobsReport } from "@/lib/types";
import {
  addDaysToIsoDate,
  formatIsoDate,
  getDaysInMonth,
  getJobsReportPeriodOptions,
  getMelbourneTodayIsoDate,
  getWeekEndingSundayIsoDate,
} from "@/lib/utils/jobs-report-dates";

export default function JobsReportPage() {
  const { toast } = useToast();

  const SHOW_MONTH = "__SHOW_MONTH__";
  const upcomingSunday = getWeekEndingSundayIsoDate({
    isoDate: getMelbourneTodayIsoDate(),
  });

  // ── Core data
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reports, setReports] = useState<JobsReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<JobsReport | null>(null);

  // ── Loading / saving
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Dialogs
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ── View
  const [activeView, setActiveView] = useState<"by-week" | "by-driver">(
    "by-week",
  );

  // ── Driver selection — shared between filter AND create (same as RCTI)
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ── Week navigation
  const [selectedYear, setSelectedYear] = useState<number>(
    parseInt(upcomingSunday.substring(0, 4), 10),
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    parseInt(upcomingSunday.substring(5, 7), 10) - 1,
  );
  const [weekEnding, setWeekEnding] = useState<string>(upcomingSunday);

  // ── Edit notes for selected report
  const [editNotes, setEditNotes] = useState<string>("");

  // ── Pending selection after navigating from by-driver view
  const [pendingReportId, setPendingReportId] = useState<number | null>(null);

  // ── By-driver view
  const {
    byDriverSelectedId,
    setByDriverSelectedId,
    byDriverReports,
    setByDriverReports,
    isLoadingByDriverReports,
    byDriverExpandedYears,
    toggleByDriverYear,
    byDriverGroupedReports,
  } = useJobsReportByDriver();

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchDrivers();
    void fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekEnding, selectedYear, selectedMonth, statusFilter]);

  // Resolve pending report selection once fresh data loads
  useEffect(() => {
    if (pendingReportId === null || reports.length === 0) return;
    const found = reports.find((r) => r.id === pendingReportId);
    if (found) {
      setSelectedReport(found);
      setEditNotes(found.notes ?? "");
      setPendingReportId(null);
    }
  }, [pendingReportId, reports]);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchDrivers = async () => {
    try {
      const response = await fetch("/api/drivers");
      if (!response.ok) throw new Error("Failed to fetch drivers");
      const data: unknown = await response.json();
      setDrivers(
        Array.isArray(data)
          ? (data as Driver[]).filter((d) => !d.isArchived)
          : [],
      );
    } catch (error) {
      console.error("Error fetching drivers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch drivers",
        variant: "destructive",
      });
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs");
      if (!response.ok) throw new Error("Failed to fetch jobs");
      const data: unknown = await response.json();
      setJobs(Array.isArray(data) ? (data as Job[]) : []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  };

  const fetchReports = async (): Promise<JobsReport[]> => {
    setIsLoadingReports(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      let weekStartIso: string;
      let weekEndIso: string;

      if (weekEnding === SHOW_MONTH) {
        weekStartIso = formatIsoDate({
          year: selectedYear,
          monthIndex: selectedMonth,
          day: 1,
        });
        weekEndIso = formatIsoDate({
          year: selectedYear,
          monthIndex: selectedMonth,
          day: getDaysInMonth({
            year: selectedYear,
            monthIndex: selectedMonth,
          }),
        });
      } else {
        weekStartIso = addDaysToIsoDate({ isoDate: weekEnding, days: -6 });
        weekEndIso = weekEnding;
      }

      params.append("startDate", weekStartIso);
      params.append("endDate", weekEndIso);

      const response = await fetch(`/api/jobs-report?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data: unknown = await response.json();
      const fresh: JobsReport[] = Array.isArray(data)
        ? (data as JobsReport[])
        : [];
      setReports(fresh);
      return fresh;
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Error",
        description: "Failed to fetch reports",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoadingReports(false);
    }
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateReport = async () => {
    if (selectedDriverIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one driver",
        variant: "destructive",
      });
      return;
    }
    if (weekEnding === SHOW_MONTH) {
      toast({
        title: "Error",
        description: "Please select a specific week to create report(s)",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const weekEndingIso = weekEnding;

      if (selectedDriverIds.length === 1) {
        const driverId = parseInt(selectedDriverIds[0], 10);
        const response = await fetch("/api/jobs-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverId,
            weekEnding: weekEndingIso,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(
            (err as { error?: string }).error ?? "Failed to create report",
          );
        }

        const newReport = (await response.json()) as JobsReport;
        toast({ title: "Success", description: "Report created successfully" });

        const fresh = await fetchReports();
        const created = fresh.find((r) => r.id === newReport.id);
        if (created) {
          setSelectedReport(created);
          setEditNotes(created.notes ?? "");
        } else {
          setPendingReportId(newReport.id);
        }
      } else {
        // Batch creation
        const results = { success: [] as string[], failed: [] as string[] };

        for (const driverIdStr of selectedDriverIds) {
          const driverId = parseInt(driverIdStr, 10);
          const driver = drivers.find((d) => d.id === driverId);
          const driverName = driver?.driver ?? `Driver ${driverId}`;

          try {
            const response = await fetch("/api/jobs-report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                driverId,
                weekEnding: weekEndingIso,
              }),
            });

            if (response.ok) {
              results.success.push(driverName);
            } else {
              const err = await response.json();
              results.failed.push(
                `${driverName}: ${(err as { error?: string }).error ?? "Failed"}`,
              );
            }
          } catch (err) {
            results.failed.push(
              `${driverName}: ${err instanceof Error ? err.message : "Failed"}`,
            );
          }
        }

        await fetchReports();
        setSelectedDriverIds([]);

        if (results.success.length > 0 && results.failed.length === 0) {
          toast({
            title: "Success",
            description: `Created ${results.success.length} report${results.success.length > 1 ? "s" : ""} successfully`,
          });
        } else if (results.success.length > 0 && results.failed.length > 0) {
          toast({
            title: "Partially Successful",
            description: `Created ${results.success.length} report${results.success.length > 1 ? "s" : ""}. ${results.failed.length} failed.`,
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to create all reports",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error creating report:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create report(s)",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleFinaliseReport = async () => {
    if (!selectedReport) return;
    setIsFinalising(true);
    try {
      const response = await fetch(
        `/api/jobs-report/${selectedReport.id}/finalise`,
        { method: "POST" },
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          (err as { error?: string }).error ?? "Failed to finalise report",
        );
      }
      const updated = (await response.json()) as JobsReport;
      setSelectedReport(updated);
      setReports((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      toast({ title: "Success", description: "Report finalised successfully" });
    } catch (error) {
      console.error("Error finalising report:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to finalise report",
        variant: "destructive",
      });
    } finally {
      setIsFinalising(false);
    }
  };

  const handleUnfinaliseReport = async () => {
    if (!selectedReport) return;
    setIsFinalising(true);
    try {
      const response = await fetch(
        `/api/jobs-report/${selectedReport.id}/unfinalise`,
        { method: "POST" },
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          (err as { error?: string }).error ?? "Failed to revert report",
        );
      }
      const updated = (await response.json()) as JobsReport;
      setSelectedReport(updated);
      setEditNotes(updated.notes ?? "");
      setReports((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      toast({ title: "Success", description: "Report reverted to draft" });
    } catch (error) {
      console.error("Error reverting report:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to revert report",
        variant: "destructive",
      });
    } finally {
      setIsFinalising(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedReport) return;
    setIsSavingNotes(true);
    try {
      const response = await fetch(`/api/jobs-report/${selectedReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: editNotes }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          (err as { error?: string }).error ?? "Failed to save notes",
        );
      }
      const updated = (await response.json()) as JobsReport;
      setSelectedReport(updated);
      setReports((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      toast({ title: "Success", description: "Notes saved successfully" });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save notes",
        variant: "destructive",
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!selectedReport) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/jobs-report/${selectedReport.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          (err as { error?: string }).error ?? "Failed to delete report",
        );
      }
      setSelectedReport(null);
      setEditNotes("");
      setShowDeleteDialog(false);
      await fetchReports();
      toast({ title: "Success", description: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting report:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete report",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const applyUpdatedReport = ({ updated }: { updated: JobsReport }) => {
    setSelectedReport((prev) => (prev?.id === updated.id ? updated : prev));
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setByDriverReports((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r)),
    );
  };

  const {
    isAddingManualLine,
    manualLineData,
    setManualLineData,
    isSavingManualLine,
    deletingLineId,
    handleStartManualLine,
    handleCancelManualLine,
    handleAddManualLine,
    handleRemoveManualLine,
  } = useJobsReportManualLines({ selectedReport, applyUpdatedReport });

  const handleSelectReport = ({ report }: { report: JobsReport }) => {
    handleCancelManualLine();
    if (selectedReport?.id === report.id) {
      setSelectedReport(null);
      setEditNotes("");
    } else {
      setSelectedReport(report);
      setEditNotes(report.notes ?? "");
    }
  };

  const handleNavigateToReport = ({ report }: { report: JobsReport }) => {
    const weekEndingIso = report.weekEnding.substring(0, 10);
    setSelectedYear(parseInt(weekEndingIso.substring(0, 4), 10));
    setSelectedMonth(parseInt(weekEndingIso.substring(5, 7), 10) - 1);
    setWeekEnding(weekEndingIso);
    setSelectedDriverIds([report.driverId.toString()]);
    setPendingReportId(report.id);
    setActiveView("by-week");
  };

  const toggleDriverSelection = ({ driverId }: { driverId: string }) => {
    setSelectedDriverIds((prev) =>
      prev.includes(driverId)
        ? prev.filter((id) => id !== driverId)
        : [...prev, driverId],
    );
  };

  const handleSelectAllDrivers = () => {
    const allIds = nonArchivedDrivers.map((d) => d.id.toString());
    if (selectedDriverIds.length === allIds.length) {
      setSelectedDriverIds([]);
    } else {
      setSelectedDriverIds(allIds);
    }
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const nonArchivedDrivers = drivers.filter((d) => !d.isArchived);
  const employeeDrivers = nonArchivedDrivers.filter((d) => d.type === "Employee");
  const contractorDrivers = nonArchivedDrivers.filter(
    (d) => d.type === "Contractor",
  );
  const subcontractorDrivers = nonArchivedDrivers.filter(
    (d) => d.type === "Subcontractor",
  );

  const { years, months, weekEndings } = useMemo(
    () => getJobsReportPeriodOptions({ jobs, selectedYear, selectedMonth }),
    [jobs, selectedYear, selectedMonth],
  );

  const filteredReports = reports.filter(
    (r) =>
      selectedDriverIds.length === 0 ||
      selectedDriverIds.includes(r.driverId.toString()),
  );

  const {
    isDownloadingPdf,
    isDownloadingAllPdfs,
    handleDownloadPdf,
    handleDownloadAllPdfs,
  } = useJobsReportPdfDownloads({ selectedReport, filteredReports });

  const total = filteredReports.length;
  const draft = filteredReports.filter((r) => r.status === "draft").length;
  const finalised = filteredReports.filter((r) => r.status === "finalised").length;
  let totalJobs = 0;
  for (const r of filteredReports) totalJobs += r.lines?.length ?? 0;
  const summaryStats = { total, draft, finalised, totalJobs };

  const selectedDriver =
    nonArchivedDrivers.find((d) => d.id === selectedReport?.driverId) ?? null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredRole="admin"
        fallbackTitle="Admin Access Required"
        fallbackDescription="You need administrator permission to access the Jobs Report section."
      >
        {/* PageControls with Tabs */}
        <div className="sticky top-0 z-30 bg-white dark:bg-background border-b">
          <PageControls
            type="jobs-report"
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            weekEnding={weekEnding}
            years={years}
            months={months}
            weekEndings={weekEndings}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            onWeekEndingChange={(nextWeekEnding) => {
              if (typeof nextWeekEnding === "string") {
                setWeekEnding(nextWeekEnding);
              }
            }}
            showDateControls={activeView === "by-week"}
            tabs={
              <Tabs
                value={activeView}
                onValueChange={(v) =>
                  setActiveView(v as "by-week" | "by-driver")
                }
              >
                <TabsList>
                  <TabsTrigger value="by-week" id="view-by-week-tab">
                    <Calendar className="h-4 w-4 mr-2" aria-hidden="true" />
                    By Week Ending
                  </TabsTrigger>
                  <TabsTrigger value="by-driver" id="view-by-driver-tab">
                    <User className="h-4 w-4 mr-2" aria-hidden="true" />
                    By Driver
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
        </div>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <div className="container mx-auto px-4 py-6 space-y-5">
          {/* ════════════ BY-DRIVER VIEW ════════════ */}
          {activeView === "by-driver" && (
            <JobsReportByDriverView
              employeeDrivers={employeeDrivers}
              contractorDrivers={contractorDrivers}
              subcontractorDrivers={subcontractorDrivers}
              selectedDriverId={byDriverSelectedId}
              onSelectDriver={setByDriverSelectedId}
              isLoading={isLoadingByDriverReports}
              reportCount={byDriverReports.length}
              groupedReports={byDriverGroupedReports}
              expandedYears={byDriverExpandedYears}
              onToggleYear={toggleByDriverYear}
              onOpenReport={handleNavigateToReport}
            />
          )}

          {/* ════════════ BY-WEEK VIEW ════════════ */}
          {activeView === "by-week" && (
            <>
              <JobsReportSummaryStats summaryStats={summaryStats} />

              {/* Two-column layout */}
              <div className="flex gap-5 items-start">
                {/* ── Left sidebar ──────────────────────────────────────────── */}
                <div className="w-[360px] flex-shrink-0 space-y-4">
                  <JobsReportFiltersBar
                    employeeDrivers={employeeDrivers}
                    contractorDrivers={contractorDrivers}
                    subcontractorDrivers={subcontractorDrivers}
                    allDrivers={nonArchivedDrivers}
                    selectedDriverIds={selectedDriverIds}
                    onToggleDriver={toggleDriverSelection}
                    onSelectAllDrivers={handleSelectAllDrivers}
                    onClearDrivers={() => setSelectedDriverIds([])}
                    statusFilter={statusFilter}
                    onStatusChange={({ status }) => setStatusFilter(status)}
                    onCreateReport={handleCreateReport}
                    isCreating={isCreating}
                    isMonthView={weekEnding === SHOW_MONTH}
                    onDownloadAllPdfs={handleDownloadAllPdfs}
                    isDownloadingAllPdfs={isDownloadingAllPdfs}
                    hasReports={filteredReports.length > 0}
                  />

                  <JobsReportList
                    reports={filteredReports}
                    isLoading={isLoadingReports}
                    hasDriverFilter={selectedDriverIds.length > 0}
                    selectedReportId={selectedReport?.id ?? null}
                    onSelectReport={handleSelectReport}
                  />
                </div>

                {/* ── Right panel ───────────────────────────────────────────── */}
                <div className="flex-1 min-w-0">
                  {!selectedReport ? (
                    <div className="bg-card border rounded-lg p-16 text-center">
                      <FileText
                        className="h-12 w-12 text-muted-foreground mx-auto mb-4"
                        aria-hidden="true"
                      />
                      <h3 className="text-base font-medium text-muted-foreground">
                        No report selected
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select a report from the list, or select driver(s) and
                        click &ldquo;Create Report&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div className="bg-card border rounded-lg overflow-hidden">
                      <JobsReportDetailHeader
                        report={selectedReport}
                        isFinalising={isFinalising}
                        onFinalise={handleFinaliseReport}
                        onUnfinalise={handleUnfinaliseReport}
                        isDownloadingPdf={isDownloadingPdf}
                        onDownloadPdf={handleDownloadPdf}
                        onOpenEmailDialog={() => setShowEmailDialog(true)}
                        onOpenDeleteDialog={() => setShowDeleteDialog(true)}
                      />

                      <JobsReportNotes
                        report={selectedReport}
                        editNotes={editNotes}
                        onEditNotesChange={({ notes }) => setEditNotes(notes)}
                        onSaveNotes={handleSaveNotes}
                        isSavingNotes={isSavingNotes}
                      />

                      <JobsReportLinesTable
                        report={selectedReport}
                        isAddingManualLine={isAddingManualLine}
                        onStartManualLine={handleStartManualLine}
                        manualLineData={manualLineData}
                        setManualLineData={setManualLineData}
                        onSaveManualLine={handleAddManualLine}
                        onCancelManualLine={handleCancelManualLine}
                        isSavingManualLine={isSavingManualLine}
                        deletingLineId={deletingLineId}
                        onRemoveManualLine={handleRemoveManualLine}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Email dialog ──────────────────────────────────────────────────── */}
        <EmailJobsReportDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          report={selectedReport}
          driverEmail={selectedDriver?.email ?? null}
          onSent={({ sentAt }) => {
            if (!selectedReport) return;
            const updated: JobsReport = { ...selectedReport, sentAt };
            setSelectedReport(updated);
            setReports((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r)),
            );
          }}
        />

        <JobsReportDeleteDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDeleteReport}
          isDeleting={isDeleting}
        />
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
