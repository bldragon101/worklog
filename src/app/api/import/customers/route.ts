import { NextResponse } from "next/server";
import {
  readImportFormData,
  rejectOversizedImportFile,
} from "@/lib/import-file";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { isFuelLevyInRange, parseFuelLevy } from "@/lib/utils/fuel-levy";
import { BILL_TO_EMAIL_ERROR, containsEmailAddress } from "@/lib/validation";
import { apiRoute } from "@/lib/api-route";
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

export const POST = apiRoute({
  auth: { permission: "create_customers" },
  errorMessage: "Error importing customers",
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

        if (containsEmailAddress({ value: row["Bill To"] })) {
          errors.push(`Row ${i + 2}: ${BILL_TO_EMAIL_ERROR}`);
          continue;
        }

        // Parse numeric fields with parseFloat to preserve decimal precision
        const tray = row["Tray Rate"] ? parseFloat(row["Tray Rate"]) : null;
        const crane = row["Crane Rate"] ? parseFloat(row["Crane Rate"]) : null;
        const semi = row["Semi Rate"] ? parseFloat(row["Semi Rate"]) : null;
        const semiCrane = row["Semi Crane Rate"]
          ? parseFloat(row["Semi Crane Rate"])
          : null;
        const fuelLevy = parseFuelLevy({ value: row["Fuel Levy (%)"] ?? "" });
        if (fuelLevy !== null && !isFuelLevyInRange({ value: fuelLevy })) {
          errors.push(`Row ${i + 2}: Fuel Levy must be between 0 and 100`);
          continue;
        }

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

    return NextResponse.json({
      success: true,
      imported: importedCustomers.length,
      errors: errors,
      totalRows: customers.length,
    });
  },
});
