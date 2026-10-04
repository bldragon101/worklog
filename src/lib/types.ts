import type { CountryRunUnit } from "@/lib/utils/country-run";
// Shared entity types for the application

// Jobs Report Types
type JobsReportStatus = "draft" | "finalised";

interface JobsReportLine {
  id: number;
  reportId: number;
  jobId: number | null;
  jobDate: string;
  customer: string;
  truckType: string;
  description: string | null;
  startTime: string | null;
  finishTime: string | null;
  chargedHours: number | null;
  travelTimeHours: number | null;
  driverCharge: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobsReport {
  id: number;
  driverId: number;
  driverName: string;
  weekEnding: string;
  reportNumber: string;
  status: JobsReportStatus;
  notes: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  driver?: Driver;
  lines: JobsReportLine[];
}

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
  travelTimeHours?: number | null;
  driverCharge: number | null;
  deductionHours?: number | null;
  /** Admin only: RCTIs and jobs reports show the hours paid, without the deduction. */
  hideDeduction?: boolean;
  /** Paid to the driver but not charged to the customer. */
  driverOnly?: boolean | null;
  startTime: string | null;
  finishTime: string | null;
  comments: string | null;
  jobReference: string | null;
  countryRunValue?: number | null;
  countryRunUnit?: CountryRunUnit | null;
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
  fuelLevy: number | null;
  tolls: boolean;
  breakDeduction: number | null; // Hours for break deduction over 7.5 hours
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: number;
  driver: string;
  lastName: string | null;
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
  // Only returned to roles that may manage driver bank details
  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;
  email: string | null;
  isArchived: boolean;
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
  travelTimeHours: number | null;
  driverCharge: number | null;
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
  sentAt: string | null;
  revertedToDraftAt: string | null;
  revertedToDraftReason: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: RctiLine[];
  deductionApplications?: Array<{
    id: number;
    deductionId: number;
    amount: number;
    appliedAt: string;
    deduction: {
      id: number;
      type: string;
      description: string;
      frequency: string;
    };
  }>;
}

// RCTI Deduction Types
interface RctiDeductionApplication {
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

export type CompanySettingsForEmail = {
  companyName: string;
  companyAbn: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogo: string | null;
  emailReplyTo: string | null;
};
