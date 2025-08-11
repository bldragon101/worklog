"use client"

import React, { useState, useEffect } from 'react';
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { DriverForm } from "@/components/entities/driver/driver-form";
import { Driver } from "@/lib/types";
import { driverColumns } from "@/components/entities/driver/driver-columns";
import { driverSheetFields } from "@/components/entities/driver/driver-sheet-fields";
import { DriverDataTableToolbarWrapper } from "@/components/entities/driver/driver-data-table-toolbar-wrapper";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { PageControls } from "@/components/layout/page-controls";

const DriversPage = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);

  // Fetch drivers
  const fetchDrivers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/drivers');
      if (response.ok) {
        const data = await response.json();
        setDrivers(data);
      } else {
        console.error('Failed to fetch drivers');
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
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
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(driverData),
        });

        if (response.ok) {
          await fetchDrivers();
          setIsFormOpen(false);
          setEditingDriver(null);
        } else {
          console.error('Failed to update driver');
        }
      } else {
        // Create new driver
        const response = await fetch('/api/drivers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(driverData),
        });

        if (response.ok) {
          await fetchDrivers();
          setIsFormOpen(false);
        } else {
          console.error('Failed to create driver');
        }
      }
    } catch (error) {
      console.error('Error submitting driver:', error);
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
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchDrivers();
      } else {
        const errorData = await response.json();
        console.error('Failed to delete driver:', errorData.error);
        throw new Error(errorData.error || 'Failed to delete driver');
      }
    } catch (error) {
      console.error('Error deleting driver:', error);
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

  // Mobile card fields configuration
  const driverMobileFields = [
    {
      key: 'driver',
      label: 'Driver',
      isTitle: true,
    },
    {
      key: 'truck',
      label: 'Truck',
      isSubtitle: true,
    },
    {
      key: 'type',
      label: 'Type',
      isBadge: true,
    },
  ];

  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full w-full max-w-full space-y-4">
        <PageControls
          type="drivers"
        />

        <div className="flex-1 w-full max-w-full">
          <div className="px-4 pb-4 h-full">
            <UnifiedDataTable
              data={drivers}
              columns={driverColumns(handleEdit, handleDelete)}
              sheetFields={driverSheetFields}
              mobileFields={driverMobileFields}
              getItemId={(driver) => driver.id}
              isLoading={isLoading}
              loadingRowId={loadingRowId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAddNew}
              onImportSuccess={fetchDrivers}
              ToolbarComponent={DriverDataTableToolbarWrapper}
            />
          </div>
        </div>

        <DriverForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          driver={editingDriver}
          isLoading={isSubmitting}
        />
      </div>
    </ProtectedLayout>
  );
};

export default DriversPage;
