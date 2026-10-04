import { NextResponse } from "next/server";
import {
  readImportFormData,
  rejectOversizedImportFile,
} from "@/lib/import-file";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { apiRoute } from "@/lib/api-route";
interface VehicleCSVRow {
  Registration: string;
  "Expiry Date": string;
  Make: string;
  Model: string;
  "Year of Manufacture": string;
  Type: string;
  "Carrying Capacity"?: string;
  "Tray Length"?: string;
  "Crane Reach"?: string;
  "Crane Type"?: string;
  "Crane Capacity"?: string;
}

export const POST = apiRoute({
  auth: { permission: "create_vehicles" },
  errorMessage: "Error importing vehicles",
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

    const vehicles = result.data as VehicleCSVRow[];
    const importedVehicles = [];
    const errors = [];

    for (let i = 0; i < vehicles.length; i++) {
      const row = vehicles[i];
      try {
        // Validate required fields
        if (
          !row.Registration ||
          !row["Expiry Date"] ||
          !row.Make ||
          !row.Model ||
          !row["Year of Manufacture"] ||
          !row.Type
        ) {
          errors.push(
            `Row ${i + 2}: Missing required fields (Registration, Expiry Date, Make, Model, Year of Manufacture, Type)`,
          );
          continue;
        }

        // Parse year
        const yearOfManufacture = parseInt(row["Year of Manufacture"]);
        if (isNaN(yearOfManufacture)) {
          errors.push(`Row ${i + 2}: Invalid year of manufacture`);
          continue;
        }

        // Parse expiry date
        const expiryDate = new Date(row["Expiry Date"]);
        if (isNaN(expiryDate.getTime())) {
          errors.push(`Row ${i + 2}: Invalid expiry date format`);
          continue;
        }

        // Check if vehicle with this registration already exists
        const existingVehicle = await prisma.vehicle.findUnique({
          where: { registration: row.Registration },
        });

        if (existingVehicle) {
          errors.push(
            `Row ${i + 2}: Vehicle with registration ${row.Registration} already exists`,
          );
          continue;
        }

        const vehicle = await prisma.vehicle.create({
          data: {
            registration: row.Registration,
            expiryDate: expiryDate,
            make: row.Make,
            model: row.Model,
            yearOfManufacture: yearOfManufacture,
            type: row.Type,
            carryingCapacity: row["Carrying Capacity"] || null,
            trayLength: row["Tray Length"] || null,
            craneReach: row["Crane Reach"] || null,
            craneType: row["Crane Type"] || null,
            craneCapacity: row["Crane Capacity"] || null,
          },
        });

        importedVehicles.push(vehicle);
      } catch (error) {
        errors.push(
          `Row ${i + 2}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedVehicles.length,
      errors: errors,
      totalRows: vehicles.length,
    });
  },
});
