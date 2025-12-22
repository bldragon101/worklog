import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
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
    const registration = searchParams.get("registration");
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const type = searchParams.get("type");

    // Build where clause based on filters
    const where: Prisma.VehicleWhereInput = {};

    if (registration) {
      where.registration = { contains: registration, mode: "insensitive" };
    }

    if (make) {
      where.make = { contains: make, mode: "insensitive" };
    }

    if (model) {
      where.model = { contains: model, mode: "insensitive" };
    }

    if (type) {
      where.type = { contains: type, mode: "insensitive" };
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Convert to CSV format
    const csvHeaders = [
      "Registration",
      "Expiry Date",
      "Make",
      "Model",
      "Year of Manufacture",
      "Type",
      "Carrying Capacity",
      "Tray Length",
      "Crane Reach",
      "Crane Type",
      "Crane Capacity",
      "Created At",
      "Updated At",
    ];

    const csvRows = vehicles.map((vehicle) => [
      vehicle.registration,
      vehicle.expiryDate
        ? new Date(vehicle.expiryDate).toISOString().split("T")[0]
        : "",
      vehicle.make,
      vehicle.model,
      vehicle.yearOfManufacture.toString(),
      vehicle.type,
      vehicle.carryingCapacity || "",
      vehicle.trayLength || "",
      vehicle.craneReach || "",
      vehicle.craneType || "",
      vehicle.craneCapacity || "",
      new Date(vehicle.createdAt).toISOString(),
      new Date(vehicle.updatedAt).toISOString(),
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `vehicles_export_${timestamp}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...rateLimitResult.headers,
      },
    });
  } catch (error) {
    console.error("Error exporting vehicles:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
