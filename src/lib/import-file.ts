import { NextRequest, NextResponse } from "next/server";

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

// Room for the multipart boundaries and part headers around the file
const MAX_IMPORT_REQUEST_BYTES = MAX_IMPORT_FILE_BYTES + 64 * 1024;

function importTooLargeResponse({ headers }: { headers?: HeadersInit }) {
  return NextResponse.json(
    {
      success: false,
      error: `File is too large. The maximum size is ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB.`,
    },
    { status: 413, headers },
  );
}

/**
 * Parse an import upload, counting bytes as the body is read and stopping as
 * soon as it passes the size limit, rather than buffering it all first.
 * Returns the form data, or a 400/413 response to return as-is.
 */
export async function readImportFormData({
  request,
  headers,
}: {
  request: NextRequest;
  headers?: HeadersInit;
}): Promise<FormData | NextResponse> {
  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > MAX_IMPORT_REQUEST_BYTES) {
    return importTooLargeResponse({ headers });
  }

  if (!request.body) {
    return NextResponse.json(
      { success: false, error: "No file provided" },
      { status: 400, headers },
    );
  }

  let bytesRead = 0;
  const limitedBody = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesRead += chunk.byteLength;
        if (bytesRead > MAX_IMPORT_REQUEST_BYTES) {
          controller.error(new Error("Import request body is too large"));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );

  try {
    return await new Response(limitedBody, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    if (bytesRead > MAX_IMPORT_REQUEST_BYTES) {
      return importTooLargeResponse({ headers });
    }
    return NextResponse.json(
      { success: false, error: "Invalid upload. Please select a CSV file." },
      { status: 400, headers },
    );
  }
}

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

  return importTooLargeResponse({ headers });
}
