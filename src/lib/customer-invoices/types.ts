/**
 * Client-safe types for customer invoices. These are the shapes returned by
 * the customer invoice API.
 */

export type TruckClass = "tray" | "crane" | "semi" | "semiCrane";

export type CustomerInvoiceLineKind = "job" | "break" | "toll" | "fuelLevy";

export type TollRoad = "eastlink" | "citylink";

export interface CustomerInvoiceLine {
  kind: CustomerInvoiceLineKind;
  /** The job a job line was built from; null for the other kinds */
  jobId: number | null;
  /** YYYY-MM-DD for job lines */
  jobDate: string | null;
  truckType: string | null;
  truckClass: TruckClass | null;
  registration: string | null;
  driver: string | null;
  description: string;
  quantity: number;
  unitAmount: number;
  amountExGst: number;
  gstAmount: number;
  amountIncGst: number;
  /** Break lines only: the key to waive this break deduction */
  breakKey: string | null;
  /** Toll lines only */
  tollRoad: TollRoad | null;
  /** Fuel levy lines only */
  fuelLevyPercent: number | null;
}

export type CustomerInvoiceWarningCode =
  | "unknown_customer"
  | "unknown_truck_type"
  | "missing_rate"
  | "missing_hours"
  | "missing_runsheet"
  | "job_moved";

export interface CustomerInvoiceWarning {
  code: CustomerInvoiceWarningCode;
  jobId: number | null;
  message: string;
}

export interface CustomerInvoiceTotals {
  subtotal: number;
  gst: number;
  total: number;
}

export interface CustomerInvoiceJob {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  driver: string;
  registration: string;
  truckType: string;
  jobReference: string | null;
  pickup: string;
  dropoff: string | null;
  chargedHours: number | null;
  hasRunsheet: boolean;
}

export interface CustomerInvoiceView {
  /**
   * Stable key: `saved:<id>` for a saved invoice, or
   * `auto:<customer>:<weekEnding>:<reference group>` for an automatic draft.
   */
  key: string;
  /** Saved invoice id; null for an automatic draft */
  id: number | null;
  isSaved: boolean;
  customerId: number | null;
  customerName: string;
  billTo: string;
  /** YYYY-MM-DD (a Sunday) */
  weekEnding: string;
  jobReference: string | null;
  reference: string;
  notes: string | null;
  waivedBreakDeductions: string[];
  jobs: CustomerInvoiceJob[];
  lines: CustomerInvoiceLine[];
  totals: CustomerInvoiceTotals;
  warnings: CustomerInvoiceWarning[];
}

export interface CustomerInvoicesWeekResponse {
  /** YYYY-MM-DD (a Sunday) */
  weekEnding: string;
  invoices: CustomerInvoiceView[];
}
