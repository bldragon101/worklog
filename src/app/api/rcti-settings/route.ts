import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRctiAccess } from "@/lib/rcti-access";
import { apiRoute } from "@/lib/api-route";

/**
 * GET /api/rcti-settings
 * Backward-compatible route — proxies to CompanySettings model
 */
export const GET = apiRoute({
  auth: requireRctiAccess,
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
 * POST /api/rcti-settings
 * Backward-compatible route — proxies to CompanySettings model
 */
export const POST = apiRoute({
  auth: requireRctiAccess,
  errorMessage: "Error saving company settings",
  responseMessage: "Failed to save company settings",
  handler: async ({ request }) => {
    const body = await request.json();
    const {
      companyName,
      companyAbn,
      companyAddress,
      companyPhone,
      companyEmail,
      companyLogo,
      emailReplyTo,
    } = body;

    if (!companyName || companyName.trim() === "") {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 },
      );
    }

    const normaliseOptionalField = ({ value }: { value: unknown }) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    };

    const existingSettings = await prisma.companySettings.findFirst();

    let settings;
    if (existingSettings) {
      const updateData: Record<string, string | null> = {
        companyName: companyName.trim(),
      };

      const abn = normaliseOptionalField({ value: companyAbn });
      if (abn !== undefined) updateData.companyAbn = abn;

      const address = normaliseOptionalField({ value: companyAddress });
      if (address !== undefined) updateData.companyAddress = address;

      const phone = normaliseOptionalField({ value: companyPhone });
      if (phone !== undefined) updateData.companyPhone = phone;

      const email = normaliseOptionalField({ value: companyEmail });
      if (email !== undefined) updateData.companyEmail = email;

      const logo = normaliseOptionalField({ value: companyLogo });
      if (logo !== undefined) updateData.companyLogo = logo;

      const replyTo = normaliseOptionalField({ value: emailReplyTo });
      if (replyTo !== undefined) updateData.emailReplyTo = replyTo;

      settings = await prisma.companySettings.update({
        where: { id: existingSettings.id },
        data: updateData,
      });
    } else {
      settings = await prisma.companySettings.create({
        data: {
          companyName: companyName.trim(),
          companyAbn: companyAbn?.trim() ? companyAbn.trim() : null,
          companyAddress: companyAddress?.trim() ? companyAddress.trim() : null,
          companyPhone: companyPhone?.trim() ? companyPhone.trim() : null,
          companyEmail: companyEmail?.trim() ? companyEmail.trim() : null,
          companyLogo: companyLogo?.trim() ? companyLogo.trim() : null,
          emailReplyTo: emailReplyTo?.trim() ? emailReplyTo.trim() : null,
        },
      });
    }

    return NextResponse.json(settings, {
      status: existingSettings ? 200 : 201,
    });
  },
});
