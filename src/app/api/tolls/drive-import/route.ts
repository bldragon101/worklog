import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api-route";
import { importNewTollFilesFromDrive } from "@/lib/tolls/drive-import";

/** Import any Linkt CSV files in the Drive folder not imported yet */
export const POST = apiRoute({
  rateLimit: "upload",
  auth: { permission: "manage_tolls" },
  errorMessage: "Error importing Linkt files from Google Drive",
  responseMessage: "Failed to import Linkt files from Google Drive",
  logErrorMessageOnly: true,
  handler: async ({ userId }) => {
    const result = await importNewTollFilesFromDrive({ force: true, createdBy: userId });
    return NextResponse.json(result);
  },
});
