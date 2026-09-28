import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching vehicle mappings",
  handler: async () => {
    // Fetch vehicles with their registration to truck type mappings
    const vehicles = await prisma.vehicle.findMany({
      select: {
        registration: true,
        type: true,
      },
      orderBy: {
        registration: "asc",
      },
    });

    // Create a mapping object where registration maps to truck type
    const registrationToType: Record<string, string> = {};
    vehicles.forEach((v) => {
      registrationToType[v.registration] = v.type;
    });

    return NextResponse.json({
      registrationToType,
    });
  },
});
