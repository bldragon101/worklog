import { SheetField } from "@/components/data-table/core/types";
import { Driver } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

export const driverSheetFields: SheetField<Driver>[] = [
  {
    id: "id",
    label: "ID",
    type: "readonly",
  },
  {
    id: "driver",
    label: "Driver Name",
    component: ({ driver }) => <span className="font-medium">{driver}</span>,
  },
  {
    id: "truck",
    label: "Truck",
  },
  {
    id: "type",
    label: "Type",
    component: ({ type }) => {
      const typeVariant =
        type === "Employee"
          ? "default"
          : type === "Contractor"
            ? "secondary"
            : "outline";
      return <Badge variant={typeVariant}>{type}</Badge>;
    },
  },
  {
    id: "tray",
    label: "Tray Rate",
    component: ({ tray }) => (
      <span>
        {tray
          ? `$${Number(tray).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "Not set"}
      </span>
    ),
  },
  {
    id: "crane",
    label: "Crane Rate",
    component: ({ crane }) => (
      <span>
        {crane
          ? `$${Number(crane).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "Not set"}
      </span>
    ),
  },
  {
    id: "semi",
    label: "Semi Rate",
    component: ({ semi }) => (
      <span>
        {semi
          ? `$${Number(semi).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "Not set"}
      </span>
    ),
  },
  {
    id: "semiCrane",
    label: "Semi Crane Rate",
    component: ({ semiCrane }) => (
      <span>
        {semiCrane
          ? `$${Number(semiCrane).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "Not set"}
      </span>
    ),
  },
  {
    id: "breaks",
    label: "Break Hours",
    component: ({ breaks }) => <span>{breaks ? `${breaks}h` : "Not set"}</span>,
  },
  {
    id: "tolls",
    label: "Tolls",
    component: ({ tolls, type }) => {
      if (type !== "Subcontractor") {
        return (
          <span className="text-muted-foreground">N/A (Not applicable)</span>
        );
      }
      return (
        <div className="flex items-center gap-1">
          <Checkbox checked={tolls} disabled />
          <span>{tolls ? "Yes" : "No"}</span>
        </div>
      );
    },
  },
  {
    id: "fuelLevy",
    label: "Fuel Levy",
    component: ({ fuelLevy, type }) => {
      if (type !== "Subcontractor") {
        return (
          <span className="text-muted-foreground">N/A (Not applicable)</span>
        );
      }
      return <span>{fuelLevy ? `${fuelLevy}%` : "Not set"}</span>;
    },
  },
  {
    id: "email" as keyof Driver,
    label: "Email",
    component: ({ email }: Driver) => <span>{email || "Not set"}</span>,
  },
  {
    id: "createdAt",
    label: "Created",
    type: "readonly",
    component: ({ createdAt }) => (
      <span>{format(new Date(createdAt), "dd/MM/yyyy")}</span>
    ),
  },
  {
    id: "updatedAt",
    label: "Last Updated",
    type: "readonly",
    component: ({ updatedAt }) => (
      <span>{format(new Date(updatedAt), "dd/MM/yyyy")}</span>
    ),
  },
];
