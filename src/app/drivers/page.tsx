"use client";

import { useState } from "react";
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { DriverForm } from "@/components/entities/driver/driver-form";
import { Driver } from "@/lib/types";
import { driverColumns } from "@/components/entities/driver/driver-columns";
import { formatDriverFullName } from "@/lib/utils/driver-name";
import { driverSheetFields } from "@/components/entities/driver/driver-sheet-fields";
import { DriverDataTableToolbarWrapper } from "@/components/entities/driver/driver-data-table-toolbar-wrapper";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { PageControls } from "@/components/layout/page-controls";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ProgressDialog } from "@/components/ui/progress-dialog";
import { TableLoadingSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useEntityList } from "@/hooks/use-entity-list";
import { Archive } from "lucide-react";

const EmptyArchivedState = () => (
  <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground py-16">
    <Archive
      className="h-12 w-12 mb-4 opacity-50"
      aria-label="No archived drivers"
    />
    <p className="text-lg font-medium">No archived drivers</p>
    <p className="text-sm">
      Archived drivers will appear here. You can archive a driver from the
      actions menu.
    </p>
  </div>
);

const DriversPage = () => {
  const { toast } = useToast();
  const {
    items: drivers,
    isLoading,
    refresh,
    isFormOpen,
    editingItem: editingDriver,
    openAddForm,
    openEditForm,
    closeForm,
    loadingRowId,
    deleteItem,
    deleteDialogOpen,
    setDeleteDialogOpen,
    itemsToDelete: driversToDelete,
    isDeleting,
    requestMultiDelete,
    confirmMultiDelete,
  } = useEntityList<Driver>({ resource: "drivers", singularLabel: "driver" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

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
          await refresh();
          closeForm();
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
          await refresh();
          closeForm();
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

  // Handle delete
  const handleDelete = async (driver: Driver) => {
    await deleteItem({ item: driver });
    toast({
      title: "Driver deleted",
      description: `${driver.driver} has been deleted successfully.`,
    });
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
        await refresh();
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

  // Mobile card fields configuration
  const driverMobileFields = [
    {
      key: "driver",
      label: "Driver",
      isTitle: true,
      render: (_value: unknown, item: unknown) =>
        formatDriverFullName(item as Driver),
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
                  openEditForm,
                  handleDelete,
                  undefined,
                  handleArchive,
                )}
                sheetFields={driverSheetFields}
                mobileFields={driverMobileFields}
                getItemId={(driver) => driver.id}
                isLoading={false}
                loadingRowId={loadingRowId}
                onEdit={openEditForm}
                onDelete={handleDelete}
                onAdd={openAddForm}
                onImportSuccess={refresh}
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
                openEditForm,
                handleDelete,
                activeTab === "active" ? requestMultiDelete : undefined,
                handleArchive,
              )}
              sheetFields={driverSheetFields}
              mobileFields={driverMobileFields}
              getItemId={(driver) => driver.id}
              isLoading={isLoading}
              loadingRowId={loadingRowId}
              onEdit={openEditForm}
              onDelete={handleDelete}
              onMultiDelete={
                activeTab === "active" ? requestMultiDelete : undefined
              }
              onAdd={openAddForm}
              onImportSuccess={refresh}
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
          onClose={closeForm}
          onSubmit={handleFormSubmit}
          driver={editingDriver}
          isLoading={isSubmitting}
        />
        {/* Delete Confirmation Dialog */}
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmMultiDelete}
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
