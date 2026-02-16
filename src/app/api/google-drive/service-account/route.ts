import { NextRequest, NextResponse } from "next/server";
import { createGoogleDriveClient } from "@/lib/google-auth";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { z } from "zod";
import { drive_v3 } from "googleapis";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

// Zod schema for GET request query parameters
const getQuerySchema = z.object({
  action: z.enum([
    "list-shared-drives",
    "list-drive-folders",
    "list-folder-contents",
    "list-hierarchical-folders",
    "create-folder",
  ]),
  driveId: z.string().optional(),
  folderId: z.string().optional(),
  parentId: z.string().optional(),
  folderName: z.string().optional(),
});

export async function GET(request: NextRequest) {
  // 1. Rate limiting
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  // 2. Authentication
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);

    // 3. Input validation with Zod
    const queryParams = {
      action: searchParams.get("action"),
      driveId: searchParams.get("driveId") || undefined,
      folderId: searchParams.get("folderId") || undefined,
      parentId: searchParams.get("parentId") || undefined,
      folderName: searchParams.get("folderName") || undefined,
    };

    const validationResult = getQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request parameters",
          details: validationResult.error.issues,
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const { action, driveId, folderId, parentId, folderName } =
      validationResult.data;

    // Get the authenticated client using OAuth2 tokens
    const drive = await createGoogleDriveClient();

    switch (action) {
      case "list-shared-drives": {
        // List all shared drives
        const sharedDrivesResponse = await drive.drives.list({
          pageSize: 10,
          fields: "nextPageToken, drives(id, name)",
        });

        const sharedDrives = sharedDrivesResponse.data.drives || [];

        return NextResponse.json(
          {
            success: true,

            sharedDrives: sharedDrives.map((drive) => ({
              id: drive.id,
              name: drive.name,
            })),
          },
          { headers: rateLimitResult.headers },
        );
      }

      case "list-drive-folders": {
        if (!driveId) {
          return NextResponse.json(
            {
              success: false,
              error: "driveId is required",
            },
            { status: 400, headers: rateLimitResult.headers },
          );
        }

        // List all folders in the shared drive (excluding deleted ones) with pagination
        let allFolders: drive_v3.Schema$File[] = [];
        let pageToken: string | undefined = undefined;

        do {
          const response: drive_v3.Schema$FileList = (
            await drive.files.list({
              corpora: "drive",
              driveId: driveId,
              includeItemsFromAllDrives: true,
              supportsAllDrives: true,
              q: `mimeType='application/vnd.google-apps.folder' and trashed=false`,
              fields: "nextPageToken, files(id, name, mimeType, createdTime)",
              pageSize: 1000,
              pageToken: pageToken ?? undefined,
            })
          ).data;

          const folders = response.files || [];
          allFolders = allFolders.concat(folders);
          pageToken = response.nextPageToken ?? undefined;
        } while (pageToken);

        return NextResponse.json(
          {
            success: true,

            folders: allFolders.map((folder) => ({
              id: folder.id,
              name: folder.name,
              mimeType: folder.mimeType,
              createdTime: folder.createdTime,
              isFolder: true,
            })),
          },
          { headers: rateLimitResult.headers },
        );
      }

      case "list-folder-contents": {
        if (!driveId || !folderId) {
          return NextResponse.json(
            {
              success: false,
              error: "driveId and folderId are required",
            },
            { status: 400, headers: rateLimitResult.headers },
          );
        }

        // List contents of specific folder in shared drive (excluding deleted files)
        const filesResponse = await drive.files.list({
          corpora: "drive",
          driveId: driveId,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          q: `'${folderId}' in parents and trashed=false`,
          fields: "files(id, name, mimeType, createdTime, modifiedTime)",
          pageSize: 100,
          orderBy: "modifiedTime desc",
        });

        const files = filesResponse.data.files || [];

        return NextResponse.json(
          {
            success: true,

            files: files.map((file) => ({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              createdTime: file.createdTime,
              modifiedTime: file.modifiedTime,
              isFolder: file.mimeType === "application/vnd.google-apps.folder",
            })),
          },
          { headers: rateLimitResult.headers },
        );
      }

      case "list-hierarchical-folders": {
        const effectiveParentId = parentId || "root";

        if (!driveId) {
          return NextResponse.json(
            {
              success: false,
              error: "driveId is required",
            },
            { status: 400, headers: rateLimitResult.headers },
          );
        }

        // For shared drives, we need to handle root differently
        let allHierarchicalFiles: drive_v3.Schema$File[] = [];

        if (effectiveParentId === "root") {
          // For root level of shared drive, query without specifying parents with pagination
          let pageToken: string | undefined = undefined;

          do {
            const hierarchicalResponse: drive_v3.Schema$FileList = (
              await drive.files.list({
                corpora: "drive",
                driveId: driveId,
                includeItemsFromAllDrives: true,
                supportsAllDrives: true,
                q: `trashed=false`,
                fields:
                  "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, parents)",
                pageSize: 1000,
                orderBy: "folder,name",
                pageToken: pageToken,
              })
            ).data;

            const files = hierarchicalResponse.files || [];
            allHierarchicalFiles = allHierarchicalFiles.concat(files);
            pageToken = hierarchicalResponse.nextPageToken ?? undefined;
          } while (pageToken);

          // Filter to only root level items (those whose only parent is the drive itself)
          allHierarchicalFiles = allHierarchicalFiles.filter(
            (file) =>
              !file.parents ||
              (file.parents.length === 1 && file.parents[0] === driveId),
          );
        } else {
          // For specific folder, get direct children with pagination
          let pageToken: string | undefined = undefined;

          do {
            const hierarchicalResponse: drive_v3.Schema$FileList = (
              await drive.files.list({
                corpora: "drive",
                driveId: driveId,
                includeItemsFromAllDrives: true,
                supportsAllDrives: true,
                q: `'${effectiveParentId}' in parents and trashed=false`,
                fields:
                  "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, parents)",
                pageSize: 1000,
                orderBy: "folder,name",
                pageToken: pageToken,
              })
            ).data;

            const files = hierarchicalResponse.files || [];
            allHierarchicalFiles = allHierarchicalFiles.concat(files);
            pageToken = hierarchicalResponse.nextPageToken ?? undefined;
          } while (pageToken);
        }

        const hierarchicalFiles = allHierarchicalFiles;

        return NextResponse.json(
          {
            success: true,

            files: hierarchicalFiles.map((file) => ({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              createdTime: file.createdTime,
              modifiedTime: file.modifiedTime,
              parents: file.parents,
              isFolder: file.mimeType === "application/vnd.google-apps.folder",
            })),
          },
          { headers: rateLimitResult.headers },
        );
      }

      case "create-folder": {
        const effectiveFolderParentId = parentId || "root";

        if (!driveId || !folderName) {
          return NextResponse.json(
            {
              success: false,
              error: "driveId and folderName are required",
            },
            { status: 400, headers: rateLimitResult.headers },
          );
        }

        // Create folder in Google Drive
        const folderMetadata = {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents:
            effectiveFolderParentId === "root"
              ? [driveId]
              : [effectiveFolderParentId],
        };

        const folderResponse = await drive.files.create({
          requestBody: folderMetadata,
          supportsAllDrives: true,
          fields: "id,name,mimeType,createdTime,parents",
        });

        const createdFolder = folderResponse.data;

        return NextResponse.json(
          {
            success: true,
            folder: {
              id: createdFolder.id,
              name: createdFolder.name,
              mimeType: createdFolder.mimeType,
              createdTime: createdFolder.createdTime,
              parents: createdFolder.parents,
              isFolder: true,
            },
          },
          { headers: rateLimitResult.headers },
        );
      }

      default: {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
          },
          { status: 400, headers: rateLimitResult.headers },
        );
      }
    }
  } catch (error) {
    console.error("Google Drive error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

// Zod schema for POST request body
const postBodySchema = z.object({
  fileName: z.string().min(1),
  fileContent: z.string().optional(),
  driveId: z.string().min(1),
  folderId: z.string().min(1),
  isImageUpload: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  // 1. Rate limiting (use upload config for file operations)
  const uploadRateLimit = createRateLimiter(rateLimitConfigs.upload);
  const rateLimitResult = uploadRateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  // 2. Authentication
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();

    // 3. Input validation with Zod
    const validationResult = postBodySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          details: validationResult.error.issues,
        },
        { status: 400, headers: rateLimitResult.headers },
      );
    }

    const { fileName, fileContent, driveId, folderId, isImageUpload } =
      validationResult.data;

    const drive = await createGoogleDriveClient();

    if (isImageUpload) {
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: "text/plain",
        body: "Image upload placeholder - implement proper file handling",
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        supportsAllDrives: true,
        fields: "id,name,webViewLink,thumbnailLink",
      });

      return NextResponse.json(
        {
          success: true,
          fileId: file.data.id,
          fileName: file.data.name,
          webViewLink: file.data.webViewLink,
          thumbnailLink: file.data.thumbnailLink,
        },
        { headers: rateLimitResult.headers },
      );
    } else {
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: "text/csv",
        body: fileContent,
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        supportsAllDrives: true,
        fields: "id,name,webViewLink",
      });

      return NextResponse.json(
        {
          success: true,
          fileId: file.data.id,
          fileName: file.data.name,
          webViewLink: file.data.webViewLink,
        },
        { headers: rateLimitResult.headers },
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
