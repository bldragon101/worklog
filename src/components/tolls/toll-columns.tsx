"use client";

import type { DataTableColumnDef } from "@/components/data-table/core/table-features";
import { DataTableColumnHeader } from "@/components/data-table/components/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateDDMMYYYY } from "@/lib/utils/jobs-report-dates";
import type { TollMatchStatus, TollRoad } from "@/lib/tolls/toll-matching";
import type { TollJobRow, TollTripRow } from "@/lib/tolls/toll-types";

export const TOLL_ROAD_LABELS: Record<TollRoad, string> = {
  citylink: "CityLink",
  eastlink: "EastLink",
};

export const TOLL_MATCH_LABELS: Record<TollMatchStatus, string> = {
  matched: "Matched",
  "no-job": "No job",
  "unknown-vehicle": "Unknown vehicle",
};

export const UNKNOWN_REGISTRATION = "Unknown";

const MATCH_BADGE_CLASSES: Record<TollMatchStatus, string> = {
  matched: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "no-job": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  "unknown-vehicle":
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

const ROAD_BADGE_CLASSES: Record<TollRoad, string> = {
  citylink: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  eastlink:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

/** HH:mm from a UTC-literal ISO string, without time zone conversion */
export function formatIsoTime({ isoString }: { isoString: string | null }): string {
  return isoString ? isoString.substring(11, 16) : "";
}

export function getTripRegistration({ trip }: { trip: TollTripRow }): string {
  return trip.registration ?? UNKNOWN_REGISTRATION;
}

function includesFilterValue({
  rowValue,
  value,
}: {
  rowValue: string;
  value: unknown;
}): boolean {
  if (Array.isArray(value)) return value.includes(rowValue);
  return rowValue === value;
}

export const tollTripColumns: DataTableColumnDef<TollTripRow, unknown>[] = [
  {
    id: "date",
    accessorFn: (trip) => trip.tripStart.slice(0, 10),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => (
      <div className="font-mono text-s">
        {formatDateDDMMYYYY({ isoString: row.original.tripStart })}
      </div>
    ),
    filterFn: (row, id, value) =>
      includesFilterValue({ rowValue: row.getValue(id), value }),
    size: 100,
  },
  {
    id: "time",
    accessorFn: (trip) => trip.tripStart.substring(11, 16),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
    cell: ({ row }) => {
      const start = formatIsoTime({ isoString: row.original.tripStart });
      const end = formatIsoTime({ isoString: row.original.tripEnd });
      return (
        <div className="font-mono text-s whitespace-nowrap">
          {end && end !== start ? `${start}-${end}` : start}
        </div>
      );
    },
    size: 100,
  },
  {
    id: "registration",
    accessorFn: (trip) => getTripRegistration({ trip }),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Registration" />
    ),
    cell: ({ row }) => {
      const trip = row.original;
      if (trip.registration) {
        return <div className="font-mono text-s">{trip.registration}</div>;
      }
      return (
        <div className="font-mono text-s text-orange-600">
          Tag {trip.tagNumber ?? "-"}
        </div>
      );
    },
    filterFn: (row, id, value) =>
      includesFilterValue({ rowValue: row.getValue(id), value }),
    size: 120,
  },
  {
    accessorKey: "road",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Road" />,
    cell: ({ row }) => (
      <Badge className={`font-mono text-s ${ROAD_BADGE_CLASSES[row.original.road]}`}>
        {TOLL_ROAD_LABELS[row.original.road]}
      </Badge>
    ),
    filterFn: (row, id, value) =>
      includesFilterValue({ rowValue: row.getValue(id), value }),
    size: 100,
  },
  {
    accessorKey: "tripDetails",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Trip" />,
    cell: ({ row }) => (
      <div className="text-s truncate" title={row.original.tripDetails}>
        {row.original.tripDetails.replace(/^EL\s+/i, "")}
      </div>
    ),
    size: 260,
  },
  {
    accessorKey: "vehicleClass",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Class" />,
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.original.vehicleClass ?? ""}</div>
    ),
    size: 70,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => (
      <div className="font-mono text-s text-right">
        {formatCurrency({ amount: row.original.amount })}
      </div>
    ),
    size: 90,
  },
  {
    accessorKey: "matchStatus",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Job" />,
    cell: ({ row }) => {
      const { matchStatus, job } = row.original;
      if (matchStatus === "matched" && job) {
        const times = [
          formatIsoTime({ isoString: job.startTime }),
          formatIsoTime({ isoString: job.finishTime }),
        ]
          .filter(Boolean)
          .join("-");
        return (
          <div className="text-s truncate" title={`Job #${job.id}`}>
            <span className="font-medium">{job.driver}</span>
            <span className="text-muted-foreground"> · {job.customer}</span>
            {times && (
              <span className="font-mono text-muted-foreground"> · {times}</span>
            )}
          </div>
        );
      }
      return (
        <Badge className={`text-s ${MATCH_BADGE_CLASSES[matchStatus]}`}>
          {TOLL_MATCH_LABELS[matchStatus]}
        </Badge>
      );
    },
    filterFn: (row, id, value) =>
      includesFilterValue({ rowValue: row.getValue(id), value }),
    size: 260,
  },
  {
    accessorKey: "tagNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tag" />,
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.original.tagNumber ?? ""}</div>
    ),
    meta: { hidden: true },
    size: 130,
  },
];

function TollCountCell({
  recorded,
  actual,
}: {
  recorded: number;
  actual: number;
}) {
  const isMismatch = recorded !== actual;
  return (
    <div
      className={`font-mono text-s ${isMismatch ? "text-red-600 font-semibold" : ""}`}
      title={`Recorded on job: ${recorded}, Linkt trips: ${actual}`}
    >
      {recorded} / {actual}
    </div>
  );
}

export const tollJobColumns: DataTableColumnDef<TollJobRow, unknown>[] = [
  {
    accessorKey: "jobDay",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => (
      <div className="font-mono text-s">
        {formatDateDDMMYYYY({ isoString: row.original.jobDay })}
      </div>
    ),
    size: 100,
  },
  {
    accessorKey: "driver",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Driver" />,
    cell: ({ row }) => <div className="text-s">{row.original.driver}</div>,
    size: 140,
  },
  {
    accessorKey: "customer",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => <div className="text-s">{row.original.customer}</div>,
    size: 160,
  },
  {
    accessorKey: "registration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Registration" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s">{row.original.registration}</div>
    ),
    size: 110,
  },
  {
    accessorKey: "truckType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Truck" />,
    cell: ({ row }) => <div className="text-s">{row.original.truckType}</div>,
    size: 100,
  },
  {
    id: "citylink",
    accessorFn: (job) => job.actualCitylink,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="CityLink (job / Linkt)" />
    ),
    cell: ({ row }) => (
      <TollCountCell
        recorded={row.original.recordedCitylink}
        actual={row.original.actualCitylink}
      />
    ),
    size: 150,
  },
  {
    id: "eastlink",
    accessorFn: (job) => job.actualEastlink,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="EastLink (job / Linkt)" />
    ),
    cell: ({ row }) => (
      <TollCountCell
        recorded={row.original.recordedEastlink}
        actual={row.original.actualEastlink}
      />
    ),
    size: 150,
  },
  {
    accessorKey: "tollCost",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Toll Cost" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-s text-right">
        {formatCurrency({ amount: row.original.tollCost })}
      </div>
    ),
    size: 100,
  },
  {
    id: "status",
    accessorFn: (job) => (job.isMismatch ? "mismatch" : "ok"),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) =>
      row.original.isMismatch ? (
        <Badge className="text-s bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
          Mismatch
        </Badge>
      ) : (
        <Badge className="text-s bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          OK
        </Badge>
      ),
    filterFn: (row, id, value) =>
      includesFilterValue({ rowValue: row.getValue(id), value }),
    size: 100,
  },
];
