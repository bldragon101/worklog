import { NextRequest, NextResponse } from "next/server";
import { createGoogleDriveClient } from "@/lib/google-auth";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import { z } from "zod";
import { drive_v3 } from "googleapis";

const MY_DRIVE_SENTINEL = "my-drive";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

const driveIdPattern = /^[A-Za-z0-9_-]+$/;

const getQuerySchema = z.object({
  action: z.enum([
    "list-shared-drives",
    "list-drive-folders",
    "list-folder-contents",
    "list-hierarchical-folders",
    "create-folder",
  ]),
  driveId: z
    .string()
    .regex(driveIdPattern, "Invalid Drive ID format")
    .optional(),
  folderId: z
    .string()
    .regex(driveIdPattern, "Invalid folder ID format")
    .optional(),
  parentId: z
    .string()
    .regex(driveIdPattern, "Invalid parent ID format")
    .optional(),
  folderName: z.string().optional(),
});

function isMyDrive({ driveId }: { driveId: string | undefined }): boolean {
  return driveId === MY_DRIVE_SENTINEL;
}

function buildListParams({
  driveId,
  query,
  fields,
  pageSize,
  pageToken,
  orderBy,
}: {
  driveId: string;
  query: string;
  fields: string;
  pageSize: number;
  pageToken?: string;
  orderBy?: string;
}): drive_v3.Params$Resource$Files$List {
  if (isMyDrive({ driveId })) {
    return {
      corpora: "user",
      includeItemsFromAllDrives: false,
      supportsAllDrives: true,
      q: query,
      fields,
      pageSize,
      pageToken: pageToken ?? undefined,
      orderBy,
    };
  }

  return {
    corpora: "drive",
    driveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    q: query,
    fields,
    pageSize,
    pageToken: pageToken ?? undefined,
    orderBy,
  };
}

export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);

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

    const drive = await createGoogleDriveClient();

    switch (action) {
      case "list-shared-drives": {
        const sharedDrivesResponse = await drive.drives.list({
          pageSize: 100,
          fields: "nextPageToken, drives(id, name)",
        });

        const sharedDrives = sharedDrivesResponse.data.drives || [];

        const drives = [
          { id: MY_DRIVE_SENTINEL, name: "My Drive" },
          ...sharedDrives.map((d) => ({
            id: d.id,
            name: d.name,
          })),
        ];

        return NextResponse.json(
          {
            success: true,
            sharedDrives: drives,
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

        let allFolders: drive_v3.Schema$File[] = [];
        let pageToken: string | undefined;

        do {
          const response: drive_v3.Schema$FileList = (
            await drive.files.list(
              buildListParams({
                driveId,
                query: `mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: "nextPageToken, files(id, name, mimeType, createdTime)",
                pageSize: 1000,
                pageToken,
              }),
            )
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

        const filesResponse = await drive.files.list(
          buildListParams({
            driveId,
            query: `'${folderId}' in parents and trashed=false`,
            fields: "files(id, name, mimeType, createdTime, modifiedTime)",
            pageSize: 100,
            orderBy: "modifiedTime desc",
          }),
        );

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

        let allHierarchicalFiles: drive_v3.Schema$File[] = [];

        if (effectiveParentId === "root") {
          if (isMyDrive({ driveId })) {
            let pageToken: string | undefined;

            do {
              const hierarchicalResponse: drive_v3.Schema$FileList = (
                await drive.files.list(
                  buildListParams({
                    driveId,
                    query: `'root' in parents and trashed=false`,
                    fields:
                      "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, parents)",
                    pageSize: 1000,
                    pageToken,
                    orderBy: "folder,name",
                  }),
                )
              ).data;

              const files = hierarchicalResponse.files || [];
              allHierarchicalFiles = allHierarchicalFiles.concat(files);
              pageToken = hierarchicalResponse.nextPageToken ?? undefined;
            } while (pageToken);
          } else {
            let pageToken: string | undefined;

            do {
              const hierarchicalResponse: drive_v3.Schema$FileList = (
                await drive.files.list(
                  buildListParams({
                    driveId,
                    query: `trashed=false`,
                    fields:
                      "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, parents)",
                    pageSize: 1000,
                    pageToken,
                    orderBy: "folder,name",
                  }),
                )
              ).data;

              const files = hierarchicalResponse.files || [];
              allHierarchicalFiles = allHierarchicalFiles.concat(files);
              pageToken = hierarchicalResponse.nextPageToken ?? undefined;
            } while (pageToken);

            allHierarchicalFiles = allHierarchicalFiles.filter(
              (file) =>
                !file.parents ||
                (file.parents.length === 1 && file.parents[0] === driveId),
            );
          }
        } else {
          let pageToken: string | undefined;

          do {
            const hierarchicalResponse: drive_v3.Schema$FileList = (
              await drive.files.list(
                buildListParams({
                  driveId,
                  query: `'${effectiveParentId}' in parents and trashed=false`,
                  fields:
                    "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, parents)",
                  pageSize: 1000,
                  pageToken,
                  orderBy: "folder,name",
                }),
              )
            ).data;

            const files = hierarchicalResponse.files || [];
            allHierarchicalFiles = allHierarchicalFiles.concat(files);
            pageToken = hierarchicalResponse.nextPageToken ?? undefined;
          } while (pageToken);
        }

        return NextResponse.json(
          {
            success: true,
            files: allHierarchicalFiles.map((file) => ({
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

        const parents = isMyDrive({ driveId })
          ? [
              effectiveFolderParentId === "root"
                ? "root"
                : effectiveFolderParentId,
            ]
          : effectiveFolderParentId === "root"
            ? [driveId]
            : [effectiveFolderParentId];

        const folderMetadata = {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents,
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
    const safeMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Google Drive error:", safeMessage);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process Google Drive request",
      },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}

const postBodySchema = z
  .object({
    fileName: z.string().min(1),
    fileContent: z.string().optional(),
    driveId: z.string().min(1).regex(driveIdPattern, "Invalid Drive ID format"),
    folderId: z
      .string()
      .min(1)
      .regex(driveIdPattern, "Invalid folder ID format"),
    isImageUpload: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isImageUpload && !data.fileContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fileContent is required when isImageUpload is false",
        path: ["fileContent"],
      });
    }
  });

export async function POST(request: NextRequest) {
  const uploadRateLimit = createRateLimiter(rateLimitConfigs.upload);
  const rateLimitResult = uploadRateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();

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

    const { fileName, fileContent, folderId, isImageUpload } =
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
    const safeMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Upload error:", safeMessage);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to upload file",
      },
      { status: 500, headers: rateLimitResult.headers },
    );
  }
}
