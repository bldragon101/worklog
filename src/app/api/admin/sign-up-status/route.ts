import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const settings = await prisma.companySettings.findFirst({
      select: { signUpEnabled: true },
    });

    const enabled = settings?.signUpEnabled ?? true;

    return NextResponse.json(
      { enabled },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("Error checking sign-up status:", error);
    return NextResponse.json({ enabled: true }, { status: 200 });
  }
}
