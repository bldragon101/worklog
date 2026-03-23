import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * POST /api/jobs-report/[id]/unfinalise
 * Revert a finalised Jobs Report back to draft
 */
export async function POST(
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

    if (report.status === "draft") {
      return NextResponse.json(
        { error: "Jobs Report is already in draft status" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const updatedReport = await prisma.jobsReport.update({
      where: { id: reportId },
      data: {
        status: "draft",
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
    console.error("Error unfinalising Jobs Report:", error);
    return NextResponse.json(
      { error: "Failed to unfinalise Jobs Report" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
