import { NextResponse } from "next/server";
import { createGoogleDriveClient } from "@/lib/google-auth";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Google Drive get file error",
  responseMessage: "Failed to get file from Google Drive",
  errorBody: { success: false },
  handler: async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        {
          success: false,
          error: "fileId is required",
        },
        { status: 400 },
      );
    }

    const drive = await createGoogleDriveClient();

    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: "id,name,mimeType,size",
      supportsAllDrives: true,
    });

    const mimeType = fileMetadata.data.mimeType;

    if (!mimeType?.startsWith("image/") && mimeType !== "application/pdf") {
      return NextResponse.json(
        {
          success: false,
          error: "File type not supported. Only images and PDFs are allowed.",
        },
        { status: 400 },
      );
    }

    const fileResponse = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      {
        responseType: "arraybuffer",
      },
    );

    const buffer = Buffer.from(fileResponse.data as ArrayBuffer);
    const base64 = buffer.toString("base64");
    const fileUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: fileMetadata.data.name,
      fileSize: fileMetadata.data.size,
      mimeType: fileMetadata.data.mimeType,
    });
  },
});
