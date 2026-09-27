import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { fuelLevyValueSchema } from "@/lib/validation";
import { z } from "zod";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

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
export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    for (const [key, value] of Object.entries(rateLimitResult.headers)) {
      authResult.headers.set(key, value);
    }
    return authResult;
  }

  try {
    const settings = await prisma.companySettings.findFirst({
      select: { defaultFuelLevy: true },
    });

    return NextResponse.json(
      {
        defaultFuelLevy: settings?.defaultFuelLevy ?? null,
        companySettingsConfigured: settings !== null,
      },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error(
      "Error fetching fuel levy settings:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to fetch fuel levy settings" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

/**
 * PATCH /api/admin/fuel-levy-settings
 * Update the default fuel levy percentage. Admin only.
 */
export async function PATCH(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    for (const [key, value] of Object.entries(rateLimitResult.headers)) {
      authResult.headers.set(key, value);
    }
    return authResult;
  }

  const role = await getUserRole(authResult.userId);
  if (!role || role.toLowerCase() !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin privileges required" },
      { status: 403, headers: rateLimitResult.headers },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const parseResult = FuelLevySettingsSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400, headers: rateLimitResult.headers },
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
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const settings = await prisma.companySettings.update({
      where: { id: existingSettings.id },
      data: { defaultFuelLevy },
      select: { defaultFuelLevy: true },
    });

    return NextResponse.json(
      { ...settings, companySettingsConfigured: true },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error(
      "Error updating fuel levy settings:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to update fuel levy settings" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
