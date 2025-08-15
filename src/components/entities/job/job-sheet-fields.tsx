import { SheetField } from "@/components/data-table/core/types";
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
      <span>{runsheet === null ? "No" : runsheet ? "Yes" : "No"}</span>
    ),
  },
  {
    id: "invoiced",
    label: "Invoiced",
    component: ({ invoiced }) => (
      <span>{invoiced === null ? "No" : invoiced ? "Yes" : "No"}</span>
    ),
  },
  {
    id: "startTime",
    label: "Start Time",
    component: ({ startTime }) => (
      <span>{startTime ? format(new Date(startTime), "HH:mm") : "N/A"}</span>
    ),
  },
  {
    id: "finishTime",
    label: "Finish Time",
    component: ({ finishTime }) => (
      <span>{finishTime ? format(new Date(finishTime), "HH:mm") : "N/A"}</span>
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
      <span>{driverCharge || "N/A"}</span>
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