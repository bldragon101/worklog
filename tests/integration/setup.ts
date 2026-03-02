/**
 * Jest Integration Test Setup
 *
 * This file provides setup and teardown hooks for integration tests
 * that need to interact with the test database using golden data.
 *
 * Usage in test files:
 *   import { setupTestDb, teardownTestDb, getTestPrismaClient } from './setup';
 *
 *   beforeAll(async () => {
 *     await setupTestDb();
 *   });
 *
 *   afterAll(async () => {
 *     await teardownTestDb();
 *   });
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  getGoldenDataSet,
  getTestDriverNames,
  getTestCustomerNames,
  getTestVehicleRegistrations,
  generateInvoiceNumber,
  GoldenDriver,
  GoldenRcti,
} from "../fixtures/golden-data";

// ============================================================================
// Prisma Client Management
// ============================================================================

let testPrisma: PrismaClient | null = null;

/**
 * Get or create the test Prisma client
 */
export function getTestPrismaClient(): PrismaClient {
  if (!testPrisma) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL environment variable is required for integration tests"
      );
    }

    const adapter = new PrismaPg({
      connectionString: databaseUrl,
    });

    testPrisma = new PrismaClient({ adapter });
  }

  return testPrisma;
}

/**
 * Disconnect the test Prisma client
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}

// ============================================================================
// Calculation Helpers (self-contained to avoid import issues in Jest)
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
    return {
      amountExGst: Math.round(grossAmount * 100) / 100,
      gstAmount: 0,
      amountIncGst: Math.round(grossAmount * 100) / 100,
    };
  }

  if (gstMode === "inclusive") {
    const amountIncGst = Math.round(grossAmount * 100) / 100;
    const amountExGst = Math.round((grossAmount / 1.1) * 100) / 100;
    const gstAmount = Math.round((amountIncGst - amountExGst) * 100) / 100;
    return { amountExGst, gstAmount, amountIncGst };
  }

  // GST exclusive
  const amountExGst = Math.round(grossAmount * 100) / 100;
  const gstAmount = Math.round(amountExGst * 0.1 * 100) / 100;
  const amountIncGst = Math.round((amountExGst + gstAmount) * 100) / 100;
  return { amountExGst, gstAmount, amountIncGst };
}

function calculateRctiTotals(
  lines: Array<{ amountExGst: number; gstAmount: number; amountIncGst: number }>
): {
  subtotal: number;
  gst: number;
  total: number;
} {
  const subtotal = lines.reduce((sum, line) => sum + line.amountExGst, 0);
  const gst = lines.reduce((sum, line) => sum + line.gstAmount, 0);
  const total = lines.reduce((sum, line) => sum + line.amountIncGst, 0);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// ============================================================================
// Cleanup Functions
// ============================================================================

/**
 * Delete all test data from the database
 */
export async function cleanupTestData(): Promise<void> {
  const prisma = getTestPrismaClient();

  const testDriverNames = getTestDriverNames();
  const testCustomerNames = getTestCustomerNames();
  const testVehicleRegistrations = getTestVehicleRegistrations();

  // Get test driver IDs
  const testDrivers = await prisma.driver.findMany({
    where: {
      driver: { in: testDriverNames },
    },
    select: { id: true },
  });
  const testDriverIds = testDrivers.map((d) => d.id);

  if (testDriverIds.length > 0) {
    // Get test RCTI IDs
    const testRctis = await prisma.rcti.findMany({
      where: {
        driverId: { in: testDriverIds },
      },
      select: { id: true },
    });
    const testRctiIds = testRctis.map((r) => r.id);

    if (testRctiIds.length > 0) {
      await prisma.rctiDeductionApplication.deleteMany({
        where: { rctiId: { in: testRctiIds } },
      });

      await prisma.rctiStatusChange.deleteMany({
        where: { rctiId: { in: testRctiIds } },
      });

      await prisma.rctiLine.deleteMany({
        where: { rctiId: { in: testRctiIds } },
      });

      await prisma.rcti.deleteMany({
        where: { id: { in: testRctiIds } },
      });
    }

    await prisma.rctiDeduction.deleteMany({
      where: { driverId: { in: testDriverIds } },
    });
  }

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

  await prisma.driver.deleteMany({
    where: { driver: { in: testDriverNames } },
  });

  await prisma.customer.deleteMany({
    where: { customer: { in: testCustomerNames } },
  });

  await prisma.vehicle.deleteMany({
    where: { registration: { in: testVehicleRegistrations } },
  });
}

// ============================================================================
// Seeding Functions
// ============================================================================

/**
 * Seed RCTIs with their associated lines
 */
async function seedRctisWithLines(
  prisma: PrismaClient,
  rctis: GoldenRcti[],
  drivers: GoldenDriver[],
  driverIdMap: Map<string, number>
): Promise<void> {
  for (const rcti of rctis) {
    const driverId = driverIdMap.get(rcti.driverName);
    if (!driverId) continue;

    const driver = drivers.find((d) => d.driver === rcti.driverName);
    if (!driver) continue;

    const invoiceNumber = generateInvoiceNumber(
      rcti.driverName,
      rcti.weekEnding
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
            rcti.weekEnding.getTime() + 2 * 24 * 60 * 60 * 1000
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

/**
 * Seed all golden data into the database
 */
export async function seedGoldenData(): Promise<void> {
  const prisma = getTestPrismaClient();
  const data = getGoldenDataSet();

  // Seed vehicles
  for (const vehicle of data.vehicles) {
    await prisma.vehicle.upsert({
      where: { registration: vehicle.registration },
      update: vehicle,
      create: vehicle,
    });
  }

  // Seed drivers
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

  // Seed customers
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

  // Seed jobs
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

  // Seed deductions
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

  // Seed RCTIs
  await seedRctisWithLines(prisma, data.rctis, data.drivers, driverIdMap);
}

// ============================================================================
// Main Setup/Teardown Functions
// ============================================================================

/**
 * Setup test database with golden data
 * Call this in beforeAll hooks
 */
export async function setupTestDb(): Promise<void> {
  await cleanupTestData();
  await seedGoldenData();
}

/**
 * Teardown test database
 * Call this in afterAll hooks
 */
export async function teardownTestDb(): Promise<void> {
  await cleanupTestData();
  await disconnectTestPrisma();
}

/**
 * Reset database to golden state
 * Useful for resetting between test suites within a file
 */
export async function resetTestDb(): Promise<void> {
  await cleanupTestData();
  await seedGoldenData();
}

// ============================================================================
// Test Data Query Helpers
// ============================================================================

/**
 * Get a test driver by name
 */
export async function getTestDriver(name: string) {
  const prisma = getTestPrismaClient();
  return prisma.driver.findFirst({
    where: { driver: name },
  });
}

/**
 * Get a test customer by name
 */
export async function getTestCustomer(name: string) {
  const prisma = getTestPrismaClient();
  return prisma.customer.findFirst({
    where: { customer: name },
  });
}

/**
 * Get a test vehicle by registration
 */
export async function getTestVehicle(registration: string) {
  const prisma = getTestPrismaClient();
  return prisma.vehicle.findFirst({
    where: { registration },
  });
}

/**
 * Get all test jobs
 */
export async function getAllTestJobs() {
  const prisma = getTestPrismaClient();
  const testDriverNames = getTestDriverNames();

  return prisma.jobs.findMany({
    where: {
      driver: { in: testDriverNames },
    },
    orderBy: { date: "desc" },
  });
}

/**
 * Get RCTIs for a specific driver
 */
export async function getRctisForDriver(driverName: string) {
  const prisma = getTestPrismaClient();
  return prisma.rcti.findMany({
    where: { driverName },
    include: {
      lines: true,
      statusChanges: true,
    },
    orderBy: { weekEnding: "desc" },
  });
}

/**
 * Count test entities in database
 */
export async function countTestEntities(): Promise<{
  vehicles: number;
  drivers: number;
  customers: number;
  jobs: number;
  rctis: number;
  deductions: number;
}> {
  const prisma = getTestPrismaClient();
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
