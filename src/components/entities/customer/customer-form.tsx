"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FuelLevySelect } from "@/components/shared/fuel-levy-select";
import { parseFuelLevy } from "@/lib/utils/fuel-levy";
import { useDefaultFuelLevy } from "@/hooks/use-default-fuel-levy";
import { Loader2 } from "lucide-react";
import { Customer } from "./customer-columns";

const TRUCK_TYPE_RATE_FIELDS = [
  { field: "tray", label: "Tray" },
  { field: "crane", label: "Crane" },
  { field: "semi", label: "Semi" },
  { field: "semiCrane", label: "Semi Crane" },
] as const;

/**
 * Returns the value when it is a positive number, otherwise null, matching the
 * customer schema which rejects zero or negative rates and break deductions.
 */
function toPositiveOrNull({ value }: { value: number }): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Initial form values. New customers include tolls, and their fuel levy starts
 * as null, meaning untouched, so it follows the default fuel levy until edited.
 */
function getInitialFormData({ customer }: { customer?: Customer | null }): {
  customer: string;
  billTo: string;
  contact: string;
  tray: string;
  crane: string;
  semi: string;
  semiCrane: string;
  fuelLevy: string | null;
  tolls: boolean;
  breakDeduction: string;
  comments: string;
} {
  if (!customer) {
    return {
      customer: "",
      billTo: "",
      contact: "",
      tray: "",
      crane: "",
      semi: "",
      semiCrane: "",
      fuelLevy: null,
      tolls: true,
      breakDeduction: "",
      comments: "",
    };
  }
  return {
    customer: customer.customer || "",
    billTo: customer.billTo || "",
    contact: customer.contact || "",
    tray: customer.tray?.toString() || "",
    crane: customer.crane?.toString() || "",
    semi: customer.semi?.toString() || "",
    semiCrane: customer.semiCrane?.toString() || "",
    fuelLevy: customer.fuelLevy?.toString() || "",
    tolls: customer.tolls || false,
    breakDeduction: customer.breakDeduction
      ? customer.breakDeduction.toString()
      : "",
    comments: customer.comments || "",
  };
}

type CustomerFormData = ReturnType<typeof getInitialFormData>;

function isFormDataEqual({
  a,
  b,
}: {
  a: CustomerFormData;
  b: CustomerFormData;
}): boolean {
  return (Object.keys(a) as Array<keyof CustomerFormData>).every(
    (key) => a[key] === b[key],
  );
}

interface CustomerFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (customer: Partial<Customer>) => void;
  customer?: Customer | null;
  isLoading?: boolean;
}

export function CustomerForm({
  isOpen,
  onClose,
  onSubmit,
  customer,
  isLoading = false,
}: CustomerFormProps) {
  const { data: defaultFuelLevy } = useDefaultFuelLevy();
  const isNewCustomer = !customer;
  const [formData, setFormData] = useState(() =>
    getInitialFormData({ customer }),
  );
  const [fuelLevyError, setFuelLevyError] = useState<string | null>(null);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

  const hasUnsavedChanges = !isFormDataEqual({
    a: formData,
    b: getInitialFormData({ customer }),
  });

  const fuelLevyValue =
    formData.fuelLevy ??
    (defaultFuelLevy === null || defaultFuelLevy === undefined
      ? ""
      : defaultFuelLevy.toString());

  // Reset form when customer or dialog open state changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData(getInitialFormData({ customer }));
    setFuelLevyError(null);
  }, [customer, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const fuelLevy = parseFuelLevy({ value: fuelLevyValue });
    if (isNewCustomer && fuelLevy === null) {
      setFuelLevyError("Fuel levy is required");
      return;
    }

    const submitData: Partial<Customer> = {
      ...formData,
      tray: toPositiveOrNull({ value: parseInt(formData.tray) }),
      crane: toPositiveOrNull({ value: parseInt(formData.crane) }),
      semi: toPositiveOrNull({ value: parseInt(formData.semi) }),
      semiCrane: toPositiveOrNull({ value: parseInt(formData.semiCrane) }),
      fuelLevy,
      breakDeduction: toPositiveOrNull({
        value: parseFloat(formData.breakDeduction),
      }),
      comments: formData.comments || null,
    };

    if (customer) {
      submitData.id = customer.id;
    }

    onSubmit(submitData);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field === "fuelLevy") setFuelLevyError(null);
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
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleCloseAttempt}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {customer ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
            <DialogDescription>
              {customer
                ? "Update customer information."
                : "Enter the details for the new customer, including rates for every truck type and the fuel levy."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="customer" className="text-sm font-medium">
                  Customer *
                </label>
                <Input
                  id="customer"
                  className="rounded"
                  value={formData.customer}
                  onChange={(e) =>
                    handleInputChange("customer", e.target.value)
                  }
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="billTo" className="text-sm font-medium">
                  Bill To *
                </label>
                <Input
                  id="billTo"
                  className="rounded"
                  value={formData.billTo}
                  onChange={(e) => handleInputChange("billTo", e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="contact" className="text-sm font-medium">
                Contact *
              </label>
              <Input
                id="contact"
                className="rounded"
                value={formData.contact}
                onChange={(e) => handleInputChange("contact", e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">
                Service Rates ($){isNewCustomer && " *"}
              </label>
              <div className="grid grid-cols-2 gap-4">
                {TRUCK_TYPE_RATE_FIELDS.map(({ field, label }) => (
                  <div key={field} className="space-y-2">
                    <label htmlFor={field} className="text-sm font-medium">
                      {label}
                      {isNewCustomer && " *"}
                    </label>
                    <Input
                      id={field}
                      className="rounded"
                      type="number"
                      min="1"
                      step="1"
                      value={formData[field]}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      placeholder="Enter amount"
                      required={isNewCustomer}
                      disabled={isLoading}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="fuel-levy-select" className="text-sm font-medium">
                  Fuel Levy{isNewCustomer && " *"}
                </label>
                <FuelLevySelect
                  id="fuel-levy-select"
                  value={fuelLevyValue}
                  onChange={(value) => handleInputChange("fuelLevy", value)}
                  disabled={isLoading}
                />
                {fuelLevyError && (
                  <p className="text-sm text-destructive" role="alert">
                    {fuelLevyError}
                  </p>
                )}
                {isNewCustomer &&
                  defaultFuelLevy !== null &&
                  defaultFuelLevy !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Default fuel levy is {defaultFuelLevy}%
                    </p>
                  )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tolls</label>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="tolls"
                    checked={formData.tolls}
                    onCheckedChange={(checked) =>
                      handleInputChange("tolls", checked as boolean)
                    }
                    disabled={isLoading}
                    className="rounded-none"
                  />
                  <label htmlFor="tolls" className="text-sm">
                    Include tolls
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="break-deduction-input"
                className="text-sm font-medium"
              >
                Break Deduction (hours) - over 7.5 hours
              </label>
              <Input
                id="break-deduction-input"
                className="rounded"
                type="number"
                step="0.1"
                min="0"
                value={formData.breakDeduction}
                onChange={(e) =>
                  handleInputChange("breakDeduction", e.target.value)
                }
                placeholder="Enter hours (e.g., 0.5)"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="comments" className="text-sm font-medium">
                Comments
              </label>
              <Textarea
                id="comments"
                className="rounded"
                value={formData.comments}
                onChange={(e) => handleInputChange("comments", e.target.value)}
                placeholder="Enter any additional comments..."
                rows={3}
                disabled={isLoading}
              />
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
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </div>
                ) : customer ? (
                  "Update Customer"
                ) : (
                  "Add Customer"
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
