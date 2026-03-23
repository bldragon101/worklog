"use client";

import { useState, useEffect, useMemo } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { getStatusBadge } from "@/components/shared/status-badge";
import { SummaryStatCard } from "@/components/shared/summary-stat-card";
import { SentBadge } from "@/components/shared/sent-badge";
import { DriverFilterPopover } from "@/components/shared/driver-filter-popover";
import { StatusFilterPopover } from "@/components/shared/status-filter-popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSkeleton, Spinner } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { EmailJobsReportDialog } from "@/components/jobs-report/email-jobs-report-dialog";
import { IconLogo } from "@/components/brand/icon-logo";
import { PageControls } from "@/components/layout/page-controls";
import {
  FileText,
  Plus,
  Lock,
  Unlock,
  Trash2,
  Download,
  Calendar,
  User,
  Mail,
  Briefcase,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Driver, Job, JobsReport } from "@/lib/types";

// ─── Helpers (defined outside component — no deps, stable references) ─────────

function formatDateDDMMYYYY({ isoString }: { isoString: string }): string {
  const parts = isoString.substring(0, 10).split("-");
  if (parts.length !== 3) return isoString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatWeekEndingLong({ isoString }: { isoString: string }): string {
  const parts = isoString.substring(0, 10).split("-");
  if (parts.length !== 3) return isoString;
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
  const monthName = months[parseInt(parts[1], 10) - 1] ?? "";
  return `${parseInt(parts[2], 10)} ${monthName} ${parts[0]}`;
}

function formatSentShort({ isoString }: { isoString: string }): string {
  const parts = isoString.substring(0, 10).split("-");
  if (parts.length !== 3) return isoString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const MELBOURNE_TZ = "Australia/Melbourne";

function pad2({ value }: { value: number }): string {
  return String(value).padStart(2, "0");
}

function isLeapYear({ year }: { year: number }): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

function getDaysInMonth({
  year,
  monthIndex,
}: {
  year: number;
  monthIndex: number;
}): number {
  const month = monthIndex + 1;
  if (month === 2) {
    return isLeapYear({ year }) ? 29 : 28;
  }

  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }

  return 31;
}

function getIsoDateParts({
  isoDate,
}: {
  isoDate: string;
}): { year: number; monthIndex: number; day: number } | null {
  const datePart = isoDate.substring(0, 10);
  const parts = datePart.split("-");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day))
    return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > getDaysInMonth({ year, monthIndex: month - 1 })) return null;

  return { year, monthIndex: month - 1, day };
}

function formatIsoDate({
  year,
  monthIndex,
  day,
}: {
  year: number;
  monthIndex: number;
  day: number;
}): string {
  return `${year}-${pad2({ value: monthIndex + 1 })}-${pad2({ value: day })}`;
}

function addDaysToIsoDate({
  isoDate,
  days,
}: {
  isoDate: string;
  days: number;
}): string {
  const parsed = getIsoDateParts({ isoDate });
  if (!parsed) return isoDate.substring(0, 10);

  let year = parsed.year;
  let monthIndex = parsed.monthIndex;
  let day = parsed.day;
  let remaining = days;

  while (remaining > 0) {
    const daysInMonth = getDaysInMonth({ year, monthIndex });
    if (day < daysInMonth) {
      day++;
    } else {
      day = 1;
      if (monthIndex === 11) {
        monthIndex = 0;
        year++;
      } else {
        monthIndex++;
      }
    }
    remaining--;
  }

  while (remaining < 0) {
    if (day > 1) {
      day--;
    } else {
      if (monthIndex === 0) {
        monthIndex = 11;
        year--;
      } else {
        monthIndex--;
      }
      day = getDaysInMonth({ year, monthIndex });
    }
    remaining++;
  }

  return formatIsoDate({ year, monthIndex, day });
}

function getDayOfWeek({
  isoDate,
}: {
  isoDate: string;
}): number {
  const parsed = getIsoDateParts({ isoDate });
  if (!parsed) return 0;

  let year = parsed.year;
  const month = parsed.monthIndex + 1;
  const day = parsed.day;
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (month < 3) year -= 1;
  return (
    (year +
      Math.floor(year / 4) -
      Math.floor(year / 100) +
      Math.floor(year / 400) +
      offsets[month - 1] +
      day) %
    7
  );
}

function getWeekEndingSundayIsoDate({
  isoDate,
}: {
  isoDate: string;
}): string {
  const dayOfWeek = getDayOfWeek({ isoDate });
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  return addDaysToIsoDate({ isoDate, days: daysUntilSunday });
}

function getMelbourneTodayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ─── Page ──────────────────────────────────────────────────────────────────────

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
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingAllPdfs, setIsDownloadingAllPdfs] = useState(false);
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
  const [byDriverSelectedId, setByDriverSelectedId] = useState<string>("");
  const [byDriverReports, setByDriverReports] = useState<JobsReport[]>([]);
  const [isLoadingByDriverReports, setIsLoadingByDriverReports] =
    useState(false);
  const [byDriverExpandedYears, setByDriverExpandedYears] = useState<
    Set<number>
  >(new Set());

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

  useEffect(() => {
    if (!byDriverSelectedId) return;
    void fetchByDriverReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDriverSelectedId]);

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

  const fetchByDriverReports = async () => {
    if (!byDriverSelectedId) return;
    setIsLoadingByDriverReports(true);
    try {
      const response = await fetch(
        `/api/jobs-report?driverId=${byDriverSelectedId}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Failed to fetch driver reports");
      const data: unknown = await response.json();
      const driverReports: JobsReport[] = Array.isArray(data)
        ? (data as JobsReport[])
        : [];
      setByDriverReports(driverReports);

      if (driverReports.length > 0) {
        const yrs = driverReports.map((r) =>
          parseInt(r.weekEnding.substring(0, 4), 10),
        );
        const maxYear = Math.max(...yrs);
        if (isFinite(maxYear)) setByDriverExpandedYears(new Set([maxYear]));
      }
    } catch (error) {
      console.error("Error fetching driver reports:", error);
      toast({
        title: "Error",
        description: "Failed to fetch reports",
        variant: "destructive",
      });
    } finally {
      setIsLoadingByDriverReports(false);
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

  const handleDownloadAllPdfs = async () => {
    const toDl = filteredReports.filter((r) => (r.lines?.length ?? 0) > 0);
    if (toDl.length === 0) {
      toast({
        title: "No Reports",
        description: "No reports with jobs to download",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingAllPdfs(true);
    let successCount = 0;
    let failCount = 0;

    for (const report of toDl) {
      try {
        const response = await fetch(`/api/jobs-report/${report.id}/pdf`);
        if (!response.ok) {
          failCount++;
          continue;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${report.reportNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        successCount++;
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 300);
        });
      } catch {
        failCount++;
      }
    }

    setIsDownloadingAllPdfs(false);

    if (failCount === 0) {
      toast({
        title: "Success",
        description: `Downloaded ${successCount} PDF${successCount !== 1 ? "s" : ""}`,
      });
    } else {
      toast({
        title: "Partially Successful",
        description: `Downloaded ${successCount} PDF${successCount !== 1 ? "s" : ""}. ${failCount} failed.`,
      });
    }
  };

  const handleFinaliseReport = async () => {
    if (!selectedReport) return;
    setIsFinalising(true);
    try {
      const response = await fetch(
        `/api/jobs-report/${selectedReport.id}/finalize`,
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
        `/api/jobs-report/${selectedReport.id}/unfinalize`,
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

  const handleDownloadPdf = async () => {
    if (!selectedReport) return;
    setIsDownloadingPdf(true);
    try {
      const response = await fetch(`/api/jobs-report/${selectedReport.id}/pdf`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          (err as { error?: string }).error ?? "Failed to generate PDF",
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedReport.reportNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "PDF downloaded successfully" });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPdf(false);
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

  const handleSelectReport = (report: JobsReport) => {
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

  const toggleByDriverYear = ({ year }: { year: number }) => {
    setByDriverExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const nonArchivedDrivers = useMemo(
    () => drivers.filter((d) => !d.isArchived),
    [drivers],
  );
  const employeeDrivers = useMemo(
    () => nonArchivedDrivers.filter((d) => d.type === "Employee"),
    [nonArchivedDrivers],
  );
  const contractorDrivers = useMemo(
    () => nonArchivedDrivers.filter((d) => d.type === "Contractor"),
    [nonArchivedDrivers],
  );
  const subcontractorDrivers = useMemo(
    () => nonArchivedDrivers.filter((d) => d.type === "Subcontractor"),
    [nonArchivedDrivers],
  );

  const years = useMemo(() => {
    const s = new Set<number>();
    s.add(selectedYear);
    for (const j of jobs) {
      if (j.date) {
        const year = parseInt(j.date.substring(0, 4), 10);
        if (Number.isFinite(year)) s.add(year);
      }
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [jobs, selectedYear]);

  const months = useMemo(() => {
    const s = new Set<number>();
    s.add(selectedMonth);
    for (const j of jobs) {
      if (j.date && parseInt(j.date.substring(0, 4), 10) === selectedYear) {
        const monthIndex = parseInt(j.date.substring(5, 7), 10) - 1;
        if (monthIndex >= 0 && monthIndex <= 11) {
          s.add(monthIndex);
        }
      }
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [jobs, selectedYear, selectedMonth]);

  const weekEndings = useMemo(() => {
    const s = new Set<string>();
    for (const j of jobs) {
      if (!j.date) continue;
      const weekEndingIso = getWeekEndingSundayIsoDate({
        isoDate: j.date.substring(0, 10),
      });
      if (
        parseInt(weekEndingIso.substring(0, 4), 10) === selectedYear &&
        parseInt(weekEndingIso.substring(5, 7), 10) - 1 === selectedMonth
      ) {
        s.add(weekEndingIso);
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [jobs, selectedYear, selectedMonth]);

  const filteredReports = useMemo(
    () =>
      reports.filter(
        (r) =>
          selectedDriverIds.length === 0 ||
          selectedDriverIds.includes(r.driverId.toString()),
      ),
    [reports, selectedDriverIds],
  );

  const summaryStats = useMemo(() => {
    const total = filteredReports.length;
    const draft = filteredReports.filter((r) => r.status === "draft").length;
    const finalised = filteredReports.filter(
      (r) => r.status === "finalised",
    ).length;
    let totalJobs = 0;
    for (const r of filteredReports) totalJobs += r.lines?.length ?? 0;
    return { total, draft, finalised, totalJobs };
  }, [filteredReports]);

  const byDriverGroupedReports = useMemo(() => {
    const grouped = new Map<number, JobsReport[]>();
    for (const r of byDriverReports) {
      const year = parseInt(r.weekEnding.substring(0, 4), 10);
      const existing = grouped.get(year);
      if (existing) {
        existing.push(r);
      } else {
        grouped.set(year, [r]);
      }
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, rpts]) => ({
        year,
        reports: rpts.sort((a, b) => b.weekEnding.localeCompare(a.weekEnding)),
      }));
  }, [byDriverReports]);

  const selectedDriver = useMemo(
    () =>
      nonArchivedDrivers.find((d) => d.id === selectedReport?.driverId) ?? null,
    [nonArchivedDrivers, selectedReport],
  );

  const totalHours = useMemo(() => {
    if (!selectedReport) return 0;
    let total = 0;
    for (const line of selectedReport.lines)
      total += Number(line.chargedHours ?? 0);
    return total;
  }, [selectedReport]);

  const totalDriverCharge = useMemo(() => {
    if (!selectedReport) return 0;
    let total = 0;
    for (const line of selectedReport.lines)
      total += Number(line.driverCharge ?? 0);
    return total;
  }, [selectedReport]);

  const totalTravelTime = useMemo(() => {
    if (!selectedReport) return 0;
    let total = 0;
    for (const line of selectedReport.lines) {
      const travel =
        Number(line.driverCharge ?? 0) - Number(line.chargedHours ?? 0);
      if (travel > 0) total += travel;
    }
    return total;
  }, [selectedReport]);

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
            <div className="space-y-5 max-w-2xl">
              <div className="bg-card border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-base">Select a Driver</h3>
                <Select
                  value={byDriverSelectedId}
                  onValueChange={setByDriverSelectedId}
                >
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

              {isLoadingByDriverReports && (
                <LoadingSkeleton count={3} variant="card" />
              )}

              {!isLoadingByDriverReports &&
                byDriverSelectedId &&
                byDriverReports.length === 0 && (
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

              {!isLoadingByDriverReports &&
                byDriverGroupedReports.length > 0 && (
                  <div className="space-y-3">
                    {byDriverGroupedReports.map(
                      ({ year, reports: yearReports }) => {
                        const isExpanded = byDriverExpandedYears.has(year);
                        return (
                          <div
                            key={year}
                            className="bg-card border rounded-lg overflow-hidden"
                          >
                            <button
                              type="button"
                              id={`driver-year-${year}-toggle`}
                              className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                              onClick={() => toggleByDriverYear({ year })}
                            >
                              <span className="font-semibold text-base">
                                {year}
                              </span>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="text-sm">
                                  {yearReports.length} report
                                  {yearReports.length !== 1 ? "s" : ""}
                                </span>
                                {isExpanded ? (
                                  <ChevronDown
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <ChevronRight
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
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
                                        {(r.lines?.length ?? 0) !== 1
                                          ? "s"
                                          : ""}
                                      </p>
                                    </div>
                                    <div className="ml-4 flex-shrink-0">
                                      <Button
                                        type="button"
                                        id={`by-driver-open-${r.id}`}
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          handleNavigateToReport({ report: r })
                                        }
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
                      },
                    )}
                  </div>
                )}
            </div>
          )}

          {/* ════════════ BY-WEEK VIEW ════════════ */}
          {activeView === "by-week" && (
            <>
              {/* Summary stats */}
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <SummaryStatCard
                  label="Total Reports"
                  value={summaryStats.total}
                  subtitle="This period"
                  icon={FileText}
                />
                <SummaryStatCard
                  label="Draft"
                  value={summaryStats.draft}
                  subtitle="In progress"
                  icon={FileText}
                />
                <SummaryStatCard
                  label="Finalised"
                  value={summaryStats.finalised}
                  subtitle="Locked"
                  icon={Lock}
                />
                <SummaryStatCard
                  label="Total Jobs"
                  value={summaryStats.totalJobs}
                  subtitle="Across all reports"
                  icon={Briefcase}
                />
              </div>

              {/* Two-column layout */}
              <div className="flex gap-5 items-start">
                {/* ── Left sidebar ──────────────────────────────────────────── */}
                <div className="w-[360px] flex-shrink-0 space-y-4">
                  {/* Filter + Create row — identical pattern to RCTI */}
                  <div className="bg-card border rounded-lg p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Driver multi-select popover */}
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
                        totalDriverCount={nonArchivedDrivers.length}
                        onToggleDriver={toggleDriverSelection}
                        onSelectAll={handleSelectAllDrivers}
                        onClear={() => setSelectedDriverIds([])}
                        idPrefix="jr"
                        allDrivers={nonArchivedDrivers}
                      />

                      {/* Status filter popover */}
                      <StatusFilterPopover
                        statuses={[
                          { value: "all", label: "All Statuses" },
                          { value: "draft", label: "Draft" },
                          { value: "finalised", label: "Finalised" },
                        ]}
                        statusFilter={statusFilter}
                        onStatusChange={({ status }) => setStatusFilter(status)}
                        idPrefix="jr"
                      />

                      {/* Create Report button — uses selectedDriverIds, same as RCTI */}
                      <Button
                        type="button"
                        id="jr-create-report-btn"
                        size="sm"
                        className="h-8"
                        disabled={
                          selectedDriverIds.length === 0 ||
                          isCreating ||
                          weekEnding === SHOW_MONTH
                        }
                        onClick={handleCreateReport}
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

                      {/* Download All PDFs button */}
                      <Button
                        type="button"
                        id="jr-download-all-pdfs-btn"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={
                          isDownloadingAllPdfs || filteredReports.length === 0
                        }
                        onClick={handleDownloadAllPdfs}
                      >
                        {isDownloadingAllPdfs ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download
                              className="mr-2 h-4 w-4"
                              aria-hidden="true"
                            />
                            Download All PDFs
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Reports list */}
                  {isLoadingReports ? (
                    <LoadingSkeleton count={3} variant="card" />
                  ) : filteredReports.length === 0 ? (
                    <div className="bg-card border rounded-lg p-8 text-center">
                      <FileText
                        className="h-8 w-8 text-muted-foreground mx-auto mb-2"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-muted-foreground">
                        {selectedDriverIds.length > 0
                          ? "No reports found for selected drivers this period"
                          : "No reports found for this period"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredReports.map((report) => (
                        <div
                          key={report.id}
                          role="button"
                          tabIndex={0}
                          id={`jr-report-item-${report.id}`}
                          className={`flex items-center justify-between p-3 bg-card border rounded-lg cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all ${
                            selectedReport?.id === report.id
                              ? "border-primary bg-accent"
                              : ""
                          }`}
                          onClick={() => handleSelectReport(report)}
                          onKeyUp={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              handleSelectReport(report);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {report.reportNumber}
                              </span>
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
                  )}
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
                      {/* Report header */}
                      <div className="p-5 border-b">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-xl font-bold">
                                {selectedReport.reportNumber}
                              </h2>
                              {getStatusBadge({
                                status: selectedReport.status,
                              })}
                              <SentBadge sentAt={selectedReport.sentAt} />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {selectedReport.driverName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Week ending{" "}
                              {formatWeekEndingLong({
                                isoString: selectedReport.weekEnding,
                              })}
                            </p>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2 flex-shrink-0">
                            {selectedReport.status === "draft" && (
                              <Button
                                type="button"
                                id="jr-finalise-btn"
                                size="sm"
                                onClick={handleFinaliseReport}
                                disabled={isFinalising}
                              >
                                {isFinalising ? (
                                  <>
                                    <Spinner size="sm" className="mr-2" />
                                    Finalising...
                                  </>
                                ) : (
                                  <>
                                    <Lock
                                      className="mr-2 h-4 w-4"
                                      aria-hidden="true"
                                    />
                                    Finalise Report
                                  </>
                                )}
                              </Button>
                            )}

                            {selectedReport.status === "finalised" && (
                              <Button
                                type="button"
                                id="jr-unfinalise-btn"
                                size="sm"
                                variant="outline"
                                onClick={handleUnfinaliseReport}
                                disabled={isFinalising}
                              >
                                {isFinalising ? (
                                  <>
                                    <Spinner size="sm" className="mr-2" />
                                    Reverting...
                                  </>
                                ) : (
                                  <>
                                    <Unlock
                                      className="mr-2 h-4 w-4"
                                      aria-hidden="true"
                                    />
                                    Unfinalize
                                  </>
                                )}
                              </Button>
                            )}

                            <Button
                              type="button"
                              id="jr-download-pdf-btn"
                              size="sm"
                              variant="outline"
                              onClick={handleDownloadPdf}
                              disabled={isDownloadingPdf}
                            >
                              {isDownloadingPdf ? (
                                <>
                                  <Spinner size="sm" className="mr-2" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Download
                                    className="mr-2 h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Download PDF
                                </>
                              )}
                            </Button>

                            {selectedReport.status === "finalised" && (
                              <Button
                                type="button"
                                id="jr-email-btn"
                                size="sm"
                                variant="outline"
                                title="Email report to driver"
                                onClick={() => setShowEmailDialog(true)}
                              >
                                <Mail
                                  className="mr-2 h-4 w-4"
                                  aria-hidden="true"
                                />
                                Email Report
                              </Button>
                            )}

                            {selectedReport.status === "draft" && (
                              <Button
                                type="button"
                                id="jr-delete-btn"
                                size="sm"
                                variant="destructive"
                                title="Delete draft report"
                                onClick={() => setShowDeleteDialog(true)}
                              >
                                <Trash2
                                  className="mr-2 h-4 w-4"
                                  aria-hidden="true"
                                />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Notes section */}
                      <div className="p-5 border-b">
                        <h4 className="text-sm font-semibold mb-2">Notes</h4>
                        {selectedReport.status === "draft" ? (
                          <div className="space-y-2">
                            <Textarea
                              id="jr-edit-notes"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Add notes to this report..."
                              rows={3}
                              className="resize-none text-sm"
                            />
                            <Button
                              type="button"
                              id="jr-save-notes-btn"
                              size="sm"
                              variant="outline"
                              onClick={handleSaveNotes}
                              disabled={
                                isSavingNotes ||
                                editNotes === (selectedReport.notes ?? "")
                              }
                            >
                              {isSavingNotes ? (
                                <>
                                  <Spinner size="sm" className="mr-2" />
                                  Saving...
                                </>
                              ) : (
                                "Save Notes"
                              )}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {selectedReport.notes ? (
                              selectedReport.notes
                            ) : (
                              <span className="italic">No notes</span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Jobs table */}
                      <div className="p-5">
                        <h4 className="text-sm font-semibold mb-3">
                          Jobs ({selectedReport.lines?.length ?? 0})
                        </h4>

                        {!selectedReport.lines ||
                        selectedReport.lines.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground border rounded-lg">
                            <Briefcase
                              className="h-8 w-8 mx-auto mb-2 opacity-50"
                              aria-hidden="true"
                            />
                            <p className="text-sm">
                              No jobs found for this driver and week
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                                    Date
                                  </th>
                                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                                    Customer
                                  </th>
                                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                                    Vehicle Type
                                  </th>
                                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                                    Description
                                  </th>
                                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                                    Hours
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedReport.lines.map((line) => (
                                  <tr
                                    key={line.id}
                                    className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                                  >
                                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">
                                      {formatDateDDMMYYYY({
                                        isoString: line.jobDate,
                                      })}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {line.customer}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      {line.truckType}
                                    </td>
                                    <td className="px-3 py-2.5 text-muted-foreground">
                                      {line.description ?? (
                                        <span className="italic opacity-50">
                                          —
                                        </span>
                                      )}
                                      {(line.startTime || line.finishTime) && (
                                        <div className="font-mono text-xs text-muted-foreground/70 mt-0.5">
                                          {line.startTime ?? "—"}
                                          {" – "}
                                          {line.finishTime ?? "—"}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                                      {(() => {
                                        const hours = Number(
                                          line.chargedHours ?? 0,
                                        );
                                        const charge = Number(
                                          line.driverCharge ?? 0,
                                        );
                                        const travel = charge - hours;
                                        if (hours === 0 && charge === 0) {
                                          return (
                                            <span className="text-muted-foreground">
                                              —
                                            </span>
                                          );
                                        }
                                        if (travel > 0.001) {
                                          return (
                                            <span>
                                              {hours % 1 === 0
                                                ? hours.toString()
                                                : hours.toFixed(2)}
                                              <span className="text-amber-600 dark:text-amber-400 ml-1">
                                                +
                                                {travel % 1 === 0
                                                  ? travel.toString()
                                                  : travel.toFixed(2)}{" "}
                                                travel
                                              </span>
                                              <span className="text-muted-foreground ml-1">
                                                ={" "}
                                                {charge % 1 === 0
                                                  ? charge.toString()
                                                  : charge.toFixed(2)}
                                              </span>
                                            </span>
                                          );
                                        }
                                        return hours % 1 === 0
                                          ? hours.toString()
                                          : hours.toFixed(2);
                                      })()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 bg-muted/20">
                                  <td
                                    colSpan={4}
                                    className="px-3 py-2.5 text-right font-semibold text-sm"
                                  >
                                    Total
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-bold font-mono text-sm">
                                    {totalTravelTime > 0 ? (
                                      <span>
                                        {totalHours % 1 === 0
                                          ? totalHours.toString()
                                          : totalHours.toFixed(2)}
                                        <span className="text-amber-600 dark:text-amber-400 ml-1">
                                          +
                                          {totalTravelTime % 1 === 0
                                            ? totalTravelTime.toString()
                                            : totalTravelTime.toFixed(2)}{" "}
                                          travel
                                        </span>
                                        <span className="text-muted-foreground font-normal ml-1">
                                          ={" "}
                                          {totalDriverCharge % 1 === 0
                                            ? totalDriverCharge.toString()
                                            : totalDriverCharge.toFixed(2)}
                                        </span>
                                      </span>
                                    ) : (
                                      <>
                                        {totalHours % 1 === 0
                                          ? totalHours.toString()
                                          : totalHours.toFixed(2)}
                                      </>
                                    )}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
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

        {/* ── Delete confirmation dialog ─────────────────────────────────────── */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Delete Report</DialogTitle>
              <DialogDescription>
                This will permanently delete the draft report and cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                id="jr-cancel-delete-btn"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                id="jr-confirm-delete-btn"
                onClick={handleDeleteReport}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
