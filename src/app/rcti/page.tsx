"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks } from "date-fns";
import type { Rcti, Driver } from "@/lib/types";

export default function RCTIPage() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rctis, setRctis] = useState<Rcti[]>([]);
  const [selectedRcti, setSelectedRcti] = useState<Rcti | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  // Fetch drivers
  useEffect(() => {
    fetchDrivers();
  }, []);

  // Fetch RCTIs when filters change
  useEffect(() => {
    fetchRctis();
  }, [selectedDriverId, selectedWeek, statusFilter]);

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

  const fetchRctis = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDriverId) params.append("driverId", selectedDriverId);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });
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
    }
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
      const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });
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

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });

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
        <div className="flex flex-col h-full space-y-6 p-6">
          <div className="flex flex-col space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">RCTI</h1>
              <p className="text-muted-foreground">
                Manage Recipient Created Tax Invoices
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total RCTIs
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryStats.total}</div>
                  <p className="text-xs text-muted-foreground">This period</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Draft</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryStats.draft}</div>
                  <p className="text-xs text-muted-foreground">In progress</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Finalised
                  </CardTitle>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summaryStats.finalised}
                  </div>
                  <p className="text-xs text-muted-foreground">Locked</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Paid</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryStats.paid}</div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Amount
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${summaryStats.totalAmount.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">This period</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>
                  Select driver and week to create or view RCTIs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
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
                    <Label>Week</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        id="prev-week-btn"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setSelectedWeek((prev) => subWeeks(prev, 1))
                        }
                      >
                        ←
                      </Button>
                      <Button
                        type="button"
                        id="next-week-btn"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setSelectedWeek((prev) => addWeeks(prev, 1))
                        }
                      >
                        →
                      </Button>
                      <Button
                        type="button"
                        id="today-btn"
                        variant="outline"
                        onClick={() => setSelectedWeek(new Date())}
                      >
                        Today
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(weekStart, "MMM d")} -{" "}
                      {format(weekEnd, "MMM d, yyyy")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status-filter">Status</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
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
                      disabled={!selectedDriverId || isSaving}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create RCTI
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* RCTI List */}
            {rctis.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>RCTIs</CardTitle>
                  <CardDescription>
                    Click to view and edit details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {rctis.map((rcti) => (
                      <div
                        key={rcti.id}
                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent ${
                          selectedRcti?.id === rcti.id ? "bg-accent" : ""
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
                </CardContent>
              </Card>
            )}

            {/* Selected RCTI Details */}
            {selectedRcti && (
              <>
                <Card>
                  <CardHeader>
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
                              <Save className="mr-2 h-4 w-4" />
                              Save
                            </Button>
                            <Button
                              type="button"
                              id="finalize-rcti-btn"
                              onClick={handleFinalizeRcti}
                              disabled={isSaving}
                              size="sm"
                              variant="default"
                            >
                              <Lock className="mr-2 h-4 w-4" />
                              Finalise
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
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
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
                            setGstStatus(
                              value as "registered" | "not_registered",
                            )
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
                            <SelectItem value="registered">
                              Registered
                            </SelectItem>
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
                  </CardContent>
                </Card>

                {/* Lines Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Lines</CardTitle>
                    <CardDescription>
                      {selectedRcti.lines?.length || 0} jobs included
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Date</th>
                            <th className="text-left p-2">Customer</th>
                            <th className="text-left p-2">Truck Type</th>
                            <th className="text-left p-2">Description</th>
                            <th className="text-right p-2">Hours</th>
                            <th className="text-right p-2">Rate</th>
                            <th className="text-right p-2">Ex GST</th>
                            <th className="text-right p-2">GST</th>
                            <th className="text-right p-2">Inc GST</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRcti.lines?.map((line) => {
                            const edits = editedLines.get(line.id);
                            const hours =
                              edits?.chargedHours ?? line.chargedHours;
                            const rate = edits?.ratePerHour ?? line.ratePerHour;

                            return (
                              <tr key={line.id} className="border-b">
                                <td className="p-2">
                                  {format(new Date(line.jobDate), "MMM d")}
                                </td>
                                <td className="p-2">{line.customer}</td>
                                <td className="p-2">{line.truckType}</td>
                                <td className="p-2">{line.description}</td>
                                <td className="p-2 text-right">
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
                                <td className="p-2 text-right">
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
                                <td className="p-2 text-right">
                                  ${line.amountExGst.toFixed(2)}
                                </td>
                                <td className="p-2 text-right">
                                  ${line.gstAmount.toFixed(2)}
                                </td>
                                <td className="p-2 text-right">
                                  ${line.amountIncGst.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 font-bold">
                            <td colSpan={6} className="p-2 text-right">
                              Totals:
                            </td>
                            <td className="p-2 text-right">
                              ${selectedRcti.subtotal.toFixed(2)}
                            </td>
                            <td className="p-2 text-right">
                              ${selectedRcti.gst.toFixed(2)}
                            </td>
                            <td className="p-2 text-right">
                              ${selectedRcti.total.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </ProtectedRoute>
    </ProtectedLayout>
  );
}
