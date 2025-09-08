"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { Driver } from "@/lib/types";
import { SearchableSelect } from "@/components/shared/searchable-select";

interface DriverFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (driver: Partial<Driver>) => void;
  driver?: Driver | null;
  isLoading?: boolean;
}

export function DriverForm({
  isOpen,
  onClose,
  onSubmit,
  driver,
  isLoading = false,
}: DriverFormProps) {
  const [formData, setFormData] = useState({
    driver: "",
    truck: "",
    tray: "",
    crane: "",
    semi: "",
    semiCrane: "",
    breaks: "",
    type: "Employee" as "Employee" | "Contractor" | "Subcontractor",
    tolls: false,
    fuelLevy: "",
  });

  const [vehicleRegistrations, setVehicleRegistrations] = useState<string[]>(
    [],
  );
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  // Fetch vehicle registrations
  useEffect(() => {
    const fetchVehicleRegistrations = async () => {
      try {
        setIsLoadingVehicles(true);
        const response = await fetch("/api/vehicles/select-options");
        if (response.ok) {
          const data = await response.json();
          setVehicleRegistrations(data.registrationOptions || []);
        } else {
          console.error("Failed to fetch vehicle registrations");
        }
      } catch (error) {
        console.error("Error fetching vehicle registrations:", error);
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    if (isOpen) {
      fetchVehicleRegistrations();
    }
  }, [isOpen]);

  useEffect(() => {
    if (driver) {
      setFormData({
        driver: driver.driver || "",
        truck: driver.truck || "",
        tray: driver.tray?.toString() || "",
        crane: driver.crane?.toString() || "",
        semi: driver.semi?.toString() || "",
        semiCrane: driver.semiCrane?.toString() || "",
        breaks: driver.breaks?.toString() || "",
        type: driver.type || "Employee",
        tolls: driver.tolls || false,
        fuelLevy: driver.fuelLevy?.toString() || "",
      });
    } else {
      setFormData({
        driver: "",
        truck: "",
        tray: "",
        crane: "",
        semi: "",
        semiCrane: "",
        breaks: "",
        type: "Employee",
        tolls: false,
        fuelLevy: "",
      });
    }
    setHasUnsavedChanges(false);
  }, [driver, isOpen]);

  // Track changes to detect unsaved modifications
  useEffect(() => {
    if (!driver) {
      // For new drivers, check if any data has been entered
      const hasData =
        formData.driver ||
        formData.truck ||
        formData.tray ||
        formData.crane ||
        formData.semi ||
        formData.semiCrane ||
        formData.breaks ||
        formData.type !== "Employee" ||
        formData.tolls ||
        formData.fuelLevy;
      setHasUnsavedChanges(!!hasData);
    } else {
      // For existing drivers, compare with original data
      const hasChanges =
        formData.driver !== (driver.driver || "") ||
        formData.truck !== (driver.truck || "") ||
        formData.tray !== (driver.tray?.toString() || "") ||
        formData.crane !== (driver.crane?.toString() || "") ||
        formData.semi !== (driver.semi?.toString() || "") ||
        formData.semiCrane !== (driver.semiCrane?.toString() || "") ||
        formData.breaks !== (driver.breaks?.toString() || "") ||
        formData.type !== (driver.type || "Employee") ||
        formData.tolls !== (driver.tolls || false) ||
        formData.fuelLevy !== (driver.fuelLevy?.toString() || "");
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, driver]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData: Partial<Driver> = {
      ...formData,
      tray: formData.tray ? Math.max(0, parseInt(formData.tray) || 0) : null,
      crane: formData.crane ? Math.max(0, parseInt(formData.crane) || 0) : null,
      semi: formData.semi ? Math.max(0, parseInt(formData.semi) || 0) : null,
      semiCrane: formData.semiCrane ? Math.max(0, parseInt(formData.semiCrane) || 0) : null,
      breaks: formData.breaks ? Math.max(0, parseFloat(formData.breaks) || 0) : null,
      fuelLevy: formData.fuelLevy ? Math.max(0, parseInt(formData.fuelLevy) || 0) : null,
    };

    if (driver) {
      submitData.id = driver.id;
    }

    onSubmit(submitData);
    setHasUnsavedChanges(false);
  };

  const handleInputChange = (
    field: string,
    value: string | "Employee" | "Contractor" | "Subcontractor" | boolean,
  ) => {
    setFormData((prev) => {
      const newData = {
        ...prev,
        [field]: value,
      };

      // Clear tolls and fuel levy when type is not Subcontractor
      if (field === "type" && value !== "Subcontractor") {
        newData.tolls = false;
        newData.fuelLevy = "";
      }

      return newData;
    });
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirmation(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirmation(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleCloseAttempt}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {driver ? "Edit Driver" : "Add New Driver"}
            </DialogTitle>
            <DialogDescription>
              {driver
                ? "Update driver information."
                : "Enter the details for the new driver."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="driver-name-input"
                  className="text-sm font-medium"
                >
                  Driver Name *
                </label>
                <Input
                  id="driver-name-input"
                  className="rounded"
                  value={formData.driver}
                  onChange={(e) => handleInputChange("driver", e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="truck-select" className="text-sm font-medium">
                  Truck *
                </label>
                <SearchableSelect
                  id="truck-select"
                  value={formData.truck}
                  onChange={(value) => handleInputChange("truck", value)}
                  options={vehicleRegistrations}
                  placeholder="Select truck registration..."
                  className="w-full"
                  disabled={isLoading}
                  loading={isLoadingVehicles}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Service Rates ($)</label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="tray-rate-input"
                    className="text-sm font-medium"
                  >
                    Tray Rate
                  </label>
                  <Input
                    id="tray-rate-input"
                    className="rounded"
                    type="number"
                    value={formData.tray}
                    onChange={(e) => handleInputChange("tray", e.target.value)}
                    placeholder="Enter amount"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="crane-rate-input"
                    className="text-sm font-medium"
                  >
                    Crane Rate
                  </label>
                  <Input
                    id="crane-rate-input"
                    className="rounded"
                    type="number"
                    value={formData.crane}
                    onChange={(e) => handleInputChange("crane", e.target.value)}
                    placeholder="Enter amount"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="semi-rate-input"
                    className="text-sm font-medium"
                  >
                    Semi Rate
                  </label>
                  <Input
                    id="semi-rate-input"
                    className="rounded"
                    type="number"
                    value={formData.semi}
                    onChange={(e) => handleInputChange("semi", e.target.value)}
                    placeholder="Enter amount"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="semi-crane-rate-input"
                    className="text-sm font-medium"
                  >
                    Semi Crane Rate
                  </label>
                  <Input
                    id="semi-crane-rate-input"
                    className="rounded"
                    type="number"
                    value={formData.semiCrane}
                    onChange={(e) =>
                      handleInputChange("semiCrane", e.target.value)
                    }
                    placeholder="Enter amount"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="breaks-input" className="text-sm font-medium">
                  Breaks (hours)
                </label>
                <Input
                  id="breaks-input"
                  className="rounded"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.breaks}
                  onChange={(e) => handleInputChange("breaks", e.target.value)}
                  placeholder="Enter hours (e.g., 0.5)"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="type-select" className="text-sm font-medium">
                  Type *
                </label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    handleInputChange(
                      "type",
                      value as "Employee" | "Contractor" | "Subcontractor",
                    )
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id="type-select" className="rounded">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Contractor">Contractor</SelectItem>
                    <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Only show tolls and fuel levy for subcontractors */}
            {formData.type === "Subcontractor" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="fuel-levy-select"
                    className="text-sm font-medium"
                  >
                    Fuel Levy
                  </label>
                  <Select
                    value={formData.fuelLevy}
                    onValueChange={(value) =>
                      handleInputChange("fuelLevy", value)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger id="fuel-levy-select" className="rounded">
                      <SelectValue placeholder="Select percentage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="15">15%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tolls</label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="tolls-checkbox"
                      checked={formData.tolls}
                      onCheckedChange={(checked) =>
                        handleInputChange("tolls", checked as boolean)
                      }
                      disabled={isLoading}
                    />
                    <label htmlFor="tolls-checkbox" className="text-sm">
                      Include tolls
                    </label>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded"
                onClick={handleCloseAttempt}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </div>
                ) : driver ? (
                  "Update Driver"
                ) : (
                  "Add Driver"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <AlertDialog
        open={showCloseConfirmation}
        onOpenChange={setShowCloseConfirmation}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close this
              form? All changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCloseConfirmation(false)}>
              Continue Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Close Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
