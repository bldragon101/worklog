"use client";
import { useState } from "react";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { Vehicle } from "@/lib/types";
import { vehicleColumns } from "@/components/entities/vehicle/vehicle-columns";
import { vehicleSheetFields } from "@/components/entities/vehicle/vehicle-sheet-fields";
import { VehicleDataTableToolbarWrapper } from "@/components/entities/vehicle/vehicle-data-table-toolbar-wrapper";
import { PageControls } from "@/components/layout/page-controls";
import { VehicleForm } from "@/components/entities/vehicle/vehicle-form";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ProgressDialog } from "@/components/ui/progress-dialog";
import { TableLoadingSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useEntityList } from "@/hooks/use-entity-list";

const VehiclesPage = () => {
  const {
    items: vehicles,
    isFetching,
    refresh,
    setItems: setVehicles,
    isFormOpen,
    editingItem: editingVehicle,
    openAddForm,
    openEditForm,
    closeForm,
    loadingRowId,
    deleteDialogOpen,
    setDeleteDialogOpen,
    itemsToDelete: vehiclesToDelete,
    isDeleting,
    requestMultiDelete,
    deleteItems,
    confirmMultiDelete,
  } = useEntityList<Vehicle>({ resource: "vehicles", singularLabel: "vehicle" });
  const [isFormLoading, setIsFormLoading] = useState(false);

  const { toast } = useToast();

  // Handle delete from a row's menu, which has already asked to confirm
  const handleDelete = async (vehicle: Vehicle) => {
    await deleteItems({ items: [vehicle] });
  };

  // Handle form submit
  const handleFormSubmit = async (vehicleData: Partial<Vehicle>) => {
    setIsFormLoading(true);
    try {
      const isEditing = editingVehicle !== null;
      const url = isEditing
        ? `/api/vehicles/${editingVehicle.id}`
        : "/api/vehicles";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vehicleData),
      });

      if (response.ok) {
        const result = await response.json();
        if (isEditing) {
          setVehicles({
            update: (prev) =>
              prev.map((v) => (v.id === result.id ? result : v)),
          });
        } else {
          setVehicles({ update: (prev) => [result, ...prev] });
        }
        closeForm();
      } else {
        const error = await response.json();
        toast({
          title: "Failed to save vehicle",
          description: error.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving vehicle:", error);
      toast({
        title: "Error saving vehicle",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFormLoading(false);
    }
  };

  // Mobile card fields configuration
  const vehicleMobileFields = [
    {
      key: "truck",
      label: "Truck",
      isTitle: true,
    },
    {
      key: "type",
      label: "Type",
      isSubtitle: true,
    },
    {
      key: "status",
      label: "Status",
      isBadge: true,
    },
  ];

  return (
    <ProtectedLayout>
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-30 bg-white dark:bg-background border-b">
          <PageControls type="vehicles" />
        </div>
        <div className="flex-1 overflow-hidden">
          {/* Conditional rendering: only show table when data is loaded OR not loading */}
          {vehicles.length > 0 || !isFetching ? (
            <UnifiedDataTable
              data={vehicles}
              columns={vehicleColumns(
                openEditForm,
                handleDelete,
                requestMultiDelete,
              )}
              sheetFields={vehicleSheetFields}
              mobileFields={vehicleMobileFields}
              getItemId={(vehicle) => vehicle.id}
              isLoading={isFetching}
              loadingRowId={loadingRowId}
              onEdit={openEditForm}
              onDelete={handleDelete}
              onMultiDelete={requestMultiDelete}
              onAdd={openAddForm}
              onImportSuccess={refresh}
              ToolbarComponent={VehicleDataTableToolbarWrapper}
            />
          ) : (
            <TableLoadingSkeleton rows={8} columns={6} />
          )}
        </div>
        <VehicleForm
          isOpen={isFormOpen}
          onClose={closeForm}
          onSubmit={handleFormSubmit}
          vehicle={editingVehicle}
          isLoading={isFormLoading}
        />
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmMultiDelete}
          title={
            vehiclesToDelete.length > 1
              ? "Delete Multiple Vehicles"
              : "Delete Vehicle"
          }
          description={
            vehiclesToDelete.length > 1
              ? "This will permanently remove these vehicles and all associated data."
              : "This will permanently remove this vehicle and all associated data."
          }
          itemName={
            vehiclesToDelete.length === 1
              ? vehiclesToDelete[0]?.registration
              : undefined
          }
          isLoading={isDeleting}
        />
        <ProgressDialog
          open={isDeleting}
          title="Deleting..."
          description="Please wait while the selected vehicles are deleted."
        />
      </div>
    </ProtectedLayout>
  );
};

export default VehiclesPage;
