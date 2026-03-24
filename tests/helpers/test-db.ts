/**
 * Test Database Helper
 *
 * Provides utilities for seeding golden data into the test database
 * and cleaning up after tests. Designed for both E2E (Playwright)
 * and integration tests (Jest).
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
import {
  calculateLineAmounts,
  calculateRctiTotals,
} from "@/lib/utils/rcti-calculations";

// ============================================================================
// Prisma Client Setup for Tests
// ============================================================================

let testPrisma: PrismaClient | null = null;

/**
 * Get or create the test Prisma client
 * Uses DATABASE_URL environment variable (should point to test database)
 */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL environment variable is required for test database operations"
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
// Cleanup Functions
// ============================================================================

/**
 * Delete all test data from the database
 * Uses the TEST_DATA_PREFIX naming convention to identify test data
 */
export async function cleanupTestData(): Promise<void> {
  const prisma = getTestPrisma();

  const testDriverNames = getTestDriverNames();
  const testCustomerNames = getTestCustomerNames();
  const testVehicleRegistrations = getTestVehicleRegistrations();

  // Delete in order of dependencies (children first)

  // 1. Delete RCTI-related data (must delete applications before deductions)
  // First, get all test driver IDs
  const testDrivers = await prisma.driver.findMany({
    where: {
      driver: { in: testDriverNames },
    },
    select: { id: true },
  });
  const testDriverIds = testDrivers.map((d) => d.id);

  if (testDriverIds.length > 0) {
    // Delete RCTI deduction applications for test RCTIs
    const testRctis = await prisma.rcti.findMany({
      where: {
        driverId: { in: testDriverIds },
      },
      select: { id: true },
    });
    const testRctiIds = testRctis.map((r) => r.id);

    if (testRctiIds.length > 0) {
      await prisma.rctiDeductionApplication.deleteMany({
        where: {
          rctiId: { in: testRctiIds },
        },
      });

      // Delete RCTI status changes
      await prisma.rctiStatusChange.deleteMany({
        where: {
          rctiId: { in: testRctiIds },
        },
      });

      // Delete RCTI lines
      await prisma.rctiLine.deleteMany({
        where: {
          rctiId: { in: testRctiIds },
        },
      });

      // Delete RCTIs
      await prisma.rcti.deleteMany({
        where: {
          id: { in: testRctiIds },
        },
      });
    }

    // Delete RCTI deductions for test drivers
    await prisma.rctiDeduction.deleteMany({
      where: {
        driverId: { in: testDriverIds },
      },
    });
  }

  // 2. Delete jobs with test data
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

  // 3. Delete test drivers
  await prisma.driver.deleteMany({
    where: {
      driver: { in: testDriverNames },
    },
  });

  // 4. Delete test customers
  await prisma.customer.deleteMany({
    where: {
      customer: { in: testCustomerNames },
    },
  });

  // 5. Delete test vehicles
  await prisma.vehicle.deleteMany({
    where: {
      registration: { in: testVehicleRegistrations },
    },
  });
}

// ============================================================================
// Seeding Functions
// ============================================================================

/**
 * Seed all golden data into the database
 */
export async function seedGoldenData(): Promise<void> {
  const prisma = getTestPrisma();
  const data = getGoldenDataSet();

  // Seed in order of dependencies (parents first)

  // 1. Seed vehicles
  for (const vehicle of data.vehicles) {
    await prisma.vehicle.upsert({
      where: { registration: vehicle.registration },
      update: vehicle,
      create: vehicle,
    });
  }

  // 2. Seed drivers
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

  // 3. Seed customers
  for (const customer of data.customers) {
    await prisma.customer.upsert({
      where: {
        id: await prisma.customer
          .findFirst({
            where: { customer: customer.customer },
            select: { id: true },
          })
          .then((c) => c?.id ?? -1),
      },
      update: customer,
      create: customer,
    });
  }

  // 4. Seed jobs
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

  // 5. Seed deductions
  for (const deduction of data.deductions) {
    const driverId = driverIdMap.get(deduction.driverName);
    if (!driverId) {
      console.warn(
        `Driver not found for deduction: ${deduction.driverName}`
      );
      continue;
    }

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

  // 6. Seed RCTIs with lines
  await seedRctisWithLines(prisma, data.rctis, data.drivers, driverIdMap);
}

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
    if (!driverId) {
      console.warn(`Driver not found for RCTI: ${rcti.driverName}`);
      continue;
    }

    const driver = drivers.find((d) => d.driver === rcti.driverName);
    if (!driver) {
      continue;
    }

    const invoiceNumber = generateInvoiceNumber(
      rcti.driverName,
      rcti.weekEnding
    );

    // Calculate sample lines based on driver rates
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

    // Calculate line amounts
    const calculatedLines = sampleLines.map((line) => {
      const amounts = calculateLineAmounts({
        chargedHours: line.chargedHours,
        ratePerHour: line.ratePerHour,
        gstStatus: driver.gstStatus,
        gstMode: driver.gstMode,
      });
      return {
        ...line,
        ...amounts,
      };
    });

    // Calculate totals
    const totals = calculateRctiTotals(calculatedLines);

    // Create RCTI
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

    // Create RCTI lines
    for (const line of calculatedLines) {
      await prisma.rctiLine.create({
        data: {
          rctiId: createdRcti.id,
          jobId: null, // Manual lines, not linked to jobs
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

    // Create status change history for finalised/paid RCTIs
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
          ), // 2 days after week ending
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

// ============================================================================
// Combined Operations
// ============================================================================

/**
 * Reset database to golden state
 * Cleans up existing test data and seeds fresh golden data
 */
export async function resetToGoldenData(): Promise<void> {
  await cleanupTestData();
  await seedGoldenData();
}

/**
 * Setup for test suites
 * Call this in beforeAll/beforeEach hooks
 */
export async function setupTestDatabase(): Promise<void> {
  await resetToGoldenData();
}

/**
 * Teardown for test suites
 * Call this in afterAll hooks
 */
export async function teardownTestDatabase(): Promise<void> {
  await cleanupTestData();
  await disconnectTestPrisma();
}

// ============================================================================
// Utility Functions for Tests
// ============================================================================

/**
 * Get a test driver by name
 */
export async function getTestDriver(name: string) {
  const prisma = getTestPrisma();
  return prisma.driver.findFirst({
    where: { driver: name },
  });
}

/**
 * Get a test customer by name
 */
export async function getTestCustomer(name: string) {
  const prisma = getTestPrisma();
  return prisma.customer.findFirst({
    where: { customer: name },
  });
}

/**
 * Get a test vehicle by registration
 */
export async function getTestVehicle(registration: string) {
  const prisma = getTestPrisma();
  return prisma.vehicle.findFirst({
    where: { registration },
  });
}

/**
 * Get jobs for a specific week
 */
export async function getJobsForWeek(weekEnding: Date) {
  const prisma = getTestPrisma();
  const weekStart = new Date(weekEnding);
  weekStart.setDate(weekStart.getDate() - 6);

  return prisma.jobs.findMany({
    where: {
      date: {
        gte: weekStart,
        lte: weekEnding,
      },
    },
    orderBy: { date: "asc" },
  });
}

/**
 * Get RCTIs for a specific driver
 */
export async function getRctisForDriver(driverName: string) {
  const prisma = getTestPrisma();
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
 * Get all test jobs
 */
export async function getAllTestJobs() {
  const prisma = getTestPrisma();
  const testDriverNames = getTestDriverNames();

  return prisma.jobs.findMany({
    where: {
      driver: { in: testDriverNames },
    },
    orderBy: { date: "desc" },
  });
}

/**
 * Count test entities in database
 * Useful for verification in tests
 */
export async function countTestEntities(): Promise<{
  vehicles: number;
  drivers: number;
  customers: number;
  jobs: number;
  rctis: number;
  deductions: number;
}> {
  const prisma = getTestPrisma();
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
