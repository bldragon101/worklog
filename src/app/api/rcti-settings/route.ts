import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * GET /api/rcti-settings
 * Get RCTI settings (company details)
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Get the first (and should be only) settings record
    const settings = await prisma.rctiSettings.findFirst();

    if (!settings) {
      // Return default empty settings if none exist
      return NextResponse.json(
        {
          companyName: "",
          companyAbn: null,
          companyAddress: null,
          companyPhone: null,
          companyEmail: null,
          companyLogo: null,
        },
        { headers: rateLimitResult.headers },
      );
    }

    return NextResponse.json(settings, { headers: rateLimitResult.headers });
  } catch (error) {
    console.error("Error fetching RCTI settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch RCTI settings" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

/**
 * POST /api/rcti-settings
 * Create or update RCTI settings
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const {
      companyName,
      companyAbn,
      companyAddress,
      companyPhone,
      companyEmail,
      companyLogo,
    } = body;

    // Validate required field
    if (!companyName || companyName.trim() === "") {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    // Helper to normalise optional fields
    const normaliseOptionalField = (value: unknown) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    };

    // Check if settings already exist
    const existingSettings = await prisma.rctiSettings.findFirst();

    let settings;
    if (existingSettings) {
      // Update existing settings. Optional fields only change when provided.
      const updateData: Record<string, string | null> = {
        companyName: companyName.trim(),
      };

      const abn = normaliseOptionalField(companyAbn);
      if (abn !== undefined) updateData.companyAbn = abn;

      const address = normaliseOptionalField(companyAddress);
      if (address !== undefined) updateData.companyAddress = address;

      const phone = normaliseOptionalField(companyPhone);
      if (phone !== undefined) updateData.companyPhone = phone;

      const email = normaliseOptionalField(companyEmail);
      if (email !== undefined) updateData.companyEmail = email;

      const logo = normaliseOptionalField(companyLogo);
      if (logo !== undefined) updateData.companyLogo = logo;

      settings = await prisma.rctiSettings.update({
        where: { id: existingSettings.id },
        data: updateData,
      });
    } else {
      // Create new settings
      settings = await prisma.rctiSettings.create({
        data: {
          companyName: companyName.trim(),
          companyAbn: companyAbn?.trim() ? companyAbn.trim() : null,
          companyAddress: companyAddress?.trim() ? companyAddress.trim() : null,
          companyPhone: companyPhone?.trim() ? companyPhone.trim() : null,
          companyEmail: companyEmail?.trim() ? companyEmail.trim() : null,
          companyLogo: companyLogo?.trim() ? companyLogo.trim() : null,
        },
      });
    }

    return NextResponse.json(settings, {
      status: existingSettings ? 200 : 201,
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error saving RCTI settings:", error);
    return NextResponse.json(
      { error: "Failed to save RCTI settings" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
