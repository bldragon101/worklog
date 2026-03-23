import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startOfWeek, endOfWeek } from "date-fns";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { JobsReportStatus } from "@/generated/prisma/client";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const MELBOURNE_TZ = "Australia/Melbourne";

function toMelbourneDateUTC({ date }: { date: Date }): Date {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(dateStr + "T00:00:00.000Z");
}

function toMelbourneTimeHHMM({ date }: { date: Date }): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

const jobsReportQuerySchema = z.object({
  driverId: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z
      .string()
      .regex(/^\d+$/, "Driver ID must be a number")
      .nullable()
      .optional(),
  ),
  startDate: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().nullable().optional(),
  ),
  endDate: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().nullable().optional(),
  ),
  status: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.enum(["draft", "finalised"]).nullable().optional(),
  ),
});

const jobsReportCreateSchema = z.object({
  driverId: z.number().int().positive(),
  weekEnding: z.string().min(1),
  notes: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().nullable().optional(),
  ),
});

function generateReportNumber({
  existingNumbers,
  weekEnding,
  driverName,
}: {
  existingNumbers: string[];
  weekEnding: Date;
  driverName: string;
}): string {
  const isoString = weekEnding.toISOString();
  const year = isoString.substring(0, 4);
  const month = isoString.substring(5, 7);
  const day = isoString.substring(8, 10);
  const dateStr = `${day}${month}${year}`;

  const safeName = driverName || "";
  const namePart = safeName
    .substring(0, 8)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const baseNumber = `JR-${dateStr}-${namePart}`;

  if (!existingNumbers.includes(baseNumber)) {
    return baseNumber;
  }

  let counter = 1;
  let candidateNumber = `${baseNumber}-${counter}`;
  while (existingNumbers.includes(candidateNumber)) {
    counter++;
    candidateNumber = `${baseNumber}-${counter}`;
  }

  return candidateNumber;
}

/**
 * GET /api/jobs-report
 * List Jobs Reports with optional filters
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

    const validation = jobsReportQuerySchema.safeParse(queryParams);
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
      status?: JobsReportStatus;
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
      where.status = status as JobsReportStatus;
    }

    const reports = await prisma.jobsReport.findMany({
      where,
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
      orderBy: { weekEnding: "desc" },
    });

    return NextResponse.json(reports, { headers: rateLimitResult.headers });
  } catch (error) {
    console.error("Error fetching Jobs Reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch Jobs Reports" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

/**
 * POST /api/jobs-report
 * Create a new draft Jobs Report
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const validation = jobsReportCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const { driverId, weekEnding, notes } = validation.data;

    const weekEndingDate = new Date(weekEnding);
    if (isNaN(weekEndingDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid weekEnding date" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    // Calculate week range (Monday to Sunday)
    const weekStart = startOfWeek(weekEndingDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekEndingDate, { weekStartsOn: 1 });

    // Fetch jobs for the driver and week
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
      // For employees and contractors, match by driver name
      jobWhereClause.driver = driver.driver;
    }

    const jobs = await prisma.jobs.findMany({
      where: jobWhereClause,
      orderBy: { date: "asc" },
    });

    // Generate unique report number
    const existingReports = await prisma.jobsReport.findMany({
      select: { reportNumber: true },
    });

    const reportNumber = generateReportNumber({
      existingNumbers: existingReports.map((r) => r.reportNumber),
      weekEnding: weekEndingDate,
      driverName: driver.driver,
    });

    // Build report lines from jobs
    const lineData = jobs.map((job) => ({
      jobId: job.id,
      jobDate: toMelbourneDateUTC({ date: job.date }),
      customer: job.customer,
      truckType: job.truckType,
      description: job.comments ?? null,
      startTime: job.startTime
        ? toMelbourneTimeHHMM({ date: job.startTime })
        : null,
      finishTime: job.finishTime
        ? toMelbourneTimeHHMM({ date: job.finishTime })
        : null,
      chargedHours: job.chargedHours ?? null,
      driverCharge: job.driverCharge ?? null,
    }));

    // Create report with lines (empty lines allowed - unlike RCTI)
    const report = await prisma.jobsReport.create({
      data: {
        driverId,
        driverName: driver.driver,
        weekEnding: weekEndingDate,
        reportNumber,
        status: "draft",
        notes: notes ?? null,
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

    return NextResponse.json(report, {
      status: 201,
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error creating Jobs Report:", error);
    return NextResponse.json(
      { error: "Failed to create Jobs Report" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
