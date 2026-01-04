import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
const rateLimit = createRateLimiter(rateLimitConfigs.general);

interface CustomerCSVRow {
  Customer: string;
  "Bill To": string;
  Contact: string;
  "Tray Rate"?: string;
  "Crane Rate"?: string;
  "Semi Rate"?: string;
  "Semi Crane Rate"?: string;
  "Fuel Levy (%)"?: string;
  Tolls?: string;
  Comments?: string;
}

export async function POST(request: NextRequest) {
  // SECURITY: Apply rate limiting (outside try block so headers are available in catch)
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  try {
    // SECURITY: Check authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No file provided",
        },
        {
          status: 400,
          headers: rateLimitResult.headers,
        },
      );
    }

    const text = await file.text();
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });

    if (result.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "CSV parsing errors",
          details: result.errors,
        },
        {
          status: 400,
          headers: rateLimitResult.headers,
        },
      );
    }

    const customers = result.data as CustomerCSVRow[];
    const importedCustomers = [];
    const errors = [];

    for (let i = 0; i < customers.length; i++) {
      const row = customers[i];
      try {
        // Validate required fields
        if (!row.Customer || !row["Bill To"] || !row.Contact) {
          errors.push(`Row ${i + 2}: Missing required fields`);
          continue;
        }

        // Parse numeric fields with parseFloat to preserve decimal precision
        const tray = row["Tray Rate"] ? parseFloat(row["Tray Rate"]) : null;
        const crane = row["Crane Rate"] ? parseFloat(row["Crane Rate"]) : null;
        const semi = row["Semi Rate"] ? parseFloat(row["Semi Rate"]) : null;
        const semiCrane = row["Semi Crane Rate"]
          ? parseFloat(row["Semi Crane Rate"])
          : null;
        const fuelLevy = row["Fuel Levy (%)"]
          ? parseFloat(row["Fuel Levy (%)"])
          : null;

        // Parse boolean field
        const tolls =
          row.Tolls?.toLowerCase() === "yes" || row.Tolls === "true";

        const customer = await prisma.customer.create({
          data: {
            customer: row.Customer,
            billTo: row["Bill To"],
            contact: row.Contact,
            tray: tray,
            crane: crane,
            semi: semi,
            semiCrane: semiCrane,
            fuelLevy: fuelLevy,
            tolls: tolls,
            comments: row.Comments || null,
          },
        });

        importedCustomers.push(customer);
      } catch (error) {
        errors.push(
          `Row ${i + 2}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        imported: importedCustomers.length,
        errors: errors,
        totalRows: customers.length,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Error importing customers:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
