import { NextResponse } from "next/server";
import {
  readImportFormData,
  rejectOversizedImportFile,
} from "@/lib/import-file";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { csvDriverHoursSchema, csvHoursSchema } from "@/lib/bulk-job-schemas";
import { apiRoute } from "@/lib/api-route";

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
  "Driver Only"?: string;
  "Charged Hours"?: string;
  "Travel Time Hours"?: string;
  "Driver Charge"?: string;
  "Driver Hours"?: string;
  "Deduction Hours"?: string;
  "Job Reference"?: string;
  Eastlink?: string;
  Citylink?: string;
  Comments?: string;
}

export const POST = apiRoute({
  auth: { permission: "create_jobs" },
  errorMessage: "Error importing jobs",
  errorBody: { success: false },
  handler: async ({ request }) => {
    const formData = await readImportFormData({
      request,
    });
    if (formData instanceof NextResponse) return formData;
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No file provided",
        },
        {
          status: 400,
        },
      );
    }

    const oversized = rejectOversizedImportFile({
      file,
    });
    if (oversized) return oversized;

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
        const chargedResult = csvHoursSchema.safeParse(
          row["Charged Hours"] ?? "",
        );
        if (!chargedResult.success) {
          errors.push(`Row ${i + 2}: Charged Hours must be zero or greater`);
          continue;
        }
        const chargedHours = chargedResult.data;
        const travelResult = csvHoursSchema.safeParse(
          row["Travel Time Hours"] ?? "",
        );
        if (!travelResult.success) {
          errors.push(
            `Row ${i + 2}: Travel Time Hours must be zero or greater`,
          );
          continue;
        }
        const travelTimeHours = travelResult.data;
        // "Driver Hours" is the current header; "Driver Charge" is the legacy
        // name and is still accepted for older exports.
        const driverHoursCell =
          [row["Driver Hours"], row["Driver Charge"]].find(
            (value) => value != null && value.trim() !== "",
          ) ?? "";
        const driverResult = csvDriverHoursSchema.safeParse(driverHoursCell);
        if (!driverResult.success) {
          errors.push(`Row ${i + 2}: Driver Hours must be a number`);
          continue;
        }
        const driverCharge = driverResult.data;
        const deductionResult = csvHoursSchema.safeParse(
          row["Deduction Hours"] ?? "",
        );
        if (!deductionResult.success) {
          errors.push(`Row ${i + 2}: Deduction Hours must be zero or greater`);
          continue;
        }
        const deductionHours = deductionResult.data;
        const eastlink = row.Eastlink ? parseInt(row.Eastlink) : null;
        const citylink = row.Citylink ? parseInt(row.Citylink) : null;

        // Parse boolean fields
        const runsheet =
          row.Runsheet?.toLowerCase() === "yes" || row.Runsheet === "true";
        const invoiced =
          row.Invoiced?.toLowerCase() === "yes" || row.Invoiced === "true";
        const driverOnly =
          row["Driver Only"]?.toLowerCase() === "yes" ||
          row["Driver Only"] === "true";

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
            driverOnly: driverOnly,
            chargedHours: chargedHours,
            travelTimeHours: travelTimeHours,
            driverCharge: driverCharge,
            deductionHours: deductionHours,
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

    return NextResponse.json({
      success: true,
      imported: importedJobs.length,
      errors: errors,
      totalRows: jobs.length,
    });
  },
});
