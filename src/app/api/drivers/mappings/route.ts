import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching driver mappings",
  handler: async () => {
    // Fetch drivers with their truck (registration) mappings
    const drivers = await prisma.driver.findMany({
      select: {
        driver: true,
        truck: true,
      },
      orderBy: {
        driver: "asc",
      },
    });

    // Create a mapping object where driver name maps to truck (registration) value
    const driverToTruck: Record<string, string> = {};
    drivers.forEach((d) => {
      driverToTruck[d.driver] = d.truck;
    });

    return NextResponse.json({
      driverToTruck,
    });
  },
});
