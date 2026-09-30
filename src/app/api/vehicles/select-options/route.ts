import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching vehicle select options",
  handler: async () => {
    // Fetch only the fields needed for selects
    const vehicles = await prisma.vehicle.findMany({
      select: {
        registration: true,
        type: true,
      },
      orderBy: {
        registration: "asc",
      },
    });

    // Create unique arrays for each field
    const registrationOptions = vehicles.map((v) => v.registration).sort();
    const truckTypeOptions = [...new Set(vehicles.map((v) => v.type))].sort();

    return NextResponse.json({
      registrationOptions,
      truckTypeOptions,
    });
  },
});
