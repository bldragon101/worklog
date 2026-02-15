import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * GET /api/rcti-settings
 * Backward-compatible route — proxies to CompanySettings model
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
 * POST /api/rcti-settings
 * Backward-compatible route — proxies to CompanySettings model
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
      emailReplyTo,
    } = body;

    if (!companyName || companyName.trim() === "") {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400, headers: rateLimitResult.headers },
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
