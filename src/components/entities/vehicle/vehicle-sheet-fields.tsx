import type { SheetField } from "@/components/data-table/core/types";
import type { Vehicle } from "@/components/entities/vehicle/vehicle-columns";

export const vehicleSheetFields: SheetField<Vehicle, unknown>[] = [
  {
    id: "registration",
    label: "Registration",
    type: "readonly",
  },
  {
    id: "expiryDate",
    label: "Expiry Date",
    type: "readonly",
    component: ({ expiryDate }) => {
      const date = new Date(expiryDate);
      const isExpired = date < new Date();
      const isExpiringSoon = date < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      return (
        <span className={isExpired ? 'text-red-600 font-medium' : isExpiringSoon ? 'text-orange-600 font-medium' : ''}>
          {date.toLocaleDateString()}
        </span>
      );
    },
  },
  {
    id: "make",
    label: "Make",
    type: "readonly",
  },
  {
    id: "model",
    label: "Model",
    type: "readonly",
  },
  {
    id: "yearOfManufacture",
    label: "Year of Manufacture",
    type: "readonly",
  },
  {
    id: "type",
    label: "Vehicle Type",
    type: "readonly",
  },
  {
    id: "carryingCapacity",
    label: "Carrying Capacity",
    type: "readonly",
    component: ({ carryingCapacity }) => (
      <span>{carryingCapacity || "N/A"}</span>
    ),
  },
  {
    id: "trayLength",
    label: "Tray Length",
    type: "readonly",
    component: ({ trayLength }) => (
      <span>{trayLength || "N/A"}</span>
    ),
  },
  {
    id: "craneReach",
    label: "Crane Reach",
    type: "readonly",
    component: ({ craneReach }) => (
      <span>{craneReach || "N/A"}</span>
    ),
  },
  {
    id: "craneType",
    label: "Crane Type",
    type: "readonly",
    component: ({ craneType }) => (
      <span>{craneType || "N/A"}</span>
    ),
  },
  {
    id: "craneCapacity",
    label: "Crane Capacity",
    type: "readonly",
    component: ({ craneCapacity }) => (
      <span>{craneCapacity || "N/A"}</span>
    ),
  },
];