"use client";
import React, { useState, useEffect } from 'react';
import { ProtectedLayout } from "@/components/protected-layout";
import { VehicleDataTable } from "@/components/VehicleDataTable";
import { Vehicle } from "@/components/vehicle-columns";
import { PageControls } from "@/components/page-controls";

// Sample data converted from CSV
const sampleVehicles: Vehicle[] = [
  {
    id: 1,
    registration: "BJN154",
    expiryDate: "2025-09-07",
    make: "MERC B",
    model: "X250",
    yearOfManufacture: 2020,
    type: "UTE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    registration: "CKY727",
    expiryDate: "2025-09-05",
    make: "DAF",
    model: "LF290",
    yearOfManufacture: 2023,
    type: "TRAY",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    registration: "XW58DC",
    expiryDate: "2026-05-08",
    make: "U D",
    model: "PW24",
    yearOfManufacture: 2018,
    type: "CRANE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    registration: "XV91JY",
    expiryDate: "2026-02-20",
    make: "U D",
    model: "PD24 2",
    yearOfManufacture: 2019,
    type: "TRAY",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 5,
    registration: "BLN404",
    expiryDate: "2026-03-30",
    make: "DAF",
    model: "XF530",
    yearOfManufacture: 2021,
    type: "SEMI",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 6,
    registration: "XW65RG",
    expiryDate: "2026-08-02",
    make: "DAF",
    model: "LF290",
    yearOfManufacture: 2021,
    type: "CRANE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 7,
    registration: "BQW194",
    expiryDate: "2026-01-28",
    make: "DAF",
    model: "FA LF2",
    yearOfManufacture: 2021,
    type: "CRANE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 8,
    registration: "YV01PG",
    expiryDate: "2025-09-26",
    make: "STONE",
    model: "3 AXLE",
    yearOfManufacture: 2022,
    type: "TRAILER",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 9,
    registration: "YV00PG",
    expiryDate: "2025-09-26",
    make: "STONE",
    model: "3 AXLE",
    yearOfManufacture: 2022,
    type: "TRAILER",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 10,
    registration: "BWS900",
    expiryDate: "2025-10-26",
    make: "DAF",
    model: "CF480F",
    yearOfManufacture: 2022,
    type: "SEMI",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 11,
    registration: "BWS903",
    expiryDate: "2026-02-03",
    make: "DAF",
    model: "CF410",
    yearOfManufacture: 2022,
    type: "CRANE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 12,
    registration: "BCJ996",
    expiryDate: "2026-04-12",
    make: "HINO",
    model: "700",
    yearOfManufacture: 2022,
    type: "CRANE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 13,
    registration: "BCJ995",
    expiryDate: "2026-05-15",
    make: "HINO",
    model: "700",
    yearOfManufacture: 2022,
    type: "CRANE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 14,
    registration: "CKY704",
    expiryDate: "2025-10-04",
    make: "DAF",
    model: "XF530",
    yearOfManufacture: 2023,
    type: "SEMI",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 15,
    registration: "XW19ML",
    expiryDate: "2025-11-23",
    make: "IVECO",
    model: "STRALI",
    yearOfManufacture: 2014,
    type: "SEMI CRANE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 16,
    registration: "CNV398",
    expiryDate: "2025-12-14",
    make: "DAF",
    model: "LF290",
    yearOfManufacture: 2023,
    type: "TRAY",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 17,
    registration: "XW36NI",
    expiryDate: "2026-02-28",
    make: "HINO",
    model: "500",
    yearOfManufacture: 2023,
    type: "TRAY",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 18,
    registration: "YV07SH",
    expiryDate: "2026-07-02",
    make: "STONE",
    model: "ST3 OD",
    yearOfManufacture: 2024,
    type: "TRAILER",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 19,
    registration: "BCJ998",
    expiryDate: "2025-09-19",
    make: "HINO",
    model: "700",
    yearOfManufacture: 2023,
    type: "SEMI CRANE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 20,
    registration: "CTJ450",
    expiryDate: "2025-09-25",
    make: "DAF",
    model: "CF450",
    yearOfManufacture: 2023,
    type: "CRANE",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 21,
    registration: "YV59WD",
    expiryDate: "2026-07-22",
    make: "STONE",
    model: "ST3 OD",
    yearOfManufacture: 2025,
    type: "TRAILER",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 22,
    registration: "GAGANW",
    expiryDate: "2026-07-18",
    make: "DAF",
    model: "XG660",
    yearOfManufacture: 2024,
    type: "SEMI",
    carryingCapacity: null,
    trayLength: null,
    craneReach: null,
    craneType: null,
    craneCapacity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(sampleVehicles);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);

  // Handle edit (placeholder for now)
  const handleEdit = (vehicle: Vehicle) => {
    console.log('Edit vehicle:', vehicle);
    // TODO: Implement edit functionality
  };

  // Handle delete (placeholder for now)
  const handleDelete = (vehicle: Vehicle) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      setLoadingRowId(vehicle.id);
      setTimeout(() => {
        setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
        setLoadingRowId(null);
      }, 1000);
    }
  };

  // Handle add vehicle (placeholder for now)
  const handleAddVehicle = () => {
    console.log('Add new vehicle');
    // TODO: Implement add vehicle functionality
  };

  // Handle import success
  const handleImportSuccess = () => {
    console.log('Import successful');
    // TODO: Refresh vehicle data
  };

  return (
    <ProtectedLayout>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gray-900 dark:bg-white flex items-center justify-center">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-white dark:text-gray-900"
              >
                <path d="M14 16H9m10 0h3m-3 0l-3-3m3 3l-3 3M7 8h.01M7 12h.01M7 16h.01m-4-8h.01m-.01 4h.01m-.01 4h.01"/>
                <rect x="5" y="2" width="14" height="20" rx="2"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Vehicles</h1>
              <p className="text-muted-foreground">Manage your fleet vehicles and track registration details.</p>
            </div>
          </div>
        </div>
        
        <PageControls
          type="vehicles"
        />

        <div className="flex-1">
          <VehicleDataTable
            data={vehicles}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            loadingRowId={loadingRowId}
            onImportSuccess={handleImportSuccess}
            onAddVehicle={handleAddVehicle}
          />
        </div>
      </div>
    </ProtectedLayout>
  );
};

export default VehiclesPage;
