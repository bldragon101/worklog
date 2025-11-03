import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { rctiCreateSchema, rctiQuerySchema } from "@/lib/validation";
import {
  calculateLineAmounts,
  calculateRctiTotals,
  generateInvoiceNumber,
  getDriverRateForTruckType,
} from "@/lib/utils/rcti-calculations";
import { startOfWeek, endOfWeek } from "date-fns";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * GET /api/rcti
 * List RCTIs with optional filters
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const queryParams = {
      driverId: searchParams.get("driverId"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      status: searchParams.get("status"),
    };

    const validation = rctiQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: validation.error },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const { driverId, startDate, endDate, status } = validation.data;

    const where: {
      driverId?: number;
      weekEnding?: { gte?: Date; lte?: Date };
      status?: string;
    } = {};

    if (driverId) {
      where.driverId = parseInt(driverId, 10);
    }

    if (startDate || endDate) {
      where.weekEnding = {};
      if (startDate) {
        where.weekEnding.gte = new Date(startDate);
      }
      if (endDate) {
        where.weekEnding.lte = new Date(endDate);
      }
    }

    if (status) {
      where.status = status;
    }

    const rctis = await prisma.rcti.findMany({
      where,
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
      orderBy: { weekEnding: "desc" },
    });

    return NextResponse.json(rctis, { headers: rateLimitResult.headers });
  } catch (error) {
    console.error("Error fetching RCTIs:", error);
    return NextResponse.json(
      { error: "Failed to fetch RCTIs" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

/**
 * POST /api/rcti
 * Create a new draft RCTI
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const validation = rctiCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const {
      driverId,
      weekEnding,
      driverName,
      driverAddress,
      driverAbn,
      gstStatus,
      gstMode,
      bankAccountName,
      bankBsb,
      bankAccountNumber,
      notes,
    } = validation.data;

    const weekEndingDate = new Date(weekEnding);

    // Calculate week range (Monday to Sunday)
    const weekStart = startOfWeek(weekEndingDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekEndingDate, { weekStartsOn: 1 });

    // Fetch driver details
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    // Check if driver type is contractor or subcontractor
    if (driver.type === "Employee") {
      return NextResponse.json(
        {
          error: "RCTIs can only be created for contractors and subcontractors",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Get existing invoice numbers to generate unique number
    const existingRctis = await prisma.rcti.findMany({
      select: { invoiceNumber: true },
    });
    const invoiceNumber = generateInvoiceNumber(
      existingRctis.map((r) => r.invoiceNumber),
    );

    // Find eligible jobs for this driver and week
    const jobs = await prisma.jobs.findMany({
      where: {
        driver: driver.driver,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: { date: "asc" },
    });

    // Exclude jobs already attached to an RCTI line
    const existingLineJobIds = await prisma.rctiLine.findMany({
      select: { jobId: true },
    });
    const existingJobIdSet = new Set(existingLineJobIds.map((l) => l.jobId));

    const eligibleJobs = jobs.filter((job) => !existingJobIdSet.has(job.id));

    if (eligibleJobs.length === 0) {
      return NextResponse.json(
        {
          error: "No eligible jobs found for this driver and week",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Use provided driver info or fall back to driver record
    const finalDriverName = driverName || driver.driver;
    const finalDriverAddress = driverAddress || driver.address || null;
    const finalDriverAbn = driverAbn || driver.abn || null;
    const finalGstStatus = gstStatus || driver.gstStatus || "not_registered";
    const finalGstMode = gstMode || driver.gstMode || "exclusive";
    const finalBankAccountName =
      bankAccountName || driver.bankAccountName || null;
    const finalBankBsb = bankBsb || driver.bankBsb || null;
    const finalBankAccountNumber =
      bankAccountNumber || driver.bankAccountNumber || null;

    // Create RCTI lines from eligible jobs
    const lineData = eligibleJobs.map((job) => {
      const chargedHours = job.chargedHours || 0;
      const ratePerHour =
        job.driverCharge ||
        getDriverRateForTruckType({
          truckType: job.truckType,
          tray: driver.tray,
          crane: driver.crane,
          semi: driver.semi,
          semiCrane: driver.semiCrane,
        }) ||
        0;

      const amounts = calculateLineAmounts({
        chargedHours,
        ratePerHour,
        gstStatus: finalGstStatus as "registered" | "not_registered",
        gstMode: finalGstMode as "exclusive" | "inclusive",
      });

      const description = job.dropoff
        ? `${job.pickup} → ${job.dropoff}`
        : job.jobReference || job.pickup;

      return {
        jobId: job.id,
        jobDate: job.date,
        customer: job.customer,
        truckType: job.truckType,
        description,
        chargedHours,
        ratePerHour,
        ...amounts,
      };
    });

    // Calculate totals
    const totals = calculateRctiTotals(lineData);

    // Create RCTI with lines in a transaction
    const rcti = await prisma.rcti.create({
      data: {
        driverId,
        driverName: finalDriverName,
        driverAddress: finalDriverAddress,
        driverAbn: finalDriverAbn,
        gstStatus: finalGstStatus,
        gstMode: finalGstMode,
        bankAccountName: finalBankAccountName,
        bankBsb: finalBankBsb,
        bankAccountNumber: finalBankAccountNumber,
        weekEnding: weekEndingDate,
        invoiceNumber,
        subtotal: totals.subtotal,
        gst: totals.gst,
        total: totals.total,
        status: "draft",
        notes: notes || null,
        lines: {
          create: lineData,
        },
      },
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    return NextResponse.json(rcti, {
      status: 201,
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error creating RCTI:", error);
    return NextResponse.json(
      { error: "Failed to create RCTI" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
