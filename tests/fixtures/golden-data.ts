/**
 * Golden Data Set for Testing
 *
 * This file contains the canonical test data that should be seeded
 * before running tests. Jobs are generated dynamically relative to
 * the current date to ensure week-ending functionality works correctly.
 */

process.env.TZ = "Australia/Melbourne";

import {
  endOfWeek,
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  format,
} from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface GoldenVehicle {
  registration: string;
  expiryDate: Date;
  make: string;
  model: string;
  yearOfManufacture: number;
  type: string;
  carryingCapacity?: string;
  trayLength?: string;
  craneReach?: string;
  craneType?: string;
  craneCapacity?: string;
}

export interface GoldenDriver {
  driver: string;
  truck: string;
  tray?: number;
  crane?: number;
  semi?: number;
  semiCrane?: number;
  breaks?: number;
  type: "Employee" | "Subcontractor";
  fuelLevy?: number;
  tolls: boolean;
  email?: string;
  businessName?: string;
  abn?: string;
  address?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBsb?: string;
  gstMode: "exclusive" | "inclusive";
  gstStatus: "registered" | "not_registered";
  isArchived: boolean;
}

export interface GoldenCustomer {
  customer: string;
  billTo: string;
  contact: string;
  comments?: string;
  fuelLevy?: number;
  tray?: number;
  crane?: number;
  semi?: number;
  semiCrane?: number;
  tolls: boolean;
  breakDeduction?: number;
}

export interface GoldenJob {
  date: Date;
  driver: string;
  customer: string;
  billTo: string;
  truckType: string;
  registration: string;
  pickup: string;
  dropoff?: string;
  startTime?: Date;
  finishTime?: Date;
  chargedHours?: number;
  driverCharge?: number;
  runsheet: boolean;
  invoiced: boolean;
  comments?: string;
  jobReference?: string;
  eastlink?: number;
  citylink?: number;
}

export interface GoldenRctiDeduction {
  driverName: string;
  type: string;
  description: string;
  totalAmount: number;
  amountPaid: number;
  amountRemaining: number;
  frequency: "one-off" | "weekly" | "fortnightly";
  amountPerCycle?: number;
  status: "active" | "completed" | "cancelled";
  startDate: Date;
  completedAt?: Date;
  notes?: string;
}

export interface GoldenRcti {
  driverName: string;
  weekEnding: Date;
  status: "draft" | "finalised" | "paid";
  notes?: string;
  paidAt?: Date;
}

export interface GoldenRctiLine {
  rctiInvoiceNumber: string;
  jobDate: Date;
  customer: string;
  truckType: string;
  description?: string;
  chargedHours: number;
  ratePerHour: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the current week's Sunday (week ending date)
 * Week starts on Monday, ends on Sunday
 */
export function getCurrentWeekEnding(): Date {
  return endOfWeek(new Date(), { weekStartsOn: 1 });
}

/**
 * Get week ending date relative to current week
 * @param weeksOffset - Negative for past weeks, positive for future weeks
 */
export function getRelativeWeekEnding(weeksOffset: number): Date {
  const currentWeekEnd = getCurrentWeekEnding();
  if (weeksOffset < 0) {
    return subWeeks(currentWeekEnd, Math.abs(weeksOffset));
  }
  return addWeeks(currentWeekEnd, weeksOffset);
}

/**
 * Get a date within a specific week
 * @param weeksOffset - Relative to current week
 * @param dayOfWeek - 0 = Monday, 6 = Sunday
 */
export function getDateInWeek(weeksOffset: number, dayOfWeek: number): Date {
  const weekEnd = getRelativeWeekEnding(weeksOffset);
  const weekStart = startOfWeek(weekEnd, { weekStartsOn: 1 });
  return addDays(weekStart, dayOfWeek);
}

/**
 * Create a datetime for a specific time on a date
 */
export function createDateTime(
  date: Date,
  hours: number,
  minutes: number,
): Date {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Generate invoice number for RCTI
 */
export function generateInvoiceNumber(
  driverName: string,
  weekEnding: Date,
): string {
  const initials = driverName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const dateStr = format(weekEnding, "yyyyMMdd");
  return `RCTI-${initials}-${dateStr}`;
}

// ============================================================================
// Vehicles Data
// ============================================================================

export const goldenVehicles: GoldenVehicle[] = [
  {
    registration: "TEST-TRAY01",
    expiryDate: addWeeks(new Date(), 52),
    make: "DAF",
    model: "LF290",
    yearOfManufacture: 2022,
    type: "TRAY",
    trayLength: "8.5m",
  },
  {
    registration: "TEST-TRAY02",
    expiryDate: addWeeks(new Date(), 40),
    make: "HINO",
    model: "500",
    yearOfManufacture: 2021,
    type: "TRAY",
    trayLength: "7.5m",
  },
  {
    registration: "TEST-CRANE01",
    expiryDate: addWeeks(new Date(), 30),
    make: "DAF",
    model: "CF410",
    yearOfManufacture: 2023,
    type: "CRANE",
    craneType: "Palfinger",
    craneReach: "18m",
    craneCapacity: "8t",
  },
  {
    registration: "TEST-CRANE02",
    expiryDate: addWeeks(new Date(), 45),
    make: "HINO",
    model: "700",
    yearOfManufacture: 2022,
    type: "CRANE",
    craneType: "Hiab",
    craneReach: "15m",
    craneCapacity: "6t",
  },
  {
    registration: "TEST-SEMI01",
    expiryDate: addWeeks(new Date(), 35),
    make: "DAF",
    model: "XF530",
    yearOfManufacture: 2023,
    type: "SEMI",
    carryingCapacity: "28t",
  },
  {
    registration: "TEST-SEMI02",
    expiryDate: addWeeks(new Date(), 50),
    make: "DAF",
    model: "XG660",
    yearOfManufacture: 2024,
    type: "SEMI",
    carryingCapacity: "30t",
  },
  {
    registration: "TEST-SEMICRANE01",
    expiryDate: addWeeks(new Date(), 38),
    make: "IVECO",
    model: "Stralis",
    yearOfManufacture: 2021,
    type: "SEMI CRANE",
    craneType: "Palfinger",
    craneReach: "20m",
    craneCapacity: "10t",
  },
  {
    registration: "TEST-TRAILER01",
    expiryDate: addWeeks(new Date(), 60),
    make: "Vawdrey",
    model: "3 Axle",
    yearOfManufacture: 2022,
    type: "TRAILER",
  },
];

// ============================================================================
// Drivers Data
// ============================================================================

export const goldenDrivers: GoldenDriver[] = [
  // Employee - Not GST Registered, Exclusive
  {
    driver: "Test Driver Alpha",
    truck: "TEST-TRAY01",
    tray: 65,
    crane: 85,
    semi: 95,
    semiCrane: 110,
    breaks: 0.5,
    type: "Employee",
    fuelLevy: 15,
    tolls: true,
    email: "alpha@test.example.com",
    gstMode: "exclusive",
    gstStatus: "not_registered",
    isArchived: false,
  },
  // Employee - Not GST Registered
  {
    driver: "Test Driver Beta",
    truck: "TEST-TRAY02",
    tray: 60,
    crane: 80,
    semi: 90,
    semiCrane: 105,
    breaks: 0.5,
    type: "Employee",
    fuelLevy: 12,
    tolls: true,
    email: "beta@test.example.com",
    gstMode: "exclusive",
    gstStatus: "not_registered",
    isArchived: false,
  },
  // Subcontractor - GST Registered, Exclusive
  {
    driver: "Test Subbie Gamma",
    truck: "TEST-CRANE01",
    tray: 70,
    crane: 90,
    semi: 100,
    semiCrane: 115,
    breaks: 0,
    type: "Subcontractor",
    fuelLevy: 18,
    tolls: true,
    email: "gamma@test.example.com",
    businessName: "Gamma Transport Pty Ltd",
    abn: "12345678901",
    address: "123 Test Street, Melbourne VIC 3000",
    bankAccountName: "Gamma Transport",
    bankAccountNumber: "123456789",
    bankBsb: "123-456",
    gstMode: "exclusive",
    gstStatus: "registered",
    isArchived: false,
  },
  // Subcontractor - GST Registered, Inclusive
  {
    driver: "Test Subbie Delta",
    truck: "TEST-CRANE02",
    tray: 75,
    crane: 95,
    semi: 105,
    semiCrane: 120,
    breaks: 0,
    type: "Subcontractor",
    fuelLevy: 20,
    tolls: true,
    email: "delta@test.example.com",
    businessName: "Delta Logistics Pty Ltd",
    abn: "98765432109",
    address: "456 Sample Road, Sydney NSW 2000",
    bankAccountName: "Delta Logistics",
    bankAccountNumber: "987654321",
    bankBsb: "654-321",
    gstMode: "inclusive",
    gstStatus: "registered",
    isArchived: false,
  },
  // Subcontractor - Not GST Registered
  {
    driver: "Test Subbie Epsilon",
    truck: "TEST-SEMI01",
    tray: 65,
    crane: 85,
    semi: 95,
    semiCrane: 110,
    breaks: 0,
    type: "Subcontractor",
    fuelLevy: 15,
    tolls: false,
    email: "epsilon@test.example.com",
    businessName: "Epsilon Haulage",
    abn: "11223344556",
    address: "789 Demo Ave, Brisbane QLD 4000",
    bankAccountName: "Epsilon Haulage",
    bankAccountNumber: "112233445",
    bankBsb: "112-233",
    gstMode: "exclusive",
    gstStatus: "not_registered",
    isArchived: false,
  },
  // Archived driver (for testing archive filter)
  {
    driver: "Test Driver Archived",
    truck: "TEST-TRAY01",
    tray: 55,
    crane: 75,
    semi: 85,
    semiCrane: 100,
    breaks: 0.5,
    type: "Employee",
    fuelLevy: 10,
    tolls: false,
    email: "archived@test.example.com",
    gstMode: "exclusive",
    gstStatus: "not_registered",
    isArchived: true,
  },
];

// ============================================================================
// Customers Data
// ============================================================================

export const goldenCustomers: GoldenCustomer[] = [
  {
    customer: "Test Customer Acme",
    billTo: "Acme Corporation",
    contact: "acme@test.example.com",
    comments: "Premium customer - priority service",
    fuelLevy: 15,
    tray: 120,
    crane: 150,
    semi: 180,
    semiCrane: 200,
    tolls: true,
    breakDeduction: 0.5,
  },
  {
    customer: "Test Customer BuildCo",
    billTo: "BuildCo Industries",
    contact: "buildco@test.example.com",
    comments: "Construction materials delivery",
    fuelLevy: 12,
    tray: 110,
    crane: 140,
    semi: 170,
    semiCrane: 190,
    tolls: true,
    breakDeduction: 0.5,
  },
  {
    customer: "Test Customer Construct",
    billTo: "Construct Ltd",
    contact: "construct@test.example.com",
    fuelLevy: 10,
    tray: 100,
    crane: 130,
    semi: 160,
    semiCrane: 180,
    tolls: false,
    breakDeduction: 0,
  },
  {
    customer: "Test Customer Demo",
    billTo: "Demo Enterprises",
    contact: "demo@test.example.com",
    comments: "Weekly deliveries",
    fuelLevy: 18,
    tray: 115,
    crane: 145,
    semi: 175,
    semiCrane: 195,
    tolls: true,
    breakDeduction: 0.5,
  },
  {
    customer: "Test Customer Echo",
    billTo: "Echo Supplies",
    contact: "echo@test.example.com",
    fuelLevy: 14,
    tray: 105,
    crane: 135,
    semi: 165,
    semiCrane: 185,
    tolls: true,
    breakDeduction: 0.25,
  },
  {
    customer: "Test Customer Foxtrot",
    billTo: "Foxtrot Logistics",
    contact: "foxtrot@test.example.com",
    comments: "Urgent deliveries only",
    fuelLevy: 20,
    tray: 125,
    crane: 155,
    semi: 185,
    semiCrane: 205,
    tolls: true,
    breakDeduction: 0,
  },
];

// ============================================================================
// Jobs Data Generator
// ============================================================================

/**
 * Generate jobs spread across multiple weeks
 * This is a function because dates need to be calculated at runtime
 */
export function generateGoldenJobs(): GoldenJob[] {
  const jobs: GoldenJob[] = [];

  // Week -6: Historical data (2 jobs)
  jobs.push(
    {
      date: getDateInWeek(-6, 1), // Tuesday
      driver: "Test Driver Alpha",
      customer: "Test Customer Acme",
      billTo: "Acme Corporation",
      truckType: "TRAY",
      registration: "TEST-TRAY01",
      pickup: "Melbourne CBD",
      dropoff: "Dandenong",
      startTime: createDateTime(getDateInWeek(-6, 1), 6, 0),
      finishTime: createDateTime(getDateInWeek(-6, 1), 14, 30),
      chargedHours: 8.5,
      driverCharge: 552.5,
      runsheet: true,
      invoiced: true,
      comments: "Historical job - Week -6",
      jobReference: "JOB-W6-001",
      eastlink: 2,
      citylink: 0,
    },
    {
      date: getDateInWeek(-6, 3), // Thursday
      driver: "Test Subbie Gamma",
      customer: "Test Customer BuildCo",
      billTo: "BuildCo Industries",
      truckType: "CRANE",
      registration: "TEST-CRANE01",
      pickup: "Port Melbourne",
      dropoff: "Geelong",
      startTime: createDateTime(getDateInWeek(-6, 3), 7, 0),
      finishTime: createDateTime(getDateInWeek(-6, 3), 15, 0),
      chargedHours: 8,
      driverCharge: 720,
      runsheet: true,
      invoiced: true,
      jobReference: "JOB-W6-002",
      eastlink: 0,
      citylink: 1,
    },
  );

  // Week -5: More historical data (3 jobs)
  jobs.push(
    {
      date: getDateInWeek(-5, 0), // Monday
      driver: "Test Driver Beta",
      customer: "Test Customer Construct",
      billTo: "Construct Ltd",
      truckType: "TRAY",
      registration: "TEST-TRAY02",
      pickup: "Tullamarine",
      dropoff: "Ringwood",
      startTime: createDateTime(getDateInWeek(-5, 0), 5, 30),
      finishTime: createDateTime(getDateInWeek(-5, 0), 13, 0),
      chargedHours: 7.5,
      driverCharge: 450,
      runsheet: true,
      invoiced: true,
      jobReference: "JOB-W5-001",
    },
    {
      date: getDateInWeek(-5, 2), // Wednesday
      driver: "Test Subbie Delta",
      customer: "Test Customer Demo",
      billTo: "Demo Enterprises",
      truckType: "CRANE",
      registration: "TEST-CRANE02",
      pickup: "Sunshine",
      dropoff: "Frankston",
      startTime: createDateTime(getDateInWeek(-5, 2), 6, 0),
      finishTime: createDateTime(getDateInWeek(-5, 2), 16, 0),
      chargedHours: 10,
      driverCharge: 950,
      runsheet: true,
      invoiced: true,
      jobReference: "JOB-W5-002",
      eastlink: 3,
    },
    {
      date: getDateInWeek(-5, 4), // Friday
      driver: "Test Subbie Epsilon",
      customer: "Test Customer Echo",
      billTo: "Echo Supplies",
      truckType: "SEMI",
      registration: "TEST-SEMI01",
      pickup: "Laverton",
      dropoff: "Shepparton",
      startTime: createDateTime(getDateInWeek(-5, 4), 4, 0),
      finishTime: createDateTime(getDateInWeek(-5, 4), 14, 0),
      chargedHours: 10,
      driverCharge: 950,
      runsheet: true,
      invoiced: true,
      jobReference: "JOB-W5-003",
    },
  );

  // Week -4: (4 jobs)
  jobs.push(
    {
      date: getDateInWeek(-4, 0), // Monday
      driver: "Test Driver Alpha",
      customer: "Test Customer Foxtrot",
      billTo: "Foxtrot Logistics",
      truckType: "TRAY",
      registration: "TEST-TRAY01",
      pickup: "Altona",
      dropoff: "Moorabbin",
      startTime: createDateTime(getDateInWeek(-4, 0), 6, 0),
      finishTime: createDateTime(getDateInWeek(-4, 0), 14, 0),
      chargedHours: 8,
      driverCharge: 520,
      runsheet: true,
      invoiced: true,
      jobReference: "JOB-W4-001",
    },
    {
      date: getDateInWeek(-4, 1), // Tuesday
      driver: "Test Driver Alpha",
      customer: "Test Customer Acme",
      billTo: "Acme Corporation",
      truckType: "TRAY",
      registration: "TEST-TRAY01",
      pickup: "Clayton",
      dropoff: "Box Hill",
      startTime: createDateTime(getDateInWeek(-4, 1), 7, 0),
      finishTime: createDateTime(getDateInWeek(-4, 1), 15, 30),
      chargedHours: 8.5,
      driverCharge: 552.5,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W4-002",
      citylink: 2,
    },
    {
      date: getDateInWeek(-4, 3), // Thursday
      driver: "Test Subbie Gamma",
      customer: "Test Customer BuildCo",
      billTo: "BuildCo Industries",
      truckType: "CRANE",
      registration: "TEST-CRANE01",
      pickup: "Footscray",
      dropoff: "Craigieburn",
      startTime: createDateTime(getDateInWeek(-4, 3), 5, 0),
      finishTime: createDateTime(getDateInWeek(-4, 3), 15, 0),
      chargedHours: 10,
      driverCharge: 900,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W4-003",
    },
    {
      date: getDateInWeek(-4, 4), // Friday
      driver: "Test Driver Beta",
      customer: "Test Customer Demo",
      billTo: "Demo Enterprises",
      truckType: "TRAY",
      registration: "TEST-TRAY02",
      pickup: "Essendon",
      dropoff: "Preston",
      startTime: createDateTime(getDateInWeek(-4, 4), 6, 30),
      finishTime: createDateTime(getDateInWeek(-4, 4), 14, 30),
      chargedHours: 8,
      driverCharge: 480,
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W4-004",
    },
  );

  // Week -3: (4 jobs)
  jobs.push(
    {
      date: getDateInWeek(-3, 0), // Monday
      driver: "Test Subbie Delta",
      customer: "Test Customer Construct",
      billTo: "Construct Ltd",
      truckType: "CRANE",
      registration: "TEST-CRANE02",
      pickup: "Heidelberg",
      dropoff: "Werribee",
      startTime: createDateTime(getDateInWeek(-3, 0), 6, 0),
      finishTime: createDateTime(getDateInWeek(-3, 0), 16, 0),
      chargedHours: 10,
      driverCharge: 950,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W3-001",
      eastlink: 1,
      citylink: 1,
    },
    {
      date: getDateInWeek(-3, 2), // Wednesday
      driver: "Test Driver Alpha",
      customer: "Test Customer Echo",
      billTo: "Echo Supplies",
      truckType: "TRAY",
      registration: "TEST-TRAY01",
      pickup: "Burwood",
      dropoff: "Glen Waverley",
      startTime: createDateTime(getDateInWeek(-3, 2), 7, 0),
      finishTime: createDateTime(getDateInWeek(-3, 2), 13, 0),
      chargedHours: 6,
      driverCharge: 390,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W3-002",
    },
    {
      date: getDateInWeek(-3, 3), // Thursday
      driver: "Test Subbie Epsilon",
      customer: "Test Customer Foxtrot",
      billTo: "Foxtrot Logistics",
      truckType: "SEMI",
      registration: "TEST-SEMI01",
      pickup: "Campbellfield",
      dropoff: "Ballarat",
      startTime: createDateTime(getDateInWeek(-3, 3), 5, 0),
      finishTime: createDateTime(getDateInWeek(-3, 3), 17, 0),
      chargedHours: 12,
      driverCharge: 1140,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W3-003",
    },
    {
      date: getDateInWeek(-3, 4), // Friday
      driver: "Test Subbie Gamma",
      customer: "Test Customer Acme",
      billTo: "Acme Corporation",
      truckType: "CRANE",
      registration: "TEST-CRANE01",
      pickup: "Doncaster",
      dropoff: "Oakleigh",
      startTime: createDateTime(getDateInWeek(-3, 4), 6, 0),
      finishTime: createDateTime(getDateInWeek(-3, 4), 14, 0),
      chargedHours: 8,
      driverCharge: 720,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W3-004",
    },
  );

  // Week -2: (5 jobs)
  jobs.push(
    {
      date: getDateInWeek(-2, 0), // Monday
      driver: "Test Driver Beta",
      customer: "Test Customer BuildCo",
      billTo: "BuildCo Industries",
      truckType: "TRAY",
      registration: "TEST-TRAY02",
      pickup: "South Yarra",
      dropoff: "Richmond",
      startTime: createDateTime(getDateInWeek(-2, 0), 6, 0),
      finishTime: createDateTime(getDateInWeek(-2, 0), 12, 0),
      chargedHours: 6,
      driverCharge: 360,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W2-001",
    },
    {
      date: getDateInWeek(-2, 1), // Tuesday
      driver: "Test Driver Alpha",
      customer: "Test Customer Demo",
      billTo: "Demo Enterprises",
      truckType: "TRAY",
      registration: "TEST-TRAY01",
      pickup: "Collingwood",
      dropoff: "Fitzroy",
      startTime: createDateTime(getDateInWeek(-2, 1), 7, 0),
      finishTime: createDateTime(getDateInWeek(-2, 1), 15, 0),
      chargedHours: 8,
      driverCharge: 520,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W2-002",
    },
    {
      date: getDateInWeek(-2, 2), // Wednesday
      driver: "Test Subbie Delta",
      customer: "Test Customer Echo",
      billTo: "Echo Supplies",
      truckType: "CRANE",
      registration: "TEST-CRANE02",
      pickup: "Brunswick",
      dropoff: "Coburg",
      startTime: createDateTime(getDateInWeek(-2, 2), 6, 30),
      finishTime: createDateTime(getDateInWeek(-2, 2), 16, 30),
      chargedHours: 10,
      driverCharge: 950,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W2-003",
      eastlink: 2,
    },
    {
      date: getDateInWeek(-2, 3), // Thursday
      driver: "Test Subbie Gamma",
      customer: "Test Customer Construct",
      billTo: "Construct Ltd",
      truckType: "CRANE",
      registration: "TEST-CRANE01",
      pickup: "Northcote",
      dropoff: "Thornbury",
      startTime: createDateTime(getDateInWeek(-2, 3), 6, 0),
      finishTime: createDateTime(getDateInWeek(-2, 3), 14, 0),
      chargedHours: 8,
      driverCharge: 720,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W2-004",
    },
    {
      date: getDateInWeek(-2, 4), // Friday
      driver: "Test Subbie Epsilon",
      customer: "Test Customer Acme",
      billTo: "Acme Corporation",
      truckType: "SEMI",
      registration: "TEST-SEMI01",
      pickup: "Abbotsford",
      dropoff: "Bendigo",
      startTime: createDateTime(getDateInWeek(-2, 4), 4, 0),
      finishTime: createDateTime(getDateInWeek(-2, 4), 16, 0),
      chargedHours: 12,
      driverCharge: 1140,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W2-005",
    },
  );

  // Week -1 (Last week): (5 jobs)
  jobs.push(
    {
      date: getDateInWeek(-1, 0), // Monday
      driver: "Test Driver Alpha",
      customer: "Test Customer Foxtrot",
      billTo: "Foxtrot Logistics",
      truckType: "TRAY",
      registration: "TEST-TRAY01",
      pickup: "Kew",
      dropoff: "Hawthorn",
      startTime: createDateTime(getDateInWeek(-1, 0), 6, 0),
      finishTime: createDateTime(getDateInWeek(-1, 0), 14, 0),
      chargedHours: 8,
      driverCharge: 520,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W1-001",
    },
    {
      date: getDateInWeek(-1, 1), // Tuesday
      driver: "Test Driver Beta",
      customer: "Test Customer Acme",
      billTo: "Acme Corporation",
      truckType: "TRAY",
      registration: "TEST-TRAY02",
      pickup: "Camberwell",
      dropoff: "Malvern",
      startTime: createDateTime(getDateInWeek(-1, 1), 7, 0),
      finishTime: createDateTime(getDateInWeek(-1, 1), 15, 0),
      chargedHours: 8,
      driverCharge: 480,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W1-002",
    },
    {
      date: getDateInWeek(-1, 2), // Wednesday
      driver: "Test Subbie Gamma",
      customer: "Test Customer BuildCo",
      billTo: "BuildCo Industries",
      truckType: "CRANE",
      registration: "TEST-CRANE01",
      pickup: "Toorak",
      dropoff: "Prahran",
      startTime: createDateTime(getDateInWeek(-1, 2), 5, 30),
      finishTime: createDateTime(getDateInWeek(-1, 2), 15, 30),
      chargedHours: 10,
      driverCharge: 900,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W1-003",
      citylink: 1,
    },
    {
      date: getDateInWeek(-1, 3), // Thursday
      driver: "Test Subbie Delta",
      customer: "Test Customer Demo",
      billTo: "Demo Enterprises",
      truckType: "CRANE",
      registration: "TEST-CRANE02",
      pickup: "St Kilda",
      dropoff: "Brighton",
      startTime: createDateTime(getDateInWeek(-1, 3), 6, 0),
      finishTime: createDateTime(getDateInWeek(-1, 3), 16, 0),
      chargedHours: 10,
      driverCharge: 950,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W1-004",
    },
    {
      date: getDateInWeek(-1, 4), // Friday
      driver: "Test Subbie Epsilon",
      customer: "Test Customer Construct",
      billTo: "Construct Ltd",
      truckType: "SEMI",
      registration: "TEST-SEMI01",
      pickup: "Elwood",
      dropoff: "Mildura",
      startTime: createDateTime(getDateInWeek(-1, 4), 3, 0),
      finishTime: createDateTime(getDateInWeek(-1, 4), 17, 0),
      chargedHours: 14,
      driverCharge: 1330,
      runsheet: true,
      invoiced: false,
      jobReference: "JOB-W1-005",
    },
  );

  // Week 0 (Current week): (5 jobs)
  jobs.push(
    {
      date: getDateInWeek(0, 0), // Monday
      driver: "Test Driver Alpha",
      customer: "Test Customer Acme",
      billTo: "Acme Corporation",
      truckType: "TRAY",
      registration: "TEST-TRAY01",
      pickup: "Melbourne CBD",
      dropoff: "Footscray",
      startTime: createDateTime(getDateInWeek(0, 0), 6, 0),
      finishTime: createDateTime(getDateInWeek(0, 0), 14, 0),
      chargedHours: 8,
      driverCharge: 520,
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W0-001",
    },
    {
      date: getDateInWeek(0, 1), // Tuesday
      driver: "Test Driver Beta",
      customer: "Test Customer BuildCo",
      billTo: "BuildCo Industries",
      truckType: "TRAY",
      registration: "TEST-TRAY02",
      pickup: "Sunshine",
      dropoff: "Melton",
      startTime: createDateTime(getDateInWeek(0, 1), 7, 0),
      finishTime: createDateTime(getDateInWeek(0, 1), 15, 0),
      chargedHours: 8,
      driverCharge: 480,
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W0-002",
    },
    {
      date: getDateInWeek(0, 2), // Wednesday
      driver: "Test Subbie Gamma",
      customer: "Test Customer Demo",
      billTo: "Demo Enterprises",
      truckType: "CRANE",
      registration: "TEST-CRANE01",
      pickup: "Braybrook",
      dropoff: "Deer Park",
      startTime: createDateTime(getDateInWeek(0, 2), 6, 0),
      finishTime: createDateTime(getDateInWeek(0, 2), 16, 0),
      chargedHours: 10,
      driverCharge: 900,
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W0-003",
    },
    {
      date: getDateInWeek(0, 3), // Thursday
      driver: "Test Subbie Delta",
      customer: "Test Customer Echo",
      billTo: "Echo Supplies",
      truckType: "CRANE",
      registration: "TEST-CRANE02",
      pickup: "Yarraville",
      dropoff: "Newport",
      startTime: createDateTime(getDateInWeek(0, 3), 6, 30),
      finishTime: createDateTime(getDateInWeek(0, 3), 14, 30),
      chargedHours: 8,
      driverCharge: 760,
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W0-004",
    },
    {
      date: getDateInWeek(0, 4), // Friday
      driver: "Test Subbie Epsilon",
      customer: "Test Customer Foxtrot",
      billTo: "Foxtrot Logistics",
      truckType: "SEMI",
      registration: "TEST-SEMI01",
      pickup: "Williamstown",
      dropoff: "Hamilton",
      startTime: createDateTime(getDateInWeek(0, 4), 4, 0),
      finishTime: createDateTime(getDateInWeek(0, 4), 16, 0),
      chargedHours: 12,
      driverCharge: 1140,
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W0-005",
    },
  );

  // Week +1 (Next week): (3 jobs - future bookings)
  jobs.push(
    {
      date: getDateInWeek(1, 0), // Monday
      driver: "Test Driver Alpha",
      customer: "Test Customer BuildCo",
      billTo: "BuildCo Industries",
      truckType: "TRAY",
      registration: "TEST-TRAY01",
      pickup: "Port Melbourne",
      dropoff: "Southbank",
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W+1-001",
    },
    {
      date: getDateInWeek(1, 2), // Wednesday
      driver: "Test Subbie Gamma",
      customer: "Test Customer Acme",
      billTo: "Acme Corporation",
      truckType: "CRANE",
      registration: "TEST-CRANE01",
      pickup: "Docklands",
      dropoff: "Carlton",
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W+1-002",
    },
    {
      date: getDateInWeek(1, 4), // Friday
      driver: "Test Subbie Delta",
      customer: "Test Customer Demo",
      billTo: "Demo Enterprises",
      truckType: "CRANE",
      registration: "TEST-CRANE02",
      pickup: "Parkville",
      dropoff: "North Melbourne",
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W+1-003",
    },
  );

  // Week +2: (2 jobs - advance bookings)
  jobs.push(
    {
      date: getDateInWeek(2, 1), // Tuesday
      driver: "Test Driver Beta",
      customer: "Test Customer Construct",
      billTo: "Construct Ltd",
      truckType: "TRAY",
      registration: "TEST-TRAY02",
      pickup: "West Melbourne",
      dropoff: "Flemington",
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W+2-001",
    },
    {
      date: getDateInWeek(2, 3), // Thursday
      driver: "Test Subbie Epsilon",
      customer: "Test Customer Echo",
      billTo: "Echo Supplies",
      truckType: "SEMI",
      registration: "TEST-SEMI01",
      pickup: "Ascot Vale",
      dropoff: "Moonee Ponds",
      runsheet: false,
      invoiced: false,
      jobReference: "JOB-W+2-002",
    },
  );

  return jobs;
}

// ============================================================================
// RCTI Deductions Data Generator
// ============================================================================

export function generateGoldenDeductions(): GoldenRctiDeduction[] {
  return [
    // Active weekly deduction for Test Subbie Gamma
    {
      driverName: "Test Subbie Gamma",
      type: "Equipment",
      description: "Crane maintenance fund - weekly contribution",
      totalAmount: 1000,
      amountPaid: 200,
      amountRemaining: 800,
      frequency: "weekly",
      amountPerCycle: 50,
      status: "active",
      startDate: subWeeks(new Date(), 4),
      notes: "Agreed upon equipment maintenance contribution",
    },
    // Active one-off deduction for Test Subbie Delta
    {
      driverName: "Test Subbie Delta",
      type: "Damage",
      description: "Minor vehicle damage repair",
      totalAmount: 500,
      amountPaid: 0,
      amountRemaining: 500,
      frequency: "one-off",
      status: "active",
      startDate: subWeeks(new Date(), 1),
      notes: "Deduction for rear panel damage",
    },
    // Completed deduction for Test Subbie Epsilon
    {
      driverName: "Test Subbie Epsilon",
      type: "Advance",
      description: "Pay advance repayment",
      totalAmount: 300,
      amountPaid: 300,
      amountRemaining: 0,
      frequency: "fortnightly",
      amountPerCycle: 100,
      status: "completed",
      startDate: subWeeks(new Date(), 8),
      completedAt: subWeeks(new Date(), 2),
      notes: "Pay advance fully repaid",
    },
    // Cancelled deduction
    {
      driverName: "Test Subbie Gamma",
      type: "Uniform",
      description: "Uniform cost - cancelled",
      totalAmount: 200,
      amountPaid: 50,
      amountRemaining: 150,
      frequency: "one-off",
      status: "cancelled",
      startDate: subWeeks(new Date(), 6),
      notes: "Cancelled as uniform was returned",
    },
    // Active fortnightly deduction for Test Subbie Delta
    {
      driverName: "Test Subbie Delta",
      type: "Training",
      description: "Forklift licence training cost",
      totalAmount: 800,
      amountPaid: 200,
      amountRemaining: 600,
      frequency: "fortnightly",
      amountPerCycle: 100,
      status: "active",
      startDate: subWeeks(new Date(), 4),
    },
  ];
}

// ============================================================================
// RCTI Data Generator
// ============================================================================

export function generateGoldenRctis(): GoldenRcti[] {
  return [
    // Paid RCTI - Week -6
    {
      driverName: "Test Subbie Gamma",
      weekEnding: getRelativeWeekEnding(-6),
      status: "paid",
      notes: "Paid on time",
      paidAt: subWeeks(new Date(), 5),
    },
    // Finalised RCTI - Week -5
    {
      driverName: "Test Subbie Delta",
      weekEnding: getRelativeWeekEnding(-5),
      status: "finalised",
      notes: "Ready for payment",
    },
    // Finalised RCTI - Week -4
    {
      driverName: "Test Subbie Gamma",
      weekEnding: getRelativeWeekEnding(-4),
      status: "finalised",
    },
    // Draft RCTI with lines - Week -3
    {
      driverName: "Test Subbie Epsilon",
      weekEnding: getRelativeWeekEnding(-3),
      status: "draft",
      notes: "Pending review",
    },
    // Draft RCTI with lines - Week -2
    {
      driverName: "Test Subbie Delta",
      weekEnding: getRelativeWeekEnding(-2),
      status: "draft",
    },
    // Draft RCTI - Week -1 (last week)
    {
      driverName: "Test Subbie Gamma",
      weekEnding: getRelativeWeekEnding(-1),
      status: "draft",
      notes: "Current processing",
    },
    // Paid RCTI - Week -5 (different driver)
    {
      driverName: "Test Subbie Epsilon",
      weekEnding: getRelativeWeekEnding(-5),
      status: "paid",
      paidAt: subWeeks(new Date(), 4),
    },
  ];
}

// ============================================================================
// All Golden Data Export
// ============================================================================

export interface GoldenDataSet {
  vehicles: GoldenVehicle[];
  drivers: GoldenDriver[];
  customers: GoldenCustomer[];
  jobs: GoldenJob[];
  deductions: GoldenRctiDeduction[];
  rctis: GoldenRcti[];
}

export function getGoldenDataSet(): GoldenDataSet {
  return {
    vehicles: goldenVehicles,
    drivers: goldenDrivers,
    customers: goldenCustomers,
    jobs: generateGoldenJobs(),
    deductions: generateGoldenDeductions(),
    rctis: generateGoldenRctis(),
  };
}

// ============================================================================
// Test Data Identification
// ============================================================================

/**
 * Prefix used to identify test data
 * All test entities should have names/identifiers starting with this prefix
 */
export const TEST_DATA_PREFIX = "Test";

/**
 * Check if an entity is test data based on naming convention
 */
export function isTestData(name: string): boolean {
  return name.startsWith(TEST_DATA_PREFIX);
}

/**
 * Get all test driver names
 */
export function getTestDriverNames(): string[] {
  return goldenDrivers.map((d) => d.driver);
}

/**
 * Get all test customer names
 */
export function getTestCustomerNames(): string[] {
  return goldenCustomers.map((c) => c.customer);
}

/**
 * Get all test vehicle registrations
 */
export function getTestVehicleRegistrations(): string[] {
  return goldenVehicles.map((v) => v.registration);
}
