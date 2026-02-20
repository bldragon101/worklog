import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { z } from "zod";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const AdminSettingsSchema = z.object({
  signUpEnabled: z.boolean(),
});

export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const role = await getUserRole(authResult.userId);
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden - Admin privileges required" },
      { status: 403, headers: rateLimitResult.headers },
    );
  }

  try {
    const settings = await prisma.companySettings.findFirst({
      select: { signUpEnabled: true },
    });

    return NextResponse.json(
      { signUpEnabled: settings?.signUpEnabled ?? true },
      { headers: rateLimitResult.headers },
    );
  } catch (error) {
    console.error(
      "Error fetching admin settings:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to fetch admin settings" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const role = await getUserRole(authResult.userId);
  if (role !== "admin") {
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

    const parseResult = AdminSettingsSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const { signUpEnabled } = parseResult.data;

    const existingSettings = await prisma.companySettings.findFirst();

    if (!existingSettings) {
      return NextResponse.json(
        {
          error:
            "Company settings must be configured before toggling sign-up. Please set up company details first.",
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const settings = await prisma.companySettings.update({
      where: { id: existingSettings.id },
      data: { signUpEnabled },
      select: { signUpEnabled: true },
    });

    return NextResponse.json(settings, { headers: rateLimitResult.headers });
  } catch (error) {
    console.error(
      "Error updating admin settings:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to update admin settings" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
