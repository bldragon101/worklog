import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { rctiCreateSchema, rctiQuerySchema } from "@/lib/validation";
import { RctiStatus } from "@prisma/client";
import {
  calculateLineAmounts,
  calculateRctiTotals,
  calculateLunchBreakLines,
  generateInvoiceNumber,
  convertJobToRctiLine,
  toNumber,
} from "@/lib/utils/rcti-calculations";
import { startOfWeek, endOfWeek } from "date-fns";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

// Toll rates
const TOLL_RATE_EASTLINK = 18.5;
const TOLL_RATE_CITYLINK = 31;

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
      status?: RctiStatus;
    } = {};

    if (driverId) {
      const parsedDriverId = parseInt(driverId, 10);
      if (isNaN(parsedDriverId) || parsedDriverId <= 0) {
        return NextResponse.json(
          { error: "Invalid driverId - must be a positive integer" },
          { status: 400, headers: rateLimitResult.headers },
        );
      }
      where.driverId = parsedDriverId;
    }

    if (startDate || endDate) {
      where.weekEnding = {};
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (isNaN(startDateObj.getTime())) {
          return NextResponse.json(
            { error: "Invalid startDate" },
            { status: 400, headers: rateLimitResult.headers },
          );
        }
        where.weekEnding.gte = startDateObj;
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        if (isNaN(endDateObj.getTime())) {
          return NextResponse.json(
            { error: "Invalid endDate" },
            { status: 400, headers: rateLimitResult.headers },
          );
        }
        where.weekEnding.lte = endDateObj;
      }
    }

    if (status) {
      where.status = status as RctiStatus;
    }

    const rctis = await prisma.rcti.findMany({
      where,
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
        deductionApplications: {
          include: {
            deduction: {
              select: {
                id: true,
                type: true,
                description: true,
                frequency: true,
              },
            },
          },
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
      businessName,
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

    // Use provided driver info or fall back to driver record
    const finalDriverName = driverName || driver.driver;
    const finalBusinessName = businessName || driver.businessName || null;

    // Get existing invoice numbers to generate unique number
    const existingRctis = await prisma.rcti.findMany({
      select: { invoiceNumber: true },
    });
    const invoiceNumber = generateInvoiceNumber(
      existingRctis.map((r) => r.invoiceNumber),
      weekEndingDate,
      finalBusinessName || finalDriverName,
    );

    // Find eligible jobs for this driver and week
    // For subcontractors, match by registration (not driver name)
    const jobWhereClause: {
      driver?: string;
      registration?: string;
      date: { gte: Date; lte: Date };
    } = {
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
    };

    if (driver.type === "Subcontractor") {
      // For subcontractors, match jobs by registration = driver.truck
      jobWhereClause.registration = driver.truck;
    } else {
      // For contractors/employees, match by driver name
      jobWhereClause.driver = driver.driver;
    }

    const jobs = await prisma.jobs.findMany({
      where: jobWhereClause,
      orderBy: { date: "asc" },
    });

    // Exclude jobs already attached to an RCTI line
    const existingLineJobIds = await prisma.rctiLine.findMany({
      select: { jobId: true },
    });
    const existingJobIdSet = new Set(
      existingLineJobIds
        .map((l) => l.jobId)
        .filter((id): id is number => id !== null),
    );

    const eligibleJobs = jobs.filter((job) => !existingJobIdSet.has(job.id));

    if (eligibleJobs.length === 0) {
      return NextResponse.json(
        {
          error: "No eligible jobs found for this driver and week",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

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
      return convertJobToRctiLine({
        job,
        driver,
        gstStatus: finalGstStatus as "registered" | "not_registered",
        gstMode: finalGstMode as "exclusive" | "inclusive",
      });
    });

    // Calculate lunch break lines (grouped by truck type - Tray, Crane, Semi, etc.)
    const breakLines = calculateLunchBreakLines({
      lines: lineData.map((line) => ({
        jobId: line.jobId,
        truckType: line.truckType,
        chargedHours: line.chargedHours,
        ratePerHour: line.ratePerHour,
      })),
      driverBreakHours: driver.breaks,
      gstStatus: finalGstStatus as "registered" | "not_registered",
      gstMode: finalGstMode as "exclusive" | "inclusive",
    });

    // Convert break lines to RCTI line format
    const breakLineData = breakLines.map((breakLine) => ({
      jobId: null, // Break lines are not associated with specific jobs
      jobDate: weekEndingDate, // Use week ending date for break lines
      customer: "Break Deduction",
      truckType: breakLine.truckType,
      description: breakLine.description,
      chargedHours: -breakLine.totalBreakHours, // Negative hours
      ratePerHour: breakLine.ratePerHour,
      amountExGst: breakLine.amountExGst,
      gstAmount: breakLine.gstAmount,
      amountIncGst: breakLine.amountIncGst,
    }));

    // Calculate toll lines if driver has tolls enabled
    const tollLines = [];
    if (driver.tolls) {
      // Sum up all tolls from jobs
      const totalEastlink = eligibleJobs.reduce(
        (sum, job) => sum + (job.eastlink || 0),
        0,
      );
      const totalCitylink = eligibleJobs.reduce(
        (sum, job) => sum + (job.citylink || 0),
        0,
      );

      // Add Eastlink toll line if there are any Eastlink tolls
      if (totalEastlink > 0) {
        const eastlinkAmount = totalEastlink * TOLL_RATE_EASTLINK;
        const tollAmounts = calculateLineAmounts({
          chargedHours: 1, // Use 1 hour as a placeholder
          ratePerHour: eastlinkAmount, // Put the amount in the rate
          gstStatus: finalGstStatus as "registered" | "not_registered",
          gstMode: finalGstMode as "exclusive" | "inclusive",
        });

        tollLines.push({
          jobId: null,
          jobDate: weekEndingDate,
          customer: "Tolls",
          truckType: "Eastlink",
          description: `${totalEastlink} × $${TOLL_RATE_EASTLINK.toFixed(2)}`,
          chargedHours: totalEastlink,
          ratePerHour: TOLL_RATE_EASTLINK,
          amountExGst: tollAmounts.amountExGst,
          gstAmount: tollAmounts.gstAmount,
          amountIncGst: tollAmounts.amountIncGst,
        });
      }

      // Add CityLink toll line if there are any CityLink tolls
      if (totalCitylink > 0) {
        const citylinkAmount = totalCitylink * TOLL_RATE_CITYLINK;
        const tollAmounts = calculateLineAmounts({
          chargedHours: 1,
          ratePerHour: citylinkAmount,
          gstStatus: finalGstStatus as "registered" | "not_registered",
          gstMode: finalGstMode as "exclusive" | "inclusive",
        });

        tollLines.push({
          jobId: null,
          jobDate: weekEndingDate,
          customer: "Tolls",
          truckType: "CityLink",
          description: `${totalCitylink} × $${TOLL_RATE_CITYLINK.toFixed(2)}`,
          chargedHours: totalCitylink,
          ratePerHour: TOLL_RATE_CITYLINK,
          amountExGst: tollAmounts.amountExGst,
          gstAmount: tollAmounts.gstAmount,
          amountIncGst: tollAmounts.amountIncGst,
        });
      }
    }

    // Calculate fuel levy line if driver has fuel levy set
    const fuelLevyLines = [];
    if (driver.fuelLevy && driver.fuelLevy > 0) {
      // Calculate subtotal from job lines only (exclude breaks)
      const jobLinesSubtotal = lineData.reduce(
        (sum, line) => sum + toNumber(line.amountExGst),
        0,
      );

      // Calculate fuel levy as percentage of subtotal
      const fuelLevyAmount = (jobLinesSubtotal * driver.fuelLevy) / 100;
      const fuelLevyAmounts = calculateLineAmounts({
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        gstStatus: finalGstStatus as "registered" | "not_registered",
        gstMode: finalGstMode as "exclusive" | "inclusive",
      });

      fuelLevyLines.push({
        jobId: null,
        jobDate: weekEndingDate,
        customer: "Fuel Levy",
        truckType: `${driver.fuelLevy}%`,
        description: `${driver.fuelLevy}% of $${jobLinesSubtotal.toFixed(2)}`,
        chargedHours: 1,
        ratePerHour: fuelLevyAmount,
        amountExGst: fuelLevyAmounts.amountExGst,
        gstAmount: fuelLevyAmounts.gstAmount,
        amountIncGst: fuelLevyAmounts.amountIncGst,
      });
    }

    // Combine all lines: job lines, break lines, toll lines, fuel levy lines
    const allLines = [
      ...lineData,
      ...breakLineData,
      ...tollLines,
      ...fuelLevyLines,
    ];

    // Calculate totals from all lines
    const totals = calculateRctiTotals(allLines);

    // Create RCTI with lines in a transaction
    const rcti = await prisma.rcti.create({
      data: {
        driverId,
        driverName: finalDriverName,
        businessName: finalBusinessName,
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
          create: allLines,
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
