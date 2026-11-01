import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tollRateSettingsSchema } from "@/lib/validation";
import { apiRoute } from "@/lib/api-route";
import { DEFAULT_TOLL_RATES } from "@/lib/utils/toll-rates";

const tollRateSelect = { tollEastlinkRate: true, tollCitylinkRate: true } as const;

/**
 * GET /api/admin/toll-rate-settings
 * Get the Eastlink and CityLink rates per crossing. Available to all signed-in
 * users so the jobs stats can show toll totals. `companySettingsConfigured` is
 * false until company details are saved, which is required before the rates
 * can be changed.
 */
export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching toll rate settings",
  responseMessage: "Failed to fetch toll rate settings",
  logErrorMessageOnly: true,
  handler: async () => {
    const settings = await prisma.companySettings.findFirst({
      select: tollRateSelect,
    });

    if (!settings) {
      return NextResponse.json({
        ...DEFAULT_TOLL_RATES,
        companySettingsConfigured: false,
      });
    }

    return NextResponse.json({
      eastlink: Number(settings.tollEastlinkRate),
      citylink: Number(settings.tollCitylinkRate),
      companySettingsConfigured: true,
    });
  },
});

/**
 * PATCH /api/admin/toll-rate-settings
 * Update the Eastlink and CityLink rates per crossing. Admin only. Applies to
 * new and refreshed RCTIs; finalised RCTIs keep the amounts they were
 * created with.
 */
export const PATCH = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  errorMessage: "Error updating toll rate settings",
  responseMessage: "Failed to update toll rate settings",
  logErrorMessageOnly: true,
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

    const parseResult = tollRateSettingsSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400 },
      );
    }

    const { eastlink, citylink } = parseResult.data;

    const existingSettings = await prisma.companySettings.findFirst({
      select: { id: true },
    });

    if (!existingSettings) {
      return NextResponse.json(
        {
          error:
            "Company settings must be configured before updating toll rates. Please set up company details first.",
        },
        { status: 400 },
      );
    }

    const settings = await prisma.companySettings.update({
      where: { id: existingSettings.id },
      data: { tollEastlinkRate: eastlink, tollCitylinkRate: citylink },
      select: tollRateSelect,
    });

    return NextResponse.json({
      eastlink: Number(settings.tollEastlinkRate),
      citylink: Number(settings.tollCitylinkRate),
      companySettingsConfigured: true,
    });
  },
});
