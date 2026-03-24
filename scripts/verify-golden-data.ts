#!/usr/bin/env tsx
process.env.TZ = "Australia/Melbourne";
/**
 * Golden Data Verification Script
 *
 * This script verifies that the golden data has been seeded correctly
 * by running a series of checks against the database.
 *
 * Usage:
 *   pnpm db:golden:verify
 *   pnpx tsx scripts/verify-golden-data.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { startOfWeek } from "date-fns";
import {
  goldenVehicles,
  goldenDrivers,
  goldenCustomers,
  getTestDriverNames,
  getTestCustomerNames,
  getTestVehicleRegistrations,
  getRelativeWeekEnding,
} from "../tests/fixtures/golden-data";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({
  path: path.resolve(__dirname, "../.env.local"),
  override: true,
});
dotenv.config({
  path: path.resolve(__dirname, "../.env.development.local"),
  override: true,
});

// ============================================================================
// Types
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

// ============================================================================
// Test Runner
// ============================================================================

const results: TestResult[] = [];

function test(name: string, passed: boolean, message: string): void {
  results.push({ name, passed, message });
  const label = passed ? "PASS" : "FAIL";
  const colour = passed ? "\x1b[32m" : "\x1b[31m";
  console.log(`  ${colour}${label}\x1b[0m ${name}`);
  if (!passed) {
    console.log(`    \x1b[90m${message}\x1b[0m`);
  }
}

function expect(actual: number): {
  toBe: (expected: number) => boolean;
  toBeGreaterThan: (expected: number) => boolean;
  toBeGreaterThanOrEqual: (expected: number) => boolean;
} {
  return {
    toBe: (expected: number) => actual === expected,
    toBeGreaterThan: (expected: number) => actual > expected,
    toBeGreaterThanOrEqual: (expected: number) => actual >= expected,
  };
}

// ============================================================================
// Verification Tests
// ============================================================================

async function verifyDataSeeding(prisma: PrismaClient): Promise<void> {
  console.log("\nData Seeding Verification\n");

  const testDriverNames = getTestDriverNames();
  const testCustomerNames = getTestCustomerNames();
  const testVehicleRegistrations = getTestVehicleRegistrations();

  // Count vehicles
  const vehicleCount = await prisma.vehicle.count({
    where: { registration: { in: testVehicleRegistrations } },
  });
  test(
    "should seed all vehicles",
    expect(vehicleCount).toBe(goldenVehicles.length),
    `Expected ${goldenVehicles.length} vehicles, got ${vehicleCount}`,
  );

  // Count drivers
  const driverCount = await prisma.driver.count({
    where: { driver: { in: testDriverNames } },
  });
  test(
    "should seed all drivers",
    expect(driverCount).toBe(goldenDrivers.length),
    `Expected ${goldenDrivers.length} drivers, got ${driverCount}`,
  );

  // Count customers
  const customerCount = await prisma.customer.count({
    where: { customer: { in: testCustomerNames } },
  });
  test(
    "should seed all customers",
    expect(customerCount).toBe(goldenCustomers.length),
    `Expected ${goldenCustomers.length} customers, got ${customerCount}`,
  );

  // Count jobs
  const jobCount = await prisma.jobs.count({
    where: { driver: { in: testDriverNames } },
  });
  test(
    "should seed jobs across multiple weeks",
    expect(jobCount).toBeGreaterThanOrEqual(30),
    `Expected at least 30 jobs, got ${jobCount}`,
  );

  // Count RCTIs
  const rctiCount = await prisma.rcti.count({
    where: { driverName: { in: testDriverNames } },
  });
  test(
    "should seed RCTIs with various statuses",
    expect(rctiCount).toBeGreaterThan(0),
    `Expected at least 1 RCTI, got ${rctiCount}`,
  );

  // Count deductions
  const deductionCount = await prisma.rctiDeduction.count({
    where: { driver: { driver: { in: testDriverNames } } },
  });
  test(
    "should seed deductions",
    expect(deductionCount).toBeGreaterThan(0),
    `Expected at least 1 deduction, got ${deductionCount}`,
  );
}

async function verifyVehicleData(prisma: PrismaClient): Promise<void> {
  console.log("\nVehicle Data Verification\n");

  // Check specific vehicle
  const vehicle = await prisma.vehicle.findFirst({
    where: { registration: "TEST-TRAY01" },
  });
  test(
    "should retrieve test vehicle by registration",
    vehicle !== null &&
      vehicle.registration === "TEST-TRAY01" &&
      vehicle.type === "TRAY",
    `Vehicle TEST-TRAY01 not found or has incorrect data`,
  );

  // Check vehicle types
  const vehicles = await prisma.vehicle.findMany({
    where: { registration: { startsWith: "TEST-" } },
  });
  const types = new Set(vehicles.map((v) => v.type));
  test(
    "should have various vehicle types",
    types.has("TRAY") && types.has("CRANE") && types.has("SEMI"),
    `Missing vehicle types. Found: ${Array.from(types).join(", ")}`,
  );
}

async function verifyDriverData(prisma: PrismaClient): Promise<void> {
  console.log("\nDriver Data Verification\n");

  // Check specific driver
  const driver = await prisma.driver.findFirst({
    where: { driver: "Test Driver Alpha" },
  });
  test(
    "should retrieve test driver by name",
    driver !== null &&
      driver.driver === "Test Driver Alpha" &&
      driver.type === "Employee",
    `Driver Test Driver Alpha not found or has incorrect data`,
  );

  // Check driver types
  const drivers = await prisma.driver.findMany({
    where: { driver: { startsWith: "Test" } },
  });
  const driverTypes = new Set(drivers.map((d) => d.type));
  test(
    "should have both employee and subcontractor drivers",
    driverTypes.has("Employee") && driverTypes.has("Subcontractor"),
    `Missing driver types. Found: ${Array.from(driverTypes).join(", ")}`,
  );

  // Check GST configurations
  const gstStatuses = new Set(drivers.map((d) => d.gstStatus));
  const gstModes = new Set(drivers.map((d) => d.gstMode));
  test(
    "should have drivers with different GST configurations",
    gstStatuses.has("registered") &&
      gstStatuses.has("not_registered") &&
      gstModes.has("exclusive") &&
      gstModes.has("inclusive"),
    `Missing GST configs. Statuses: ${Array.from(gstStatuses).join(", ")}, Modes: ${Array.from(gstModes).join(", ")}`,
  );

  // Check archived driver
  const archivedDriver = await prisma.driver.findFirst({
    where: { driver: "Test Driver Archived" },
  });
  test(
    "should have an archived driver for testing archive filters",
    archivedDriver !== null && archivedDriver.isArchived === true,
    `Archived driver not found or not archived`,
  );

  // Check subcontractor bank details
  const subbie = await prisma.driver.findFirst({
    where: { driver: "Test Subbie Gamma" },
  });
  test(
    "should have subcontractor drivers with bank details",
    subbie !== null &&
      subbie.type === "Subcontractor" &&
      subbie.businessName === "Gamma Transport Pty Ltd" &&
      subbie.abn === "12345678901",
    `Subcontractor bank details incomplete`,
  );
}

async function verifyCustomerData(prisma: PrismaClient): Promise<void> {
  console.log("\nCustomer Data Verification\n");

  // Check specific customer
  const customer = await prisma.customer.findFirst({
    where: { customer: "Test Customer Acme" },
  });
  test(
    "should retrieve test customer by name",
    customer !== null &&
      customer.customer === "Test Customer Acme" &&
      customer.billTo === "Acme Corporation",
    `Customer Test Customer Acme not found or has incorrect data`,
  );

  // Check customer pricing
  const customers = await prisma.customer.findMany({
    where: { customer: { startsWith: "Test Customer" } },
  });
  const allHavePricing = customers.every(
    (c) => (c.tray ?? 0) > 0 && (c.crane ?? 0) > 0,
  );
  test(
    "should have customers with pricing configurations",
    allHavePricing,
    `Some customers missing pricing`,
  );

  // Check tolls configuration
  const withTolls = customers.filter((c) => c.tolls);
  const withoutTolls = customers.filter((c) => !c.tolls);
  test(
    "should have customers with and without tolls",
    withTolls.length > 0 && withoutTolls.length > 0,
    `Expected mix of toll configs. With: ${withTolls.length}, Without: ${withoutTolls.length}`,
  );
}

async function verifyJobData(prisma: PrismaClient): Promise<void> {
  console.log("\nJob Data Verification\n");

  const testDriverNames = getTestDriverNames();

  // Check current week jobs
  const currentWeekEnd = getRelativeWeekEnding(0);
  const currentWeekStart = startOfWeek(currentWeekEnd, { weekStartsOn: 1 });

  const currentWeekJobs = await prisma.jobs.findMany({
    where: {
      driver: { in: testDriverNames },
      date: { gte: currentWeekStart, lte: currentWeekEnd },
    },
  });
  test(
    "should have jobs for the current week",
    currentWeekJobs.length > 0,
    `No jobs found for current week`,
  );

  // Check past week jobs
  const twoWeeksAgo = getRelativeWeekEnding(-2);
  const pastWeekStart = startOfWeek(twoWeeksAgo, { weekStartsOn: 1 });

  const pastWeekJobs = await prisma.jobs.findMany({
    where: {
      driver: { in: testDriverNames },
      date: { gte: pastWeekStart, lte: twoWeeksAgo },
    },
  });
  test(
    "should have jobs for past weeks",
    pastWeekJobs.length > 0,
    `No jobs found for 2 weeks ago`,
  );

  // Check future week jobs
  const nextWeekEnd = getRelativeWeekEnding(1);
  const nextWeekStart = startOfWeek(nextWeekEnd, { weekStartsOn: 1 });

  const futureJobs = await prisma.jobs.findMany({
    where: {
      driver: { in: testDriverNames },
      date: { gte: nextWeekStart, lte: nextWeekEnd },
    },
  });
  test(
    "should have jobs for future weeks",
    futureJobs.length > 0,
    `No jobs found for next week`,
  );

  // Check completion states
  const allJobs = await prisma.jobs.findMany({
    where: { driver: { in: testDriverNames } },
  });
  const withChargedHours = allJobs.filter((j) => j.chargedHours !== null);
  const withoutChargedHours = allJobs.filter((j) => j.chargedHours === null);
  test(
    "should have jobs with different completion states",
    withChargedHours.length > 0 && withoutChargedHours.length > 0,
    `Expected mix of completion states. With hours: ${withChargedHours.length}, Without: ${withoutChargedHours.length}`,
  );

  // Check toll information
  const jobsWithTolls = await prisma.jobs.findMany({
    where: {
      driver: { in: testDriverNames },
      OR: [{ eastlink: { gt: 0 } }, { citylink: { gt: 0 } }],
    },
  });
  test(
    "should have jobs with toll information",
    jobsWithTolls.length > 0,
    `No jobs with toll information found`,
  );
}

async function verifyRctiData(prisma: PrismaClient): Promise<void> {
  console.log("\nRCTI Data Verification\n");

  const testDriverNames = getTestDriverNames();

  // Check draft RCTIs
  const draftRctis = await prisma.rcti.findMany({
    where: { driverName: { in: testDriverNames }, status: "draft" },
  });
  test(
    "should have RCTIs in draft status",
    draftRctis.length > 0,
    `No draft RCTIs found`,
  );

  // Check finalised RCTIs
  const finalisedRctis = await prisma.rcti.findMany({
    where: { driverName: { in: testDriverNames }, status: "finalised" },
  });
  test(
    "should have RCTIs in finalised status",
    finalisedRctis.length > 0,
    `No finalised RCTIs found`,
  );

  // Check paid RCTIs
  const paidRctis = await prisma.rcti.findMany({
    where: { driverName: { in: testDriverNames }, status: "paid" },
  });
  test(
    "should have RCTIs in paid status",
    paidRctis.length > 0,
    `No paid RCTIs found`,
  );

  // Check RCTI lines
  const rctiWithLines = await prisma.rcti.findFirst({
    where: { driverName: { in: testDriverNames }, lines: { some: {} } },
    orderBy: { weekEnding: "desc" },
    include: { lines: true },
  });
  test(
    "should have RCTIs with lines",
    rctiWithLines !== null && rctiWithLines.lines.length > 0,
    `RCTI lines not found`,
  );

  // Check status change history
  const finalisedOrPaid = await prisma.rcti.findMany({
    where: {
      driverName: { in: testDriverNames },
      status: { in: ["finalised", "paid"] },
    },
    include: { statusChanges: true },
  });
  const allHaveHistory = finalisedOrPaid.every(
    (r) => r.statusChanges.length > 0,
  );
  test(
    "should have RCTIs with status change history",
    allHaveHistory,
    `Some finalised/paid RCTIs missing status history`,
  );

  // Check RCTI totals
  if (rctiWithLines) {
    const linesTotal = rctiWithLines.lines.reduce(
      (sum, line) => sum + Number(line.amountIncGst),
      0,
    );
    const diff = Math.abs(Number(rctiWithLines.total) - linesTotal);
    test(
      "should calculate RCTI totals correctly",
      diff < 0.01,
      `RCTI total mismatch. Expected: ${linesTotal}, Got: ${Number(rctiWithLines.total)}`,
    );
  }
}

async function verifyDeductionData(prisma: PrismaClient): Promise<void> {
  console.log("\nDeduction Data Verification\n");

  const testDriverNames = getTestDriverNames();

  // Check active deductions
  const activeDeductions = await prisma.rctiDeduction.findMany({
    where: { driver: { driver: { in: testDriverNames } }, status: "active" },
  });
  test(
    "should have active deductions",
    activeDeductions.length > 0,
    `No active deductions found`,
  );

  // Check completed deductions
  const completedDeductions = await prisma.rctiDeduction.findMany({
    where: { driver: { driver: { in: testDriverNames } }, status: "completed" },
  });
  test(
    "should have completed deductions",
    completedDeductions.length > 0,
    `No completed deductions found`,
  );

  // Check cancelled deductions
  const cancelledDeductions = await prisma.rctiDeduction.findMany({
    where: { driver: { driver: { in: testDriverNames } }, status: "cancelled" },
  });
  test(
    "should have cancelled deductions",
    cancelledDeductions.length > 0,
    `No cancelled deductions found`,
  );

  // Check deduction frequencies
  const allDeductions = await prisma.rctiDeduction.findMany({
    where: { driver: { driver: { in: testDriverNames } } },
  });
  const frequencies = new Set(allDeductions.map((d) => d.frequency));
  test(
    "should have deductions with different frequencies",
    frequencies.has("weekly") &&
      frequencies.has("fortnightly") &&
      frequencies.has("one-off"),
    `Missing frequencies. Found: ${Array.from(frequencies).join(", ")}`,
  );
}

async function verifyDataRelationships(prisma: PrismaClient): Promise<void> {
  console.log("\nData Relationship Verification\n");

  const testDriverNames = getTestDriverNames();

  // Check jobs linked to drivers
  const jobs = await prisma.jobs.findMany({
    where: { driver: { in: testDriverNames } },
  });
  const allJobsHaveValidDriver = jobs.every((j) =>
    testDriverNames.includes(j.driver),
  );
  test(
    "should have jobs linked to existing drivers",
    allJobsHaveValidDriver,
    `Some jobs have invalid driver references`,
  );

  // Check jobs linked to customers
  const testCustomerNames = getTestCustomerNames();
  const allJobsHaveValidCustomer = jobs.every((j) =>
    testCustomerNames.includes(j.customer),
  );
  test(
    "should have jobs linked to existing customers",
    allJobsHaveValidCustomer,
    `Some jobs have invalid customer references`,
  );

  // Check jobs linked to vehicles
  const testVehicleRegs = getTestVehicleRegistrations();
  const allJobsHaveValidVehicle = jobs.every((j) =>
    testVehicleRegs.includes(j.registration),
  );
  test(
    "should have jobs linked to existing vehicles",
    allJobsHaveValidVehicle,
    `Some jobs have invalid vehicle references`,
  );

  // Check RCTIs linked to drivers
  const rctis = await prisma.rcti.findMany({
    where: { driverName: { in: testDriverNames } },
    include: { driver: true },
  });
  const allRctisHaveDriver = rctis.every(
    (r) => r.driver !== null && r.driver.driver === r.driverName,
  );
  test(
    "should have RCTIs linked to drivers",
    allRctisHaveDriver,
    `Some RCTIs have invalid driver references`,
  );
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log("\n===========================================");
  console.log("     Golden Data Verification Script");
  console.log("===========================================");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("\nERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log(
    `\nDatabase: ${databaseUrl.replace(/\/\/.*:.*@/, "//***:***@").substring(0, 50)}...`,
  );

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    await verifyDataSeeding(prisma);
    await verifyVehicleData(prisma);
    await verifyDriverData(prisma);
    await verifyCustomerData(prisma);
    await verifyJobData(prisma);
    await verifyRctiData(prisma);
    await verifyDeductionData(prisma);
    await verifyDataRelationships(prisma);

    // Summary
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;

    console.log("\n===========================================");
    console.log("                 Summary");
    console.log("===========================================\n");
    console.log(`  Total tests:  ${total}`);
    console.log(`  \x1b[32mPassed:       ${passed}\x1b[0m`);
    if (failed > 0) {
      console.log(`  \x1b[31mFailed:       ${failed}\x1b[0m`);
    } else {
      console.log(`  Failed:       ${failed}`);
    }

    console.log("");

    if (failed > 0) {
      console.log("FAIL: Some verification tests failed!\n");
      process.exit(1);
    } else {
      console.log("PASS: All verification tests passed!\n");
    }
  } catch (error) {
    console.error("\nError during verification:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
