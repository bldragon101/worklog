"use client";
import React, { useState, useEffect } from 'react';
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { Vehicle } from "@/lib/types";
import { vehicleColumns } from "@/components/entities/vehicle/vehicle-columns";
import { vehicleSheetFields } from "@/components/entities/vehicle/vehicle-sheet-fields";
import { VehicleDataTableToolbarWrapper } from "@/components/entities/vehicle/vehicle-data-table-toolbar-wrapper";
import { PageControls } from "@/components/layout/page-controls";
import { VehicleForm } from "@/components/entities/vehicle/vehicle-form";

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);

  // Fetch vehicles from API
  const fetchVehicles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/vehicles');
      if (response.ok) {
        const data = await response.json();
        setVehicles(data);
      } else {
        console.error('Failed to fetch vehicles:', response.statusText);
        setVehicles([]);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
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
    if (confirm('Are you sure you want to delete this vehicle?')) {
      setLoadingRowId(vehicle.id);
      try {
        const response = await fetch(`/api/vehicles/${vehicle.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
        } else {
          console.error('Failed to delete vehicle:', response.statusText);
          alert('Failed to delete vehicle. Please try again.');
        }
      } catch (error) {
        console.error('Error deleting vehicle:', error);
        alert('Failed to delete vehicle. Please try again.');
      } finally {
        setLoadingRowId(null);
      }
    }
  };

  // Handle add vehicle
  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setIsFormOpen(true);
  };

  // Handle import success
  const handleImportSuccess = () => {
    console.log('Import successful');
    // Refresh vehicle data from API
    fetchVehicles();
  };

  // Handle form submit
  const handleFormSubmit = async (vehicleData: Partial<Vehicle>) => {
    setIsFormLoading(true);
    try {
      const isEditing = editingVehicle !== null;
      const url = isEditing ? `/api/vehicles/${editingVehicle.id}` : '/api/vehicles';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicleData),
      });

      if (response.ok) {
        const result = await response.json();
        if (isEditing) {
          setVehicles(prev => prev.map(v => v.id === result.id ? result : v));
        } else {
          setVehicles(prev => [result, ...prev]);
        }
        setIsFormOpen(false);
        setEditingVehicle(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save vehicle. Please try again.');
      }
    } catch (error) {
      console.error('Error saving vehicle:', error);
      alert('Failed to save vehicle. Please try again.');
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
      key: 'truck',
      label: 'Truck',
      isTitle: true,
    },
    {
      key: 'type',
      label: 'Type',
      isSubtitle: true,
    },
    {
      key: 'status',
      label: 'Status',
      isBadge: true,
    },
  ];


  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full w-full max-w-full space-y-4">
        <PageControls type="vehicles" />

        <div className="flex-1 w-full max-w-full">
          <div className="px-4 pb-4 h-full">
            <UnifiedDataTable
              data={vehicles}
              columns={vehicleColumns(handleEdit, handleDelete)}
              sheetFields={vehicleSheetFields}
              mobileFields={vehicleMobileFields}
              getItemId={(vehicle) => vehicle.id}
              isLoading={isLoading}
              loadingRowId={loadingRowId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAddVehicle}
              onImportSuccess={handleImportSuccess}
              ToolbarComponent={VehicleDataTableToolbarWrapper}
            />
          </div>
        </div>

        <VehicleForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          vehicle={editingVehicle}
          isLoading={isFormLoading}
        />
      </div>
    </ProtectedLayout>
  );
};

export default VehiclesPage;
