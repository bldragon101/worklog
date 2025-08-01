import { SheetField } from "@/components/data-table/types";
import { Job } from "@/lib/types";
import { format } from "date-fns";

export const jobSheetFields: SheetField<Job>[] = [
  {
    id: "id",
    label: "ID",
    type: "readonly",
  },
  {
    id: "date",
    label: "Date",
    component: ({ date }) => (
      <span>{format(new Date(date), "dd/MM/yyyy")}</span>
    ),
  },
  {
    id: "driver",
    label: "Driver",
  },
  {
    id: "customer",
    label: "Customer",
  },
  {
    id: "billTo",
    label: "Bill To",
  },
  {
    id: "registration",
    label: "Registration",
  },
  {
    id: "truckType",
    label: "Truck Type",
  },
  {
    id: "pickup",
    label: "Pickup",
  },
  {
    id: "dropoff",
    label: "Dropoff",
  },
  {
    id: "runsheet",
    label: "Runsheet",
    component: ({ runsheet }) => (
      <span>{runsheet === null ? "N/A" : runsheet ? "Yes" : "No"}</span>
    ),
  },
  {
    id: "invoiced",
    label: "Invoiced",
    component: ({ invoiced }) => (
      <span>{invoiced === null ? "N/A" : invoiced ? "Yes" : "No"}</span>
    ),
  },
  {
    id: "chargedHours",
    label: "Charged Hours",
    component: ({ chargedHours }) => (
      <span>{chargedHours || "N/A"}</span>
    ),
  },
  {
    id: "driverCharge",
    label: "Driver Charge",
    component: ({ driverCharge }) => (
      <span>{driverCharge ? `$${driverCharge}` : "N/A"}</span>
    ),
  },
  {
    id: "comments",
    label: "Comments",
    component: ({ comments }) => (
      <span className="break-words whitespace-pre-wrap text-left block">{comments || "N/A"}</span>
    ),
  },
];