import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { prisma } from "@/lib/api-helpers";
import { Prisma } from "@/generated/prisma/client";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const driver = searchParams.get("driver");
    const type = searchParams.get("type");

    // Build where clause based on filters
    const where: Prisma.DriverWhereInput = {};

    if (driver) {
      where.driver = { contains: driver, mode: "insensitive" };
    }

    if (type) {
      where.type = type as "Employee" | "Contractor" | "Subcontractor";
    }

    const drivers = await prisma.driver.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Convert to CSV format
    const csvHeaders = [
      "Driver",
      "Truck",
      "Tray Rate",
      "Crane Rate",
      "Semi Rate",
      "Semi Crane Rate",
      "Breaks (hours)",
      "Type",
      "Tolls",
      "Fuel Levy (%)",
      "Created At",
      "Updated At",
    ];

    const csvRows = drivers.map((driver) => [
      driver.driver,
      driver.truck,
      driver.tray || "",
      driver.crane || "",
      driver.semi || "",
      driver.semiCrane || "",
      driver.breaks || "",
      driver.type,
      driver.tolls ? "Yes" : "No",
      driver.fuelLevy || "",
      driver.createdAt.toISOString(),
      driver.updatedAt.toISOString(),
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `drivers_export_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...rateLimitResult.headers,
      },
    });
  } catch (error) {
    console.error("Error exporting drivers:", error);
    return NextResponse.json(
      { error: "Failed to export drivers" },
      { status: 500 },
    );
  }
}
