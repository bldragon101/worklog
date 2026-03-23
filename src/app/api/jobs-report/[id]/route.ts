import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const reportId = parseInt(id, 10);

    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: "Invalid report ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    return NextResponse.json(report, { headers: rateLimitResult.headers });
  } catch (error) {
    console.error("Error fetching Jobs Report:", error);
    return NextResponse.json(
      { error: "Failed to fetch Jobs Report" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

/**
 * PATCH /api/jobs-report/[id]
 * Update notes on a draft Jobs Report
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const reportId = parseInt(id, 10);

    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: "Invalid report ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const body = await request.json();
    const validation = jobsReportPatchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft Jobs Reports can be edited" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const updatedReport = await prisma.jobsReport.update({
      where: { id: reportId },
      data: {
        notes: validation.data.notes ?? null,
      },
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    return NextResponse.json(updatedReport, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error updating Jobs Report:", error);
    return NextResponse.json(
      { error: "Failed to update Jobs Report" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

/**
 * DELETE /api/jobs-report/[id]
 * Delete a draft Jobs Report
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const reportId = parseInt(id, 10);

    if (isNaN(reportId)) {
      return NextResponse.json(
        { error: "Invalid report ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const report = await prisma.jobsReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Jobs Report not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft Jobs Reports can be deleted" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    await prisma.jobsReport.delete({
      where: { id: reportId },
    });

    return NextResponse.json(
      { message: "Jobs Report deleted successfully" },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Error deleting Jobs Report:", error);
    return NextResponse.json(
      { error: "Failed to delete Jobs Report" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
