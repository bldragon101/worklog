import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { toNumber } from "@/lib/utils/rcti-calculations";
import { apiRoute, idParams } from "@/lib/api-route";

// GET /api/rcti-deductions/[id] - Get single deduction
export const GET = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid deduction ID" }),
  errorMessage: "Error fetching deduction",
  responseMessage: "Failed to fetch deduction",
  handler: async ({ params: { id: deductionId } }) => {
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
        { status: 404 },
      );
    }

    return NextResponse.json(deduction);
  },
});

// PATCH /api/rcti-deductions/[id] - Update deduction
export const PATCH = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid deduction ID" }),
  errorMessage: "Error updating deduction",
  responseMessage: "Failed to update deduction",
  handler: async ({ request, params: { id: deductionId } }) => {
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
        { status: 404 },
      );
    }

    // Prevent changing totalAmount if applications exist (would break tracking)
    // Allow changing description, frequency, amountPerCycle, startDate, notes

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

    if (startDate !== undefined) {
      const candidate = new Date(startDate);
      if (Number.isNaN(candidate.getTime())) {
        return NextResponse.json(
          { error: "Invalid startDate" },
          { status: 400 },
        );
      }
      updateData.startDate = candidate;
    }

    if (totalAmount !== undefined) {
      if (totalAmount <= 0) {
        return NextResponse.json(
          { error: "Total amount must be greater than 0" },
          { status: 400 },
        );
      }

      // Check if totalAmount is actually changing
      const currentTotal = toNumber(deduction.totalAmount);
      const isChanging = totalAmount !== currentTotal;

      // Don't allow changing totalAmount if applications exist
      if (isChanging && deduction.applications.length > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot change total amount after deduction has been applied to RCTIs",
          },
          { status: 400 },
        );
      }

      // Only update if value is actually changing
      if (isChanging) {
        updateData.totalAmount = totalAmount;
        updateData.amountRemaining =
          totalAmount - toNumber(deduction.amountPaid);
      }
    }

    if (frequency !== undefined) {
      if (!["once", "weekly", "fortnightly", "monthly"].includes(frequency)) {
        return NextResponse.json(
          {
            error:
              "Frequency must be 'once', 'weekly', 'fortnightly', or 'monthly'",
          },
          { status: 400 },
        );
      }
      updateData.frequency = frequency;
    }

    if (amountPerCycle !== undefined) {
      if (amountPerCycle <= 0) {
        return NextResponse.json(
          { error: "Amount per cycle must be greater than 0" },
          { status: 400 },
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

    return NextResponse.json(updatedDeduction);
  },
});

// DELETE /api/rcti-deductions/[id] - Delete or cancel deduction
export const DELETE = apiRoute({
  auth: requireRctiAccess,
  params: idParams({ message: "Invalid deduction ID" }),
  errorMessage: "Error deleting deduction",
  responseMessage: "Failed to delete deduction",
  handler: async ({ params: { id: deductionId } }) => {
    const deduction = await prisma.rctiDeduction.findUnique({
      where: { id: deductionId },
      include: {
        applications: true,
      },
    });

    if (!deduction) {
      return NextResponse.json(
        { error: "Deduction not found" },
        { status: 404 },
      );
    }

    // If no applications, can delete completely
    if (deduction.applications.length === 0) {
      await prisma.rctiDeduction.delete({
        where: { id: deductionId },
      });

      return NextResponse.json({ message: "Deduction deleted successfully" });
    }

    // If has applications, mark as cancelled
    const cancelledDeduction = await prisma.rctiDeduction.update({
      where: { id: deductionId },
      data: {
        status: "cancelled",
      },
    });

    return NextResponse.json({
      message: "Deduction cancelled",
      deduction: cancelledDeduction,
    });
  },
});
