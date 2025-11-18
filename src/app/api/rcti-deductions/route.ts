import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import type { DeductionStatus } from "@/lib/types";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

// GET /api/rcti-deductions - List deductions with optional filters
export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
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
          { status: 400, headers: rateLimitResult.headers },
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

    return NextResponse.json(deductions, {
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error fetching deductions:", error);
    return NextResponse.json(
      { error: "Failed to fetch deductions" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

// POST /api/rcti-deductions - Create new deduction
export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
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
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Validate and coerce driverId to integer
    const driverId = Number(rawDriverId);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return NextResponse.json(
        { error: "Invalid driverId - must be a positive integer" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Validate startDate if provided
    let parsedStartDate: Date | null = null;
    if (startDate) {
      const candidate = new Date(startDate);
      if (Number.isNaN(candidate.getTime())) {
        return NextResponse.json(
          { error: "Invalid startDate" },
          { status: 400, headers: rateLimitResult.headers },
        );
      }
      parsedStartDate = candidate;
    }

    if (!["deduction", "reimbursement"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'deduction' or 'reimbursement'" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    if (!["once", "weekly", "fortnightly", "monthly"].includes(frequency)) {
      return NextResponse.json(
        {
          error:
            "Frequency must be 'once', 'weekly', 'fortnightly', or 'monthly'",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "Total amount must be greater than 0" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    if (frequency !== "once" && (!amountPerCycle || amountPerCycle <= 0)) {
      return NextResponse.json(
        { error: "Amount per cycle required for recurring deductions" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Verify driver exists and is contractor/subcontractor
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404, headers: rateLimitResult.headers },
      );
    }

    if (driver.type === "Employee") {
      return NextResponse.json(
        { error: "Deductions only apply to contractors and subcontractors" },
        { status: 400, headers: rateLimitResult.headers },
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
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error creating deduction:", error);
    return NextResponse.json(
      { error: "Failed to create deduction" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
