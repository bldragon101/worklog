import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const optionalTime = z.preprocess(
  (val) => (val === "" || val === undefined ? null : val),
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm")
    .nullable(),
);

const manualJobsReportLineSchema = z.object({
  manualLine: z.object({
    jobDate: z.iso.date(),
    customer: z.string().trim().min(1),
    truckType: z.string().trim().min(1),
    startTime: optionalTime,
    finishTime: optionalTime,
    chargedHours: z
      .union([z.number(), z.string().trim().min(1).transform(Number)])
      .pipe(z.number().finite().nonnegative()),
  }),
});

/**
 * POST /api/jobs-report/[id]/lines
 * Add a manual line to a draft Jobs Report
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const role = await getUserRole(authResult.userId);
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin privileges required" },
      { status: 403, headers: rateLimitResult.headers },
    );
  }

  try {
    const { id } = await params;
    const reportId = parseInt(id, 10);

    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: "Invalid report ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const body = await request.json().catch(() => null);
    const validation = manualJobsReportLineSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Missing or invalid fields for manual line" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
      select: { id: true, status: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Can only add lines to draft Jobs Reports" },
        { status: 409, headers: rateLimitResult.headers },
      );
    }

    const { jobDate, customer, truckType, startTime, finishTime, chargedHours } =
      validation.data.manualLine;

    await prisma.jobsReportLine.create({
      data: {
        reportId,
        jobId: null,
        jobDate: new Date(`${jobDate}T00:00:00.000Z`),
        customer,
        truckType,
        startTime,
        finishTime,
        chargedHours,
        travelTimeHours: null,
        driverCharge: null,
      },
    });

    const updatedReport = await prisma.jobsReport.findUnique({
      where: { id: reportId },
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

    return NextResponse.json(updatedReport, {
      status: 201,
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error adding Jobs Report line:", error);
    return NextResponse.json(
      { error: "Failed to add manual line" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
