import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { customerBulkUpdateSchema } from "@/lib/validation";
import { apiRoute } from "@/lib/api-route";

/**
 * PATCH /api/customers/bulk
 * Update truck type rates, fuel levy and tolls across many customers. Admin only.
 */
export const PATCH = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  errorMessage: "Error bulk updating customers",
  responseMessage: "Failed to update customers",
  handler: async ({ request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const parseResult = customerBulkUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.issues[0]?.message ?? "Validation failed",
          details: parseResult.error.issues,
        },
        { status: 400 },
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
        { status: 404 },
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

    return NextResponse.json({
      success: true,
      updatedCount: result.customersAfter.length,
      customers: result.customersAfter,
    });
  },
});
