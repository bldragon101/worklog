import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { z } from "zod";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const normaliseOptionalString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  });

const normaliseOptionalEmail = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine(
    (val) =>
      val === undefined ||
      val === null ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: "Invalid email format" },
  );

const normaliseOptionalUrl = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine(
    (val) => {
      if (val === undefined || val === null) return true;
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid URL format" },
  );

const CompanySettingsSchema = z.object({
  companyName: z
    .string({ error: "Company name is required" })
    .trim()
    .min(1, "Company name is required")
    .max(255, "Company name must be 255 characters or fewer"),
  companyAbn: normaliseOptionalString,
  companyAddress: normaliseOptionalString,
  companyPhone: normaliseOptionalString,
  companyEmail: normaliseOptionalEmail,
  companyLogo: normaliseOptionalUrl,
  emailReplyTo: normaliseOptionalEmail,
});

/**
 * GET /api/company-settings
 * Get company settings (company details, logo, email config)
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      return NextResponse.json(
        {
          companyName: "",
          companyAbn: null,
          companyAddress: null,
          companyPhone: null,
          companyEmail: null,
          companyLogo: null,
          emailReplyTo: null,
        },
        { headers: rateLimitResult.headers },
      );
    }

    return NextResponse.json(settings, { headers: rateLimitResult.headers });
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch company settings" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

/**
 * POST /api/company-settings
 * Create or update company settings
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

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

    const parseResult = CompanySettingsSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const {
      companyName,
      companyAbn,
      companyAddress,
      companyPhone,
      companyEmail,
      companyLogo,
      emailReplyTo,
    } = parseResult.data;

    const existingSettings = await prisma.companySettings.findFirst();

    let settings;
    if (existingSettings) {
      const updateData: Record<string, string | null> = {
        companyName,
      };

      if (companyAbn !== undefined) updateData.companyAbn = companyAbn;
      if (companyAddress !== undefined)
        updateData.companyAddress = companyAddress;
      if (companyPhone !== undefined) updateData.companyPhone = companyPhone;
      if (companyEmail !== undefined) updateData.companyEmail = companyEmail;
      if (companyLogo !== undefined) updateData.companyLogo = companyLogo;
      if (emailReplyTo !== undefined) updateData.emailReplyTo = emailReplyTo;

      settings = await prisma.companySettings.update({
        where: { id: existingSettings.id },
        data: updateData,
      });
    } else {
      settings = await prisma.companySettings.create({
        data: {
          companyName,
          companyAbn: companyAbn ?? null,
          companyAddress: companyAddress ?? null,
          companyPhone: companyPhone ?? null,
          companyEmail: companyEmail ?? null,
          companyLogo: companyLogo ?? null,
          emailReplyTo: emailReplyTo ?? null,
        },
      });
    }

    return NextResponse.json(settings, {
      status: existingSettings ? 200 : 201,
      headers: rateLimitResult.headers,
    });
  } catch (error) {
    console.error("Error saving company settings:", error);
    return NextResponse.json(
      { error: "Failed to save company settings" },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
