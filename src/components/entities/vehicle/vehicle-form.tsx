"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Vehicle } from "./vehicle-columns";

interface VehicleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (vehicle: Partial<Vehicle>) => void;
  vehicle?: Vehicle | null;
  isLoading?: boolean;
}

const vehicleTypes = ["UTE", "TRAY", "CRANE", "SEMI", "SEMI CRANE", "TRAILER"];

export function VehicleForm({
  isOpen,
  onClose,
  onSubmit,
  vehicle,
  isLoading = false,
}: VehicleFormProps) {
  const [formData, setFormData] = useState({
    registration: "",
    expiryDate: "",
    make: "",
    model: "",
    yearOfManufacture: "",
    type: "",
    carryingCapacity: "",
    trayLength: "",
    craneReach: "",
    craneType: "",
    craneCapacity: "",
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setFormData({
        registration: vehicle.registration || "",
        expiryDate: vehicle.expiryDate
          ? typeof vehicle.expiryDate === "string"
            ? vehicle.expiryDate.split("T")[0]
            : vehicle.expiryDate.toISOString().split("T")[0]
          : "",
        make: vehicle.make || "",
        model: vehicle.model || "",
        yearOfManufacture: vehicle.yearOfManufacture?.toString() || "",
        type: vehicle.type || "",
        carryingCapacity: vehicle.carryingCapacity || "",
        trayLength: vehicle.trayLength || "",
        craneReach: vehicle.craneReach || "",
        craneType: vehicle.craneType || "",
        craneCapacity: vehicle.craneCapacity || "",
      });
    } else {
      setFormData({
        registration: "",
        expiryDate: "",
        make: "",
        model: "",
        yearOfManufacture: "",
        type: "",
        carryingCapacity: "",
        trayLength: "",
        craneReach: "",
        craneType: "",
        craneCapacity: "",
      });
    }
    setHasUnsavedChanges(false);
  }, [vehicle, isOpen]);

  // Track changes to detect unsaved modifications
  useEffect(() => {
    if (!vehicle) {
      // For new vehicles, check if any data has been entered
      const hasData =
        formData.registration ||
        formData.expiryDate ||
        formData.make ||
        formData.model ||
        formData.yearOfManufacture ||
        formData.type ||
        formData.carryingCapacity ||
        formData.trayLength ||
        formData.craneReach ||
        formData.craneType ||
        formData.craneCapacity;
      setHasUnsavedChanges(!!hasData);
    } else {
      // For existing vehicles, compare with original data
      const originalExpiryDate = vehicle.expiryDate
        ? typeof vehicle.expiryDate === "string"
          ? vehicle.expiryDate.split("T")[0]
          : vehicle.expiryDate.toISOString().split("T")[0]
        : "";

      const hasChanges =
        formData.registration !== (vehicle.registration || "") ||
        formData.expiryDate !== originalExpiryDate ||
        formData.make !== (vehicle.make || "") ||
        formData.model !== (vehicle.model || "") ||
        formData.yearOfManufacture !==
          (vehicle.yearOfManufacture?.toString() || "") ||
        formData.type !== (vehicle.type || "") ||
        formData.carryingCapacity !== (vehicle.carryingCapacity || "") ||
        formData.trayLength !== (vehicle.trayLength || "") ||
        formData.craneReach !== (vehicle.craneReach || "") ||
        formData.craneType !== (vehicle.craneType || "") ||
        formData.craneCapacity !== (vehicle.craneCapacity || "");
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, vehicle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData: Partial<Vehicle> = {
      ...formData,
      yearOfManufacture: formData.yearOfManufacture
        ? parseInt(formData.yearOfManufacture)
        : 0,
      carryingCapacity: formData.carryingCapacity || null,
      trayLength: formData.trayLength || null,
      craneReach: formData.craneReach || null,
      craneType: formData.craneType || null,
      craneCapacity: formData.craneCapacity || null,
    };

    if (vehicle) {
      submitData.id = vehicle.id;
    }

    onSubmit(submitData);
    setHasUnsavedChanges(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {vehicle ? "Edit Vehicle" : "Add New Vehicle"}
            </DialogTitle>
            <DialogDescription>
              {vehicle
                ? "Update vehicle information."
                : "Enter the details for the new vehicle."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="registration" className="text-sm font-medium">
                  Registration *
                </label>
                <Input
                  id="registration"
                  className="rounded"
                  value={formData.registration}
                  onChange={(e) =>
                    handleInputChange("registration", e.target.value)
                  }
                  required
                  disabled={isLoading}
                  placeholder="e.g., ABC123"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="expiryDate" className="text-sm font-medium">
                  Expiry Date *
                </label>
                <Input
                  id="expiryDate"
                  className="rounded"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) =>
                    handleInputChange("expiryDate", e.target.value)
                  }
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="make" className="text-sm font-medium">
                  Make *
                </label>
                <Input
                  id="make"
                  className="rounded"
                  value={formData.make}
                  onChange={(e) => handleInputChange("make", e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="e.g., DAF, HINO"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="model" className="text-sm font-medium">
                  Model *
                </label>
                <Input
                  id="model"
                  className="rounded"
                  value={formData.model}
                  onChange={(e) => handleInputChange("model", e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="e.g., LF290, XF530"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="yearOfManufacture"
                  className="text-sm font-medium"
                >
                  Year of Manufacture *
                </label>
                <Input
                  id="yearOfManufacture"
                  className="rounded"
                  type="number"
                  min="1900"
                  max={new Date().getFullYear() + 5}
                  value={formData.yearOfManufacture}
                  onChange={(e) =>
                    handleInputChange("yearOfManufacture", e.target.value)
                  }
                  required
                  disabled={isLoading}
                  placeholder="e.g., 2023"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="type" className="text-sm font-medium">
                  Type *
                </label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => handleInputChange("type", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="rounded">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="carryingCapacity"
                  className="text-sm font-medium"
                >
                  Carrying Capacity
                </label>
                <Input
                  id="carryingCapacity"
                  className="rounded"
                  value={formData.carryingCapacity}
                  onChange={(e) =>
                    handleInputChange("carryingCapacity", e.target.value)
                  }
                  disabled={isLoading}
                  placeholder="e.g., 10T"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="trayLength" className="text-sm font-medium">
                  Tray Length
                </label>
                <Input
                  id="trayLength"
                  className="rounded"
                  value={formData.trayLength}
                  onChange={(e) =>
                    handleInputChange("trayLength", e.target.value)
                  }
                  disabled={isLoading}
                  placeholder="e.g., 6m"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="craneReach" className="text-sm font-medium">
                  Crane Reach
                </label>
                <Input
                  id="craneReach"
                  className="rounded"
                  value={formData.craneReach}
                  onChange={(e) =>
                    handleInputChange("craneReach", e.target.value)
                  }
                  disabled={isLoading}
                  placeholder="e.g., 15m"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="craneType" className="text-sm font-medium">
                  Crane Type
                </label>
                <Input
                  id="craneType"
                  className="rounded"
                  value={formData.craneType}
                  onChange={(e) =>
                    handleInputChange("craneType", e.target.value)
                  }
                  disabled={isLoading}
                  placeholder="e.g., Hiab"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="craneCapacity" className="text-sm font-medium">
                  Crane Capacity
                </label>
                <Input
                  id="craneCapacity"
                  className="rounded"
                  value={formData.craneCapacity}
                  onChange={(e) =>
                    handleInputChange("craneCapacity", e.target.value)
                  }
                  disabled={isLoading}
                  placeholder="e.g., 5T"
                />
              </div>
            </div>

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
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {vehicle ? "Update Vehicle" : "Add Vehicle"}
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
