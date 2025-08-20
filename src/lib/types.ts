// Shared entity types for the application

export interface Job {
  id: number;
  date: string;
  driver: string;
  customer: string;
  billTo: string;
  registration: string;
  truckType: string;
  pickup: string;
  dropoff: string;
  runsheet: boolean | null;
  invoiced: boolean | null;
  chargedHours: number | null;
  driverCharge: number | null;
  startTime: string | null;
  finishTime: string | null;
  comments: string | null;
  attachmentRunsheet: string[];
  attachmentDocket: string[];
  attachmentDeliveryPhotos: string[];
}

export interface Customer {
  id: number;
  customer: string;
  billTo: string;
  contact: string;
  tray: number | null;
  crane: number | null;
  semi: number | null;
  semiCrane: number | null;
  fuelLevy: number | null; // 5, 10, or 15
  tolls: boolean;
  breakDeduction: number | null; // Hours for break deduction over 7.5 hours
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: number;
  driver: string;
  truck: string;
  tray: number | null;
  crane: number | null;
  semi: number | null;
  semiCrane: number | null;
  breaks: number | null;
  type: 'Employee' | 'Contractor' | 'Subcontractor';
  tolls: boolean;
  fuelLevy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: number;
  registration: string;
  expiryDate: string | Date;
  make: string;
  model: string;
  yearOfManufacture: number;
  type: string;
  carryingCapacity: string | null;
  trayLength: string | null;
  craneReach: string | null;
  craneType: string | null;
  craneCapacity: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Maintenance {
  id: number;
  vehicleId: number;
  vehicleRegistration: string;
  date: string;
  type: string;
  description: string;
  cost: number | null;
  supplier: string | null;
  nextDue: string | null;
  completed: boolean;
  comments: string | null;
}

// Google Drive Integration Types
export interface GoogleDriveSettings {
  id: number;
  userId: string;
  driveId: string;
  driveName: string;
  baseFolderId: string;
  folderName: string;
  folderPath: string[];
  purpose: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoogleDriveConfig {
  baseFolderId: string;
  driveId: string;
  folderName?: string;
  folderPath?: string[];
}

export interface GoogleDriveSettingsRequest {
  driveId: string;
  driveName: string;
  baseFolderId: string;
  folderName: string;
  folderPath: string[];
  purpose?: string;
}

export interface GoogleDriveSettingsResponse {
  success: boolean;
  settings?: GoogleDriveSettings;
  error?: string;
  details?: Record<string, unknown>;
}