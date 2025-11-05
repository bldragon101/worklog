import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { renderToStream } from "@react-pdf/renderer";
import { RctiPdfTemplate } from "@/components/rcti/rcti-pdf-template";
import React from "react";
import { readFile } from "fs/promises";
import path from "path";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

/**
 * GET /api/rcti/[id]/pdf
 * Generate and download RCTI as PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { id } = await params;
    const rctiId = parseInt(id, 10);

    if (isNaN(rctiId)) {
      return NextResponse.json({ error: "Invalid RCTI ID" }, { status: 400 });
    }

    // Fetch RCTI with lines
    const rcti = await prisma.rcti.findUnique({
      where: { id: rctiId },
      include: {
        lines: {
          orderBy: { jobDate: "asc" },
        },
        driver: true,
      },
    });

    if (!rcti) {
      return NextResponse.json({ error: "RCTI not found" }, { status: 404 });
    }

    // Fetch RCTI settings
    const settings = await prisma.rctiSettings.findFirst();

    if (!settings) {
      return NextResponse.json(
        {
          error:
            "RCTI settings not configured. Please configure company details in RCTI settings.",
        },
        { status: 400 },
      );
    }

    // Convert logo to base64 if it exists
    let logoDataUrl = "";
    if (settings.companyLogo && settings.companyLogo.startsWith("/uploads/")) {
      try {
        const logoPath = path.join(
          process.cwd(),
          "public",
          settings.companyLogo,
        );
        const logoBuffer = await readFile(logoPath);
        const logoBase64 = logoBuffer.toString("base64");

        // Determine MIME type from file extension
        const ext = path.extname(settings.companyLogo).toLowerCase();
        const mimeTypes: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
        };
        const mimeType = mimeTypes[ext] || "image/png";

        logoDataUrl = `data:${mimeType};base64,${logoBase64}`;
      } catch (error) {
        console.error("Error reading logo file:", error);
        // Continue without logo if there's an error
      }
    }

    // Prepare settings data
    const settingsData = {
      companyName: settings.companyName || "",
      companyAbn: settings.companyAbn || "",
      companyAddress: settings.companyAddress || "",
      companyPhone: settings.companyPhone || "",
      companyEmail: settings.companyEmail || "",
      companyLogo: logoDataUrl,
    };

    // Generate PDF using React.createElement
    const pdfDocument = React.createElement(RctiPdfTemplate, {
      rcti,
      settings: settingsData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await renderToStream(pdfDocument as any);

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Return PDF as response
    const filename = `${rcti.invoiceNumber}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...rateLimitResult.headers,
      },
    });
  } catch (error) {
    console.error("Error generating RCTI PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
