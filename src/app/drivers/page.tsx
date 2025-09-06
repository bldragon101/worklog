"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { DriverForm } from "@/components/entities/driver/driver-form";
import { Driver } from "@/lib/types";
import { driverColumns } from "@/components/entities/driver/driver-columns";
import { driverSheetFields } from "@/components/entities/driver/driver-sheet-fields";
import { DriverDataTableToolbarWrapper } from "@/components/entities/driver/driver-data-table-toolbar-wrapper";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { PageControls } from "@/components/layout/page-controls";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ProgressDialog } from "@/components/ui/progress-dialog";
import { useToast } from "@/hooks/use-toast";

const DriversPage = () => {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);

  // Multi-delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driversToDelete, setDriversToDelete] = useState<Driver[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch drivers
  const fetchDrivers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/drivers");
      if (response.ok) {
        const data = await response.json();
        setDrivers(data);
      } else {
        console.error("Failed to fetch drivers");
      }
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // Handle form submission
  const handleFormSubmit = async (driverData: Partial<Driver>) => {
    try {
      setIsSubmitting(true);

      if (editingDriver) {
        // Update existing driver
        const response = await fetch(`/api/drivers/${editingDriver.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(driverData),
        });

        if (response.ok) {
          await fetchDrivers();
          setIsFormOpen(false);
          setEditingDriver(null);
        } else {
          console.error("Failed to update driver");
        }
      } else {
        // Create new driver
        const response = await fetch("/api/drivers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(driverData),
        });

        if (response.ok) {
          await fetchDrivers();
          setIsFormOpen(false);
        } else {
          console.error("Failed to create driver");
        }
      }
    } catch (error) {
      console.error("Error submitting driver:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setIsFormOpen(true);
  };

  // Handle delete
  const handleDelete = async (driver: Driver) => {
    setLoadingRowId(driver.id);
    try {
      const response = await fetch(`/api/drivers/${driver.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchDrivers();
      } else {
        const errorData = await response.json();
        console.error("Failed to delete driver:", errorData.error);
        throw new Error(errorData.error || "Failed to delete driver");
      }
    } catch (error) {
      console.error("Error deleting driver:", error);
      throw error; // Re-throw to let the dialog handle the error
    } finally {
      setLoadingRowId(null);
    }
  };

  // Handle add new driver
  const handleAddNew = () => {
    setEditingDriver(null);
    setIsFormOpen(true);
  };

  // Handle form close
  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingDriver(null);
  };

  // Multi-delete handler
  const handleMultiDelete = useCallback(async (selectedDrivers: Driver[]) => {
    setDriversToDelete(selectedDrivers);
    setDeleteDialogOpen(true);
  }, []);

  // Confirm multi-delete
  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      // Delete each driver in parallel
      const results = await Promise.all(
        driversToDelete.map((driver) =>
          fetch(`/api/drivers/${driver.id}`, { method: "DELETE" }),
        ),
      );
      const allSuccess = results.every((res) => res.ok);

      if (allSuccess) {
        toast({
          title: "Drivers deleted successfully",
          description: `${driversToDelete.length} driver${driversToDelete.length === 1 ? "" : "s"} deleted`,
          variant: "default",
        });
      } else {
        toast({
          title: "Some deletions failed",
          description: "Please refresh and try again",
          variant: "destructive",
        });
      }
      setDeleteDialogOpen(false);
      setDriversToDelete([]);
      await fetchDrivers();
    } catch (error) {
      console.error("Error deleting drivers:", error);
      toast({
        title: "Error deleting drivers",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [driversToDelete, toast]);

  // Mobile card fields configuration
  const driverMobileFields = [
    {
      key: "driver",
      label: "Driver",
      isTitle: true,
    },
    {
      key: "truck",
      label: "Truck",
      isSubtitle: true,
    },
    {
      key: "type",
      label: "Type",
      isBadge: true,
    },
  ];

  return (
    <ProtectedLayout>
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-30 bg-white dark:bg-background border-b">
          <PageControls type="drivers" />
        </div>
        <div className="flex-1 overflow-hidden">
          <UnifiedDataTable
            data={drivers}
            columns={driverColumns(handleEdit, handleDelete, handleMultiDelete)}
            sheetFields={driverSheetFields}
            mobileFields={driverMobileFields}
            getItemId={(driver) => driver.id}
            isLoading={isLoading}
            loadingRowId={loadingRowId}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onMultiDelete={handleMultiDelete}
            onAdd={handleAddNew}
            onImportSuccess={fetchDrivers}
            ToolbarComponent={DriverDataTableToolbarWrapper}
          />
        </div>
        <DriverForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          driver={editingDriver}
          isLoading={isSubmitting}
        />
        {/* Delete Confirmation Dialog */}
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title={
            driversToDelete.length > 1
              ? "Delete Multiple Drivers"
              : "Delete Driver"
          }
          description={
            driversToDelete.length > 1
              ? "This will permanently remove these drivers and all associated data."
              : "This will permanently remove this driver and all associated data."
          }
          itemName={
            driversToDelete.length === 1 ? driversToDelete[0].driver : undefined
          }
          isLoading={isDeleting}
        />
        {/* Progress Dialog */}
        <ProgressDialog
          open={isDeleting}
          title="Deleting drivers..."
          description="Please wait while the selected drivers are deleted."
        />
      </div>
    </ProtectedLayout>
  );
};

export default DriversPage;
