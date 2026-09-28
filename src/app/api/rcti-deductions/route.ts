import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import type { DeductionStatus } from "@/lib/types";
import { apiRoute } from "@/lib/api-route";

// GET /api/rcti-deductions - List deductions with optional filters
export const GET = apiRoute({
  auth: requireRctiAccess,
  errorMessage: "Error fetching deductions",
  responseMessage: "Failed to fetch deductions",
  handler: async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const where: {
      driverId?: number;
      status?: DeductionStatus;
      type?: string;
    } = {};

    // Validate driverId if provided
    if (driverId) {
      if (!/^\d+$/.test(driverId)) {
        return NextResponse.json(
          { error: "Invalid driverId - must be a valid integer" },
          { status: 400 },
        );
      }
      where.driverId = parseInt(driverId, 10);
    }

    // Default to active deductions only (exclude cancelled)
    if (status) {
      where.status = status as DeductionStatus;
    } else {
      where.status = "active";
    }

    if (type) where.type = type;

    const deductions = await prisma.rctiDeduction.findMany({
      where,
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
          orderBy: {
            appliedAt: "desc",
          },
        },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    });

    return NextResponse.json(deductions);
  },
});

// POST /api/rcti-deductions - Create new deduction
export const POST = apiRoute({
  auth: requireRctiAccess,
  errorMessage: "Error creating deduction",
  responseMessage: "Failed to create deduction",
  handler: async ({ request }) => {
    const body = await request.json();
    const {
      driverId: rawDriverId,
      type,
      description,
      totalAmount,
      frequency,
      amountPerCycle,
      startDate,
      notes,
    } = body;

    // Validation: Check required fields
    if (!rawDriverId || !type || !description || !totalAmount || !frequency) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate and coerce driverId to integer
    const driverId = Number(rawDriverId);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return NextResponse.json(
        { error: "Invalid driverId - must be a positive integer" },
        { status: 400 },
      );
    }

    // Validate startDate if provided
    let parsedStartDate: Date | null = null;
    if (startDate) {
      const candidate = new Date(startDate);
      if (Number.isNaN(candidate.getTime())) {
        return NextResponse.json(
          { error: "Invalid startDate" },
          { status: 400 },
        );
      }
      parsedStartDate = candidate;
    }

    if (!["deduction", "reimbursement"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'deduction' or 'reimbursement'" },
        { status: 400 },
      );
    }

    if (!["once", "weekly", "fortnightly", "monthly"].includes(frequency)) {
      return NextResponse.json(
        {
          error:
            "Frequency must be 'once', 'weekly', 'fortnightly', or 'monthly'",
        },
        { status: 400 },
      );
    }

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "Total amount must be greater than 0" },
        { status: 400 },
      );
    }

    if (frequency !== "once" && (!amountPerCycle || amountPerCycle <= 0)) {
      return NextResponse.json(
        { error: "Amount per cycle required for recurring deductions" },
        { status: 400 },
      );
    }

    // Verify driver exists and is contractor/subcontractor
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    if (driver.type === "Employee") {
      return NextResponse.json(
        { error: "Deductions only apply to contractors and subcontractors" },
        { status: 400 },
      );
    }

    // Create deduction
    const deduction = await prisma.rctiDeduction.create({
      data: {
        driverId,
        type,
        description,
        totalAmount,
        amountPaid: 0,
        amountRemaining: totalAmount,
        frequency,
        amountPerCycle: frequency === "once" ? totalAmount : amountPerCycle,
        status: "active",
        startDate: parsedStartDate ?? new Date(),
        notes,
      },
      include: {
        driver: {
          select: {
            id: true,
            driver: true,
          },
        },
      },
    });

    return NextResponse.json(deduction, {
      status: 201,
    });
  },
});
