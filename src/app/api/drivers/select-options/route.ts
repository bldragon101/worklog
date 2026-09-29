import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching driver select options",
  handler: async () => {
    // Fetch only the driver names for selects (exclude archived drivers)
    const drivers = await prisma.driver.findMany({
      select: {
        driver: true,
      },
      where: {
        isArchived: false,
      },
      orderBy: {
        driver: "asc",
      },
    });

    // Create unique array of driver names
    const driverOptions = drivers.map((d) => d.driver).sort();

    return NextResponse.json({
      driverOptions,
    });
  },
});
