import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";

const QuickEditSettingsSchema = z.object({
  quickEditMinRole: z.enum(["admin", "manager", "user", "viewer"]),
});

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error fetching quick edit settings",
  responseMessage: "Failed to fetch quick edit settings",
  logErrorMessageOnly: true,
  handler: async () => {
    const settings = await prisma.companySettings.findFirst({
      select: { quickEditMinRole: true },
    });

    return NextResponse.json({
      quickEditMinRole: settings?.quickEditMinRole ?? "admin",
    });
  },
});

export const PATCH = apiRoute({
  auth: {
    roles: ["admin"],
    forbiddenMessage: "Forbidden - Admin privileges required",
  },
  errorMessage: "Error updating quick edit settings",
  responseMessage: "Failed to update quick edit settings",
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

    const parseResult = QuickEditSettingsSchema.safeParse(body);

    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400 },
      );
    }

    const { quickEditMinRole } = parseResult.data;

    const existingSettings = await prisma.companySettings.findFirst();

    if (!existingSettings) {
      return NextResponse.json(
        {
          error:
            "Company settings must be configured before updating quick edit permissions. Please set up company details first.",
        },
        { status: 400 },
      );
    }

    const settings = await prisma.companySettings.update({
      where: { id: existingSettings.id },
      data: { quickEditMinRole },
      select: { quickEditMinRole: true },
    });

    return NextResponse.json(settings);
  },
});
