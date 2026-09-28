import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export const GET = apiRoute({
  auth: "public",
  errorMessage: "Error checking sign-up status",
  handler: async () => {
    try {
      const settings = await prisma.companySettings.findFirst({
        select: { signUpEnabled: true },
      });

      const enabled = settings?.signUpEnabled ?? true;

      return NextResponse.json({ enabled }, { headers: NO_STORE });
    } catch (error) {
      console.error(
        "Error checking sign-up status:",
        error instanceof Error ? error.message : String(error),
      );
      return NextResponse.json(
        { enabled: false, error: "Failed to check sign-up status" },
        { headers: NO_STORE },
      );
    }
  },
});
