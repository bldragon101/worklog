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
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  DollarSign,
  Plus,
  Save,
  Lock,
  Unlock,
  Trash2,
  CheckCircle,
} from "lucide-react";
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
  const [isLoadingRctis, setIsLoadingRctis] = useState(false);
  const [isLoadingDeductions, setIsLoadingDeductions] = useState(false);

  // Filters
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
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
    Map<number, { chargedHours?: number; ratePerHour?: number }>
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
  }, [selectedDriverId, weekEnding, selectedYear, selectedMonth, statusFilter]);

  // Fetch deductions when selected RCTI changes
  useEffect(() => {
    if (selectedRcti) {
      fetchDeductionsForRcti(selectedRcti);
      fetchPendingDeductionsForRcti(selectedRcti);
    } else {
      setDeductions([]);
      setPendingDeductions(null);
    }
  }, [selectedRcti]);

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
      const response = await fetch(
        `/api/rcti-deductions/pending?driverId=${rcti.driverId}&weekEnding=${weekEnd.toISOString()}`,
      );
      if (!response.ok) throw new Error("Failed to fetch pending deductions");
      const data = await response.json();
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
      if (selectedDriverId) params.append("driverId", selectedDriverId);
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

      const response = await fetch(`/api/rcti?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch RCTIs");
      const data = await response.json();
      setRctis(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching RCTIs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch RCTIs",
        variant: "destructive",
      });
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

  const handleDeleteDeduction = async (deductionId: number) => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/rcti-deductions/${deductionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete deduction");
      }

      if (selectedRcti) {
        await fetchDeductionsForRcti(selectedRcti);
        await fetchPendingDeductionsForRcti(selectedRcti);
      }

      toast({
        title: "Success",
        description: "Deduction deleted successfully",
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
      setIsSaving(true);
      const response = await fetch(
        `/api/rcti/${selectedRcti.id}/lines/${lineId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove line");
      }

      await fetchRctis();
      const updatedRcti = rctis.find((r) => r.id === selectedRcti.id);
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
      setIsSaving(false);
    }
  };

  const fetchAvailableJobsForRcti = async (rcti: Rcti) => {
    try {
      const weekStart = startOfWeek(parseISO(rcti.weekEnding), {
        weekStartsOn: 1,
      });
      const weekEnd = endOfWeek(parseISO(rcti.weekEnding), { weekStartsOn: 1 });

      const allJobsForDriver = jobs.filter(
        (job) => job.driver === rcti.driverName,
      );

      const jobsInWeek = allJobsForDriver.filter((job) => {
        const jobDate = parseISO(job.date);
        return isWithinInterval(jobDate, { start: weekStart, end: weekEnd });
      });

      // Filter out jobs already in the RCTI
      const existingJobIds = new Set(
        selectedRcti?.lines?.map((line) => line.jobId) || [],
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

      await fetchRctis();
      const updatedRcti = rctis.find((r) => r.id === selectedRcti.id);
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

      await fetchRctis();
      const updatedRcti = rctis.find((r) => r.id === selectedRcti.id);
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
    if (!selectedDriverId) {
      toast({
        title: "Validation Error",
        description: "Please select a driver",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (weekEnding === SHOW_MONTH) {
        toast({
          title: "Error",
          description: "Please select a specific week to create an RCTI",
          variant: "destructive",
        });
        return;
      }

      const weekEnd = endOfWeek(weekEnding as Date, { weekStartsOn: 1 });
      const response = await fetch("/api/rcti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: parseInt(selectedDriverId, 10),
          weekEnding: weekEnd.toISOString(),
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
      await fetchRctis();

      toast({
        title: "Success",
        description: "RCTI created successfully",
      });
    } catch (error) {
      console.error("Error creating RCTI:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create RCTI",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRcti = async () => {
    if (!selectedRcti) return;

    setIsSaving(true);
    try {
      const lines = Array.from(editedLines.entries()).map(([id, data]) => ({
        id,
        ...data,
      }));

      const response = await fetch(`/api/rcti/${selectedRcti.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rcti/${selectedRcti.id}/finalize`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to finalize RCTI");
      }

      const updatedRcti = await response.json();
      setSelectedRcti(updatedRcti);
      await fetchRctis();

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
      setIsSaving(false);
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
    field: "chargedHours" | "ratePerHour";
    value: number;
  }) => {
    setEditedLines((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(lineId) || {};
      newMap.set(lineId, { ...existing, [field]: value });
      return newMap;
    });
  };

  // Get selected driver name for filtering
  const selectedDriver = drivers.find(
    (d) => d.id.toString() === selectedDriverId,
  );

  // Filter jobs by selected driver (if any)
  const filteredJobs = selectedDriver
    ? jobs.filter((job) => job.driver === selectedDriver.driver)
    : jobs;

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
    const totalAmount = rctis.reduce((sum, r) => sum + r.total, 0);

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
          <Badge variant="outline" className="bg-green-50">
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
            <h2 className="text-lg font-semibold">Filters & Actions</h2>
            <div className="bg-card border rounded-lg p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="driver-select">Driver</Label>
                  <Select
                    value={selectedDriverId}
                    onValueChange={setSelectedDriverId}
                  >
                    <SelectTrigger id="driver-select">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Drivers</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem
                          key={driver.id}
                          value={driver.id.toString()}
                        >
                          {driver.driver} ({driver.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="finalised">Finalised</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Actions</Label>
                  <Button
                    type="button"
                    id="create-rcti-btn"
                    onClick={handleCreateRcti}
                    disabled={
                      !selectedDriverId || isSaving || weekEnding === SHOW_MONTH
                    }
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create RCTI
                  </Button>
                </div>
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
                      <p className="font-bold">${rcti.total.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {rcti.lines?.length || 0} lines
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

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
                            disabled={isSaving}
                            size="sm"
                            variant="default"
                          >
                            {isSaving ? (
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
                          <th className="text-left p-2 text-sm font-medium">
                            Date
                          </th>
                          <th className="text-left p-2 text-sm font-medium">
                            Customer
                          </th>
                          <th className="text-left p-2 text-sm font-medium">
                            Truck Type
                          </th>
                          <th className="text-left p-2 text-sm font-medium">
                            Description
                          </th>
                          <th className="text-right p-2 text-sm font-medium">
                            Hours
                          </th>
                          <th className="text-right p-2 text-sm font-medium">
                            Rate
                          </th>
                          <th className="text-right p-2 text-sm font-medium">
                            Ex GST
                          </th>
                          <th className="text-right p-2 text-sm font-medium">
                            GST
                          </th>
                          <th className="text-right p-2 text-sm font-medium">
                            Inc GST
                          </th>
                          {selectedRcti.status === "draft" && (
                            <th className="p-2 text-sm font-medium">Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {isAddingManualLine && (
                          <tr className="border-b bg-accent/50">
                            <td className="p-2">
                              <Input
                                type="date"
                                value={manualLineData.jobDate}
                                onChange={(e) =>
                                  setManualLineData({
                                    ...manualLineData,
                                    jobDate: e.target.value,
                                  })
                                }
                                className="w-32"
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
                            <td className="p-2">
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
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Hours"
                                value={manualLineData.chargedHours}
                                onChange={(e) =>
                                  setManualLineData({
                                    ...manualLineData,
                                    chargedHours: e.target.value,
                                  })
                                }
                                className="w-20 text-right"
                                id="manual-line-hours"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Rate"
                                value={manualLineData.ratePerHour}
                                onChange={(e) =>
                                  setManualLineData({
                                    ...manualLineData,
                                    ratePerHour: e.target.value,
                                  })
                                }
                                className="w-24 text-right"
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
                          const edits = editedLines.get(line.id);
                          const hours =
                            edits?.chargedHours ?? line.chargedHours;
                          const rate = edits?.ratePerHour ?? line.ratePerHour;

                          return (
                            <tr
                              key={line.id}
                              className="border-b hover:bg-muted/50 transition-colors"
                            >
                              <td className="p-2 text-sm">
                                {format(new Date(line.jobDate), "MMM d")}
                              </td>
                              <td className="p-2 text-sm">{line.customer}</td>
                              <td className="p-2 text-sm">{line.truckType}</td>
                              <td className="p-2 text-sm">
                                {line.description}
                              </td>
                              <td className="p-2 text-right text-sm">
                                {selectedRcti.status === "draft" ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={hours}
                                    onChange={(e) =>
                                      handleLineEdit({
                                        lineId: line.id,
                                        field: "chargedHours",
                                        value: parseFloat(e.target.value),
                                      })
                                    }
                                    className="w-20 text-right"
                                  />
                                ) : (
                                  hours.toFixed(2)
                                )}
                              </td>
                              <td className="p-2 text-right text-sm">
                                {selectedRcti.status === "draft" ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={rate}
                                    onChange={(e) =>
                                      handleLineEdit({
                                        lineId: line.id,
                                        field: "ratePerHour",
                                        value: parseFloat(e.target.value),
                                      })
                                    }
                                    className="w-24 text-right"
                                  />
                                ) : (
                                  `$${rate.toFixed(2)}`
                                )}
                              </td>
                              <td className="p-2 text-right text-sm font-medium">
                                ${line.amountExGst.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-sm">
                                ${line.gstAmount.toFixed(2)}
                              </td>
                              <td className="p-2 text-right text-sm font-medium">
                                ${line.amountIncGst.toFixed(2)}
                              </td>
                              {selectedRcti.status === "draft" && (
                                <td className="p-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveLine(line.id)}
                                    disabled={isSaving}
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
                        <tr className="border-t-2 font-bold bg-muted/30">
                          <td
                            colSpan={selectedRcti.status === "draft" ? 6 : 6}
                            className="p-2 text-right text-sm"
                          >
                            Totals:
                          </td>
                          <td className="p-2 text-right text-sm font-bold">
                            ${selectedRcti.subtotal.toFixed(2)}
                          </td>
                          <td className="p-2 text-right text-sm font-bold">
                            ${selectedRcti.gst.toFixed(2)}
                          </td>
                          <td className="p-2 text-right text-sm font-bold">
                            ${selectedRcti.total.toFixed(2)}
                          </td>
                          {selectedRcti.status === "draft" && <td></td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
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

                {/* Pending Deductions Preview */}
                {isLoadingDeductions ? (
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Spinner size="sm" />
                      <span className="text-sm text-muted-foreground">
                        Loading deductions...
                      </span>
                    </div>
                  </div>
                ) : pendingDeductions ? (
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <h4 className="font-medium text-sm mb-1.5">
                      Pending for this RCTI:
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>
                        Total Deductions:{" "}
                        <span className="font-medium text-red-600">
                          -$
                          {pendingDeductions.summary.totalDeductions.toFixed(2)}
                        </span>
                      </p>
                      <p>
                        Total Reimbursements:{" "}
                        <span className="font-medium text-green-600">
                          +$
                          {pendingDeductions.summary.totalReimbursements.toFixed(
                            2,
                          )}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {pendingDeductions.pending.length} item(s) will be
                        applied when this RCTI is finalised
                      </p>
                    </div>
                  </div>
                ) : null}

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
                    {deductions.map((deduction) => (
                      <div
                        key={deduction.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
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
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Total: ${deduction.totalAmount.toFixed(2)} | Paid: $
                            {deduction.amountPaid.toFixed(2)} | Remaining: $
                            {deduction.amountRemaining.toFixed(2)}
                          </div>
                          {deduction.frequency !== "once" && (
                            <div className="mt-2">
                              <div className="w-full bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{
                                    width: `${(deduction.amountPaid / deduction.totalAmount) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDeduction(deduction.id)}
                          disabled={isSaving || deduction.amountPaid > 0}
                          title={
                            deduction.amountPaid > 0
                              ? "Cannot delete deduction with payments applied"
                              : "Delete deduction"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
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
                              {job.truckType} | {job.chargedHours || 0}hrs @ $
                              {job.driverCharge || 0}/hr
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
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
