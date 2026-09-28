import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fuelLevyValueSchema } from "@/lib/validation";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";

const FuelLevySettingsSchema = z.object({
  defaultFuelLevy: fuelLevyValueSchema.nullable(),
});

/**
 * GET /api/admin/fuel-levy-settings
 * Get the default fuel levy percentage. Available to all signed-in users so
 * it can be shown in the sidebar and used to prefill new customers.
 * `companySettingsConfigured` is false until company details are saved, which
 * is required before the default can be changed.
 */
export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching fuel levy settings",
  responseMessage: "Failed to fetch fuel levy settings",
  handler: async () => {
    const settings = await prisma.companySettings.findFirst({
      select: { defaultFuelLevy: true },
    });

    return NextResponse.json({
      defaultFuelLevy: settings?.defaultFuelLevy ?? null,
      companySettingsConfigured: settings !== null,
    });
  },
});

/**
 * PATCH /api/admin/fuel-levy-settings
 * Update the default fuel levy percentage. Admin only.
 */
export const PATCH = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  errorMessage: "Error updating fuel levy settings",
  responseMessage: "Failed to update fuel levy settings",
  handler: async ({ request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const parseResult = FuelLevySettingsSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400 },
      );
    }

    const { defaultFuelLevy } = parseResult.data;

    const existingSettings = await prisma.companySettings.findFirst();

    if (!existingSettings) {
      return NextResponse.json(
        {
          error:
            "Company settings must be configured before updating the default fuel levy. Please set up company details first.",
        },
        { status: 400 },
      );
    }

    const settings = await prisma.companySettings.update({
      where: { id: existingSettings.id },
      data: { defaultFuelLevy },
      select: { defaultFuelLevy: true },
    });

    return NextResponse.json({ ...settings, companySettingsConfigured: true });
  },
});
