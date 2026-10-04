import { NextResponse } from "next/server";
import {
  readImportFormData,
  rejectOversizedImportFile,
} from "@/lib/import-file";
import { apiRoute } from "@/lib/api-route";
import { parseLinktTripsCsv } from "@/lib/tolls/linkt-csv";
import { importTollTrips } from "@/lib/tolls/import-toll-trips";

export const POST = apiRoute({
  rateLimit: "upload",
  auth: { permission: "manage_tolls" },
  errorMessage: "Error importing Linkt trips",
  responseMessage: "Failed to import Linkt trips",
  errorBody: { success: false },
  handler: async ({ request, userId, headers }) => {
    const formData = await readImportFormData({ request, headers });
    if (formData instanceof NextResponse) return formData;

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    const oversized = rejectOversizedImportFile({ file, headers });
    if (oversized) return oversized;

    const { trips, errors, totalRows } = parseLinktTripsCsv({
      text: await file.text(),
    });
    if (trips.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: errors[0] ?? "The file has no trips to import",
          errors,
        },
        { status: 400 },
      );
    }

    const summary = await importTollTrips({
      trips,
      source: "upload",
      fileName: file.name,
      createdBy: userId,
    });

    return NextResponse.json({
      success: true,
      ...summary,
      totalRows,
      skipped: errors.length,
      errors,
    });
  },
});
