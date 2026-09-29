"use client";

import { useState, useMemo, type SetStateAction } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useRctiHeaderFields } from "@/hooks/use-rcti-header-fields";
import { useRctiDeductions } from "@/hooks/use-rcti-deductions";
import { useRctiLines } from "@/hooks/use-rcti-lines";
import { useRctiPdfDownloads } from "@/hooks/use-rcti-pdf-downloads";
import { useRctiStatusActions } from "@/hooks/use-rcti-status-actions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, User } from "lucide-react";
import { RctiSettingsDialog } from "@/components/rcti/rcti-settings-dialog";
import { EmailRctiDialog } from "@/components/rcti/email-rcti-dialog";
import { RctiByDriverView } from "@/components/rcti/rcti-by-driver-view";
import { RctiSummaryStats } from "@/components/rcti/rcti-summary-stats";
import { RctiFiltersBar } from "@/components/rcti/rcti-filters-bar";
import { RctiListRow } from "@/components/rcti/rcti-list-row";
import { RctiDetailHeader } from "@/components/rcti/rcti-detail-header";
import { RctiHeaderFields } from "@/components/rcti/rcti-header-fields";
import { RctiLinesTable } from "@/components/rcti/rcti-lines-table";
import { RctiDeductionsPanel } from "@/components/rcti/rcti-deductions-panel";
import { RctiEditDeductionDialog } from "@/components/rcti/rcti-edit-deduction-dialog";
import { RctiAddJobsDialog } from "@/components/rcti/rcti-add-jobs-dialog";
import { RctiRevertDialog } from "@/components/rcti/rcti-revert-dialog";
import { startOfWeek, endOfWeek, getYear, getMonth } from "date-fns";
import { PageControls } from "@/components/layout/page-controls";
import { validateRctiLineEdits } from "@/lib/utils/rcti-line-validation";
import { getRctiPeriodOptions } from "@/lib/utils/rcti-period-options";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { fetchDriversList, fetchJobsList } from "@/lib/queries";
import type { Rcti, Driver, Job } from "@/lib/types";
import { pickNewerRecord } from "@/lib/utils/newer-record";

const EMPTY_DRIVERS: Driver[] = [];
const EMPTY_JOBS: Job[] = [];
const EMPTY_RCTIS: Rcti[] = [];

const SHOW_MONTH = "__SHOW_MONTH__";

function selectContractorDrivers(data: Driver[]): Driver[] {
  return Array.isArray(data)
    ? data.filter(
        (d: Driver) => d.type === "Contractor" || d.type === "Subcontractor",
      )
    : [];
}

/**
 * Query string for the RCTI list: the optional driver and status filters plus
 * the selected week (or whole month).
 */
function buildRctiListParams({
  selectedDriverIds,
  statusFilter,
  weekEnding,
  selectedYear,
  selectedMonth,
}: {
  selectedDriverIds: string[];
  statusFilter: string;
  weekEnding: Date | string;
  selectedYear: number;
  selectedMonth: number;
}): string {
  const params = new URLSearchParams();

  if (selectedDriverIds.length === 1) {
    params.append("driverId", selectedDriverIds[0]);
  }
  if (statusFilter !== "all") params.append("status", statusFilter);

  let weekStart: Date;
  let weekEnd: Date;

  if (weekEnding === SHOW_MONTH) {
    // Show whole month
    weekStart = new Date(selectedYear, selectedMonth, 1);
    weekEnd = new Date(selectedYear, selectedMonth + 1, 0);
  } else {
    // Show specific week
    weekStart = startOfWeek(weekEnding as Date, { weekStartsOn: 1 });
    weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });
  }

  params.append("startDate", weekStart.toISOString());
  params.append("endDate", weekEnd.toISOString());

  return params.toString();
}

export default function RCTIPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRcti, setSelectedRcti] = useState<Rcti | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // Bulk "mark as paid" selection state (by-week view)
  const [checkedRctiIds, setSelectedRctiIds] = useState<number[]>([]);
  const [isBulkPaying, setIsBulkPaying] = useState(false);

  // View mode: "by-week" or "by-driver"
  const [activeView, setActiveView] = useState<"by-week" | "by-driver">(
    "by-week",
  );

  // Filters
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Week navigation state (similar to Jobs page)
  const getUpcomingSunday = () => {
    return endOfWeek(new Date(), { weekStartsOn: 1 });
  };
  const upcomingSunday = getUpcomingSunday();

  const [selectedYear, setSelectedYear] = useState<number>(
    getYear(upcomingSunday),
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    getMonth(upcomingSunday),
  );
  const [weekEnding, setWeekEnding] = useState<Date | string>(upcomingSunday);

  const { data: drivers = EMPTY_DRIVERS } = useQuery({
    queryKey: queryKeys.drivers.list,
    queryFn: async () => {
      try {
        return await fetchDriversList();
      } catch (error) {
        console.error("Error fetching drivers:", error);
        toast({
          title: "Error",
          description: "Failed to fetch drivers",
          variant: "destructive",
        });
        throw error;
      }
    },
    select: selectContractorDrivers,
  });

  const { data: jobs = EMPTY_JOBS } = useQuery({
    queryKey: queryKeys.jobs.list,
    queryFn: async () => {
      try {
        return await fetchJobsList();
      } catch (error) {
        console.error("Error fetching jobs:", error);
        toast({
          title: "Error",
          description: "Failed to fetch jobs",
          variant: "destructive",
        });
        throw error;
      }
    },
  });

  // RCTIs for the current filters; the previous list stays visible while a
  // new filter loads
  const rctiListParams = buildRctiListParams({
    selectedDriverIds,
    statusFilter,
    weekEnding,
    selectedYear,
    selectedMonth,
  });
  const rctiListKey = queryKeys.rcti.list({ params: rctiListParams });
  const rctisQuery = useQuery({
    queryKey: rctiListKey,
    queryFn: async () => {
      try {
        const data = await fetchJson<Rcti[]>({
          url: `/api/rcti?${rctiListParams}`,
          init: { cache: "no-store" },
          fallbackMessage: "Failed to fetch RCTIs",
        });
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching RCTIs:", error);
        toast({
          title: "Error",
          description: "Failed to fetch RCTIs",
          variant: "destructive",
        });
        throw error;
      }
    },
    placeholderData: keepPreviousData,
  });
  const rctis = rctisQuery.data ?? EMPTY_RCTIS;
  const isLoadingRctis = rctisQuery.isLoading || rctisQuery.isPlaceholderData;

  // Only finalised RCTIs still in the list can stay checked for bulk payment
  const selectedRctiIds = checkedRctiIds.filter((id) =>
    rctis.some((r) => r.id === id && r.status === "finalised"),
  );

  /** Refetch the RCTI list and return the fresh list for the current filters. */
  const fetchRctis = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.rcti.all });
    return queryClient.getQueryData<Rcti[]>(rctiListKey) ?? [];
  };

  /** Update the cached RCTI list for the current filters without refetching. */
  const setRctis = (action: SetStateAction<Rcti[]>) => {
    queryClient.setQueryData<Rcti[]>(rctiListKey, (previous = []) =>
      typeof action === "function" ? action(previous) : action,
    );
  };

  // Form state for creating/editing RCTI
  const headerFields = useRctiHeaderFields({
    selectedDriverIds,
    drivers,
    selectedRcti,
  });
  const {
    businessName,
    driverAddress,
    driverAbn,
    gstStatus,
    gstMode,
    bankAccountName,
    bankBsb,
    bankAccountNumber,
    notes,
  } = headerFields;

  const {
    isLoadingDeductions,
    deductions,
    pendingDeductions,
    showDeductionForm,
    setShowDeductionForm,
    deductionFormData,
    setDeductionFormData,
    pendingDeductionAdjustments,
    setPendingDeductionAdjustments,
    editingDeduction,
    refreshDeductions,
    handleCreateDeduction,
    handleUpdateDeduction,
    handleDeleteDeduction,
    startEditingDeduction,
    cancelEditingDeduction,
  } = useRctiDeductions({ selectedRcti, setIsSaving });

  const {
    isDownloadingPdf,
    isDownloadingAllPdfs,
    handleDownloadPdf,
    handleDownloadAllPdfs,
  } = useRctiPdfDownloads({
    selectedRcti,
    rctis,
    selectedDriverIds,
    statusFilter,
  });

  const {
    editedLines,
    setEditedLines,
    deletingLineId,
    availableJobs,
    showAddJobDialog,
    setShowAddJobDialog,
    selectedJobsToAdd,
    setSelectedJobsToAdd,
    isAddingManualLine,
    setIsAddingManualLine,
    manualLineData,
    setManualLineData,
    handleRemoveLine,
    refreshAvailableJobs,
    handleAddJobs,
    closeAddJobDialog,
    handleAddManualLine,
    handleCancelManualLine,
    handleLineEdit,
  } = useRctiLines({ selectedRcti, setSelectedRcti, fetchRctis, setIsSaving });

  const {
    isFinalising,
    handleFinalizeRcti,
    handleUnfinalizeRcti,
    handleMarkAsPaid,
    handleDeleteRcti,
    handleToggleSent,
  } = useRctiStatusActions({
    selectedRcti,
    setSelectedRcti,
    setRctis,
    fetchRctis,
    setIsSaving,
    pendingDeductionAdjustments,
    setPendingDeductionAdjustments,
  });

  const handleRefreshRcti = async () => {
    if (!selectedRcti) return;

    if (
      !confirm(
        "Refresh this RCTI from the source jobs? Job lines, breaks, tolls and fuel levy will be regenerated from the current jobs for this week. Any manual edits to those lines will be replaced. Manually-added lines are kept.",
      )
    ) {
      return;
    }

    try {
      setIsRefreshing(true);

      // Rebuild the RCTI lines from the current source jobs
      const response = await fetch(`/api/rcti/${selectedRcti.id}/refresh`, {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to refresh RCTI");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);

      // Update form fields with refreshed data
      headerFields.loadFromRcti({ rcti: updatedRcti });
      setEditedLines(new Map());

      // Refresh deductions
      await refreshDeductions();

      // Refresh available jobs
      await refreshAvailableJobs();

      // Also refresh the list
      await fetchRctis();

      toast({
        title: "Success",
        description: "RCTI refreshed from source jobs",
      });
    } catch (error) {
      console.error("Error refreshing RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to refresh RCTI",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateRcti = async () => {
    if (selectedDriverIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one driver",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (weekEnding === SHOW_MONTH) {
        toast({
          title: "Error",
          description: "Please select a specific week to create RCTI(s)",
          variant: "destructive",
        });
        return;
      }

      const weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });

      // Handle single driver with custom settings
      if (selectedDriverIds.length === 1) {
        const driverId = parseInt(selectedDriverIds[0], 10);
        if (isNaN(driverId)) {
          toast({
            title: "Validation Error",
            description: "Invalid driver selection",
            variant: "destructive",
          });
          return;
        }

        const response = await fetch("/api/rcti", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverId,
            weekEnding: weekEnd.toISOString(),
            businessName: businessName || undefined,
            driverAddress: driverAddress || undefined,
            driverAbn: driverAbn || undefined,
            gstStatus,
            gstMode,
            bankAccountName: bankAccountName || undefined,
            bankBsb: bankBsb || undefined,
            bankAccountNumber: bankAccountNumber || undefined,
            notes: notes || undefined,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create RCTI");
        }

        const newRcti = await response.json();
        setSelectedRcti(newRcti);
        setPendingDeductionAdjustments(new Map()); // Clear adjustments for new RCTI
        await fetchRctis();

        toast({
          title: "Success",
          description: "RCTI created successfully",
        });
      } else {
        // Handle multiple drivers - batch creation
        const results = {
          success: [] as string[],
          failed: [] as string[],
        };

        // Create RCTIs for each selected driver
        for (const driverIdStr of selectedDriverIds) {
          const driverId = parseInt(driverIdStr, 10);
          const driver = drivers.find((d) => d.id === driverId);
          const driverName = driver?.driver || `Driver ${driverId}`;

          try {
            const response = await fetch("/api/rcti", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                driverId,
                weekEnding: weekEnd.toISOString(),
                businessName: driver?.businessName || undefined,
                driverAddress: driver?.address || undefined,
                driverAbn: driver?.abn || undefined,
                gstStatus: driver?.gstStatus || "not_registered",
                gstMode: driver?.gstMode || "exclusive",
                bankAccountName: driver?.bankAccountName || undefined,
                bankBsb: driver?.bankBsb || undefined,
                bankAccountNumber: driver?.bankAccountNumber || undefined,
              }),
            });

            if (response.ok) {
              results.success.push(driverName);
            } else {
              const error = await response.json();
              results.failed.push(`${driverName}: ${error.error || "Failed"}`);
            }
          } catch (error) {
            results.failed.push(
              `${driverName}: ${error instanceof Error ? error.message : "Failed"}`,
            );
          }
        }

        setPendingDeductionAdjustments(new Map()); // Clear adjustments after batch creation
        await fetchRctis();

        // Show summary toast
        if (results.success.length > 0 && results.failed.length === 0) {
          toast({
            title: "Success",
            description: `Created ${results.success.length} RCTI${results.success.length > 1 ? "s" : ""} successfully`,
          });
        } else if (results.success.length > 0 && results.failed.length > 0) {
          toast({
            title: "Partially Successful",
            description: `Created ${results.success.length} RCTI${results.success.length > 1 ? "s" : ""}. ${results.failed.length} failed.`,
            variant: "default",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to create all RCTIs",
            variant: "destructive",
          });
        }

        // Clear selection after batch creation
        setSelectedDriverIds([]);
      }
    } catch (error) {
      console.error("Error creating RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create RCTI(s)",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDriverSelection = ({ driverId }: { driverId: string }) => {
    setSelectedDriverIds((prev) =>
      prev.includes(driverId)
        ? prev.filter((id) => id !== driverId)
        : [...prev, driverId],
    );
  };

  const handleSelectAllDrivers = () => {
    const allDriverIds = [...contractorDrivers, ...subcontractorDrivers].map(
      (d) => d.id.toString(),
    );
    if (selectedDriverIds.length === allDriverIds.length) {
      setSelectedDriverIds([]);
    } else {
      setSelectedDriverIds(allDriverIds);
    }
  };

  const handleUpdateRcti = async () => {
    if (!selectedRcti) return;

    setIsSaving(true);
    try {
      const validation = validateRctiLineEdits({ editedLines });
      if (!validation.success) {
        throw new Error(
          "Invalid line data. Check all edited lines and try again. No changes were saved.",
        );
      }

      const lines = validation.data;

      const response = await fetch(`/api/rcti/${selectedRcti.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName || undefined,
          driverAddress: driverAddress || undefined,
          driverAbn: driverAbn || undefined,
          gstStatus,
          gstMode,
          bankAccountName: bankAccountName || undefined,
          bankBsb: bankBsb || undefined,
          bankAccountNumber: bankAccountNumber || undefined,
          notes: notes || undefined,
          lines: lines.length > 0 ? lines : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update RCTI");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);
      setEditedLines(new Map());
      await fetchRctis();
      // Refresh deductions after update
      await refreshDeductions();

      toast({
        title: "Success",
        description: "RCTI updated successfully",
      });
    } catch (error) {
      console.error("Error updating RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update RCTI",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Finalised RCTIs in the current list are the only ones eligible for bulk pay
  const payableRctis = rctis.filter((r) => r.status === "finalised");

  const toggleRctiSelection = ({ rctiId }: { rctiId: number }) => {
    setSelectedRctiIds((prev) =>
      prev.includes(rctiId)
        ? prev.filter((id) => id !== rctiId)
        : [...prev, rctiId],
    );
  };

  const handleToggleSelectAllPayable = () => {
    const payableIds = payableRctis.map((r) => r.id);
    const allSelected =
      payableIds.length > 0 &&
      payableIds.every((id) => selectedRctiIds.includes(id));
    setSelectedRctiIds(allSelected ? [] : payableIds);
  };

  const handleMarkSelectedAsPaid = async () => {
    if (selectedRctiIds.length === 0) return;

    setIsBulkPaying(true);
    try {
      const response = await fetch("/api/rcti/pay-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedRctiIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark RCTIs as paid");
      }

      const result = await response.json();
      const paidSelection = selectedRctiIds;
      setSelectedRctiIds([]);
      const freshRctis = await fetchRctis();

      // Keep the open detail pane in sync: if the expanded RCTI was part of the
      // batch, replace it with its refreshed record (or close it if gone).
      if (selectedRcti && paidSelection.includes(selectedRcti.id)) {
        const refreshed = freshRctis.find((r) => r.id === selectedRcti.id);
        setSelectedRcti(refreshed ?? null);
      }

      const skippedCount = result.skipped?.length || 0;
      if (skippedCount > 0) {
        toast({
          title: "Partially Successful",
          description: `Marked ${result.paidCount} RCTI${
            result.paidCount === 1 ? "" : "s"
          } as paid. ${skippedCount} skipped.`,
        });
      } else {
        toast({
          title: "Success",
          description: `Marked ${result.paidCount} RCTI${
            result.paidCount === 1 ? "" : "s"
          } as paid`,
        });
      }
    } catch (error) {
      console.error("Error marking RCTIs as paid:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to mark RCTIs as paid",
        variant: "destructive",
      });
    } finally {
      setIsBulkPaying(false);
    }
  };

  const handleReverted = async ({ rcti }: { rcti: Rcti }) => {
    setSelectedRcti(rcti);
    await fetchRctis();
  };

  // Handler for navigating from "By Driver" view to "By Week Ending" view
  const handleNavigateToRctiFromDriverView = ({
    rcti,
    weekEnding: rctiWeekEnding,
  }: {
    rcti: Rcti;
    weekEnding: Date;
  }) => {
    // Set the year/month/week to match the RCTI's week ending
    setSelectedYear(getYear(rctiWeekEnding));
    setSelectedMonth(getMonth(rctiWeekEnding));
    setWeekEnding(rctiWeekEnding);

    // Set the driver filter to this driver
    setSelectedDriverIds([rcti.driverId.toString()]);

    // Switch to "by-week" view
    setActiveView("by-week");

    // Expand the RCTI while its week loads (never toggle it closed)
    selectRcti({ rcti });
  };

  // Select an RCTI (its available jobs load for the selection)
  const selectRcti = ({ rcti }: { rcti: Rcti }) => {
    setSelectedRcti(rcti);
    headerFields.loadFromRcti({ rcti });
    setEditedLines(new Map());
  };

  const handleSelectRcti = ({ rcti }: { rcti: Rcti }) => {
    // Toggle: if clicking the same RCTI, deselect it
    if (selectedRcti?.id === rcti.id) {
      setSelectedRcti(null);
      headerFields.clearFields();
      setEditedLines(new Map());
    } else {
      selectRcti({ rcti });
    }
  };

  // Get selected driver name for filtering (only for single selection)
  const selectedDriver =
    selectedDriverIds.length === 1
      ? drivers.find((d) => d.id.toString() === selectedDriverIds[0])
      : null;

  // Filter jobs by selected driver (if single driver selected)
  const filteredJobs = selectedDriver
    ? jobs.filter((job) => job.driver === selectedDriver.driver)
    : jobs;

  // Group drivers by type for select dropdown
  const contractorDrivers = drivers.filter((d) => d.type === "Contractor");
  const subcontractorDrivers = drivers.filter(
    (d) => d.type === "Subcontractor",
  );

  const { years, months, weekEndings } = getRctiPeriodOptions({
    jobs: filteredJobs,
    selectedYear,
    selectedMonth,
  });

  const summaryStats = useMemo(() => {
    const total = rctis.length;
    const draft = rctis.filter((r) => r.status === "draft").length;
    const finalised = rctis.filter((r) => r.status === "finalised").length;
    const paid = rctis.filter((r) => r.status === "paid").length;
    const totalAmount = rctis.reduce((sum, r) => sum + Number(r.total), 0);

    return { total, draft, finalised, paid, totalAmount };
  }, [rctis]);

  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredRole="admin"
        fallbackTitle="Admin Access Required"
        fallbackDescription="You need administrator permission to access the RCTI section."
      >
        {/* PageControls with Tabs */}
        <div className="sticky top-0 z-30 bg-white dark:bg-background border-b">
          <PageControls
            type="rcti"
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            weekEnding={weekEnding}
            years={years}
            months={months}
            weekEndings={weekEndings}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            onWeekEndingChange={setWeekEnding}
            showDateControls={activeView === "by-week"}
            tabs={
              <Tabs
                value={activeView}
                onValueChange={(value) =>
                  setActiveView(value as "by-week" | "by-driver")
                }
              >
                <TabsList>
                  <TabsTrigger value="by-week" id="view-by-week-tab">
                    <Calendar className="h-4 w-4 mr-2" />
                    By Week Ending
                  </TabsTrigger>
                  <TabsTrigger value="by-driver" id="view-by-driver-tab">
                    <User className="h-4 w-4 mr-2" />
                    By Driver
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
        </div>

        <div className="container mx-auto px-4 py-6 space-y-5">
          {/* By Driver View */}
          {activeView === "by-driver" && (
            <RctiByDriverView
              drivers={drivers}
              onNavigateToRcti={handleNavigateToRctiFromDriverView}
            />
          )}

          {/* By Week Ending View */}
          {activeView === "by-week" && (
            <>
              <RctiSummaryStats summaryStats={summaryStats} />

              <RctiFiltersBar
                contractorDrivers={contractorDrivers}
                subcontractorDrivers={subcontractorDrivers}
                selectedDriverIds={selectedDriverIds}
                onToggleDriver={toggleDriverSelection}
                onSelectAllDrivers={handleSelectAllDrivers}
                onClearDrivers={() => setSelectedDriverIds([])}
                statusFilter={statusFilter}
                onStatusChange={({ status }) => setStatusFilter(status)}
                onOpenSettings={() => setShowSettingsDialog(true)}
                onCreateRcti={handleCreateRcti}
                isSaving={isSaving}
                isMonthView={weekEnding === SHOW_MONTH}
                rctis={rctis}
                onDownloadAllPdfs={handleDownloadAllPdfs}
                isDownloadingAllPdfs={isDownloadingAllPdfs}
                selectedRctiCount={selectedRctiIds.length}
                onMarkSelectedAsPaid={handleMarkSelectedAsPaid}
                isBulkPaying={isBulkPaying}
              />

              {/* RCTIs List */}
              {isLoadingRctis ? (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold">RCTIs</h2>
                    <p className="text-sm text-muted-foreground">
                      Loading RCTIs...
                    </p>
                  </div>
                  <LoadingSkeleton count={3} variant="card" />
                </div>
              ) : rctis.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold">RCTIs</h2>
                      <p className="text-sm text-muted-foreground">
                        Click to expand/collapse details
                      </p>
                    </div>
                    {payableRctis.length > 0 && (
                      <label
                        htmlFor="select-all-payable-rctis"
                        className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none"
                      >
                        <Checkbox
                          id="select-all-payable-rctis"
                          checked={payableRctis.every((r) =>
                            selectedRctiIds.includes(r.id),
                          )}
                          onCheckedChange={handleToggleSelectAllPayable}
                          aria-label="Select all finalised RCTIs for bulk payment"
                        />
                        Select all finalised ({payableRctis.length})
                      </label>
                    )}
                  </div>
                  <div className="space-y-2">
                    {rctis.flatMap((rcti) => {
                      const items = [
                        <RctiListRow
                          key={rcti.id}
                          rcti={rcti}
                          isSelected={selectedRcti?.id === rcti.id}
                          isChecked={selectedRctiIds.includes(rcti.id)}
                          onSelect={handleSelectRcti}
                          onToggleChecked={toggleRctiSelection}
                        />,
                      ];
                      if (selectedRcti?.id === rcti.id) {
                        const shownRcti = pickNewerRecord({
                          held: selectedRcti,
                          listed: rcti,
                        });
                        items.push(
                          <div key={`detail-${rcti.id}`} className="space-y-4">
                            <div className="bg-card border rounded-lg p-4">
                              <RctiDetailHeader
                                rcti={shownRcti}
                                isRefreshing={isRefreshing}
                                onRefresh={handleRefreshRcti}
                                isDownloadingPdf={isDownloadingPdf}
                                onDownloadPdf={handleDownloadPdf}
                                onOpenEmailDialog={() =>
                                  setShowEmailDialog(true)
                                }
                                onToggleSent={handleToggleSent}
                                isSaving={isSaving}
                                onSave={handleUpdateRcti}
                                isFinalising={isFinalising}
                                onFinalise={handleFinalizeRcti}
                                onDelete={handleDeleteRcti}
                                onUnfinalise={handleUnfinalizeRcti}
                                onMarkAsPaid={handleMarkAsPaid}
                                onOpenRevertDialog={() =>
                                  setShowRevertDialog(true)
                                }
                              />
                              <RctiHeaderFields
                                fields={headerFields}
                                status={shownRcti.status}
                              />
                            </div>

                            <RctiLinesTable
                              rcti={shownRcti}
                              editedLines={editedLines}
                              onLineEdit={handleLineEdit}
                              deletingLineId={deletingLineId}
                              onRemoveLine={handleRemoveLine}
                              onOpenAddJobs={() => setShowAddJobDialog(true)}
                              isAddingManualLine={isAddingManualLine}
                              onStartManualLine={() =>
                                setIsAddingManualLine(true)
                              }
                              manualLineData={manualLineData}
                              setManualLineData={setManualLineData}
                              onSaveManualLine={handleAddManualLine}
                              onCancelManualLine={handleCancelManualLine}
                              isSaving={isSaving}
                              pendingDeductions={pendingDeductions}
                              pendingDeductionAdjustments={
                                pendingDeductionAdjustments
                              }
                            />

                            <RctiDeductionsPanel
                              rcti={shownRcti}
                              isLoadingDeductions={isLoadingDeductions}
                              deductions={deductions}
                              pendingDeductions={pendingDeductions}
                              pendingDeductionAdjustments={
                                pendingDeductionAdjustments
                              }
                              setPendingDeductionAdjustments={
                                setPendingDeductionAdjustments
                              }
                              showDeductionForm={showDeductionForm}
                              setShowDeductionForm={setShowDeductionForm}
                              deductionFormData={deductionFormData}
                              setDeductionFormData={setDeductionFormData}
                              onCreateDeduction={handleCreateDeduction}
                              onEditDeduction={startEditingDeduction}
                              onDeleteDeduction={handleDeleteDeduction}
                              isSaving={isSaving}
                            />
                          </div>,
                        );
                      }

                      if (editingDeduction && selectedRcti?.id === rcti.id) {
                        items.push(
                          <RctiEditDeductionDialog
                            key={`edit-deduction-dialog-${rcti.id}`}
                            editingDeduction={editingDeduction}
                            deductionFormData={deductionFormData}
                            setDeductionFormData={setDeductionFormData}
                            onUpdate={handleUpdateDeduction}
                            onCancel={cancelEditingDeduction}
                            isSaving={isSaving}
                          />,
                        );
                      }

                      if (showAddJobDialog && selectedRcti?.id === rcti.id) {
                        items.push(
                          <RctiAddJobsDialog
                            key={`add-jobs-dialog-${rcti.id}`}
                            availableJobs={availableJobs}
                            selectedJobsToAdd={selectedJobsToAdd}
                            setSelectedJobsToAdd={setSelectedJobsToAdd}
                            onClose={closeAddJobDialog}
                            onAddJobs={handleAddJobs}
                            isSaving={isSaving}
                          />,
                        );
                      }
                      return items;
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold">RCTIs</h2>
                    <p className="text-sm text-muted-foreground">
                      No RCTIs found for the selected filters
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Company Settings Dialog */}
        <RctiSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          onSaved={() => {
            toast({
              title: "Success",
              description: "Company settings saved successfully",
            });
          }}
        />

        {/* Email RCTI Confirmation Dialog */}
        <EmailRctiDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          rcti={selectedRcti}
          driverEmail={
            selectedRcti
              ? (drivers.find((d) => d.id === selectedRcti.driverId)?.email ??
                null)
              : null
          }
          onSent={({ sentAt }) => {
            if (selectedRcti && sentAt) {
              setSelectedRcti({ ...selectedRcti, sentAt });
              setRctis((prev) =>
                prev.map((r) =>
                  r.id === selectedRcti.id ? { ...r, sentAt } : r,
                ),
              );
            }
          }}
        />

        {/* Revert to Draft Dialog */}
        <RctiRevertDialog
          open={showRevertDialog}
          onOpenChange={setShowRevertDialog}
          rcti={selectedRcti}
          onReverted={handleReverted}
        />
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
