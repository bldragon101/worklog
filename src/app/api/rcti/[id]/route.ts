import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { rctiUpdateSchema, rctiLineUpdateSchema } from "@/lib/validation";
import {
  calculateLineAmounts,
  calculateRctiTotals,
} from "@/lib/utils/rcti-calculations";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * GET /api/rcti/[id]
 * Get a single RCTI with lines
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
    const rctiId = parseInt(id, 10);

    if (isNaN(rctiId)) {
      return NextResponse.json(
        { error: "Invalid RCTI ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    return NextResponse.json(rcti, { headers: rateLimitResult.headers });
  } catch (error) {
    console.error("Error fetching RCTI:", error);
    return NextResponse.json(
      { error: "Failed to fetch RCTI" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

/**
 * PATCH /api/rcti/[id]
 * Update RCTI details, status, or lines
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
    const rctiId = parseInt(id, 10);

    if (isNaN(rctiId)) {
      return NextResponse.json(
        { error: "Invalid RCTI ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const body = await request.json();

    // Check if updating lines
    if (body.lines && Array.isArray(body.lines)) {
      // Validate RCTI exists and is not finalised/paid
      const rcti = await prisma.rcti.findUnique({
        where: { id: rctiId },
        include: { lines: true },
      });

      if (!rcti) {
        return NextResponse.json(
          { error: "RCTI not found" },
          { status: 404, headers: rateLimitResult.headers },
        );
      }

      if (rcti.status !== "draft") {
        return NextResponse.json(
          { error: "Cannot update lines of a finalised or paid RCTI" },
          { status: 400, headers: rateLimitResult.headers },
        );
      }

      // Update each line
      const updatedLines = [];
      for (const lineUpdate of body.lines) {
        if (!lineUpdate.id) continue;

        const validation = rctiLineUpdateSchema.safeParse(lineUpdate);
        if (!validation.success) {
          return NextResponse.json(
            {
              error: "Invalid line data",
              details: validation.error,
              lineId: lineUpdate.id,
            },
            { status: 400, headers: rateLimitResult.headers },
          );
        }

        const existingLine = await prisma.rctiLine.findUnique({
          where: { id: lineUpdate.id },
        });

        if (!existingLine || existingLine.rctiId !== rctiId) {
          continue;
        }

        const chargedHours =
          validation.data.chargedHours ?? existingLine.chargedHours;
        const ratePerHour =
          validation.data.ratePerHour ?? existingLine.ratePerHour;
        const jobDate = validation.data.jobDate
          ? new Date(validation.data.jobDate)
          : existingLine.jobDate;
        const customer = validation.data.customer ?? existingLine.customer;
        const truckType = validation.data.truckType ?? existingLine.truckType;
        const description =
          validation.data.description ?? existingLine.description;

        const amounts = calculateLineAmounts({
          chargedHours,
          ratePerHour,
          gstStatus: rcti.gstStatus as "registered" | "not_registered",
          gstMode: rcti.gstMode as "exclusive" | "inclusive",
        });

        const updatedLine = await prisma.rctiLine.update({
          where: { id: lineUpdate.id },
          data: {
            chargedHours,
            ratePerHour,
            jobDate,
            customer,
            truckType,
            description,
            ...amounts,
          },
        });

        updatedLines.push(updatedLine);
      }

      // Recalculate totals
      const allLines = await prisma.rctiLine.findMany({
        where: { rctiId },
      });

      const totals = calculateRctiTotals(allLines);

      const updatedRcti = await prisma.rcti.update({
        where: { id: rctiId },
        data: {
          subtotal: totals.subtotal,
          gst: totals.gst,
          total: totals.total,
        },
        include: {
          driver: true,
          lines: {
            orderBy: { jobDate: "asc" },
          },
        },
      });

      return NextResponse.json(updatedRcti, {
        headers: rateLimitResult.headers,
      });
    }

    // Update RCTI metadata (not lines)
    const validation = rctiUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: { lines: true },
    });

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    // If changing status, validate transitions
    if (validation.data.status) {
      const currentStatus = rcti.status;
      const newStatus = validation.data.status;

      if (currentStatus === "paid" && newStatus !== "paid") {
        return NextResponse.json(
          { error: "Cannot change status of a paid RCTI" },
          { status: 400, headers: rateLimitResult.headers },
        );
      }

      if (
        currentStatus === "finalised" &&
        newStatus === "draft" &&
        rcti.paidAt
      ) {
        return NextResponse.json(
          { error: "Cannot revert to draft after payment" },
          { status: 400, headers: rateLimitResult.headers },
        );
      }
    }

    // If changing GST status/mode and RCTI is draft, recalculate lines
    if (
      rcti.status === "draft" &&
      (validation.data.gstStatus || validation.data.gstMode)
    ) {
      const newGstStatus = validation.data.gstStatus || rcti.gstStatus;
      const newGstMode = validation.data.gstMode || rcti.gstMode;

      // Recalculate all lines
      for (const line of rcti.lines) {
        const amounts = calculateLineAmounts({
          chargedHours: line.chargedHours,
          ratePerHour: line.ratePerHour,
          gstStatus: newGstStatus as "registered" | "not_registered",
          gstMode: newGstMode as "exclusive" | "inclusive",
        });

        await prisma.rctiLine.update({
          where: { id: line.id },
          data: amounts,
        });
      }

      // Recalculate totals
      const updatedLines = await prisma.rctiLine.findMany({
        where: { rctiId },
      });

      const totals = calculateRctiTotals(updatedLines);

      const updateData: Record<string, unknown> = {
        subtotal: totals.subtotal,
        gst: totals.gst,
        total: totals.total,
      };

      if (validation.data.driverName !== undefined) {
        updateData.driverName = validation.data.driverName;
      }
      if (validation.data.driverAddress !== undefined) {
        updateData.driverAddress = validation.data.driverAddress;
      }
      if (validation.data.driverAbn !== undefined) {
        updateData.driverAbn = validation.data.driverAbn;
      }
      if (validation.data.gstStatus !== undefined) {
        updateData.gstStatus = validation.data.gstStatus;
      }
      if (validation.data.gstMode !== undefined) {
        updateData.gstMode = validation.data.gstMode;
      }
      if (validation.data.bankAccountName !== undefined) {
        updateData.bankAccountName = validation.data.bankAccountName;
      }
      if (validation.data.bankBsb !== undefined) {
        updateData.bankBsb = validation.data.bankBsb;
      }
      if (validation.data.bankAccountNumber !== undefined) {
        updateData.bankAccountNumber = validation.data.bankAccountNumber;
      }
      if (validation.data.notes !== undefined) {
        updateData.notes = validation.data.notes;
      }
      if (validation.data.status !== undefined) {
        updateData.status = validation.data.status;
      }

      const updatedRcti = await prisma.rcti.update({
        where: { id: rctiId },
        data: updateData,
        include: {
          driver: true,
          lines: {
            orderBy: { jobDate: "asc" },
          },
        },
      });

      return NextResponse.json(updatedRcti, {
        headers: rateLimitResult.headers,
      });
    }

    // Simple update without recalculation
    const updateData: Record<string, unknown> = {};

    if (validation.data.driverName !== undefined) {
      updateData.driverName = validation.data.driverName;
    }
    if (validation.data.driverAddress !== undefined) {
      updateData.driverAddress = validation.data.driverAddress;
    }
    if (validation.data.driverAbn !== undefined) {
      updateData.driverAbn = validation.data.driverAbn;
    }
    if (validation.data.gstStatus !== undefined) {
      updateData.gstStatus = validation.data.gstStatus;
    }
    if (validation.data.gstMode !== undefined) {
      updateData.gstMode = validation.data.gstMode;
    }
    if (validation.data.bankAccountName !== undefined) {
      updateData.bankAccountName = validation.data.bankAccountName;
    }
    if (validation.data.bankBsb !== undefined) {
      updateData.bankBsb = validation.data.bankBsb;
    }
    if (validation.data.bankAccountNumber !== undefined) {
      updateData.bankAccountNumber = validation.data.bankAccountNumber;
    }
    if (validation.data.notes !== undefined) {
      updateData.notes = validation.data.notes;
    }
    if (validation.data.status !== undefined) {
      updateData.status = validation.data.status;
    }

    const updatedRcti = await prisma.rcti.update({
      where: { id: rctiId },
      data: updateData,
      include: {
        driver: true,
        lines: {
          orderBy: { jobDate: "asc" },
        },
      },
    });

    return NextResponse.json(updatedRcti, { headers: rateLimitResult.headers });
  } catch (error) {
    console.error("Error updating RCTI:", error);
    return NextResponse.json(
      { error: "Failed to update RCTI" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

/**
 * DELETE /api/rcti/[id]
 * Delete a draft RCTI
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
    const rctiId = parseInt(id, 10);

    if (isNaN(rctiId)) {
      return NextResponse.json(
        { error: "Invalid RCTI ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
    });

    if (!rcti) {
      return NextResponse.json(
        { error: "RCTI not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (rcti.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft RCTIs can be deleted" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    await prisma.rcti.delete({
      where: { id: rctiId },
    });

    return NextResponse.json(
      { message: "RCTI deleted successfully" },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Error deleting RCTI:", error);
    return NextResponse.json(
      { error: "Failed to delete RCTI" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
