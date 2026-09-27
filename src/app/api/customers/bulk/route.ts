import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-logger";
import { customerBulkUpdateSchema } from "@/lib/validation";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * PATCH /api/customers/bulk
 * Update truck type rates, fuel levy and tolls across many customers. Admin only.
 */
export async function PATCH(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    for (const [key, value] of Object.entries(rateLimitResult.headers)) {
      authResult.headers.set(key, value);
    }
    return authResult;
  }

  const role = await getUserRole(authResult.userId);
  if (!role || role.toLowerCase() !== "admin") {
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
        { error: "Invalid request body" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const parseResult = customerBulkUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.issues[0]?.message ?? "Validation failed",
          details: parseResult.error.issues,
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const { updates } = parseResult.data;
    const customerIds = [...new Set(parseResult.data.customerIds)];

    const result = await prisma.$transaction(async (tx) => {
      const customersBefore = await tx.customer.findMany({
        where: { id: { in: customerIds } },
      });

      if (customersBefore.length !== customerIds.length) {
        return { missingCount: customerIds.length - customersBefore.length };
      }

      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: updates,
      });

      const customersAfter = await tx.customer.findMany({
        where: { id: { in: customerIds } },
      });

      return { customersBefore, customersAfter };
    });

    if ("missingCount" in result) {
      return NextResponse.json(
        {
          error: `${result.missingCount} of the selected customers no longer exist. Refresh and try again.`,
        },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    const changedFields = Object.keys(updates).join(", ");
    const afterById = new Map(result.customersAfter.map((c) => [c.id, c]));

    await Promise.all(
      result.customersBefore.map((before) =>
        logActivity({
          action: "UPDATE",
          tableName: "Customer",
          recordId: before.id.toString(),
          oldData: before,
          newData: afterById.get(before.id),
          description: `Bulk updated customer fields: ${changedFields}`,
          request,
        }),
      ),
    ).catch((error) => {
      console.error("Failed to log customer bulk update activities:", error);
    });

    return NextResponse.json(
      {
        success: true,
        updatedCount: result.customersAfter.length,
        customers: result.customersAfter,
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error(
      "Error bulk updating customers:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to update customers" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
