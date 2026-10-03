import type {
  TollJobReconciliation,
  TollMatchStatus,
  TollRoad,
} from "@/lib/tolls/toll-matching";

export interface TollTripJobSummary {
  id: number;
  driver: string;
  customer: string;
  startTime: string | null;
  finishTime: string | null;
}

export interface TollTripRow {
  id: number;
  tripStart: string;
  tripEnd: string | null;
  tripDetails: string;
  road: TollRoad;
  lpn: string | null;
  tagNumber: string | null;
  registration: string | null;
  vehicleClass: string | null;
  amount: number;
  matchStatus: TollMatchStatus;
  job: TollTripJobSummary | null;
}

export interface TollJobRow extends TollJobReconciliation {
  driver: string;
  customer: string;
  registration: string;
  truckType: string;
}

export interface UnknownTollTag {
  tagNumber: string;
  tripCount: number;
  amount: number;
  lastSeen: string;
}

export interface TollImportInfo {
  id: number;
  source: string;
  fileName: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  totalRows: number;
  inserted: number;
  duplicates: number;
  createdAt: string;
}

export interface TollDriveFileResult {
  fileId: string;
  fileName: string;
  inserted: number;
  duplicates: number;
  errors: string[];
}

export type TollDriveImportResult =
  | { status: "not-configured" }
  | { status: "checked-recently"; checkedAt: string }
  | { status: "imported"; checkedAt: string; folder: string; files: TollDriveFileResult[] };

export interface TollDriveSyncInfo {
  /** Whether this environment has a Linkt folder set in Google Drive settings */
  configured: boolean;
  error: string | null;
}

export interface TollsResponse {
  trips: TollTripRow[];
  jobs: TollJobRow[];
  unknownTags: UnknownTollTag[];
  lastImport: TollImportInfo | null;
  earliestTripDate: string | null;
  driveSync: TollDriveSyncInfo;
}
