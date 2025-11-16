// Shared entity types for the application

// Type aliases compatible with Prisma enums but safe for client-side use
export type GstMode = "exclusive" | "inclusive";
export type GstStatus = "not_registered" | "registered";
export type RctiStatus = "draft" | "finalised" | "paid";
export type DeductionStatus = "active" | "completed" | "cancelled";

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
  jobReference: string | null;
  eastlink: number | null;
  citylink: number | null;
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
  type: "Employee" | "Contractor" | "Subcontractor";
  tolls: boolean;
  fuelLevy: number | null;
  businessName: string | null;
  address: string | null;
  abn: string | null;
  gstStatus: string;
  gstMode: string;
  bankAccountName: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
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
  isGlobal: boolean;
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
  isGlobal?: boolean;
}

export interface GoogleDriveSettingsResponse {
  success: boolean;
  settings?: GoogleDriveSettings;
  error?: string;
  details?: Record<string, unknown>;
}

// RCTI Types
export interface RctiLine {
  id: number;
  rctiId: number;
  jobId: number | null;
  jobDate: string;
  customer: string;
  truckType: string;
  description: string | null;
  chargedHours: number;
  ratePerHour: number;
  amountExGst: number;
  gstAmount: number;
  amountIncGst: number;
  createdAt: string;
  updatedAt: string;
}

export interface Rcti {
  id: number;
  driverId: number;
  driver?: Driver;
  driverName: string;
  businessName: string | null;
  driverAddress: string | null;
  driverAbn: string | null;
  gstStatus: GstStatus;
  gstMode: GstMode;
  bankAccountName: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
  weekEnding: string;
  invoiceNumber: string;
  subtotal: number;
  gst: number;
  total: number;
  status: RctiStatus;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: RctiLine[];
}

export interface RctiCreateRequest {
  driverId: number;
  weekEnding: string | Date;
  driverName?: string;
  businessName?: string;
  driverAddress?: string;
  driverAbn?: string;
  gstStatus?: "registered" | "not_registered";
  gstMode?: "exclusive" | "inclusive";
  bankAccountName?: string;
  bankBsb?: string;
  bankAccountNumber?: string;
  notes?: string;
}

export interface RctiUpdateRequest {
  driverName?: string;
  businessName?: string;
  driverAddress?: string;
  driverAbn?: string;
  gstStatus?: "registered" | "not_registered";
  gstMode?: "exclusive" | "inclusive";
  bankAccountName?: string;
  bankBsb?: string;
  bankAccountNumber?: string;
  notes?: string;
  status?: RctiStatus;
  lines?: Array<{
    id: number;
    chargedHours?: number;
    ratePerHour?: number;
  }>;
}

// RCTI Deduction Types
export interface RctiDeductionApplication {
  id: number;
  deductionId: number;
  rctiId: number;
  amount: number;
  appliedAt: string;
  notes: string | null;
  rcti?: {
    id: number;
    invoiceNumber: string;
    weekEnding: string;
    status: string;
  };
}

export interface RctiDeduction {
  id: number;
  driverId: number;
  driver?: {
    id: number;
    driver: string;
  };
  type: "deduction" | "reimbursement";
  description: string;
  totalAmount: number;
  amountPaid: number;
  amountRemaining: number;
  frequency: "once" | "weekly" | "fortnightly" | "monthly";
  amountPerCycle: number | null;
  status: DeductionStatus;
  startDate: string;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  applications?: RctiDeductionApplication[];
}

export interface PendingDeduction {
  id: number;
  type: "deduction" | "reimbursement";
  description: string;
  amountToApply: number;
  amountRemaining: number;
  frequency: string;
}

export interface PendingDeductionsSummary {
  pending: PendingDeduction[];
  summary: {
    count: number;
    totalDeductions: number;
    totalReimbursements: number;
    netAdjustment: number;
  };
}
