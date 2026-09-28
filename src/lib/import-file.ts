import { NextResponse } from "next/server";

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Reject an uploaded import file larger than MAX_IMPORT_FILE_BYTES.
 * Returns a 413 response to return as-is, or null when the file is acceptable.
 */
export function rejectOversizedImportFile({
  file,
  headers,
}: {
  file: File;
  headers?: HeadersInit;
}) {
  if (file.size <= MAX_IMPORT_FILE_BYTES) return null;

  return NextResponse.json(
    {
      success: false,
      error: `File is too large. The maximum size is ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB.`,
    },
    { status: 413, headers },
  );
}
