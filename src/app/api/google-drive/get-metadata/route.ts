import { NextResponse } from "next/server";
import { createGoogleDriveClient } from "@/lib/google-auth";
import { apiRoute } from "@/lib/api-route";

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Google Drive get metadata error",
  responseMessage: "Failed to get file metadata from Google Drive",
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
      fields: "id,name,mimeType,size,createdTime",
      supportsAllDrives: true,
    });

    return NextResponse.json({
      success: true,
      fileName: fileMetadata.data.name,
      fileSize: fileMetadata.data.size,
      mimeType: fileMetadata.data.mimeType,
      fileId: fileMetadata.data.id,
      createdTime: fileMetadata.data.createdTime,
    });
  },
});
