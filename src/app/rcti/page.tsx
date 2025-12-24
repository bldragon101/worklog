"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton, Spinner } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FileText,
  DollarSign,
  Plus,
  Save,
  Lock,
  Unlock,
  Trash2,
  CheckCircle,
  Settings,
  Download,
  X,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import { RctiSettingsDialog } from "@/components/rcti/rcti-settings-dialog";
import {
  startOfWeek,
  endOfWeek,
  format,
  parseISO,
  getYear,
  getMonth,
  compareAsc,
  isWithinInterval,
} from "date-fns";
import { PageControls } from "@/components/layout/page-controls";
import { calculateLineAmounts } from "@/lib/utils/rcti-calculations";
import type {
  Rcti,
  Driver,
  Job,
  RctiDeduction,
  PendingDeductionsSummary,
} from "@/lib/types";

export default function RCTIPage() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rctis, setRctis] = useState<Rcti[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedRcti, setSelectedRcti] = useState<Rcti | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);
  const [isLoadingRctis, setIsLoadingRctis] = useState(false);
  const [isLoadingDeductions, setIsLoadingDeductions] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingAllPdfs, setIsDownloadingAllPdfs] = useState(false);
  const [deletingLineId, setDeletingLineId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Week navigation state (similar to Jobs page)
  const getUpcomingSunday = () => {
    return endOfWeek(new Date(), { weekStartsOn: 1 });
  };
  const upcomingSunday = getUpcomingSunday();

  const SHOW_MONTH = "__SHOW_MONTH__";

  const [selectedYear, setSelectedYear] = useState<number>(
    getYear(upcomingSunday),
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    getMonth(upcomingSunday),
  );
  const [weekEnding, setWeekEnding] = useState<Date | string>(upcomingSunday);

  // Form state for creating/editing RCTI
  const [businessName, setBusinessName] = useState("");
  const [driverAddress, setDriverAddress] = useState("");
  const [driverAbn, setDriverAbn] = useState("");
  const [gstStatus, setGstStatus] = useState<"registered" | "not_registered">(
    "not_registered",
  );
  const [gstMode, setGstMode] = useState<"exclusive" | "inclusive">(
    "exclusive",
  );
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankBsb, setBankBsb] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [editedLines, setEditedLines] = useState<
    Map<
      number,
      {
        chargedHours?: number | string;
        ratePerHour?: number | string;
        jobDate?: string;
        customer?: string;
        truckType?: string;
        description?: string;
      }
    >
  >(new Map());
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [showAddJobDialog, setShowAddJobDialog] = useState(false);
  const [selectedJobsToAdd, setSelectedJobsToAdd] = useState<number[]>([]);

  // Manual line entry state
  const [isAddingManualLine, setIsAddingManualLine] = useState(false);
  const [manualLineData, setManualLineData] = useState({
    jobDate: format(new Date(), "yyyy-MM-dd"),
    customer: "",
    truckType: "",
    description: "",
    chargedHours: "",
    ratePerHour: "",
  });

  // Deductions state
  const [deductions, setDeductions] = useState<RctiDeduction[]>([]);
  const [pendingDeductions, setPendingDeductions] =
    useState<PendingDeductionsSummary | null>(null);
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionFormData, setDeductionFormData] = useState({
    type: "deduction",
    description: "",
    totalAmount: "",
    frequency: "weekly",
    amountPerCycle: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });
  // Pending deduction adjustments for this RCTI (deductionId -> adjusted amount or null to skip)
  const [pendingDeductionAdjustments, setPendingDeductionAdjustments] =
    useState<Map<number, number | null>>(new Map());
  const [editingDeduction, setEditingDeduction] =
    useState<RctiDeduction | null>(null);

  // Fetch drivers and jobs
  useEffect(() => {
    fetchDrivers();
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch RCTIs when filters change
  useEffect(() => {
    fetchRctis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedDriverIds,
    weekEnding,
    selectedYear,
    selectedMonth,
    statusFilter,
  ]);

  // Fetch deductions when selected RCTI changes
  useEffect(() => {
    if (selectedRcti) {
      fetchDeductionsForRcti(selectedRcti);
      fetchPendingDeductionsForRcti(selectedRcti);
      // Clear adjustments when switching RCTIs (only when ID changes)
      setPendingDeductionAdjustments(new Map());
    } else {
      setDeductions([]);
      setPendingDeductions(null);
      setPendingDeductionAdjustments(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRcti?.id]);

  // Auto-populate driver details when single driver is selected
  useEffect(() => {
    if (selectedDriverIds.length === 1 && !selectedRcti) {
      const selectedDriver = drivers.find(
        (d) => d.id === parseInt(selectedDriverIds[0], 10),
      );
      if (selectedDriver) {
        setBusinessName(selectedDriver.businessName || "");
        setDriverAddress(selectedDriver.address || "");
        setDriverAbn(selectedDriver.abn || "");
        setGstStatus(
          (selectedDriver.gstStatus as "registered" | "not_registered") ||
            "not_registered",
        );
        setGstMode(
          (selectedDriver.gstMode as "exclusive" | "inclusive") || "exclusive",
        );
        setBankAccountName(selectedDriver.bankAccountName || "");
        setBankBsb(selectedDriver.bankBsb || "");
        setBankAccountNumber(selectedDriver.bankAccountNumber || "");
      }
    }
  }, [selectedDriverIds, drivers, selectedRcti]);

  const fetchDrivers = async () => {
    try {
      const response = await fetch("/api/drivers");
      if (!response.ok) throw new Error("Failed to fetch drivers");
      const data = await response.json();
      setDrivers(
        Array.isArray(data)
          ? data.filter(
              (d: Driver) =>
                d.type === "Contractor" || d.type === "Subcontractor",
            )
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
      const data = await response.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch jobs",
        variant: "destructive",
      });
    }
  };

  const fetchDeductionsForRcti = async (rcti: Rcti) => {
    setIsLoadingDeductions(true);
    try {
      const response = await fetch(
        `/api/rcti-deductions?driverId=${rcti.driverId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch deductions");
      const data = await response.json();
      setDeductions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching deductions:", error);
    } finally {
      setIsLoadingDeductions(false);
    }
  };

  const fetchPendingDeductionsForRcti = async (rcti: Rcti) => {
    setIsLoadingDeductions(true);
    try {
      const weekEnd = new Date(rcti.weekEnding);
      console.log("Fetching pending deductions for:", {
        driverId: rcti.driverId,
        weekEnding: weekEnd.toISOString(),
        rctiId: rcti.id,
      });
      const response = await fetch(
        `/api/rcti-deductions/pending?driverId=${rcti.driverId}&weekEnding=${weekEnd.toISOString()}`,
      );
      if (!response.ok) throw new Error("Failed to fetch pending deductions");
      const data = await response.json();
      console.log("Pending deductions response:", data);
      console.log("Number of pending deductions:", data?.pending?.length || 0);
      setPendingDeductions(data);
    } catch (error) {
      console.error("Error fetching pending deductions:", error);
    } finally {
      setIsLoadingDeductions(false);
    }
  };

  const fetchRctis = async () => {
    setIsLoadingRctis(true);
    try {
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

      const response = await fetch(`/api/rcti?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to fetch RCTIs");
      const data = await response.json();
      const freshRctis = Array.isArray(data) ? data : [];
      setRctis(freshRctis);
      return freshRctis;
    } catch (error) {
      console.error("Error fetching RCTIs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch RCTIs",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoadingRctis(false);
    }
  };

  const handleCreateDeduction = async () => {
    if (!selectedRcti) {
      toast({
        title: "Error",
        description: "Please select an RCTI first",
        variant: "destructive",
      });
      return;
    }

    if (!deductionFormData.description || !deductionFormData.totalAmount) {
      toast({
        title: "Validation Error",
        description: "Description and total amount are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/rcti-deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: selectedRcti.driverId,
          type: deductionFormData.type,
          description: deductionFormData.description,
          totalAmount: parseFloat(deductionFormData.totalAmount),
          frequency: deductionFormData.frequency,
          amountPerCycle:
            deductionFormData.frequency !== "once"
              ? parseFloat(deductionFormData.amountPerCycle || "0")
              : undefined,
          startDate: deductionFormData.startDate,
          notes: deductionFormData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create deduction");
      }

      await fetchDeductionsForRcti(selectedRcti);
      await fetchPendingDeductionsForRcti(selectedRcti);

      setDeductionFormData({
        type: "deduction",
        description: "",
        totalAmount: "",
        frequency: "weekly",
        amountPerCycle: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
        notes: "",
      });
      setShowDeductionForm(false);

      toast({
        title: "Success",
        description: "Deduction created successfully",
      });
    } catch (error) {
      console.error("Error creating deduction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create deduction",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDeduction = async () => {
    if (!editingDeduction || !selectedRcti) return;

    try {
      setIsSaving(true);
      const response = await fetch(
        `/api/rcti-deductions/${editingDeduction.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: deductionFormData.description,
            frequency: deductionFormData.frequency,
            amountPerCycle:
              deductionFormData.frequency !== "once" &&
              deductionFormData.amountPerCycle
                ? parseFloat(deductionFormData.amountPerCycle)
                : null,
            startDate: deductionFormData.startDate,
            notes: deductionFormData.notes || null,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update deduction");
      }

      await fetchDeductionsForRcti(selectedRcti);
      await fetchPendingDeductionsForRcti(selectedRcti);

      setEditingDeduction(null);
      setDeductionFormData({
        type: "deduction",
        description: "",
        totalAmount: "",
        frequency: "weekly",
        amountPerCycle: "",
        startDate: format(new Date(), "yyyy-MM-dd"),
        notes: "",
      });

      toast({
        title: "Success",
        description: "Deduction updated successfully",
      });
    } catch (error) {
      console.error("Error updating deduction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update deduction",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDeduction = async (deductionId: number) => {
    const deduction = deductions.find((d) => d.id === deductionId);
    const hasApplications = deduction && deduction.amountPaid > 0;

    const confirmMessage = hasApplications
      ? "This deduction has been partially applied. Deleting it will cancel future applications but preserve the payment history. Continue?"
      : "Are you sure you want to delete this deduction?";

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/rcti-deductions/${deductionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete deduction");
      }

      const result = await response.json();

      if (selectedRcti) {
        await fetchDeductionsForRcti(selectedRcti);
        await fetchPendingDeductionsForRcti(selectedRcti);
      }

      toast({
        title: "Success",
        description:
          result.message === "Deduction cancelled"
            ? "Deduction cancelled successfully"
            : "Deduction deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting deduction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete deduction",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLine = async (lineId: number) => {
    if (!selectedRcti) return;

    try {
      setDeletingLineId(lineId);
      const response = await fetch(
        `/api/rcti/${selectedRcti.id}/lines/${lineId}`,
        {
          method: "DELETE",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove line");
      }

      // Clean up editedLines Map for the deleted line
      setEditedLines((prev) => {
        const newMap = new Map(prev);
        newMap.delete(lineId);
        return newMap;
      });

      const freshRctis = await fetchRctis();
      const updatedRcti = freshRctis.find((r) => r.id === selectedRcti.id);
      if (updatedRcti) {
        setSelectedRcti(updatedRcti);
      }

      toast({
        title: "Success",
        description: "Line removed successfully",
      });
    } catch (error) {
      console.error("Error removing line:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove line",
        variant: "destructive",
      });
    } finally {
      setDeletingLineId(null);
    }
  };

  const handleRefreshRcti = async () => {
    if (!selectedRcti) return;

    try {
      setIsRefreshing(true);

      // Fetch the latest RCTI data from the server
      const response = await fetch(`/api/rcti/${selectedRcti.id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh RCTI");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);

      // Update form fields with refreshed data
      setBusinessName(updatedRcti.businessName || "");
      setDriverAddress(updatedRcti.driverAddress || "");
      setDriverAbn(updatedRcti.driverAbn || "");
      setGstStatus(updatedRcti.gstStatus as "registered" | "not_registered");
      setGstMode(updatedRcti.gstMode as "exclusive" | "inclusive");
      setBankAccountName(updatedRcti.bankAccountName || "");
      setBankBsb(updatedRcti.bankBsb || "");
      setBankAccountNumber(updatedRcti.bankAccountNumber || "");
      setNotes(updatedRcti.notes || "");
      setEditedLines(new Map());

      // Refresh deductions
      await fetchDeductionsForRcti(updatedRcti);
      await fetchPendingDeductionsForRcti(updatedRcti);

      // Refresh available jobs
      await fetchAvailableJobsForRcti(updatedRcti);

      // Also refresh the list
      await fetchRctis();

      toast({
        title: "Success",
        description: "RCTI refreshed successfully",
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

  const fetchAvailableJobsForRcti = async (rcti: Rcti) => {
    try {
      const weekStart = startOfWeek(parseISO(rcti.weekEnding), {
        weekStartsOn: 1,
      });
      const weekEnd = endOfWeek(parseISO(rcti.weekEnding), { weekStartsOn: 1 });

      // Get the driver to check type
      const driver = drivers.find((d) => d.driver === rcti.driverName);

      const allJobsForDriver = jobs.filter((job) => {
        // For subcontractors, match by registration = driver.truck
        if (driver?.type === "Subcontractor") {
          return job.registration === driver.truck;
        }

        // For contractors/employees, match by driver name
        return job.driver === rcti.driverName;
      });

      const jobsInWeek = allJobsForDriver.filter((job) => {
        const jobDate = parseISO(job.date);
        return isWithinInterval(jobDate, { start: weekStart, end: weekEnd });
      });

      // Filter out jobs already in the RCTI
      const existingJobIds = new Set(
        selectedRcti?.lines
          ?.map((line) => line.jobId)
          .filter((id): id is number => id !== null) || [],
      );
      const available = jobsInWeek.filter((job) => !existingJobIds.has(job.id));

      setAvailableJobs(available);
    } catch (error) {
      console.error("Error fetching available jobs:", error);
    }
  };

  const handleAddJobs = async () => {
    if (!selectedRcti || selectedJobsToAdd.length === 0) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/rcti/${selectedRcti.id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: selectedJobsToAdd }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add jobs");
      }

      const freshRctis = await fetchRctis();
      const updatedRcti = freshRctis.find((r) => r.id === selectedRcti.id);
      if (updatedRcti) {
        setSelectedRcti(updatedRcti);
        fetchAvailableJobsForRcti(updatedRcti);
      }

      setSelectedJobsToAdd([]);
      setShowAddJobDialog(false);

      toast({
        title: "Success",
        description: `${selectedJobsToAdd.length} job(s) added successfully`,
      });
    } catch (error) {
      console.error("Error adding jobs:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add jobs",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddManualLine = async () => {
    if (!selectedRcti) return;

    const { jobDate, customer, truckType, chargedHours, ratePerHour } =
      manualLineData;

    if (
      !jobDate ||
      !customer.trim() ||
      !truckType.trim() ||
      !chargedHours ||
      !ratePerHour
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/rcti/${selectedRcti.id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualLine: manualLineData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add manual line");
      }

      const freshRctis = await fetchRctis();
      const updatedRcti = freshRctis.find((r) => r.id === selectedRcti.id);
      if (updatedRcti) {
        setSelectedRcti(updatedRcti);
      }

      setIsAddingManualLine(false);
      setManualLineData({
        jobDate: format(new Date(), "yyyy-MM-dd"),
        customer: "",
        truckType: "",
        description: "",
        chargedHours: "",
        ratePerHour: "",
      });

      toast({
        title: "Success",
        description: "Manual line added successfully",
      });
    } catch (error) {
      console.error("Error adding manual line:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add manual line",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelManualLine = () => {
    setIsAddingManualLine(false);
    setManualLineData({
      jobDate: format(new Date(), "yyyy-MM-dd"),
      customer: "",
      truckType: "",
      description: "",
      chargedHours: "",
      ratePerHour: "",
    });
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
      const lines = Array.from(editedLines.entries())
        .map(([id, data]): { id: number; [key: string]: unknown } => {
          // Convert string values to numbers
          const convertedData: Record<string, unknown> = { ...data };
          if (data.chargedHours !== undefined) {
            convertedData.chargedHours =
              typeof data.chargedHours === "string"
                ? parseFloat(data.chargedHours)
                : data.chargedHours;
          }
          if (data.ratePerHour !== undefined) {
            convertedData.ratePerHour =
              typeof data.ratePerHour === "string"
                ? parseFloat(data.ratePerHour)
                : data.ratePerHour;
          }
          return {
            id,
            ...convertedData,
          };
        })
        .filter((line) => {
          // Validate numeric fields
          // - chargedHours can be negative (for break deductions), but not NaN or zero
          // - ratePerHour must be positive
          const chargedHours = line.chargedHours as number | undefined;
          const ratePerHour = line.ratePerHour as number | undefined;
          const hasValidChargedHours =
            chargedHours === undefined ||
            (!isNaN(chargedHours) && chargedHours !== 0);
          const hasValidRate =
            ratePerHour === undefined ||
            (!isNaN(ratePerHour) && ratePerHour > 0);
          return hasValidChargedHours && hasValidRate;
        });

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
      await fetchDeductionsForRcti(updatedRcti);
      await fetchPendingDeductionsForRcti(updatedRcti);

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

  const handleFinalizeRcti = async () => {
    if (!selectedRcti) return;

    setIsFinalising(true);
    try {
      // Convert adjustments Map to object
      const deductionOverrides: { [key: number]: number | null } = {};
      pendingDeductionAdjustments.forEach((value, key) => {
        deductionOverrides[key] = value;
      });

      const response = await fetch(`/api/rcti/${selectedRcti.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deductionOverrides:
            Object.keys(deductionOverrides).length > 0
              ? deductionOverrides
              : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to finalize RCTI");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);
      await fetchRctis();

      // Clear adjustments after successful finalization
      setPendingDeductionAdjustments(new Map());

      toast({
        title: "Success",
        description: "RCTI finalised successfully",
      });
    } catch (error) {
      console.error("Error finalizing RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to finalise RCTI",
        variant: "destructive",
      });
    } finally {
      setIsFinalising(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedRcti) return;

    setIsDownloadingPdf(true);
    try {
      const response = await fetch(`/api/rcti/${selectedRcti.id}/pdf`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate PDF");
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedRcti.invoiceNumber}.pdf`;
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
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadAllPdfs = async () => {
    setIsDownloadingAllPdfs(true);

    try {
      // Get filtered RCTIs based on current filters
      const filteredRctis = rctis.filter((rcti) => {
        const matchesDriver =
          selectedDriverIds.length === 0 ||
          selectedDriverIds.includes(rcti.driverId.toString());
        const matchesStatus =
          statusFilter === "all" || rcti.status === statusFilter;
        const hasLines = rcti.lines && rcti.lines.length > 0;
        return matchesDriver && matchesStatus && hasLines;
      });

      if (filteredRctis.length === 0) {
        toast({
          title: "No RCTIs Found",
          description: "No RCTIs with lines match the current filters",
          variant: "destructive",
        });
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const failedRctis: string[] = [];

      // Download each RCTI PDF with a small delay between downloads
      for (let i = 0; i < filteredRctis.length; i++) {
        const rcti = filteredRctis[i];
        try {
          const response = await fetch(`/api/rcti/${rcti.id}/pdf`);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || "Failed to generate PDF";
            throw new Error(errorMessage);
          }

          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${rcti.invoiceNumber}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          successCount++;

          // Add delay between downloads to avoid overwhelming the browser
          if (i < filteredRctis.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error(
            `Error downloading PDF for ${rcti.invoiceNumber}:`,
            errorMessage,
            `\nRCTI ID: ${rcti.id}, Status: ${rcti.status}, Lines: ${rcti.lines?.length || 0}`,
          );
          failCount++;
          failedRctis.push(rcti.invoiceNumber);
        }
      }

      if (failCount === 0) {
        toast({
          title: "Success",
          description: `Downloaded ${successCount} PDF${successCount !== 1 ? "s" : ""} successfully`,
        });
      } else if (successCount === 0) {
        toast({
          title: "Error",
          description: `Failed to download all PDFs. Check RCTI settings are configured.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Partial Success",
          description: `Downloaded ${successCount} PDF${successCount !== 1 ? "s" : ""}. Failed: ${failCount} (${failedRctis.slice(0, 3).join(", ")}${failedRctis.length > 3 ? "..." : ""})`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error downloading PDFs:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to download PDFs",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingAllPdfs(false);
    }
  };

  const handleUnfinalizeRcti = async () => {
    if (!selectedRcti) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rcti/${selectedRcti.id}/unfinalize`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unfinalize RCTI");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);
      await fetchRctis();

      toast({
        title: "Success",
        description: "RCTI reverted to draft",
      });
    } catch (error) {
      console.error("Error unfinalizing RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to unfinalise RCTI",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedRcti) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rcti/${selectedRcti.id}/pay`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark RCTI as paid");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);
      await fetchRctis();

      toast({
        title: "Success",
        description: "RCTI marked as paid",
      });
    } catch (error) {
      console.error("Error marking RCTI as paid:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to mark RCTI as paid",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRcti = async () => {
    if (!selectedRcti) return;

    if (
      !confirm(
        "Are you sure you want to delete this RCTI? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rcti/${selectedRcti.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete RCTI");
      }

      setSelectedRcti(null);
      await fetchRctis();

      toast({
        title: "Success",
        description: "RCTI deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete RCTI",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectRcti = (rcti: Rcti) => {
    // Toggle: if clicking the same RCTI, deselect it
    if (selectedRcti?.id === rcti.id) {
      setSelectedRcti(null);
      setBusinessName("");
      setDriverAddress("");
      setDriverAbn("");
      setGstStatus("not_registered");
      setGstMode("exclusive");
      setBankAccountName("");
      setBankBsb("");
      setBankAccountNumber("");
      setNotes("");
      setEditedLines(new Map());
      setAvailableJobs([]);
    } else {
      // Select the new RCTI
      setSelectedRcti(rcti);
      setBusinessName(rcti.businessName || "");
      setDriverAddress(rcti.driverAddress || "");
      setDriverAbn(rcti.driverAbn || "");
      setGstStatus(rcti.gstStatus as "registered" | "not_registered");
      setGstMode(rcti.gstMode as "exclusive" | "inclusive");
      setBankAccountName(rcti.bankAccountName || "");
      setBankBsb(rcti.bankBsb || "");
      setBankAccountNumber(rcti.bankAccountNumber || "");
      setNotes(rcti.notes || "");
      setEditedLines(new Map());
      fetchAvailableJobsForRcti(rcti);
    }
  };

  const handleLineEdit = ({
    lineId,
    field,
    value,
  }: {
    lineId: number;
    field:
      | "chargedHours"
      | "ratePerHour"
      | "jobDate"
      | "customer"
      | "truckType"
      | "description";
    value: number | string;
  }) => {
    // Allow empty strings for inputs, they'll be validated on save
    setEditedLines((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(lineId) || {};
      newMap.set(lineId, { ...existing, [field]: value });
      return newMap;
    });
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

  // Get all unique years from jobs (not RCTIs), ensuring the selected year is an option
  const yearsSet = new Set<number>();
  filteredJobs.forEach((job) => {
    if (job.date) {
      yearsSet.add(getYear(parseISO(job.date)));
    }
  });
  yearsSet.add(selectedYear);
  const years = Array.from(yearsSet).sort((a, b) => a - b);

  // Get months for selected year from jobs, ensuring selected month is an option
  const monthsSet = new Set<number>();
  filteredJobs.forEach((job) => {
    if (job.date) {
      const jobYear = getYear(parseISO(job.date));
      if (jobYear === selectedYear) {
        monthsSet.add(getMonth(parseISO(job.date)));
      }
    }
  });
  monthsSet.add(selectedMonth);
  const months = Array.from(monthsSet).sort((a, b) => a - b);

  // Get week endings from jobs for the selected driver, year, and month
  const weekEndingsSet = new Set<string>();

  filteredJobs.forEach((job) => {
    if (!job.date) return;
    const jobDate = parseISO(job.date);
    const weekEnd = endOfWeek(jobDate, { weekStartsOn: 1 });

    // Include week endings that match the selected year and month
    if (
      getYear(weekEnd) === selectedYear &&
      getMonth(weekEnd) === selectedMonth
    ) {
      weekEndingsSet.add(format(weekEnd, "yyyy-MM-dd"));
    }
  });

  // Also include weeks that start in the selected month but end in the next month
  filteredJobs.forEach((job) => {
    if (!job.date) return;
    const jobDate = parseISO(job.date);
    const weekEnd = endOfWeek(jobDate, { weekStartsOn: 1 });

    // Include if the job is in the selected month/year but week ends in next month
    if (
      getYear(jobDate) === selectedYear &&
      getMonth(jobDate) === selectedMonth
    ) {
      weekEndingsSet.add(format(weekEnd, "yyyy-MM-dd"));
    }
  });

  const weekEndings = Array.from(weekEndingsSet)
    .map((dateStr) => parseISO(dateStr))
    .sort((a, b) => compareAsc(a, b));

  const summaryStats = useMemo(() => {
    const total = rctis.length;
    const draft = rctis.filter((r) => r.status === "draft").length;
    const finalised = rctis.filter((r) => r.status === "finalised").length;
    const paid = rctis.filter((r) => r.status === "paid").length;
    const totalAmount = rctis.reduce((sum, r) => sum + Number(r.total), 0);

    return { total, draft, finalised, paid, totalAmount };
  }, [rctis]);

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

  return (
    <ProtectedLayout>
      <ProtectedRoute
        requiredRole="admin"
        fallbackTitle="Admin Access Required"
        fallbackDescription="You need administrator permission to access the RCTI section."
      >
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
          />
        </div>

        <div className="container mx-auto px-4 py-6 space-y-5">
          {/* Summary Stats */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total RCTIs
                </span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{summaryStats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">This period</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Draft
                </span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{summaryStats.draft}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Finalised
                </span>
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{summaryStats.finalised}</div>
              <p className="text-xs text-muted-foreground mt-1">Locked</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Paid
                </span>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{summaryStats.paid}</div>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
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
              <p className="text-xs text-muted-foreground mt-1">This period</p>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filters & Actions</h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettingsDialog(true)}
                  id="rcti-settings-button"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  RCTI Settings
                </Button>
              </div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Driver Filter */}
                <div className="flex items-center space-x-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-dashed rounded"
                        id="driver-filter-button"
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Driver
                        {selectedDriverIds.length > 0 && (
                          <div className="flex space-x-1">
                            {selectedDriverIds.length > 2 ? (
                              <span className="inline-flex items-center border py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-1 font-normal">
                                {selectedDriverIds.length} selected
                              </span>
                            ) : (
                              selectedDriverIds.map((driverId) => {
                                const driver = drivers.find(
                                  (d) => d.id.toString() === driverId,
                                );
                                return (
                                  <span
                                    key={driverId}
                                    className="inline-flex items-center border py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-1 font-normal"
                                  >
                                    {driver?.driver || driverId}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <div className="max-h-[400px] overflow-y-auto p-3">
                        <div className="grid gap-2">
                          <div className="flex items-center space-x-2 pb-2 border-b">
                            <Checkbox
                              id="select-all-drivers-filter"
                              checked={
                                selectedDriverIds.length ===
                                [...contractorDrivers, ...subcontractorDrivers]
                                  .length
                              }
                              onCheckedChange={handleSelectAllDrivers}
                              className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <Label
                              htmlFor="select-all-drivers-filter"
                              className="flex flex-1 items-center justify-between text-sm font-semibold cursor-pointer"
                            >
                              Select All
                              <span className="ml-auto font-mono text-xs text-muted-foreground">
                                {selectedDriverIds.length}/
                                {
                                  [
                                    ...contractorDrivers,
                                    ...subcontractorDrivers,
                                  ].length
                                }
                              </span>
                            </Label>
                          </div>

                          {contractorDrivers.length > 0 && (
                            <>
                              <div className="text-xs font-bold text-primary uppercase tracking-wide mt-2">
                                Contractors
                              </div>
                              {contractorDrivers.map((driver) => (
                                <div
                                  key={driver.id}
                                  className="flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={`filter-driver-${driver.id}`}
                                    checked={selectedDriverIds.includes(
                                      driver.id.toString(),
                                    )}
                                    onCheckedChange={() =>
                                      toggleDriverSelection({
                                        driverId: driver.id.toString(),
                                      })
                                    }
                                    className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                  <Label
                                    htmlFor={`filter-driver-${driver.id}`}
                                    className="flex flex-1 items-center justify-between text-sm font-normal cursor-pointer"
                                  >
                                    <span>{driver.driver}</span>
                                  </Label>
                                </div>
                              ))}
                            </>
                          )}

                          {subcontractorDrivers.length > 0 && (
                            <>
                              <div className="text-xs font-bold text-primary uppercase tracking-wide mt-2">
                                Subcontractors
                              </div>
                              {subcontractorDrivers.map((driver) => (
                                <div
                                  key={driver.id}
                                  className="flex items-center space-x-2"
                                >
                                  <Checkbox
                                    id={`filter-driver-${driver.id}`}
                                    checked={selectedDriverIds.includes(
                                      driver.id.toString(),
                                    )}
                                    onCheckedChange={() =>
                                      toggleDriverSelection({
                                        driverId: driver.id.toString(),
                                      })
                                    }
                                    className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                  <Label
                                    htmlFor={`filter-driver-${driver.id}`}
                                    className="flex flex-1 items-center justify-between text-sm font-normal cursor-pointer"
                                  >
                                    <span>{driver.driver}</span>
                                  </Label>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                        {selectedDriverIds.length > 0 && (
                          <div className="pt-3 mt-3 border-t">
                            <Button
                              variant="ghost"
                              onClick={() => setSelectedDriverIds([])}
                              className="w-full h-8 text-sm"
                              type="button"
                            >
                              Clear filters
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {selectedDriverIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setSelectedDriverIds([])}
                      title="Clear Driver filter"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center space-x-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-dashed rounded"
                        id="status-filter-button"
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Status
                        {statusFilter !== "all" && (
                          <span className="inline-flex items-center border py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded px-1 font-normal ml-2">
                            {statusFilter === "draft"
                              ? "Draft"
                              : statusFilter === "finalised"
                                ? "Finalised"
                                : "Paid"}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[180px] p-0" align="start">
                      <div className="p-3">
                        <div className="grid gap-2">
                          <div
                            className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                            onClick={() => setStatusFilter("all")}
                          >
                            <Checkbox
                              id="status-all"
                              checked={statusFilter === "all"}
                              className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <Label
                              htmlFor="status-all"
                              className="text-sm font-normal cursor-pointer"
                            >
                              All Statuses
                            </Label>
                          </div>
                          <div
                            className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                            onClick={() => setStatusFilter("draft")}
                          >
                            <Checkbox
                              id="status-draft"
                              checked={statusFilter === "draft"}
                              className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <Label
                              htmlFor="status-draft"
                              className="text-sm font-normal cursor-pointer"
                            >
                              Draft
                            </Label>
                          </div>
                          <div
                            className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                            onClick={() => setStatusFilter("finalised")}
                          >
                            <Checkbox
                              id="status-finalised"
                              checked={statusFilter === "finalised"}
                              className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <Label
                              htmlFor="status-finalised"
                              className="text-sm font-normal cursor-pointer"
                            >
                              Finalised
                            </Label>
                          </div>
                          <div
                            className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                            onClick={() => setStatusFilter("paid")}
                          >
                            <Checkbox
                              id="status-paid"
                              checked={statusFilter === "paid"}
                              className="rounded-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <Label
                              htmlFor="status-paid"
                              className="text-sm font-normal cursor-pointer"
                            >
                              Paid
                            </Label>
                          </div>
                        </div>
                        {statusFilter !== "all" && (
                          <div className="pt-3 mt-3 border-t">
                            <Button
                              variant="ghost"
                              onClick={() => setStatusFilter("all")}
                              className="w-full h-8 text-sm"
                              type="button"
                            >
                              Clear filter
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {statusFilter !== "all" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setStatusFilter("all")}
                      title="Clear Status filter"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Create RCTI Button */}
                <Button
                  type="button"
                  id="create-rcti-btn"
                  onClick={handleCreateRcti}
                  disabled={
                    selectedDriverIds.length === 0 ||
                    isSaving ||
                    weekEnding === SHOW_MONTH
                  }
                  size="sm"
                  className="h-8"
                >
                  {isSaving ? (
                    <Spinner className="mr-2 h-4 w-4" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {selectedDriverIds.length === 0
                    ? "Create RCTI"
                    : selectedDriverIds.length === 1
                      ? "Create RCTI"
                      : `Create ${selectedDriverIds.length} RCTIs`}
                </Button>

                {/* Download All PDFs Button */}
                <Button
                  type="button"
                  id="download-all-pdfs-btn"
                  onClick={handleDownloadAllPdfs}
                  disabled={
                    isDownloadingAllPdfs ||
                    rctis.filter((rcti) => {
                      const matchesDriver =
                        selectedDriverIds.length === 0 ||
                        selectedDriverIds.includes(rcti.driverId.toString());
                      const matchesStatus =
                        statusFilter === "all" || rcti.status === statusFilter;
                      return matchesDriver && matchesStatus;
                    }).length === 0
                  }
                  size="sm"
                  variant="outline"
                  className="h-8"
                >
                  {isDownloadingAllPdfs ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download All PDFs
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

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
              <div>
                <h2 className="text-lg font-semibold">RCTIs</h2>
                <p className="text-sm text-muted-foreground">
                  Click to expand/collapse details
                </p>
              </div>
              <div className="space-y-2">
                {rctis.map((rcti) => (
                  <div
                    key={rcti.id}
                    className={`flex items-center justify-between p-3 bg-card border rounded-lg cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all ${
                      selectedRcti?.id === rcti.id
                        ? "border-primary bg-accent"
                        : ""
                    }`}
                    onClick={() => handleSelectRcti(rcti)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {rcti.invoiceNumber}
                        </span>
                        {getStatusBadge(rcti.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rcti.driverName} - Week ending{" "}
                        {format(new Date(rcti.weekEnding), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        ${Number(rcti.total).toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {rcti.lines?.length || 0} lines
                      </p>
                    </div>
                  </div>
                ))}
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

          {/* Selected RCTI Details */}
          {selectedRcti && (
            <div className="space-y-4">
              <div className="bg-card border rounded-lg p-4">
                <div className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {selectedRcti.invoiceNumber} -{" "}
                        {getStatusBadge(selectedRcti.status)}
                      </CardTitle>
                      <CardDescription>
                        {selectedRcti.driverName} - Week ending{" "}
                        {format(
                          new Date(selectedRcti.weekEnding),
                          "MMM d, yyyy",
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        id="refresh-rcti-btn"
                        onClick={handleRefreshRcti}
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
                      <Button
                        type="button"
                        id="download-rcti-pdf-btn"
                        onClick={handleDownloadPdf}
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
                      {selectedRcti.status === "draft" && (
                        <>
                          <Button
                            type="button"
                            id="save-rcti-btn"
                            onClick={handleUpdateRcti}
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
                            onClick={handleFinalizeRcti}
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
                            onClick={handleDeleteRcti}
                            disabled={isSaving}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </>
                      )}
                      {selectedRcti.status === "finalised" && (
                        <>
                          <Button
                            type="button"
                            id="unfinalize-rcti-btn"
                            onClick={handleUnfinalizeRcti}
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
                            onClick={handleMarkAsPaid}
                            disabled={isSaving}
                            size="sm"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark as Paid
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="business-name">
                        Business/Trading Name
                      </Label>
                      <Input
                        id="business-name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        disabled={selectedRcti.status !== "draft"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driver-address">Address</Label>
                      <Input
                        id="driver-address"
                        value={driverAddress}
                        onChange={(e) => setDriverAddress(e.target.value)}
                        disabled={selectedRcti.status !== "draft"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driver-abn">ABN</Label>
                      <Input
                        id="driver-abn"
                        value={driverAbn}
                        onChange={(e) => setDriverAbn(e.target.value)}
                        disabled={selectedRcti.status !== "draft"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gst-status">GST Status</Label>
                      <Select
                        value={gstStatus}
                        onValueChange={(value) =>
                          setGstStatus(value as "registered" | "not_registered")
                        }
                        disabled={selectedRcti.status !== "draft"}
                      >
                        <SelectTrigger id="gst-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_registered">
                            Not Registered
                          </SelectItem>
                          <SelectItem value="registered">Registered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gst-mode">GST Mode</Label>
                      <Select
                        value={gstMode}
                        onValueChange={(value) =>
                          setGstMode(value as "exclusive" | "inclusive")
                        }
                        disabled={
                          selectedRcti.status !== "draft" ||
                          gstStatus === "not_registered"
                        }
                      >
                        <SelectTrigger id="gst-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exclusive">Exclusive</SelectItem>
                          <SelectItem value="inclusive">Inclusive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bank-account-name">
                        Bank Account Name
                      </Label>
                      <Input
                        id="bank-account-name"
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value)}
                        disabled={selectedRcti.status !== "draft"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bank-bsb">BSB</Label>
                      <Input
                        id="bank-bsb"
                        value={bankBsb}
                        onChange={(e) => setBankBsb(e.target.value)}
                        disabled={selectedRcti.status !== "draft"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bank-account-number">
                        Account Number
                      </Label>
                      <Input
                        id="bank-account-number"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        disabled={selectedRcti.status !== "draft"}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={selectedRcti.status !== "draft"}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Lines Table */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="p-4 border-b bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Invoice Lines</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedRcti.lines?.length || 0} jobs included
                      </p>
                    </div>
                    {selectedRcti.status === "draft" && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddJobDialog(true)}
                          disabled={isAddingManualLine}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Jobs
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() => setIsAddingManualLine(true)}
                          disabled={isAddingManualLine}
                          id="add-manual-line-btn"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Manual Line
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 text-sm font-medium w-32">
                            Date
                          </th>
                          <th className="text-left p-2 text-sm font-medium">
                            Customer
                          </th>
                          <th className="text-left p-2 text-sm font-medium w-28">
                            Truck Type
                          </th>
                          <th className="text-left p-2 text-sm font-medium">
                            Description
                          </th>
                          <th className="text-right p-2 text-sm font-medium w-24">
                            Hours
                          </th>
                          <th className="text-right p-2 text-sm font-medium w-28">
                            Rate
                          </th>
                          <th className="text-right p-2 text-sm font-medium w-28">
                            Ex GST
                          </th>
                          <th className="text-right p-2 text-sm font-medium w-24">
                            GST
                          </th>
                          <th className="text-right p-2 text-sm font-medium w-28">
                            Inc GST
                          </th>
                          {selectedRcti.status === "draft" && (
                            <th className="p-2 text-sm font-medium w-16">
                              Action
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {isAddingManualLine && (
                          <tr className="border-b bg-accent/50">
                            <td className="p-2 w-32">
                              <Input
                                type="date"
                                value={manualLineData.jobDate}
                                onChange={(e) =>
                                  setManualLineData({
                                    ...manualLineData,
                                    jobDate: e.target.value,
                                  })
                                }
                                className="w-full"
                                id="manual-line-date"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="text"
                                placeholder="Customer"
                                value={manualLineData.customer}
                                onChange={(e) =>
                                  setManualLineData({
                                    ...manualLineData,
                                    customer: e.target.value,
                                  })
                                }
                                className="w-full"
                                id="manual-line-customer"
                              />
                            </td>
                            <td className="p-2 w-28">
                              <Input
                                type="text"
                                placeholder="Truck Type"
                                value={manualLineData.truckType}
                                onChange={(e) =>
                                  setManualLineData({
                                    ...manualLineData,
                                    truckType: e.target.value,
                                  })
                                }
                                className="w-full"
                                id="manual-line-truck-type"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="text"
                                placeholder="Description"
                                value={manualLineData.description}
                                onChange={(e) =>
                                  setManualLineData({
                                    ...manualLineData,
                                    description: e.target.value,
                                  })
                                }
                                className="w-full"
                                id="manual-line-description"
                              />
                            </td>
                            <td className="p-2 w-24">
                              <Input
                                type="number"
                                step="0.25"
                                placeholder="Hours"
                                value={manualLineData.chargedHours}
                                onChange={(e) =>
                                  setManualLineData({
                                    ...manualLineData,
                                    chargedHours: e.target.value,
                                  })
                                }
                                className="w-full text-right"
                                id="manual-line-hours"
                              />
                            </td>
                            <td className="p-2 w-28">
                              <Input
                                type="number"
                                step="0.25"
                                placeholder="Rate"
                                value={manualLineData.ratePerHour}
                                onChange={(e) =>
                                  setManualLineData({
                                    ...manualLineData,
                                    ratePerHour: e.target.value,
                                  })
                                }
                                className="w-full text-right"
                                id="manual-line-rate"
                              />
                            </td>
                            <td className="p-2 text-right text-sm text-muted-foreground">
                              -
                            </td>
                            <td className="p-2 text-right text-sm text-muted-foreground">
                              -
                            </td>
                            <td className="p-2 text-right text-sm text-muted-foreground">
                              -
                            </td>
                            <td className="p-2">
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  onClick={handleAddManualLine}
                                  disabled={isSaving}
                                  id="save-manual-line-btn"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelManualLine}
                                  disabled={isSaving}
                                  id="cancel-manual-line-btn"
                                >
                                  ×
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {selectedRcti.lines?.map((line) => {
                          // Show skeleton for line being deleted
                          if (deletingLineId === line.id) {
                            return (
                              <tr key={line.id} className="border-b">
                                <td
                                  colSpan={
                                    selectedRcti.status === "draft" ? 8 : 7
                                  }
                                  className="p-2"
                                >
                                  <LoadingSkeleton count={1} variant="list" />
                                </td>
                              </tr>
                            );
                          }

                          const edits = editedLines.get(line.id);
                          const hours =
                            edits?.chargedHours !== undefined
                              ? edits.chargedHours
                              : Number(line.chargedHours);
                          const rate =
                            edits?.ratePerHour !== undefined
                              ? edits.ratePerHour
                              : Number(line.ratePerHour);
                          const jobDate =
                            edits?.jobDate ??
                            format(new Date(line.jobDate), "yyyy-MM-dd");
                          const customer = edits?.customer ?? line.customer;
                          const truckType = edits?.truckType ?? line.truckType;
                          const description =
                            edits?.description ?? line.description ?? "";

                          // Calculate amounts live if hours or rate have been edited
                          const amounts =
                            edits?.chargedHours !== undefined ||
                            edits?.ratePerHour !== undefined
                              ? calculateLineAmounts({
                                  chargedHours:
                                    typeof hours === "string"
                                      ? parseFloat(hours) || 0
                                      : hours,
                                  ratePerHour:
                                    typeof rate === "string"
                                      ? parseFloat(rate) || 0
                                      : rate,
                                  gstStatus: selectedRcti.gstStatus as
                                    | "registered"
                                    | "not_registered",
                                  gstMode: selectedRcti.gstMode as
                                    | "exclusive"
                                    | "inclusive",
                                })
                              : {
                                  amountExGst: Number(line.amountExGst),
                                  gstAmount: Number(line.gstAmount),
                                  amountIncGst: Number(line.amountIncGst),
                                };

                          return (
                            <tr
                              key={line.id}
                              className="border-b hover:bg-muted/50 transition-colors"
                            >
                              <td className="p-2 text-sm w-32">
                                {selectedRcti.status === "draft" ? (
                                  <Input
                                    type="date"
                                    value={jobDate}
                                    onChange={(e) =>
                                      handleLineEdit({
                                        lineId: line.id,
                                        field: "jobDate",
                                        value: e.target.value,
                                      })
                                    }
                                    className="w-full"
                                  />
                                ) : (
                                  format(new Date(line.jobDate), "MMM d")
                                )}
                              </td>
                              <td className="p-2 text-sm">
                                {selectedRcti.status === "draft" ? (
                                  <Input
                                    type="text"
                                    value={customer}
                                    onChange={(e) =>
                                      handleLineEdit({
                                        lineId: line.id,
                                        field: "customer",
                                        value: e.target.value,
                                      })
                                    }
                                    className="w-full"
                                  />
                                ) : (
                                  line.customer
                                )}
                              </td>
                              <td className="p-2 text-sm w-28">
                                {selectedRcti.status === "draft" ? (
                                  <Input
                                    type="text"
                                    value={truckType}
                                    onChange={(e) =>
                                      handleLineEdit({
                                        lineId: line.id,
                                        field: "truckType",
                                        value: e.target.value,
                                      })
                                    }
                                    className="w-full"
                                  />
                                ) : (
                                  line.truckType
                                )}
                              </td>
                              <td className="p-2 text-sm">
                                {selectedRcti.status === "draft" ? (
                                  <Input
                                    type="text"
                                    value={description}
                                    onChange={(e) =>
                                      handleLineEdit({
                                        lineId: line.id,
                                        field: "description",
                                        value: e.target.value,
                                      })
                                    }
                                    className="w-full"
                                  />
                                ) : (
                                  line.description
                                )}
                              </td>
                              <td className="p-2 text-right text-sm w-24">
                                {selectedRcti.status === "draft" ? (
                                  <Input
                                    type="number"
                                    step="0.25"
                                    value={hours}
                                    onChange={(e) =>
                                      handleLineEdit({
                                        lineId: line.id,
                                        field: "chargedHours",
                                        value: e.target.value,
                                      })
                                    }
                                    className="w-full text-right"
                                  />
                                ) : typeof hours === "number" ? (
                                  hours.toFixed(2)
                                ) : (
                                  hours
                                )}
                              </td>
                              <td className="p-2 text-right text-sm w-28">
                                {selectedRcti.status === "draft" ? (
                                  <Input
                                    type="number"
                                    step="0.25"
                                    value={rate}
                                    onChange={(e) =>
                                      handleLineEdit({
                                        lineId: line.id,
                                        field: "ratePerHour",
                                        value: e.target.value,
                                      })
                                    }
                                    className="w-full text-right"
                                  />
                                ) : (
                                  `$${typeof rate === "number" ? rate.toFixed(2) : rate}`
                                )}
                              </td>
                              <td className="p-2 text-right text-sm font-medium w-28">
                                ${amounts.amountExGst.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-sm w-24">
                                ${amounts.gstAmount.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-sm font-medium w-28">
                                ${amounts.amountIncGst.toFixed(2)}
                              </td>
                              {selectedRcti.status === "draft" && (
                                <td className="p-2 w-16">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveLine(line.id)}
                                    disabled={deletingLineId !== null}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        {(() => {
                          // Calculate live totals based on edited amounts
                          const totals = selectedRcti.lines?.reduce(
                            (acc, line) => {
                              const edits = editedLines.get(line.id);
                              const hours =
                                edits?.chargedHours !== undefined
                                  ? typeof edits.chargedHours === "string"
                                    ? parseFloat(edits.chargedHours) || 0
                                    : edits.chargedHours
                                  : Number(line.chargedHours);
                              const rate =
                                edits?.ratePerHour !== undefined
                                  ? typeof edits.ratePerHour === "string"
                                    ? parseFloat(edits.ratePerHour) || 0
                                    : edits.ratePerHour
                                  : Number(line.ratePerHour);

                              const amounts =
                                edits?.chargedHours !== undefined ||
                                edits?.ratePerHour !== undefined
                                  ? calculateLineAmounts({
                                      chargedHours: hours,
                                      ratePerHour: rate,
                                      gstStatus: selectedRcti.gstStatus as
                                        | "registered"
                                        | "not_registered",
                                      gstMode: selectedRcti.gstMode as
                                        | "exclusive"
                                        | "inclusive",
                                    })
                                  : {
                                      amountExGst: Number(line.amountExGst),
                                      gstAmount: Number(line.gstAmount),
                                      amountIncGst: Number(line.amountIncGst),
                                    };

                              return {
                                subtotal: acc.subtotal + amounts.amountExGst,
                                gst: acc.gst + amounts.gstAmount,
                                total: acc.total + amounts.amountIncGst,
                              };
                            },
                            { subtotal: 0, gst: 0, total: 0 },
                          ) || { subtotal: 0, gst: 0, total: 0 };

                          return (
                            <tr className="border-t-2 font-bold bg-muted/30">
                              <td
                                colSpan={
                                  selectedRcti.status === "draft" ? 6 : 6
                                }
                                className="p-2 text-right text-sm"
                              >
                                Totals:
                              </td>
                              <td className="p-2 text-right text-sm font-bold">
                                ${totals.subtotal.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-sm font-bold">
                                ${totals.gst.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-sm font-bold">
                                ${totals.total.toFixed(2)}
                              </td>
                              {selectedRcti.status === "draft" && <td></td>}
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>

                  {/* Adjusted Total After Deductions */}
                  {(() => {
                    // For drafts, show pending deductions
                    // For finalized/paid, show applied deductions
                    let netAdjustment = 0;
                    let hasDeductions = false;

                    if (
                      selectedRcti.status === "draft" &&
                      pendingDeductions &&
                      pendingDeductions.pending.length > 0
                    ) {
                      // Calculate with adjustments
                      const adjustedTotalDeductions = pendingDeductions.pending
                        .filter((d) => d.type === "deduction")
                        .reduce((sum, d) => {
                          const adjustment = pendingDeductionAdjustments.get(
                            d.id,
                          );
                          if (adjustment === null) return sum; // Skip
                          const amount =
                            adjustment !== undefined
                              ? adjustment
                              : d.amountToApply;
                          return sum + amount;
                        }, 0);

                      const adjustedTotalReimbursements =
                        pendingDeductions.pending
                          .filter((d) => d.type === "reimbursement")
                          .reduce((sum, d) => {
                            const adjustment = pendingDeductionAdjustments.get(
                              d.id,
                            );
                            if (adjustment === null) return sum; // Skip
                            const amount =
                              adjustment !== undefined
                                ? adjustment
                                : d.amountToApply;
                            return sum + amount;
                          }, 0);

                      netAdjustment =
                        adjustedTotalReimbursements - adjustedTotalDeductions;
                      hasDeductions = true;
                    } else if (
                      selectedRcti.status !== "draft" &&
                      selectedRcti.deductionApplications &&
                      selectedRcti.deductionApplications.length > 0
                    ) {
                      const deductions =
                        selectedRcti.deductionApplications.reduce(
                          (sum, app) =>
                            sum +
                            (app.deduction.type === "deduction"
                              ? Number(app.amount)
                              : 0),
                          0,
                        );
                      const reimbursements =
                        selectedRcti.deductionApplications.reduce(
                          (sum, app) =>
                            sum +
                            (app.deduction.type === "reimbursement"
                              ? Number(app.amount)
                              : 0),
                          0,
                        );
                      netAdjustment = reimbursements - deductions;
                      hasDeductions = true;
                    }

                    if (!hasDeductions) return null;

                    const currentTotal = (() => {
                      if (selectedRcti.status === "draft") {
                        // Calculate from edited lines
                        return (
                          selectedRcti.lines?.reduce((acc, line) => {
                            const edits = editedLines.get(line.id);
                            const hours =
                              edits?.chargedHours !== undefined
                                ? typeof edits.chargedHours === "string"
                                  ? parseFloat(edits.chargedHours) || 0
                                  : edits.chargedHours
                                : Number(line.chargedHours);
                            const rate =
                              edits?.ratePerHour !== undefined
                                ? typeof edits.ratePerHour === "string"
                                  ? parseFloat(edits.ratePerHour) || 0
                                  : edits.ratePerHour
                                : Number(line.ratePerHour);

                            const amounts =
                              edits?.chargedHours !== undefined ||
                              edits?.ratePerHour !== undefined
                                ? calculateLineAmounts({
                                    chargedHours: hours,
                                    ratePerHour: rate,
                                    gstStatus: selectedRcti.gstStatus as
                                      | "registered"
                                      | "not_registered",
                                    gstMode: selectedRcti.gstMode as
                                      | "exclusive"
                                      | "inclusive",
                                  })
                                : {
                                    amountExGst: Number(line.amountExGst),
                                    gstAmount: Number(line.gstAmount),
                                    amountIncGst: Number(line.amountIncGst),
                                  };

                            return acc + amounts.amountIncGst;
                          }, 0) || 0
                        );
                      } else {
                        // For finalized RCTIs, selectedRcti.total is already adjusted
                        // Derive original total by subtracting netAdjustment
                        return Number(selectedRcti.total) - netAdjustment;
                      }
                    })();

                    const adjustedTotal = currentTotal + netAdjustment;

                    return (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              Total (Inc GST):
                            </span>
                            <span className="font-medium text-gray-900">
                              ${currentTotal.toFixed(2)}
                            </span>
                          </div>
                          {netAdjustment !== 0 && (
                            <div className="flex justify-between text-sm">
                              <span
                                className={
                                  netAdjustment < 0
                                    ? "text-red-700"
                                    : "text-green-700"
                                }
                              >
                                {netAdjustment < 0
                                  ? "Deductions"
                                  : "Reimbursements"}
                                :
                              </span>
                              <span
                                className={
                                  netAdjustment < 0
                                    ? "font-medium text-red-700"
                                    : "font-medium text-green-700"
                                }
                              >
                                {netAdjustment >= 0 ? "+" : ""}$
                                {netAdjustment.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-blue-300 flex justify-between">
                            <span className="font-bold text-blue-900">
                              Amount Payable:
                            </span>
                            <span className="font-bold text-blue-900 text-lg">
                              ${adjustedTotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Deductions & Reimbursements for this RCTI */}
              <div className="bg-card border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Deductions & Reimbursements
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Driver-specific deductions for {selectedRcti.driverName}
                    </p>
                  </div>
                </div>

                {/* Pending Deductions Preview (Draft) */}
                {isLoadingDeductions ? (
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Spinner size="sm" />
                      <span className="text-sm text-muted-foreground">
                        Loading deductions...
                      </span>
                    </div>
                  </div>
                ) : selectedRcti.status === "draft" && pendingDeductions ? (
                  <div className="p-3 border rounded-lg bg-yellow-50 border-yellow-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-yellow-900">
                        Deductions to be Applied (when finalised):
                      </h4>
                      <div className="flex items-center gap-2">
                        {pendingDeductionAdjustments.size > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {pendingDeductionAdjustments.size} adjusted
                          </Badge>
                        )}
                        <p className="text-xs text-yellow-700">
                          Click ⚙️ to adjust or skip
                        </p>
                      </div>
                    </div>
                    <div className="text-sm space-y-2">
                      {pendingDeductions.pending
                        .filter((d) => d.type === "deduction")
                        .map((d) => {
                          const adjustment = pendingDeductionAdjustments.get(
                            d.id,
                          );
                          const isSkipped = adjustment === null;
                          const adjustedAmount =
                            adjustment !== undefined && adjustment !== null
                              ? adjustment
                              : d.amountToApply;
                          const isEditing = adjustment !== undefined;

                          return (
                            <div
                              key={d.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span
                                className={
                                  isSkipped
                                    ? "text-gray-400 line-through"
                                    : "text-red-700"
                                }
                              >
                                {d.description}
                              </span>
                              <div className="flex items-center gap-2">
                                {isEditing && !isSkipped ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={adjustedAmount}
                                    onChange={(e) => {
                                      const newMap = new Map(
                                        pendingDeductionAdjustments,
                                      );
                                      newMap.set(
                                        d.id,
                                        parseFloat(e.target.value) || 0,
                                      );
                                      setPendingDeductionAdjustments(newMap);
                                    }}
                                    className="w-24 h-7 text-sm text-right"
                                  />
                                ) : (
                                  <span
                                    className={
                                      isSkipped
                                        ? "font-medium text-gray-400 line-through"
                                        : "font-medium text-red-700"
                                    }
                                  >
                                    -
                                    {isSkipped
                                      ? "$0.00"
                                      : `$${adjustedAmount.toFixed(2)}`}
                                  </span>
                                )}
                                {isEditing ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newMap = new Map(
                                        pendingDeductionAdjustments,
                                      );
                                      newMap.delete(d.id);
                                      setPendingDeductionAdjustments(newMap);
                                    }}
                                    className="h-7 px-2"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2"
                                        title="Adjust or skip this deduction"
                                      >
                                        <Settings className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48">
                                      <div className="space-y-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const newMap = new Map(
                                              pendingDeductionAdjustments,
                                            );
                                            newMap.set(d.id, d.amountToApply);
                                            setPendingDeductionAdjustments(
                                              newMap,
                                            );
                                          }}
                                          className="w-full justify-start"
                                        >
                                          Edit Amount
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const newMap = new Map(
                                              pendingDeductionAdjustments,
                                            );
                                            newMap.set(d.id, null);
                                            setPendingDeductionAdjustments(
                                              newMap,
                                            );
                                          }}
                                          className="w-full justify-start"
                                        >
                                          Skip This Week
                                        </Button>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {pendingDeductions.pending
                        .filter((d) => d.type === "reimbursement")
                        .map((d) => {
                          const adjustment = pendingDeductionAdjustments.get(
                            d.id,
                          );
                          const isSkipped = adjustment === null;
                          const adjustedAmount =
                            adjustment !== undefined && adjustment !== null
                              ? adjustment
                              : d.amountToApply;
                          const isEditing = adjustment !== undefined;

                          return (
                            <div
                              key={d.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span
                                className={
                                  isSkipped
                                    ? "text-gray-400 line-through"
                                    : "text-green-700"
                                }
                              >
                                {d.description}
                              </span>
                              <div className="flex items-center gap-2">
                                {isEditing && !isSkipped ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={adjustedAmount}
                                    onChange={(e) => {
                                      const newMap = new Map(
                                        pendingDeductionAdjustments,
                                      );
                                      newMap.set(
                                        d.id,
                                        parseFloat(e.target.value) || 0,
                                      );
                                      setPendingDeductionAdjustments(newMap);
                                    }}
                                    className="w-24 h-7 text-sm text-right"
                                  />
                                ) : (
                                  <span
                                    className={
                                      isSkipped
                                        ? "font-medium text-gray-400 line-through"
                                        : "font-medium text-green-700"
                                    }
                                  >
                                    +
                                    {isSkipped
                                      ? "$0.00"
                                      : `$${adjustedAmount.toFixed(2)}`}
                                  </span>
                                )}
                                {isEditing ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const newMap = new Map(
                                        pendingDeductionAdjustments,
                                      );
                                      newMap.delete(d.id);
                                      setPendingDeductionAdjustments(newMap);
                                    }}
                                    className="h-7 px-2"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2"
                                        title="Adjust or skip this reimbursement"
                                      >
                                        <Settings className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48">
                                      <div className="space-y-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const newMap = new Map(
                                              pendingDeductionAdjustments,
                                            );
                                            newMap.set(d.id, d.amountToApply);
                                            setPendingDeductionAdjustments(
                                              newMap,
                                            );
                                          }}
                                          className="w-full justify-start"
                                        >
                                          Edit Amount
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const newMap = new Map(
                                              pendingDeductionAdjustments,
                                            );
                                            newMap.set(d.id, null);
                                            setPendingDeductionAdjustments(
                                              newMap,
                                            );
                                          }}
                                          className="w-full justify-start"
                                        >
                                          Skip This Week
                                        </Button>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {pendingDeductions.pending.length > 0 &&
                        (() => {
                          // Calculate adjusted totals
                          const adjustedTotalDeductions =
                            pendingDeductions.pending
                              .filter((d) => d.type === "deduction")
                              .reduce((sum, d) => {
                                const adjustment =
                                  pendingDeductionAdjustments.get(d.id);
                                if (adjustment === null) return sum; // Skip
                                const amount =
                                  adjustment !== undefined
                                    ? adjustment
                                    : d.amountToApply;
                                return sum + amount;
                              }, 0);

                          const adjustedTotalReimbursements =
                            pendingDeductions.pending
                              .filter((d) => d.type === "reimbursement")
                              .reduce((sum, d) => {
                                const adjustment =
                                  pendingDeductionAdjustments.get(d.id);
                                if (adjustment === null) return sum; // Skip
                                const amount =
                                  adjustment !== undefined
                                    ? adjustment
                                    : d.amountToApply;
                                return sum + amount;
                              }, 0);

                          const adjustedNet =
                            adjustedTotalReimbursements -
                            adjustedTotalDeductions;

                          return (
                            <div className="pt-2 border-t border-yellow-300 space-y-1">
                              <div className="flex justify-between">
                                <span className="text-sm text-red-700">
                                  Total Deductions:
                                </span>
                                <span className="font-medium text-red-700 text-sm">
                                  -${adjustedTotalDeductions.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-green-700">
                                  Total Reimbursements:
                                </span>
                                <span className="font-medium text-green-700 text-sm">
                                  +${adjustedTotalReimbursements.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between font-semibold text-yellow-900 pt-1">
                                <span className="text-sm">Net Adjustment:</span>
                                <span className="text-sm">
                                  {adjustedNet >= 0 ? "+" : ""}$
                                  {adjustedNet.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      <p className="text-xs text-muted-foreground mt-2">
                        These will be applied when you finalise this RCTI
                      </p>
                    </div>
                  </div>
                ) : selectedRcti.status !== "draft" ? (
                  <div className="p-3 border rounded-lg bg-gray-50 border-gray-200">
                    <p className="text-sm text-muted-foreground">
                      Deductions can only be adjusted on draft RCTIs. To modify
                      deductions, unfinalize this RCTI first.
                    </p>
                  </div>
                ) : null}

                {/* Applied Deductions (Finalized/Paid) */}
                {selectedRcti.status !== "draft" &&
                  selectedRcti.deductionApplications &&
                  selectedRcti.deductionApplications.length > 0 && (
                    <div className="p-3 border rounded-lg bg-blue-50 border-blue-200">
                      <h4 className="font-medium text-sm mb-2 text-blue-900">
                        Deductions Applied to this RCTI:
                      </h4>
                      <div className="space-y-2">
                        {selectedRcti.deductionApplications
                          .filter((app) => app.deduction.type === "deduction")
                          .map((app) => {
                            const isSkipped = Number(app.amount) === 0;
                            return (
                              <div
                                key={app.id}
                                className="flex justify-between text-sm items-center"
                              >
                                <span
                                  className={
                                    isSkipped
                                      ? "text-gray-400 line-through"
                                      : "text-red-700"
                                  }
                                >
                                  {app.deduction.description}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={
                                      isSkipped
                                        ? "font-medium text-gray-400 line-through"
                                        : "font-medium text-red-700"
                                    }
                                  >
                                    -${Number(app.amount).toFixed(2)}
                                  </span>
                                  {isSkipped && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Skipped
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        {selectedRcti.deductionApplications
                          .filter(
                            (app) => app.deduction.type === "reimbursement",
                          )
                          .map((app) => {
                            const isSkipped = Number(app.amount) === 0;
                            return (
                              <div
                                key={app.id}
                                className="flex justify-between text-sm items-center"
                              >
                                <span
                                  className={
                                    isSkipped
                                      ? "text-gray-400 line-through"
                                      : "text-green-700"
                                  }
                                >
                                  {app.deduction.description}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={
                                      isSkipped
                                        ? "font-medium text-gray-400 line-through"
                                        : "font-medium text-green-700"
                                    }
                                  >
                                    +${Number(app.amount).toFixed(2)}
                                  </span>
                                  {isSkipped && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Skipped
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        <div className="pt-2 border-t border-blue-300 flex justify-between text-sm font-semibold text-blue-900">
                          <span>Net Adjustment:</span>
                          <span>
                            {(() => {
                              const deductions =
                                selectedRcti.deductionApplications
                                  .filter(
                                    (app) => app.deduction.type === "deduction",
                                  )
                                  .reduce(
                                    (sum, app) => sum + Number(app.amount),
                                    0,
                                  );
                              const reimbursements =
                                selectedRcti.deductionApplications
                                  .filter(
                                    (app) =>
                                      app.deduction.type === "reimbursement",
                                  )
                                  .reduce(
                                    (sum, app) => sum + Number(app.amount),
                                    0,
                                  );
                              const net = reimbursements - deductions;
                              return `${net >= 0 ? "+" : "-"}$${Math.abs(net).toFixed(2)}`;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Create New Deduction */}
                {!showDeductionForm ? (
                  <Button
                    type="button"
                    onClick={() => setShowDeductionForm(true)}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Deduction/Reimbursement
                  </Button>
                ) : (
                  <div className="border rounded-lg p-3 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="deduction-type">Type</Label>
                        <Select
                          value={deductionFormData.type}
                          onValueChange={(value) =>
                            setDeductionFormData({
                              ...deductionFormData,
                              type: value,
                            })
                          }
                        >
                          <SelectTrigger id="deduction-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deduction">Deduction</SelectItem>
                            <SelectItem value="reimbursement">
                              Reimbursement
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deduction-frequency">Frequency</Label>
                        <Select
                          value={deductionFormData.frequency}
                          onValueChange={(value) =>
                            setDeductionFormData({
                              ...deductionFormData,
                              frequency: value,
                            })
                          }
                        >
                          <SelectTrigger id="deduction-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="once">One-off</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="fortnightly">
                              Fortnightly
                            </SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deduction-description">Description</Label>
                      <Input
                        id="deduction-description"
                        value={deductionFormData.description}
                        onChange={(e) =>
                          setDeductionFormData({
                            ...deductionFormData,
                            description: e.target.value,
                          })
                        }
                        placeholder="e.g., Fuel advance repayment"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="deduction-total">
                          Total Amount ($)
                        </Label>
                        <Input
                          id="deduction-total"
                          type="number"
                          step="0.01"
                          value={deductionFormData.totalAmount}
                          onChange={(e) =>
                            setDeductionFormData({
                              ...deductionFormData,
                              totalAmount: e.target.value,
                            })
                          }
                        />
                      </div>
                      {deductionFormData.frequency !== "once" && (
                        <div className="space-y-2">
                          <Label htmlFor="deduction-per-cycle">
                            Amount per cycle ($)
                          </Label>
                          <Input
                            id="deduction-per-cycle"
                            type="number"
                            step="0.01"
                            value={deductionFormData.amountPerCycle}
                            onChange={(e) =>
                              setDeductionFormData({
                                ...deductionFormData,
                                amountPerCycle: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deduction-start-date">Start Date</Label>
                      <Input
                        id="deduction-start-date"
                        type="date"
                        value={deductionFormData.startDate}
                        onChange={(e) =>
                          setDeductionFormData({
                            ...deductionFormData,
                            startDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deduction-notes">Notes (optional)</Label>
                      <Textarea
                        id="deduction-notes"
                        value={deductionFormData.notes}
                        onChange={(e) =>
                          setDeductionFormData({
                            ...deductionFormData,
                            notes: e.target.value,
                          })
                        }
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateDeduction}
                        disabled={isSaving}
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
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeductionForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Active Deductions List */}
                {isLoadingDeductions ? (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">
                      Loading deductions...
                    </h4>
                    <LoadingSkeleton count={2} variant="list" />
                  </div>
                ) : deductions.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">
                      Active Items for {selectedRcti.driverName}:
                    </h4>
                    {deductions.map((deduction) => {
                      const isSkippedThisWeek =
                        pendingDeductionAdjustments.get(deduction.id) === null;
                      return (
                        <div
                          key={deduction.id}
                          className={`flex items-center justify-between p-3 border rounded-lg ${
                            isSkippedThisWeek
                              ? "bg-gray-50 border-gray-300"
                              : ""
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-medium ${
                                  isSkippedThisWeek
                                    ? "text-gray-400 line-through"
                                    : ""
                                }`}
                              >
                                {deduction.description}
                              </span>
                              <Badge
                                variant={
                                  deduction.type === "deduction"
                                    ? "destructive"
                                    : "default"
                                }
                              >
                                {deduction.type}
                              </Badge>
                              <Badge variant="outline">
                                {deduction.frequency}
                              </Badge>
                              {isSkippedThisWeek && (
                                <Badge variant="secondary">
                                  Skipped This Week
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {(() => {
                                // Calculate adjusted amounts for draft RCTIs with pending deductions
                                let displayPaid = Number(deduction.amountPaid);
                                let displayRemaining = Number(
                                  deduction.amountRemaining,
                                );

                                if (selectedRcti.status === "draft") {
                                  const pendingDeduction =
                                    pendingDeductions?.pending.find(
                                      (p) => p.id === deduction.id,
                                    );

                                  if (pendingDeduction) {
                                    // Check if this deduction is being skipped
                                    const adjustment =
                                      pendingDeductionAdjustments.get(
                                        deduction.id,
                                      );
                                    const isSkipped = adjustment === null;

                                    if (!isSkipped) {
                                      const amountToApply =
                                        adjustment !== undefined
                                          ? adjustment
                                          : pendingDeduction.amountToApply;
                                      displayPaid += amountToApply;
                                      displayRemaining -= amountToApply;
                                    }
                                  }
                                }

                                return (
                                  <>
                                    Total: $
                                    {Number(deduction.totalAmount).toFixed(2)} |
                                    Paid: ${displayPaid.toFixed(2)} | Remaining:
                                    ${displayRemaining.toFixed(2)}
                                    {selectedRcti.status === "draft" &&
                                      pendingDeductions?.pending.some(
                                        (p) => p.id === deduction.id,
                                      ) &&
                                      !isSkippedThisWeek && (
                                        <span className="text-blue-600 ml-1">
                                          (after this RCTI)
                                        </span>
                                      )}
                                  </>
                                );
                              })()}
                            </div>
                            {deduction.frequency !== "once" &&
                              (() => {
                                // Calculate adjusted paid amount for progress bar
                                let progressPaid = Number(deduction.amountPaid);

                                if (selectedRcti.status === "draft") {
                                  const pendingDeduction =
                                    pendingDeductions?.pending.find(
                                      (p) => p.id === deduction.id,
                                    );

                                  if (pendingDeduction) {
                                    const adjustment =
                                      pendingDeductionAdjustments.get(
                                        deduction.id,
                                      );
                                    const isSkipped = adjustment === null;

                                    if (!isSkipped) {
                                      const amountToApply =
                                        adjustment !== undefined
                                          ? adjustment
                                          : pendingDeduction.amountToApply;
                                      progressPaid += amountToApply;
                                    }
                                  }
                                }

                                return (
                                  <div className="mt-2">
                                    <div className="w-full bg-muted rounded-full h-2">
                                      <div
                                        className="bg-primary h-2 rounded-full transition-all"
                                        style={{
                                          width: `${(progressPaid / Number(deduction.totalAmount)) * 100}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={isSaving}
                                  title="Deduction options"
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56">
                                <div className="space-y-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingDeduction(deduction);
                                      setDeductionFormData({
                                        type: deduction.type,
                                        description: deduction.description,
                                        totalAmount:
                                          deduction.totalAmount.toString(),
                                        frequency: deduction.frequency,
                                        amountPerCycle: deduction.amountPerCycle
                                          ? deduction.amountPerCycle.toString()
                                          : "",
                                        startDate: format(
                                          new Date(deduction.startDate),
                                          "yyyy-MM-dd",
                                        ),
                                        notes: deduction.notes || "",
                                      });
                                    }}
                                    className="w-full justify-start"
                                  >
                                    Edit Settings
                                  </Button>
                                  {selectedRcti.status === "draft" &&
                                    pendingDeductions?.pending.some(
                                      (p) => p.id === deduction.id,
                                    ) && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const newMap = new Map(
                                            pendingDeductionAdjustments,
                                          );
                                          const current = newMap.get(
                                            deduction.id,
                                          );
                                          if (current === null) {
                                            // Currently skipped, unskip it
                                            newMap.delete(deduction.id);
                                          } else {
                                            // Not skipped, skip it
                                            newMap.set(deduction.id, null);
                                          }
                                          setPendingDeductionAdjustments(
                                            newMap,
                                          );
                                        }}
                                        className="w-full justify-start"
                                      >
                                        {pendingDeductionAdjustments.get(
                                          deduction.id,
                                        ) === null
                                          ? "Unskip This Week"
                                          : "Skip This Week"}
                                      </Button>
                                    )}
                                </div>
                              </PopoverContent>
                            </Popover>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleDeleteDeduction(deduction.id)
                              }
                              disabled={isSaving}
                              title={
                                deduction.amountPaid > 0
                                  ? "Cancel deduction (preserves payment history)"
                                  : "Delete deduction"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Edit Deduction Dialog */}
          {editingDeduction && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card border rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">
                  Edit{" "}
                  {editingDeduction.type === "deduction"
                    ? "Deduction"
                    : "Reimbursement"}
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Input
                      id="edit-description"
                      type="text"
                      value={deductionFormData.description}
                      onChange={(e) =>
                        setDeductionFormData({
                          ...deductionFormData,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-total-amount">Total Amount</Label>
                    <Input
                      id="edit-total-amount"
                      type="number"
                      step="0.01"
                      value={deductionFormData.totalAmount}
                      onChange={(e) =>
                        setDeductionFormData({
                          ...deductionFormData,
                          totalAmount: e.target.value,
                        })
                      }
                      disabled
                      title="Total amount cannot be changed after creation"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Total amount cannot be changed
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="edit-frequency">Frequency</Label>
                    <Select
                      value={deductionFormData.frequency}
                      onValueChange={(value) =>
                        setDeductionFormData({
                          ...deductionFormData,
                          frequency: value,
                        })
                      }
                    >
                      <SelectTrigger id="edit-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">One-time</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {deductionFormData.frequency !== "once" && (
                    <div>
                      <Label htmlFor="edit-amount-per-cycle">
                        Amount Per Cycle
                      </Label>
                      <Input
                        id="edit-amount-per-cycle"
                        type="number"
                        step="0.01"
                        value={deductionFormData.amountPerCycle}
                        onChange={(e) =>
                          setDeductionFormData({
                            ...deductionFormData,
                            amountPerCycle: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="edit-start-date">Start Date</Label>
                    <Input
                      id="edit-start-date"
                      type="date"
                      value={deductionFormData.startDate}
                      onChange={(e) =>
                        setDeductionFormData({
                          ...deductionFormData,
                          startDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-notes">Notes (optional)</Label>
                    <Textarea
                      id="edit-notes"
                      value={deductionFormData.notes}
                      onChange={(e) =>
                        setDeductionFormData({
                          ...deductionFormData,
                          notes: e.target.value,
                        })
                      }
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    type="button"
                    onClick={handleUpdateDeduction}
                    disabled={isSaving || !deductionFormData.description.trim()}
                    className="flex-1"
                  >
                    {isSaving ? <Spinner size="sm" /> : "Update"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingDeduction(null);
                      setDeductionFormData({
                        type: "deduction",
                        description: "",
                        totalAmount: "",
                        frequency: "weekly",
                        amountPerCycle: "",
                        startDate: format(new Date(), "yyyy-MM-dd"),
                        notes: "",
                      });
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add Jobs Dialog */}
          {showAddJobDialog && selectedRcti && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Add Jobs to RCTI</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowAddJobDialog(false);
                      setSelectedJobsToAdd([]);
                    }}
                  >
                    ×
                  </Button>
                </div>

                {isSaving ? (
                  <div className="py-8">
                    <Spinner size="lg" className="mb-4" />
                    <p className="text-sm text-muted-foreground text-center">
                      Adding jobs...
                    </p>
                  </div>
                ) : availableJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No additional jobs available for this week
                  </p>
                ) : (
                  <>
                    <div className="space-y-2 mb-4">
                      {availableJobs.map((job) => (
                        <label
                          key={job.id}
                          className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent"
                        >
                          <input
                            type="checkbox"
                            checked={selectedJobsToAdd.includes(job.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedJobsToAdd([
                                  ...selectedJobsToAdd,
                                  job.id,
                                ]);
                              } else {
                                setSelectedJobsToAdd(
                                  selectedJobsToAdd.filter(
                                    (id) => id !== job.id,
                                  ),
                                );
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="font-medium">
                              {format(parseISO(job.date), "MMM d")} -{" "}
                              {job.customer}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {job.truckType}
                              {job.startTime && job.finishTime
                                ? ` | ${job.startTime.substring(11, 16)} - ${job.finishTime.substring(11, 16)}`
                                : ""}
                              {" | "}
                              {(job.driverCharge && job.driverCharge > 0
                                ? job.driverCharge
                                : job.chargedHours) || 0}
                              hrs
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddJobDialog(false);
                          setSelectedJobsToAdd([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAddJobs}
                        disabled={selectedJobsToAdd.length === 0 || isSaving}
                      >
                        Add {selectedJobsToAdd.length} Job(s)
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RCTI Settings Dialog */}
        <RctiSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          onSaved={() => {
            toast({
              title: "Success",
              description: "RCTI settings saved successfully",
            });
          }}
        />
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
