import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { toNumber } from "@/lib/utils/rcti-calculations";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

// GET /api/rcti-deductions/[id] - Get single deduction
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
    const deductionId = parseInt(id, 10);

    // Validate ID
    if (isNaN(deductionId) || !isFinite(deductionId)) {
      return NextResponse.json(
        { error: "Invalid deduction ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const deduction = await prisma.rctiDeduction.findUnique({
      where: { id: deductionId },
      include: {
        driver: {
          select: {
            id: true,
            driver: true,
            type: true,
          },
        },
        applications: {
          include: {
            rcti: {
              select: {
                id: true,
                invoiceNumber: true,
                weekEnding: true,
                status: true,
              },
            },
          },
          orderBy: {
            appliedAt: "desc",
          },
        },
      },
    });

    if (!deduction) {
      return NextResponse.json(
        { error: "Deduction not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    return NextResponse.json(deduction, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error fetching deduction:", error);
    return NextResponse.json(
      { error: "Failed to fetch deduction" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

// PATCH /api/rcti-deductions/[id] - Update deduction
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
    const deductionId = parseInt(id, 10);

    // Validate ID
    if (isNaN(deductionId) || !isFinite(deductionId)) {
      return NextResponse.json(
        { error: "Invalid deduction ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const body = await request.json();

    const deduction = await prisma.rctiDeduction.findUnique({
      where: { id: deductionId },
      include: {
        applications: true,
      },
    });

    if (!deduction) {
      return NextResponse.json(
        { error: "Deduction not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    // Only allow updates if no applications have been made yet
    if (deduction.applications.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot update deduction that has already been applied to RCTIs",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const {
      description,
      totalAmount,
      frequency,
      amountPerCycle,
      startDate,
      notes,
    } = body;

    const updateData: {
      description?: string;
      totalAmount?: number;
      amountRemaining?: number;
      frequency?: string;
      amountPerCycle?: number;
      startDate?: Date;
      notes?: string;
    } = {};

    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);

    if (totalAmount !== undefined) {
      if (totalAmount <= 0) {
        return NextResponse.json(
          { error: "Total amount must be greater than 0" },
          { status: 400, headers: rateLimitResult.headers },
        );
      }
      updateData.totalAmount = totalAmount;
      updateData.amountRemaining = totalAmount - toNumber(deduction.amountPaid);
    }

    if (frequency !== undefined) {
      if (!["once", "weekly", "fortnightly", "monthly"].includes(frequency)) {
        return NextResponse.json(
          {
            error:
              "Frequency must be 'once', 'weekly', 'fortnightly', or 'monthly'",
          },
          { status: 400, headers: rateLimitResult.headers },
        );
      }
      updateData.frequency = frequency;
    }

    if (amountPerCycle !== undefined) {
      if (amountPerCycle <= 0) {
        return NextResponse.json(
          { error: "Amount per cycle must be greater than 0" },
          { status: 400, headers: rateLimitResult.headers },
        );
      }
      updateData.amountPerCycle = amountPerCycle;
    }

    const updatedDeduction = await prisma.rctiDeduction.update({
      where: { id: deductionId },
      data: updateData,
      include: {
        driver: {
          select: {
            id: true,
            driver: true,
          },
        },
        applications: {
          include: {
            rcti: {
              select: {
                id: true,
                invoiceNumber: true,
                weekEnding: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedDeduction, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error updating deduction:", error);
    return NextResponse.json(
      { error: "Failed to update deduction" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

// DELETE /api/rcti-deductions/[id] - Delete or cancel deduction
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
    const deductionId = parseInt(id, 10);

    // Validate ID
    if (isNaN(deductionId) || !isFinite(deductionId)) {
      return NextResponse.json(
        { error: "Invalid deduction ID" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const deduction = await prisma.rctiDeduction.findUnique({
      where: { id: deductionId },
      include: {
        applications: true,
      },
    });

    if (!deduction) {
      return NextResponse.json(
        { error: "Deduction not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    // If no applications, can delete completely
    if (deduction.applications.length === 0) {
      await prisma.rctiDeduction.delete({
        where: { id: deductionId },
      });

      return NextResponse.json(
        { message: "Deduction deleted successfully" },
        { headers: rateLimitResult.headers },
      );
    }

    // If has applications, mark as cancelled
    const cancelledDeduction = await prisma.rctiDeduction.update({
      where: { id: deductionId },
      data: {
        status: "cancelled",
      },
    });

    return NextResponse.json(
      {
        message: "Deduction cancelled",
        deduction: cancelledDeduction,
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error("Error deleting deduction:", error);
    return NextResponse.json(
      { error: "Failed to delete deduction" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
