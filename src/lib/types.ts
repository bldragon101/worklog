// Shared entity types for the application

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
  comments: string | null;
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

// Placeholder types for future implementation
export interface Driver {
  id: number;
  name: string;
  licenseNumber: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  hireDate: string;
  isActive: boolean;
  comments: string | null;
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