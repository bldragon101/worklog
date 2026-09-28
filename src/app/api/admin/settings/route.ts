import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";

const AdminSettingsSchema = z.object({
  signUpEnabled: z.boolean(),
});

export const GET = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  errorMessage: "Error fetching admin settings",
  responseMessage: "Failed to fetch admin settings",
  handler: async () => {
    const settings = await prisma.companySettings.findFirst({
      select: { signUpEnabled: true },
    });

    return NextResponse.json({
      signUpEnabled: settings?.signUpEnabled ?? true,
    });
  },
});

export const PATCH = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  errorMessage: "Error updating admin settings",
  responseMessage: "Failed to update admin settings",
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

    const parseResult = AdminSettingsSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400 },
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
        { status: 400 },
      );
    }

    const settings = await prisma.companySettings.update({
      where: { id: existingSettings.id },
      data: { signUpEnabled },
      select: { signUpEnabled: true },
    });

    return NextResponse.json(settings);
  },
});
