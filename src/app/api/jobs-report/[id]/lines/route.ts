import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiRoute, idParams } from "@/lib/api-route";

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
export const POST = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error adding Jobs Report line",
  responseMessage: "Failed to add manual line",
  handler: async ({ request, params: { id: reportId } }) => {
    const body = await request.json().catch(() => null);
    const validation = manualJobsReportLineSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Missing or invalid fields for manual line" },
        { status: 400 },
      );
    }

    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
      select: { id: true, status: true },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404 },
      );
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Can only add lines to draft Jobs Reports" },
        { status: 409 },
      );
    }

    const {
      jobDate,
      customer,
      truckType,
      startTime,
      finishTime,
      chargedHours,
    } = validation.data.manualLine;

    const added = await prisma.$transaction(async (tx) => {
      const draftGuard = await tx.jobsReport.updateMany({
        where: { id: reportId, status: "draft" },
        data: { updatedAt: new Date() },
      });
      if (draftGuard.count === 0) return false;

      await tx.jobsReportLine.create({
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
      return true;
    });

    if (!added) {
      return NextResponse.json(
        { error: "Can only add lines to draft Jobs Reports" },
        { status: 409 },
      );
    }

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
    });
  },
});
