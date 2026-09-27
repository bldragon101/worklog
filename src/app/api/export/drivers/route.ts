import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * Matches the drivers table search, which filters on the full name: the query
 * can match the first name, the last name, or span both at any space, so
 * multi-word first and last names are covered.
 */
function buildDriverNameFilter({
  query,
}: {
  query: string;
}): Prisma.DriverWhereInput[] {
  const trimmed = query.trim();
  const filters: Prisma.DriverWhereInput[] = [
    { driver: { contains: trimmed, mode: "insensitive" } },
    { lastName: { contains: trimmed, mode: "insensitive" } },
  ];
  for (const [index, char] of [...trimmed].entries()) {
    if (char !== " " || index === 0) continue;
    const firstPart = trimmed.slice(0, index).trimEnd();
    const lastPart = trimmed.slice(index + 1).trimStart();
    if (!firstPart || !lastPart) continue;
    filters.push({
      driver: { endsWith: firstPart, mode: "insensitive" },
      lastName: { startsWith: lastPart, mode: "insensitive" },
    });
  }
  return filters;
}

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
      where.OR = buildDriverNameFilter({ query: driver });
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
      "Last Name",
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
      driver.lastName || "",
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
