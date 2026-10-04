import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";
import { importNewTollFilesFromDrive } from "@/lib/tolls/drive-import";

const driveImportSchema = z.object({
  /** false checks at most once an hour (page loads); true always checks */
  force: z.boolean(),
});

/** Import any Linkt CSV files in the Drive folder not imported yet */
export const POST = apiRoute({
  auth: { permission: "manage_tolls" },
  errorMessage: "Error importing Linkt files from Google Drive",
  responseMessage: "Failed to import Linkt files from Google Drive",
  validationMessage: "Invalid Drive import request",
  logErrorMessageOnly: true,
  handler: async ({ request, userId }) => {
    const { force } = driveImportSchema.parse(await request.json());
    const result = await importNewTollFilesFromDrive({ force, createdBy: userId });
    return NextResponse.json(result);
  },
});
