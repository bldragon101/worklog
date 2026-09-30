import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { apiRoute } from "@/lib/api-route";

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
  for (const { index } of trimmed.matchAll(/ /g)) {
    const firstPart = trimmed.slice(0, index);
    const lastPart = trimmed.slice(index + 1);
    if (!firstPart || !lastPart) continue;
    filters.push({
      driver: { endsWith: firstPart, mode: "insensitive" },
      lastName: { startsWith: lastPart, mode: "insensitive" },
    });
  }
  return filters;
}

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error exporting drivers",
  responseMessage: "Failed to export drivers",
  handler: async ({ request }) => {
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
      },
    });
  },
});
