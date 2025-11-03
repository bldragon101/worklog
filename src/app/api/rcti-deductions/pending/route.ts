import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { getPendingDeductionsForDriver } from "@/lib/rcti-deductions";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * GET /api/rcti-deductions/pending
 * Get pending deductions that will be applied to the next RCTI
 * Query params:
 *   - driverId (required)
 *   - weekEnding (required) - ISO date string
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId");
    const weekEnding = searchParams.get("weekEnding");

    if (!driverId) {
      return NextResponse.json(
        { error: "Missing driverId parameter" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    if (!weekEnding) {
      return NextResponse.json(
        { error: "Missing weekEnding parameter" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const pending = await getPendingDeductionsForDriver({
      driverId: parseInt(driverId, 10),
      weekEnding: new Date(weekEnding),
    });

    const totalDeductions = pending
      .filter((d) => d.type === "deduction")
      .reduce((sum, d) => sum + d.amountToApply, 0);

    const totalReimbursements = pending
      .filter((d) => d.type === "reimbursement")
      .reduce((sum, d) => sum + d.amountToApply, 0);

    const netAdjustment = totalReimbursements - totalDeductions;

    return NextResponse.json(
      {
        pending,
        summary: {
          count: pending.length,
          totalDeductions,
          totalReimbursements,
          netAdjustment,
        },
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Error fetching pending deductions:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending deductions" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
