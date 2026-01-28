"use client";

import React, { useState, useCallback } from "react";
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
import { TableLoadingSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Archive } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const EmptyArchivedState = () => (
  <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground py-16">
    <Archive className="h-12 w-12 mb-4 opacity-50" />
    <p className="text-lg font-medium">No archived drivers</p>
    <p className="text-sm">
      Archived drivers will appear here. You can archive a driver from the
      actions menu.
    </p>
  </div>
);

const DriversPage = () => {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("active");

  // Multi-delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driversToDelete, setDriversToDelete] = useState<Driver[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch drivers using SWR
  const {
    data: drivers = [] as Driver[],
    isLoading,
    mutate,
  } = useSWR<Driver[]>("/api/drivers", fetcher);

  // Separate active and archived drivers
  const activeDrivers = drivers.filter((d: Driver) => !d.isArchived);
  const archivedDrivers = drivers.filter((d: Driver) => d.isArchived);

  // Get current display data based on active tab
  const displayedDrivers =
    activeTab === "active" ? activeDrivers : archivedDrivers;

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
          await mutate();
          setIsFormOpen(false);
          setEditingDriver(null);
          toast({
            title: "Driver updated",
            description: "Driver details have been updated successfully.",
          });
        } else {
          const errorData = await response.json();
          toast({
            title: "Failed to update driver",
            description: errorData.error || "Please try again.",
            variant: "destructive",
          });
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
          await mutate();
          setIsFormOpen(false);
          toast({
            title: "Driver created",
            description: "New driver has been added successfully.",
          });
        } else {
          const errorData = await response.json();
          toast({
            title: "Failed to create driver",
            description: errorData.error || "Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error submitting driver:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
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
        await mutate();
        toast({
          title: "Driver deleted",
          description: `${driver.driver} has been deleted successfully.`,
        });
      } else {
        const errorData = await response.json();
        console.error("Failed to delete driver:", errorData.error);
        throw new Error(errorData.error || "Failed to delete driver");
      }
    } catch (error) {
      console.error("Error deleting driver:", error);
      throw error;
    } finally {
      setLoadingRowId(null);
    }
  };

  // Handle archive/unarchive
  const handleArchive = async (driver: Driver) => {
    const newArchiveStatus = !driver.isArchived;
    try {
      const response = await fetch(`/api/drivers/${driver.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isArchived: newArchiveStatus }),
      });

      if (response.ok) {
        await mutate();
        toast({
          title: newArchiveStatus ? "Driver archived" : "Driver restored",
          description: newArchiveStatus
            ? `${driver.driver} has been archived. They will no longer appear in dropdown selections.`
            : `${driver.driver} has been restored and is now active.`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Failed to update driver",
          description: errorData.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error archiving driver:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
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
      await mutate();
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
  }, [driversToDelete, toast, mutate]);

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
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <TableLoadingSkeleton rows={8} columns={7} />
          ) : activeTab === "archived" && archivedDrivers.length === 0 ? (
            <div className="flex flex-col flex-1">
              <UnifiedDataTable
                data={[]}
                columns={driverColumns(
                  handleEdit,
                  handleDelete,
                  undefined,
                  handleArchive,
                )}
                sheetFields={driverSheetFields}
                mobileFields={driverMobileFields}
                getItemId={(driver) => driver.id}
                isLoading={false}
                loadingRowId={loadingRowId}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAdd={handleAddNew}
                onImportSuccess={mutate}
                ToolbarComponent={DriverDataTableToolbarWrapper}
                toolbarProps={{
                  activeTab,
                  onTabChange: setActiveTab,
                  activeCount: activeDrivers.length,
                  archivedCount: archivedDrivers.length,
                }}
                hideToolbar={false}
              />
              <EmptyArchivedState />
            </div>
          ) : (
            <UnifiedDataTable
              data={displayedDrivers}
              columns={driverColumns(
                handleEdit,
                handleDelete,
                activeTab === "active" ? handleMultiDelete : undefined,
                handleArchive,
              )}
              sheetFields={driverSheetFields}
              mobileFields={driverMobileFields}
              getItemId={(driver) => driver.id}
              isLoading={isLoading}
              loadingRowId={loadingRowId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMultiDelete={
                activeTab === "active" ? handleMultiDelete : undefined
              }
              onAdd={handleAddNew}
              onImportSuccess={mutate}
              ToolbarComponent={DriverDataTableToolbarWrapper}
              toolbarProps={{
                activeTab,
                onTabChange: setActiveTab,
                activeCount: activeDrivers.length,
                archivedCount: archivedDrivers.length,
              }}
            />
          )}
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
