import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startOfWeek, endOfWeek } from "date-fns";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { JobsReportStatus, Prisma } from "@/generated/prisma/client";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const MELBOURNE_TZ = "Australia/Melbourne";
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toMelbourneDateUTC({ date }: { date: Date }): Date {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(dateStr + "T00:00:00.000Z");
}

function formatTimeUTC({ date }: { date: Date }): string {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
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
    z
      .string()
      .regex(DATE_ONLY_REGEX, "startDate must be in YYYY-MM-DD format")
      .nullable()
      .optional(),
  ),
  endDate: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z
      .string()
      .regex(DATE_ONLY_REGEX, "endDate must be in YYYY-MM-DD format")
      .nullable()
      .optional(),
  ),
  status: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.enum(["draft", "finalised"]).nullable().optional(),
  ),
});

const jobsReportCreateSchema = z.object({
  driverId: z.number().int().positive(),
  weekEnding: z
    .string()
    .regex(DATE_ONLY_REGEX, "weekEnding must be in YYYY-MM-DD format"),
  notes: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().nullable().optional(),
  ),
});

function parseDateOnlyString({
  dateString,
}: {
  dateString: string;
}): Date | null {
  const [yearString, monthString, dayString] = dateString.split("-");
  if (!yearString || !monthString || !dayString) {
    return null;
  }

  const year = parseInt(yearString, 10);
  const monthIndex = parseInt(monthString, 10) - 1;
  const day = parseInt(dayString, 10);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return null;
  }

  const parsedDate = new Date(year, monthIndex, day);
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== monthIndex ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}

function generateReportNumber({
  existingNumbers,
  weekEnding,
  driverName,
}: {
  existingNumbers: string[];
  weekEnding: Date;
  driverName: string;
}): string {
  const year = String(weekEnding.getFullYear());
  const month = String(weekEnding.getMonth() + 1).padStart(2, "0");
  const day = String(weekEnding.getDate()).padStart(2, "0");
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
  if (authResult instanceof NextResponse) {
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      authResult.headers.set(key, value);
    });
    return authResult;
  }

  const role = await getUserRole(authResult.userId);
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin privileges required" },
      { status: 403, headers: rateLimitResult.headers },
    );
  }

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
        const startDateObj = parseDateOnlyString({ dateString: startDate });
        if (!startDateObj) {
          return NextResponse.json(
            { error: "Invalid startDate. Expected format YYYY-MM-DD." },
            { status: 400, headers: rateLimitResult.headers },
          );
        }
        where.weekEnding.gte = startDateObj;
      }
      if (endDate) {
        const endDateObj = parseDateOnlyString({ dateString: endDate });
        if (!endDateObj) {
          return NextResponse.json(
            { error: "Invalid endDate. Expected format YYYY-MM-DD." },
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
        driver: {
          select: {
            id: true,
            driver: true,
            email: true,
          },
        },
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
  if (authResult instanceof NextResponse) {
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      authResult.headers.set(key, value);
    });
    return authResult;
  }

  const role = await getUserRole(authResult.userId);
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin privileges required" },
      { status: 403, headers: rateLimitResult.headers },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }
    const validation = jobsReportCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const { driverId, weekEnding, notes } = validation.data;

    const weekEndingDate = parseDateOnlyString({ dateString: weekEnding });
    if (!weekEndingDate) {
      return NextResponse.json(
        { error: "Invalid weekEnding. Expected format YYYY-MM-DD." },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const canonicalWeekEnding = endOfWeek(weekEndingDate, { weekStartsOn: 1 });

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    const existingReportForDriverWeek = await prisma.jobsReport.findFirst({
      where: {
        driverId,
        weekEnding: canonicalWeekEnding,
      },
      include: {
        driver: {
          select: {
            id: true,
            driver: true,
            email: true,
          },
        },
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    if (existingReportForDriverWeek) {
      return NextResponse.json(
        {
          error: "A Jobs Report already exists for this driver and week",
          report: existingReportForDriverWeek,
        },
        { status: 409, headers: rateLimitResult.headers },
      );
    }

    // Calculate week range (Monday to Sunday)
    const weekStart = startOfWeek(canonicalWeekEnding, { weekStartsOn: 1 });
    const weekEnd = canonicalWeekEnding;

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
      weekEnding: canonicalWeekEnding,
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
        ? formatTimeUTC({ date: job.startTime })
        : null,
      finishTime: job.finishTime
        ? formatTimeUTC({ date: job.finishTime })
        : null,
      chargedHours: job.chargedHours ?? null,
      driverCharge: job.driverCharge ?? null,
    }));

    // Create report with lines (empty lines allowed - unlike RCTI)
    try {
      const report = await prisma.jobsReport.create({
        data: {
          driverId,
          driverName: driver.driver,
          weekEnding: canonicalWeekEnding,
          reportNumber,
          status: "draft",
          notes: notes ?? null,
          lines: {
            create: lineData,
          },
        },
        include: {
          driver: {
            select: {
              id: true,
              driver: true,
              email: true,
            },
          },
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingReport = await prisma.jobsReport.findFirst({
          where: {
            driverId,
            weekEnding: canonicalWeekEnding,
          },
          include: {
            driver: {
              select: {
                id: true,
                driver: true,
                email: true,
              },
            },
            lines: {
              orderBy: { jobDate: "asc" },
            },
          },
        });

        return NextResponse.json(
          {
            error: "A Jobs Report already exists for this driver and week",
            report: existingReport,
          },
          { status: 409, headers: rateLimitResult.headers },
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("Error creating Jobs Report:", error);
    return NextResponse.json(
      { error: "Failed to create Jobs Report" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
