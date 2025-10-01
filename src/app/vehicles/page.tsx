"use client";
import React, { useState, useEffect, useCallback } from "react";
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

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingRowId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);

  // Multi-delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehiclesToDelete, setVehiclesToDelete] = useState<Vehicle[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  // Fetch vehicles from API
  const fetchVehicles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/vehicles");
      if (response.ok) {
        const data = await response.json();
        setVehicles(data);
      } else {
        console.error("Failed to fetch vehicles:", response.statusText);
        setVehicles([]);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      setVehicles([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load vehicles on component mount
  useEffect(() => {
    fetchVehicles();
  }, []);

  // Handle edit
  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsFormOpen(true);
  };

  // Handle delete
  const handleDelete = async (vehicle: Vehicle) => {
    setVehiclesToDelete([vehicle]);
    setDeleteDialogOpen(true);
  };

  // Handle multi-delete
  const handleMultiDelete = useCallback(async (selected: Vehicle[]) => {
    setVehiclesToDelete(selected);
    setDeleteDialogOpen(true);
  }, []);

  // Confirm delete (single or multi)
  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      // Bulk delete API if available, otherwise delete sequentially
      // Here, we'll use sequential deletes for vehicles
      const results = await Promise.allSettled(
        vehiclesToDelete.map((vehicle) =>
          fetch(`/api/vehicles/${vehicle.id}`, { method: "DELETE" }),
        ),
      );
      const successCount = results.filter(
        (r) =>
          r.status === "fulfilled" &&
          (r as PromiseFulfilledResult<Response>).value.ok,
      ).length;

      if (successCount === vehiclesToDelete.length) {
        toast({
          title: "Vehicles deleted successfully",
          description: `${successCount} vehicle${successCount === 1 ? "" : "s"} deleted`,
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
      setVehiclesToDelete([]);
      fetchVehicles();
    } catch (error) {
      console.error("Error deleting vehicles:", error);
      toast({
        title: "Error deleting vehicles",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [vehiclesToDelete, toast]);

  // Handle add vehicle
  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setIsFormOpen(true);
  };

  // Handle import success
  const handleImportSuccess = () => {
    fetchVehicles();
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
          setVehicles((prev) =>
            prev.map((v) => (v.id === result.id ? result : v)),
          );
        } else {
          setVehicles((prev) => [result, ...prev]);
        }
        setIsFormOpen(false);
        setEditingVehicle(null);
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

  // Handle form close
  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingVehicle(null);
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
          {vehicles.length > 0 || !isLoading ? (
            <UnifiedDataTable
              data={vehicles}
              columns={vehicleColumns(
                handleEdit,
                handleDelete,
                handleMultiDelete,
              )}
              sheetFields={vehicleSheetFields}
              mobileFields={vehicleMobileFields}
              getItemId={(vehicle) => vehicle.id}
              isLoading={isLoading}
              loadingRowId={loadingRowId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onMultiDelete={handleMultiDelete}
              onAdd={handleAddVehicle}
              onImportSuccess={handleImportSuccess}
              ToolbarComponent={VehicleDataTableToolbarWrapper}
            />
          ) : (
            <TableLoadingSkeleton rows={8} columns={6} />
          )}
        </div>
        <VehicleForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          vehicle={editingVehicle}
          isLoading={isFormLoading}
        />
        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
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
