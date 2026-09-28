import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";

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
export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching company settings",
  responseMessage: "Failed to fetch company settings",
  handler: async () => {
    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      return NextResponse.json({
        companyName: "",
        companyAbn: null,
        companyAddress: null,
        companyPhone: null,
        companyEmail: null,
        companyLogo: null,
        emailReplyTo: null,
      });
    }

    return NextResponse.json(settings);
  },
});

/**
 * POST /api/company-settings
 * Create or update company settings
 */
export const POST = apiRoute({
  auth: { permission: "manage_company_settings" },
  errorMessage: "Error saving company settings",
  responseMessage: "Failed to save company settings",
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

    const parseResult = CompanySettingsSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400 },
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
    });
  },
});
