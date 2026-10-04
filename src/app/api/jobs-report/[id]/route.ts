import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiRoute, idParams } from "@/lib/api-route";

const jobsReportPatchSchema = z.object({
  notes: z.preprocess(
    (val) => (val === null || val === "" ? null : val),
    z.string().nullable().optional(),
  ),
});

/**
 * GET /api/jobs-report/[id]
 * Get a single Jobs Report with lines
 */
export const GET = apiRoute({
  auth: { permission: "manage_jobs_report" },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error fetching Jobs Report",
  responseMessage: "Failed to fetch Jobs Report",
  handler: async ({ params: { id: reportId } }) => {
    const report = await prisma.jobsReport.findUnique({
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

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(report);
  },
});

/**
 * PATCH /api/jobs-report/[id]
 * Update notes on a draft Jobs Report
 */
export const PATCH = apiRoute({
  auth: { permission: "manage_jobs_report" },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error updating Jobs Report",
  responseMessage: "Failed to update Jobs Report",
  handler: async ({ request, params: { id: reportId } }) => {
    const body = await request.json();
    const validation = jobsReportPatchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400 },
      );
    }

    const updateResult = await prisma.jobsReport.updateMany({
      where: {
        id: reportId,
        status: "draft",
      },
      data: {
        notes: validation.data.notes ?? null,
      },
    });

    if (updateResult.count === 0) {
      const existingReport = await prisma.jobsReport.findUnique({
        where: { id: reportId },
        select: { id: true },
      });

      if (!existingReport) {
        return NextResponse.json(
          { error: "Jobs Report not found" },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { error: "Only draft Jobs Reports can be edited" },
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

    if (!updatedReport) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updatedReport);
  },
});

/**
 * DELETE /api/jobs-report/[id]
 * Delete a draft Jobs Report
 */
export const DELETE = apiRoute({
  auth: { permission: "manage_jobs_report" },
  params: idParams({ message: "Invalid report ID" }),
  errorMessage: "Error deleting Jobs Report",
  responseMessage: "Failed to delete Jobs Report",
  handler: async ({ params: { id: reportId } }) => {
    const deleteResult = await prisma.jobsReport.deleteMany({
      where: {
        id: reportId,
        status: "draft",
      },
    });

    if (deleteResult.count === 0) {
      const existingReport = await prisma.jobsReport.findUnique({
        where: { id: reportId },
        select: { id: true },
      });

      if (!existingReport) {
        return NextResponse.json(
          { error: "Jobs Report not found" },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { error: "Only draft Jobs Reports can be deleted" },
        { status: 409 },
      );
    }

    return NextResponse.json({ message: "Jobs Report deleted successfully" });
  },
});
