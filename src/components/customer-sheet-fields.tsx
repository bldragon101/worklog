import { SheetField } from "@/components/data-table/types";
import { Customer } from "@/components/customer-columns";
import { format } from "date-fns";

export const customerSheetFields: SheetField<Customer>[] = [
  {
    id: "id",
    label: "ID",
    type: "readonly",
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
    id: "contact",
    label: "Contact",
  },
  {
    id: "tray",
    label: "Tray Rate",
    component: ({ tray }) => (
      <span>{tray ? `$${tray}` : "N/A"}</span>
    ),
  },
  {
    id: "crane",
    label: "Crane Rate",
    component: ({ crane }) => (
      <span>{crane ? `$${crane}` : "N/A"}</span>
    ),
  },
  {
    id: "semi",
    label: "Semi Rate",
    component: ({ semi }) => (
      <span>{semi ? `$${semi}` : "N/A"}</span>
    ),
  },
  {
    id: "semiCrane",
    label: "Semi Crane Rate",
    component: ({ semiCrane }) => (
      <span>{semiCrane ? `$${semiCrane}` : "N/A"}</span>
    ),
  },
  {
    id: "fuelLevy",
    label: "Fuel Levy",
    component: ({ fuelLevy }) => (
      <span>{fuelLevy ? `${fuelLevy}%` : "N/A"}</span>
    ),
  },
  {
    id: "tolls",
    label: "Tolls",
    component: ({ tolls }) => (
      <span>{tolls ? "Yes" : "No"}</span>
    ),
  },
  {
    id: "comments",
    label: "Comments",
    component: ({ comments }) => (
      <span className="break-words whitespace-pre-wrap text-left block">{comments || "N/A"}</span>
    ),
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
    label: "Updated",
    type: "readonly",
    component: ({ updatedAt }) => (
      <span>{format(new Date(updatedAt), "dd/MM/yyyy")}</span>
    ),
  },
];