#!/usr/bin/env tsx
/**
 * Golden Data Seed Script
 *
 * This script can be run manually to seed or reset the test database
 * with golden data for testing purposes.
 *
 * Usage:
 *   pnpx tsx scripts/seed-golden-data.ts [command]
 *
 * Commands:
 *   seed     - Seed golden data (adds to existing data)
 *   reset    - Clean up existing test data and re-seed
 *   cleanup  - Only clean up test data without re-seeding
 *   status   - Show count of test entities in database
 *
 * Examples:
 *   pnpx tsx scripts/seed-golden-data.ts seed
 *   pnpx tsx scripts/seed-golden-data.ts reset
 *   pnpx tsx scripts/seed-golden-data.ts cleanup
 *   pnpx tsx scripts/seed-golden-data.ts status
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  getGoldenDataSet,
  getTestDriverNames,
  getTestCustomerNames,
  getTestVehicleRegistrations,
  generateInvoiceNumber,
  GoldenDriver,
  GoldenRcti,
} from "../tests/fixtures/golden-data";
import { bankersRound } from "../src/lib/utils/rcti-calculations";
import dotenv from "dotenv";
import path from "path";

// Ensure consistent timezone across all environments (local dev, CI, etc.)
process.env.TZ = "Australia/Melbourne";

// Load environment variables (order matters - more specific files loaded last with override)
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
// Calculation Helpers
// ============================================================================

function calculateLineAmounts({
  chargedHours,
  ratePerHour,
  gstStatus,
  gstMode,
}: {
  chargedHours: number;
  ratePerHour: number;
  gstStatus: "registered" | "not_registered";
  gstMode: "exclusive" | "inclusive";
}): {
  amountExGst: number;
  gstAmount: number;
  amountIncGst: number;
} {
  const grossAmount = chargedHours * ratePerHour;

  if (gstStatus === "not_registered") {
    const amount = bankersRound(grossAmount);
    return {
      amountExGst: amount,
      gstAmount: 0,
      amountIncGst: amount,
    };
  }

  if (gstMode === "inclusive") {
    const amountIncGst = bankersRound(grossAmount);
    const amountExGst = bankersRound(grossAmount / 1.1);
    const gstAmount = bankersRound(amountIncGst - amountExGst);
    return { amountExGst, gstAmount, amountIncGst };
  }

  const amountExGst = bankersRound(grossAmount);
  const gstAmount = bankersRound(amountExGst * 0.1);
  const amountIncGst = bankersRound(amountExGst + gstAmount);
  return { amountExGst, gstAmount, amountIncGst };
}

function calculateRctiTotals(
  lines: Array<{
    amountExGst: number;
    gstAmount: number;
    amountIncGst: number;
  }>,
): {
  subtotal: number;
  gst: number;
  total: number;
} {
  const subtotal = bankersRound(
    lines.reduce((sum, line) => sum + line.amountExGst, 0),
  );
  const gst = bankersRound(
    lines.reduce((sum, line) => sum + line.gstAmount, 0),
  );
  const total = bankersRound(
    lines.reduce((sum, line) => sum + line.amountIncGst, 0),
  );

  return {
    subtotal,
    gst,
    total,
  };
}

// ============================================================================
// Database Functions
// ============================================================================

async function cleanupTestData(prisma: PrismaClient): Promise<void> {
  const testDriverNames = getTestDriverNames();
  const testCustomerNames = getTestCustomerNames();
  const testVehicleRegistrations = getTestVehicleRegistrations();

  console.log("  Fetching test driver IDs...");
  const testDrivers = await prisma.driver.findMany({
    where: {
      driver: { in: testDriverNames },
    },
    select: { id: true },
  });
  const testDriverIds = testDrivers.map((d) => d.id);

  if (testDriverIds.length > 0) {
    const testRctis = await prisma.rcti.findMany({
      where: {
        driverId: { in: testDriverIds },
      },
      select: { id: true },
    });
    const testRctiIds = testRctis.map((r) => r.id);

    if (testRctiIds.length > 0) {
      console.log("  Deleting RCTI deduction applications...");
      await prisma.rctiDeductionApplication.deleteMany({
        where: { rctiId: { in: testRctiIds } },
      });

      console.log("  Deleting RCTI status changes...");
      await prisma.rctiStatusChange.deleteMany({
        where: { rctiId: { in: testRctiIds } },
      });

      console.log("  Deleting RCTI lines...");
      await prisma.rctiLine.deleteMany({
        where: { rctiId: { in: testRctiIds } },
      });

      console.log("  Deleting RCTIs...");
      await prisma.rcti.deleteMany({
        where: { id: { in: testRctiIds } },
      });
    }

    console.log("  Deleting RCTI deductions...");
    await prisma.rctiDeduction.deleteMany({
      where: { driverId: { in: testDriverIds } },
    });
  }

  console.log("  Deleting jobs...");
  await prisma.jobs.deleteMany({
    where: {
      OR: [
        { driver: { in: testDriverNames } },
        { customer: { in: testCustomerNames } },
        { registration: { in: testVehicleRegistrations } },
        { jobReference: { startsWith: "JOB-W" } },
      ],
    },
  });

  console.log("  Deleting drivers...");
  await prisma.driver.deleteMany({
    where: { driver: { in: testDriverNames } },
  });

  console.log("  Deleting customers...");
  await prisma.customer.deleteMany({
    where: { customer: { in: testCustomerNames } },
  });

  console.log("  Deleting vehicles...");
  await prisma.vehicle.deleteMany({
    where: { registration: { in: testVehicleRegistrations } },
  });
}

async function seedRctisWithLines(
  prisma: PrismaClient,
  rctis: GoldenRcti[],
  drivers: GoldenDriver[],
  driverIdMap: Map<string, number>,
): Promise<void> {
  for (const rcti of rctis) {
    const driverId = driverIdMap.get(rcti.driverName);
    if (!driverId) continue;

    const driver = drivers.find((d) => d.driver === rcti.driverName);
    if (!driver) continue;

    const invoiceNumber = generateInvoiceNumber(
      rcti.driverName,
      rcti.weekEnding,
    );

    const sampleLines = [
      {
        jobDate: rcti.weekEnding,
        customer: "Test Customer Acme",
        truckType: driver.truck.includes("CRANE") ? "CRANE" : "TRAY",
        description: "Standard delivery",
        chargedHours: 8,
        ratePerHour: driver.crane ?? driver.tray ?? 65,
      },
      {
        jobDate: rcti.weekEnding,
        customer: "Test Customer BuildCo",
        truckType: driver.truck.includes("CRANE") ? "CRANE" : "TRAY",
        description: "Construction site delivery",
        chargedHours: 6,
        ratePerHour: driver.crane ?? driver.tray ?? 65,
      },
    ];

    const calculatedLines = sampleLines.map((line) => {
      const amounts = calculateLineAmounts({
        chargedHours: line.chargedHours,
        ratePerHour: line.ratePerHour,
        gstStatus: driver.gstStatus,
        gstMode: driver.gstMode,
      });
      return { ...line, ...amounts };
    });

    const totals = calculateRctiTotals(calculatedLines);

    const createdRcti = await prisma.rcti.create({
      data: {
        driverId,
        driverName: rcti.driverName,
        businessName: driver.businessName,
        driverAddress: driver.address,
        driverAbn: driver.abn,
        gstStatus: driver.gstStatus,
        gstMode: driver.gstMode,
        bankAccountName: driver.bankAccountName,
        bankBsb: driver.bankBsb,
        bankAccountNumber: driver.bankAccountNumber,
        weekEnding: rcti.weekEnding,
        invoiceNumber,
        subtotal: totals.subtotal,
        gst: totals.gst,
        total: totals.total,
        status: rcti.status,
        notes: rcti.notes,
        paidAt: rcti.paidAt,
      },
    });

    for (const line of calculatedLines) {
      await prisma.rctiLine.create({
        data: {
          rctiId: createdRcti.id,
          jobId: null,
          jobDate: line.jobDate,
          customer: line.customer,
          truckType: line.truckType,
          description: line.description,
          chargedHours: line.chargedHours,
          ratePerHour: line.ratePerHour,
          amountExGst: line.amountExGst,
          gstAmount: line.gstAmount,
          amountIncGst: line.amountIncGst,
        },
      });
    }

    if (rcti.status === "finalised" || rcti.status === "paid") {
      await prisma.rctiStatusChange.create({
        data: {
          rctiId: createdRcti.id,
          fromStatus: "draft",
          toStatus: "finalised",
          reason: "Test finalisation",
          changedBy: "test-system",
          changedAt: new Date(
            rcti.weekEnding.getTime() + 2 * 24 * 60 * 60 * 1000,
          ),
        },
      });
    }

    if (rcti.status === "paid" && rcti.paidAt) {
      await prisma.rctiStatusChange.create({
        data: {
          rctiId: createdRcti.id,
          fromStatus: "finalised",
          toStatus: "paid",
          reason: "Payment received",
          changedBy: "test-system",
          changedAt: rcti.paidAt,
        },
      });
    }
  }
}

async function seedGoldenData(prisma: PrismaClient): Promise<void> {
  const data = getGoldenDataSet();

  console.log(`  Seeding ${data.vehicles.length} vehicles...`);
  for (const vehicle of data.vehicles) {
    await prisma.vehicle.upsert({
      where: { registration: vehicle.registration },
      update: vehicle,
      create: vehicle,
    });
  }

  console.log(`  Seeding ${data.drivers.length} drivers...`);
  const driverIdMap = new Map<string, number>();
  for (const driver of data.drivers) {
    const created = await prisma.driver.upsert({
      where: { driver: driver.driver },
      update: {
        truck: driver.truck,
        tray: driver.tray,
        crane: driver.crane,
        semi: driver.semi,
        semiCrane: driver.semiCrane,
        breaks: driver.breaks,
        type: driver.type,
        fuelLevy: driver.fuelLevy,
        tolls: driver.tolls,
        email: driver.email,
        businessName: driver.businessName,
        abn: driver.abn,
        address: driver.address,
        bankAccountName: driver.bankAccountName,
        bankAccountNumber: driver.bankAccountNumber,
        bankBsb: driver.bankBsb,
        gstMode: driver.gstMode,
        gstStatus: driver.gstStatus,
        isArchived: driver.isArchived,
      },
      create: {
        driver: driver.driver,
        truck: driver.truck,
        tray: driver.tray,
        crane: driver.crane,
        semi: driver.semi,
        semiCrane: driver.semiCrane,
        breaks: driver.breaks,
        type: driver.type,
        fuelLevy: driver.fuelLevy,
        tolls: driver.tolls,
        email: driver.email,
        businessName: driver.businessName,
        abn: driver.abn,
        address: driver.address,
        bankAccountName: driver.bankAccountName,
        bankAccountNumber: driver.bankAccountNumber,
        bankBsb: driver.bankBsb,
        gstMode: driver.gstMode,
        gstStatus: driver.gstStatus,
        isArchived: driver.isArchived,
      },
    });
    driverIdMap.set(driver.driver, created.id);
  }

  console.log(`  Seeding ${data.customers.length} customers...`);
  for (const customer of data.customers) {
    const existing = await prisma.customer.findFirst({
      where: { customer: customer.customer },
      select: { id: true },
    });

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: customer,
      });
    } else {
      await prisma.customer.create({
        data: customer,
      });
    }
  }

  console.log(`  Seeding ${data.jobs.length} jobs...`);
  for (const job of data.jobs) {
    await prisma.jobs.create({
      data: {
        date: job.date,
        driver: job.driver,
        customer: job.customer,
        billTo: job.billTo,
        truckType: job.truckType,
        registration: job.registration,
        pickup: job.pickup,
        dropoff: job.dropoff,
        startTime: job.startTime,
        finishTime: job.finishTime,
        chargedHours: job.chargedHours,
        driverCharge: job.driverCharge,
        runsheet: job.runsheet,
        invoiced: job.invoiced,
        comments: job.comments,
        jobReference: job.jobReference,
        eastlink: job.eastlink,
        citylink: job.citylink,
      },
    });
  }

  console.log(`  Seeding ${data.deductions.length} deductions...`);
  for (const deduction of data.deductions) {
    const driverId = driverIdMap.get(deduction.driverName);
    if (!driverId) continue;

    await prisma.rctiDeduction.create({
      data: {
        driverId,
        type: deduction.type,
        description: deduction.description,
        totalAmount: deduction.totalAmount,
        amountPaid: deduction.amountPaid,
        amountRemaining: deduction.amountRemaining,
        frequency: deduction.frequency,
        amountPerCycle: deduction.amountPerCycle,
        status: deduction.status,
        startDate: deduction.startDate,
        completedAt: deduction.completedAt,
        notes: deduction.notes,
      },
    });
  }

  console.log(`  Seeding ${data.rctis.length} RCTIs with lines...`);
  await seedRctisWithLines(prisma, data.rctis, data.drivers, driverIdMap);
}

async function getTestEntityCounts(prisma: PrismaClient): Promise<{
  vehicles: number;
  drivers: number;
  customers: number;
  jobs: number;
  rctis: number;
  deductions: number;
}> {
  const testDriverNames = getTestDriverNames();
  const testCustomerNames = getTestCustomerNames();
  const testVehicleRegistrations = getTestVehicleRegistrations();

  const [vehicles, drivers, customers, jobs, rctis, deductions] =
    await Promise.all([
      prisma.vehicle.count({
        where: { registration: { in: testVehicleRegistrations } },
      }),
      prisma.driver.count({
        where: { driver: { in: testDriverNames } },
      }),
      prisma.customer.count({
        where: { customer: { in: testCustomerNames } },
      }),
      prisma.jobs.count({
        where: { driver: { in: testDriverNames } },
      }),
      prisma.rcti.count({
        where: { driverName: { in: testDriverNames } },
      }),
      prisma.rctiDeduction.count({
        where: {
          driver: { driver: { in: testDriverNames } },
        },
      }),
    ]);

  return { vehicles, drivers, customers, jobs, rctis, deductions };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const command = process.argv[2] || "help";

  console.log("\n===========================================");
  console.log("        Golden Data Seed Script");
  console.log("===========================================\n");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    console.error("Please ensure .env.local or .env.development.local exists");
    process.exit(1);
  }

  console.log(
    `Database: ${databaseUrl.replace(/\/\/.*:.*@/, "//***:***@").substring(0, 50)}...`,
  );

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    switch (command) {
      case "seed":
        console.log("\nSeeding golden data...\n");
        await seedGoldenData(prisma);
        console.log("\nSeeding complete!");
        break;

      case "reset":
        console.log("\nResetting database to golden state...\n");
        console.log("Step 1: Cleaning up existing test data...");
        await cleanupTestData(prisma);
        console.log("\nStep 2: Seeding fresh golden data...");
        await seedGoldenData(prisma);
        console.log("\nReset complete!");
        break;

      case "cleanup":
        console.log("\nCleaning up test data...\n");
        await cleanupTestData(prisma);
        console.log("\nCleanup complete!");
        break;

      case "status":
        console.log("\nGathering test entity counts...\n");
        const counts = await getTestEntityCounts(prisma);
        console.log("Test Data Status:");
        console.log("  Vehicles:   ", counts.vehicles);
        console.log("  Drivers:    ", counts.drivers);
        console.log("  Customers:  ", counts.customers);
        console.log("  Jobs:       ", counts.jobs);
        console.log("  RCTIs:      ", counts.rctis);
        console.log("  Deductions: ", counts.deductions);
        break;

      case "help":
      default:
        console.log("Usage: pnpx tsx scripts/seed-golden-data.ts [command]");
        console.log("\nCommands:");
        console.log("  seed     - Seed golden data (adds to existing data)");
        console.log("  reset    - Clean up existing test data and re-seed");
        console.log("  cleanup  - Only clean up test data without re-seeding");
        console.log("  status   - Show count of test entities in database");
        console.log("  help     - Show this help message");
        console.log("\nExamples:");
        console.log("  pnpx tsx scripts/seed-golden-data.ts seed");
        console.log("  pnpx tsx scripts/seed-golden-data.ts reset");
        break;
    }

    console.log("");
  } catch (error) {
    console.error("\nError:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
