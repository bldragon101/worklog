import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
const rateLimit = createRateLimiter(rateLimitConfigs.general);

interface JobCSVRow {
  Date: string;
  Driver: string;
  Customer: string;
  "Bill To": string;
  Registration?: string;
  "Truck Type"?: string;
  Pickup?: string;
  Dropoff?: string;
  Runsheet?: string;
  Invoiced?: string;
  "Charged Hours"?: string;
  "Driver Charge"?: string;
  "Job Reference"?: string;
  Eastlink?: string;
  Citylink?: string;
  Comments?: string;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Apply rate limiting
    const rateLimitResult = rateLimit(request);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

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

    const jobs = result.data as JobCSVRow[];
    const importedJobs = [];
    const errors = [];

    for (let i = 0; i < jobs.length; i++) {
      const row = jobs[i];
      try {
        // Validate required fields
        if (!row.Date || !row.Driver || !row.Customer || !row["Bill To"]) {
          errors.push(`Row ${i + 2}: Missing required fields`);
          continue;
        }

        // Parse date
        const date = new Date(row.Date);
        if (isNaN(date.getTime())) {
          errors.push(`Row ${i + 2}: Invalid date format`);
          continue;
        }

        // Parse numeric fields
        const chargedHours = row["Charged Hours"]
          ? parseFloat(row["Charged Hours"])
          : null;
        const driverCharge = row["Driver Charge"]
          ? parseFloat(row["Driver Charge"])
          : null;
        const eastlink = row.Eastlink ? parseInt(row.Eastlink) : null;
        const citylink = row.Citylink ? parseInt(row.Citylink) : null;

        // Parse boolean fields
        const runsheet =
          row.Runsheet?.toLowerCase() === "yes" || row.Runsheet === "true";
        const invoiced =
          row.Invoiced?.toLowerCase() === "yes" || row.Invoiced === "true";

        const job = await prisma.jobs.create({
          data: {
            date: date,
            driver: row.Driver,
            customer: row.Customer,
            billTo: row["Bill To"],
            registration: row.Registration || "",
            truckType: row["Truck Type"] || "",
            pickup: row.Pickup || "",
            dropoff: row.Dropoff || "",
            runsheet: runsheet,
            invoiced: invoiced,
            chargedHours: chargedHours,
            driverCharge: driverCharge,
            jobReference: row["Job Reference"] || null,
            eastlink: eastlink,
            citylink: citylink,
            comments: row.Comments || null,
          },
        });

        importedJobs.push(job);
      } catch (error) {
        errors.push(
          `Row ${i + 2}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        imported: importedJobs.length,
        errors: errors,
        totalRows: jobs.length,
      },
      {
        headers: rateLimitResult.headers,
      },
    );
  } catch (error) {
    console.error("Error importing jobs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
