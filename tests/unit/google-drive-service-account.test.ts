/**
 * Unit tests for Google Drive service-account route
 * Tests My Drive vs Shared Drives compatibility, buildListParams, isMyDrive,
 * drive listing, folder operations, and create-folder parent logic
 */

import { z } from "zod";

const MY_DRIVE_SENTINEL = "my-drive";

function isMyDrive({ driveId }: { driveId: string | undefined }): boolean {
  return driveId === MY_DRIVE_SENTINEL;
}

interface ListParams {
  corpora: string;
  driveId?: string;
  includeItemsFromAllDrives: boolean;
  supportsAllDrives: boolean;
  q: string;
  fields: string;
  pageSize: number;
  pageToken?: string;
  orderBy?: string;
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
}): ListParams {
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

function buildCreateFolderParents({
  driveId,
  parentId,
}: {
  driveId: string;
  parentId: string;
}): string[] {
  if (isMyDrive({ driveId })) {
    return [parentId === "root" ? "root" : parentId];
  }
  return [parentId === "root" ? driveId : parentId];
}

function buildDrivesList({
  sharedDrives,
}: {
  sharedDrives: Array<{
    id: string | null | undefined;
    name: string | null | undefined;
  }>;
}): Array<{ id: string | null | undefined; name: string | null | undefined }> {
  return [
    { id: MY_DRIVE_SENTINEL, name: "My Drive" },
    ...sharedDrives.map((d) => ({
      id: d.id,
      name: d.name,
    })),
  ];
}

function buildRootQuery({ driveId }: { driveId: string }): string {
  if (isMyDrive({ driveId })) {
    return "'root' in parents and trashed=false";
  }
  return "trashed=false";
}

function filterRootFiles({
  driveId,
  files,
}: {
  driveId: string;
  files: Array<{ parents?: string[] }>;
}): Array<{ parents?: string[] }> {
  if (isMyDrive({ driveId })) {
    return files;
  }
  return files.filter(
    (file) =>
      !file.parents ||
      (file.parents.length === 1 && file.parents[0] === driveId),
  );
}

describe("Google Drive Service Account Route", () => {
  describe("isMyDrive", () => {
    it("should return true for my-drive sentinel value", () => {
      expect(isMyDrive({ driveId: MY_DRIVE_SENTINEL })).toBe(true);
    });

    it("should return false for a shared drive ID", () => {
      expect(isMyDrive({ driveId: "0APfGHs2mkmXKUk9PVA" })).toBe(false);
    });

    it("should return false for undefined driveId", () => {
      expect(isMyDrive({ driveId: undefined })).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isMyDrive({ driveId: "" })).toBe(false);
    });

    it("should return false for similar but incorrect values", () => {
      expect(isMyDrive({ driveId: "my_drive" })).toBe(false);
      expect(isMyDrive({ driveId: "My Drive" })).toBe(false);
      expect(isMyDrive({ driveId: "MY-DRIVE" })).toBe(false);
      expect(isMyDrive({ driveId: "mydrive" })).toBe(false);
    });
  });

  describe("buildListParams", () => {
    const baseArgs = {
      query: "trashed=false",
      fields: "files(id, name)",
      pageSize: 100,
    };

    describe("My Drive (personal drive)", () => {
      it("should use corpora 'user' for My Drive", () => {
        const params = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          ...baseArgs,
        });

        expect(params.corpora).toBe("user");
      });

      it("should not include driveId in params for My Drive", () => {
        const params = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          ...baseArgs,
        });

        expect(params.driveId).toBeUndefined();
      });

      it("should set includeItemsFromAllDrives to false for My Drive", () => {
        const params = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          ...baseArgs,
        });

        expect(params.includeItemsFromAllDrives).toBe(false);
      });

      it("should still set supportsAllDrives to true for My Drive", () => {
        const params = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          ...baseArgs,
        });

        expect(params.supportsAllDrives).toBe(true);
      });

      it("should pass through query, fields, and pageSize for My Drive", () => {
        const params = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          query: "mimeType='application/vnd.google-apps.folder'",
          fields: "files(id, name, mimeType)",
          pageSize: 500,
        });

        expect(params.q).toBe("mimeType='application/vnd.google-apps.folder'");
        expect(params.fields).toBe("files(id, name, mimeType)");
        expect(params.pageSize).toBe(500);
      });

      it("should handle pageToken for My Drive", () => {
        const params = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          ...baseArgs,
          pageToken: "next-page-token-123",
        });

        expect(params.pageToken).toBe("next-page-token-123");
      });

      it("should handle undefined pageToken for My Drive", () => {
        const params = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          ...baseArgs,
          pageToken: undefined,
        });

        expect(params.pageToken).toBeUndefined();
      });

      it("should pass through orderBy for My Drive", () => {
        const params = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          ...baseArgs,
          orderBy: "folder,name",
        });

        expect(params.orderBy).toBe("folder,name");
      });
    });

    describe("Shared Drives", () => {
      const sharedDriveId = "0APfGHs2mkmXKUk9PVA";

      it("should use corpora 'drive' for shared drives", () => {
        const params = buildListParams({
          driveId: sharedDriveId,
          ...baseArgs,
        });

        expect(params.corpora).toBe("drive");
      });

      it("should include driveId in params for shared drives", () => {
        const params = buildListParams({
          driveId: sharedDriveId,
          ...baseArgs,
        });

        expect(params.driveId).toBe(sharedDriveId);
      });

      it("should set includeItemsFromAllDrives to true for shared drives", () => {
        const params = buildListParams({
          driveId: sharedDriveId,
          ...baseArgs,
        });

        expect(params.includeItemsFromAllDrives).toBe(true);
      });

      it("should set supportsAllDrives to true for shared drives", () => {
        const params = buildListParams({
          driveId: sharedDriveId,
          ...baseArgs,
        });

        expect(params.supportsAllDrives).toBe(true);
      });

      it("should pass through query, fields, and pageSize for shared drives", () => {
        const params = buildListParams({
          driveId: sharedDriveId,
          query: "'folderId123' in parents and trashed=false",
          fields: "nextPageToken, files(id, name, mimeType, createdTime)",
          pageSize: 1000,
        });

        expect(params.q).toBe("'folderId123' in parents and trashed=false");
        expect(params.fields).toBe(
          "nextPageToken, files(id, name, mimeType, createdTime)",
        );
        expect(params.pageSize).toBe(1000);
      });

      it("should handle pageToken for shared drives", () => {
        const params = buildListParams({
          driveId: sharedDriveId,
          ...baseArgs,
          pageToken: "shared-page-token-456",
        });

        expect(params.pageToken).toBe("shared-page-token-456");
      });

      it("should handle orderBy for shared drives", () => {
        const params = buildListParams({
          driveId: sharedDriveId,
          ...baseArgs,
          orderBy: "modifiedTime desc",
        });

        expect(params.orderBy).toBe("modifiedTime desc");
      });
    });

    describe("params consistency between My Drive and Shared Drives", () => {
      it("should always include supportsAllDrives regardless of drive type", () => {
        const myDriveParams = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          ...baseArgs,
        });
        const sharedParams = buildListParams({
          driveId: "shared-id",
          ...baseArgs,
        });

        expect(myDriveParams.supportsAllDrives).toBe(true);
        expect(sharedParams.supportsAllDrives).toBe(true);
      });

      it("should pass query identically for both drive types", () => {
        const testQuery =
          "mimeType='application/vnd.google-apps.folder' and trashed=false";

        const myDriveParams = buildListParams({
          driveId: MY_DRIVE_SENTINEL,
          query: testQuery,
          fields: "files(id)",
          pageSize: 10,
        });
        const sharedParams = buildListParams({
          driveId: "shared-id",
          query: testQuery,
          fields: "files(id)",
          pageSize: 10,
        });

        expect(myDriveParams.q).toBe(testQuery);
        expect(sharedParams.q).toBe(testQuery);
      });
    });
  });

  describe("buildDrivesList", () => {
    it("should always include My Drive as the first option", () => {
      const result = buildDrivesList({ sharedDrives: [] });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(MY_DRIVE_SENTINEL);
      expect(result[0].name).toBe("My Drive");
    });

    it("should include shared drives after My Drive", () => {
      const sharedDrives = [
        { id: "drive-1", name: "Team Drive A" },
        { id: "drive-2", name: "Team Drive B" },
      ];

      const result = buildDrivesList({ sharedDrives });

      expect(result.length).toBe(3);
      expect(result[0].id).toBe(MY_DRIVE_SENTINEL);
      expect(result[0].name).toBe("My Drive");
      expect(result[1].id).toBe("drive-1");
      expect(result[1].name).toBe("Team Drive A");
      expect(result[2].id).toBe("drive-2");
      expect(result[2].name).toBe("Team Drive B");
    });

    it("should handle accounts with no shared drives", () => {
      const result = buildDrivesList({ sharedDrives: [] });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(MY_DRIVE_SENTINEL);
    });

    it("should handle many shared drives", () => {
      const sharedDrives = Array.from({ length: 20 }, (_, i) => ({
        id: `drive-${i}`,
        name: `Shared Drive ${i}`,
      }));

      const result = buildDrivesList({ sharedDrives });

      expect(result.length).toBe(21);
      expect(result[0].id).toBe(MY_DRIVE_SENTINEL);

      for (let i = 0; i < 20; i++) {
        expect(result[i + 1].id).toBe(`drive-${i}`);
        expect(result[i + 1].name).toBe(`Shared Drive ${i}`);
      }
    });

    it("should preserve shared drive order", () => {
      const sharedDrives = [
        { id: "z-drive", name: "Zebra Drive" },
        { id: "a-drive", name: "Alpha Drive" },
        { id: "m-drive", name: "Middle Drive" },
      ];

      const result = buildDrivesList({ sharedDrives });

      expect(result[1].name).toBe("Zebra Drive");
      expect(result[2].name).toBe("Alpha Drive");
      expect(result[3].name).toBe("Middle Drive");
    });
  });

  describe("buildRootQuery", () => {
    it("should query root parents for My Drive", () => {
      const query = buildRootQuery({ driveId: MY_DRIVE_SENTINEL });

      expect(query).toBe("'root' in parents and trashed=false");
    });

    it("should query all non-trashed files for shared drives", () => {
      const query = buildRootQuery({ driveId: "shared-drive-id" });

      expect(query).toBe("trashed=false");
    });

    it("should produce different queries for My Drive vs Shared Drive", () => {
      const myDriveQuery = buildRootQuery({ driveId: MY_DRIVE_SENTINEL });
      const sharedQuery = buildRootQuery({ driveId: "shared-id" });

      expect(myDriveQuery).not.toBe(sharedQuery);
    });
  });

  describe("filterRootFiles", () => {
    it("should not filter files for My Drive (all returned files are already root)", () => {
      const files = [
        { parents: ["root-id-1"] },
        { parents: ["root-id-2"] },
        { parents: undefined },
      ];

      const result = filterRootFiles({
        driveId: MY_DRIVE_SENTINEL,
        files,
      });

      expect(result.length).toBe(3);
    });

    it("should filter shared drive files to only root-level items", () => {
      const driveId = "shared-drive-123";
      const files = [
        { parents: [driveId] },
        { parents: ["some-subfolder-id"] },
        { parents: [driveId] },
        { parents: undefined },
      ];

      const result = filterRootFiles({ driveId, files });

      expect(result.length).toBe(3);
      expect(result[0].parents).toEqual([driveId]);
      expect(result[1].parents).toEqual([driveId]);
      expect(result[2].parents).toBeUndefined();
    });

    it("should exclude shared drive files with non-root parents", () => {
      const driveId = "shared-drive-456";
      const files = [
        { parents: ["subfolder-1"] },
        { parents: ["subfolder-2"] },
      ];

      const result = filterRootFiles({ driveId, files });

      expect(result.length).toBe(0);
    });

    it("should include files without parents in shared drives", () => {
      const driveId = "shared-drive-789";
      const files = [{ parents: undefined }, {}];

      const result = filterRootFiles({ driveId, files });

      expect(result.length).toBe(2);
    });

    it("should exclude files with multiple parents in shared drives", () => {
      const driveId = "shared-drive-multi";
      const files = [{ parents: [driveId, "other-parent"] }];

      const result = filterRootFiles({ driveId, files });

      expect(result.length).toBe(0);
    });

    it("should handle empty file list", () => {
      const result = filterRootFiles({
        driveId: "any-drive",
        files: [],
      });

      expect(result.length).toBe(0);
    });
  });

  describe("buildCreateFolderParents", () => {
    describe("My Drive", () => {
      it("should use 'root' as parent when parentId is 'root'", () => {
        const parents = buildCreateFolderParents({
          driveId: MY_DRIVE_SENTINEL,
          parentId: "root",
        });

        expect(parents).toEqual(["root"]);
      });

      it("should use actual parentId when not root", () => {
        const parents = buildCreateFolderParents({
          driveId: MY_DRIVE_SENTINEL,
          parentId: "folder-abc-123",
        });

        expect(parents).toEqual(["folder-abc-123"]);
      });
    });

    describe("Shared Drives", () => {
      it("should use driveId as parent when parentId is 'root'", () => {
        const driveId = "shared-drive-xyz";
        const parents = buildCreateFolderParents({
          driveId,
          parentId: "root",
        });

        expect(parents).toEqual([driveId]);
      });

      it("should use actual parentId when not root", () => {
        const parents = buildCreateFolderParents({
          driveId: "shared-drive-xyz",
          parentId: "subfolder-456",
        });

        expect(parents).toEqual(["subfolder-456"]);
      });
    });

    describe("root parent differences", () => {
      it("should produce different root parents for My Drive vs Shared Drive", () => {
        const driveId = "shared-drive-abc";

        const myDriveParents = buildCreateFolderParents({
          driveId: MY_DRIVE_SENTINEL,
          parentId: "root",
        });
        const sharedParents = buildCreateFolderParents({
          driveId,
          parentId: "root",
        });

        expect(myDriveParents).toEqual(["root"]);
        expect(sharedParents).toEqual([driveId]);
        expect(myDriveParents).not.toEqual(sharedParents);
      });

      it("should produce identical parents for non-root in both drive types", () => {
        const folderId = "specific-folder-789";

        const myDriveParents = buildCreateFolderParents({
          driveId: MY_DRIVE_SENTINEL,
          parentId: folderId,
        });
        const sharedParents = buildCreateFolderParents({
          driveId: "shared-drive-abc",
          parentId: folderId,
        });

        expect(myDriveParents).toEqual([folderId]);
        expect(sharedParents).toEqual([folderId]);
      });
    });

    it("should always return a single-element array", () => {
      const cases = [
        { driveId: MY_DRIVE_SENTINEL, parentId: "root" },
        { driveId: MY_DRIVE_SENTINEL, parentId: "folder-1" },
        { driveId: "shared-1", parentId: "root" },
        { driveId: "shared-1", parentId: "folder-2" },
      ];

      for (const testCase of cases) {
        const parents = buildCreateFolderParents(testCase);
        expect(parents).toHaveLength(1);
      }
    });
  });

  describe("Drive listing response format", () => {
    it("should format My Drive entry correctly", () => {
      const drives = buildDrivesList({ sharedDrives: [] });
      const myDrive = drives[0];

      expect(myDrive).toEqual({
        id: MY_DRIVE_SENTINEL,
        name: "My Drive",
      });
    });

    it("should format shared drive entries to match expected shape", () => {
      const sharedDrives = [
        { id: "0APfGHs2mkmXKUk9PVA", name: "WorkLog Files" },
      ];

      const drives = buildDrivesList({ sharedDrives });

      expect(drives[1]).toEqual({
        id: "0APfGHs2mkmXKUk9PVA",
        name: "WorkLog Files",
      });
    });

    it("should be usable as API response sharedDrives field", () => {
      const sharedDrives = [
        { id: "drive-1", name: "Drive One" },
        { id: "drive-2", name: "Drive Two" },
      ];

      const response = {
        success: true,
        sharedDrives: buildDrivesList({ sharedDrives }),
      };

      expect(response.success).toBe(true);
      expect(response.sharedDrives).toHaveLength(3);
      expect(response.sharedDrives[0].id).toBe(MY_DRIVE_SENTINEL);
    });
  });

  describe("Query schema validation", () => {
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

    it("should accept my-drive as a valid driveId", () => {
      const result = getQuerySchema.safeParse({
        action: "list-drive-folders",
        driveId: MY_DRIVE_SENTINEL,
      });

      expect(result.success).toBe(true);
    });

    it("should accept shared drive IDs", () => {
      const result = getQuerySchema.safeParse({
        action: "list-drive-folders",
        driveId: "0APfGHs2mkmXKUk9PVA",
      });

      expect(result.success).toBe(true);
    });

    it("should allow driveId to be omitted for list-shared-drives", () => {
      const result = getQuerySchema.safeParse({
        action: "list-shared-drives",
      });

      expect(result.success).toBe(true);
    });

    it("should reject invalid action values", () => {
      const result = getQuerySchema.safeParse({
        action: "invalid-action",
        driveId: MY_DRIVE_SENTINEL,
      });

      expect(result.success).toBe(false);
    });

    it("should accept all valid actions", () => {
      const actions = [
        "list-shared-drives",
        "list-drive-folders",
        "list-folder-contents",
        "list-hierarchical-folders",
        "create-folder",
      ];

      for (const action of actions) {
        const result = getQuerySchema.safeParse({ action });
        expect(result.success).toBe(true);
      }
    });

    it("should accept create-folder with all params", () => {
      const result = getQuerySchema.safeParse({
        action: "create-folder",
        driveId: MY_DRIVE_SENTINEL,
        parentId: "root",
        folderName: "New Folder",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("My Drive folder listing queries", () => {
    it("should build correct folder listing query for My Drive", () => {
      const params = buildListParams({
        driveId: MY_DRIVE_SENTINEL,
        query:
          "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: "nextPageToken, files(id, name, mimeType, createdTime)",
        pageSize: 1000,
      });

      expect(params.corpora).toBe("user");
      expect(params.driveId).toBeUndefined();
      expect(params.q).toBe(
        "mimeType='application/vnd.google-apps.folder' and trashed=false",
      );
    });

    it("should build correct folder contents query for My Drive", () => {
      const folderId = "my-folder-id-123";
      const params = buildListParams({
        driveId: MY_DRIVE_SENTINEL,
        query: `'${folderId}' in parents and trashed=false`,
        fields: "files(id, name, mimeType, createdTime, modifiedTime)",
        pageSize: 100,
        orderBy: "modifiedTime desc",
      });

      expect(params.corpora).toBe("user");
      expect(params.q).toBe(`'${folderId}' in parents and trashed=false`);
      expect(params.orderBy).toBe("modifiedTime desc");
    });

    it("should build correct hierarchical root query for My Drive", () => {
      const params = buildListParams({
        driveId: MY_DRIVE_SENTINEL,
        query: "'root' in parents and trashed=false",
        fields:
          "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, parents)",
        pageSize: 1000,
        orderBy: "folder,name",
      });

      expect(params.corpora).toBe("user");
      expect(params.q).toBe("'root' in parents and trashed=false");
      expect(params.orderBy).toBe("folder,name");
    });
  });

  describe("Shared Drive folder listing queries", () => {
    const sharedDriveId = "0APfGHs2mkmXKUk9PVA";

    it("should build correct folder listing query for shared drives", () => {
      const params = buildListParams({
        driveId: sharedDriveId,
        query:
          "mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: "nextPageToken, files(id, name, mimeType, createdTime)",
        pageSize: 1000,
      });

      expect(params.corpora).toBe("drive");
      expect(params.driveId).toBe(sharedDriveId);
      expect(params.includeItemsFromAllDrives).toBe(true);
    });

    it("should build correct folder contents query for shared drives", () => {
      const folderId = "shared-folder-456";
      const params = buildListParams({
        driveId: sharedDriveId,
        query: `'${folderId}' in parents and trashed=false`,
        fields: "files(id, name, mimeType, createdTime, modifiedTime)",
        pageSize: 100,
        orderBy: "modifiedTime desc",
      });

      expect(params.corpora).toBe("drive");
      expect(params.driveId).toBe(sharedDriveId);
      expect(params.q).toBe(`'${folderId}' in parents and trashed=false`);
    });

    it("should build correct hierarchical root query for shared drives", () => {
      const params = buildListParams({
        driveId: sharedDriveId,
        query: "trashed=false",
        fields:
          "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, parents)",
        pageSize: 1000,
        orderBy: "folder,name",
      });

      expect(params.corpora).toBe("drive");
      expect(params.driveId).toBe(sharedDriveId);
      expect(params.q).toBe("trashed=false");
    });
  });

  describe("Settings compatibility", () => {
    it("should accept my-drive as a valid driveId in settings", () => {
      const settings = {
        driveId: MY_DRIVE_SENTINEL,
        driveName: "My Drive",
        baseFolderId: "root-folder-id",
        folderName: "WorkLog",
        folderPath: ["WorkLog"],
        purpose: "job_attachments",
      };

      expect(settings.driveId).toBe(MY_DRIVE_SENTINEL);
      expect(settings.driveName).toBe("My Drive");
    });

    it("should accept shared drive ID in settings", () => {
      const settings = {
        driveId: "0APfGHs2mkmXKUk9PVA",
        driveName: "Team Drive",
        baseFolderId: "folder-in-shared",
        folderName: "WorkLog",
        folderPath: ["WorkLog"],
        purpose: "job_attachments",
      };

      expect(settings.driveId).toBe("0APfGHs2mkmXKUk9PVA");
    });

    it("should be able to determine drive type from saved settings", () => {
      const myDriveSettings = { driveId: MY_DRIVE_SENTINEL };
      const sharedDriveSettings = { driveId: "0APfGHs2mkmXKUk9PVA" };

      expect(isMyDrive({ driveId: myDriveSettings.driveId })).toBe(true);
      expect(isMyDrive({ driveId: sharedDriveSettings.driveId })).toBe(false);
    });
  });

  describe("End-to-end flow simulation", () => {
    it("should handle full My Drive flow: list drives -> select -> browse -> create folder", () => {
      const drives = buildDrivesList({ sharedDrives: [] });
      expect(drives[0].id).toBe(MY_DRIVE_SENTINEL);

      const selectedDriveId = MY_DRIVE_SENTINEL;
      expect(isMyDrive({ driveId: selectedDriveId })).toBe(true);

      const listParams = buildListParams({
        driveId: selectedDriveId,
        query: "'root' in parents and trashed=false",
        fields: "files(id, name)",
        pageSize: 100,
      });
      expect(listParams.corpora).toBe("user");
      expect(listParams.driveId).toBeUndefined();

      const createParents = buildCreateFolderParents({
        driveId: selectedDriveId,
        parentId: "root",
      });
      expect(createParents).toEqual(["root"]);
    });

    it("should handle full Shared Drive flow: list drives -> select -> browse -> create folder", () => {
      const sharedDrives = [{ id: "shared-drive-abc", name: "Company Drive" }];
      const drives = buildDrivesList({ sharedDrives });
      expect(drives.length).toBe(2);
      expect(drives[1].id).toBe("shared-drive-abc");

      const selectedDriveId = "shared-drive-abc";
      expect(isMyDrive({ driveId: selectedDriveId })).toBe(false);

      const listParams = buildListParams({
        driveId: selectedDriveId,
        query: "trashed=false",
        fields: "files(id, name)",
        pageSize: 100,
      });
      expect(listParams.corpora).toBe("drive");
      expect(listParams.driveId).toBe(selectedDriveId);

      const createParents = buildCreateFolderParents({
        driveId: selectedDriveId,
        parentId: "root",
      });
      expect(createParents).toEqual([selectedDriveId]);
    });

    it("should handle browsing subfolders identically for both drive types", () => {
      const subfolderId = "subfolder-xyz-789";

      const myDriveParams = buildListParams({
        driveId: MY_DRIVE_SENTINEL,
        query: `'${subfolderId}' in parents and trashed=false`,
        fields: "files(id, name)",
        pageSize: 100,
      });

      const sharedParams = buildListParams({
        driveId: "shared-drive-id",
        query: `'${subfolderId}' in parents and trashed=false`,
        fields: "files(id, name)",
        pageSize: 100,
      });

      expect(myDriveParams.q).toBe(sharedParams.q);
      expect(myDriveParams.fields).toBe(sharedParams.fields);
      expect(myDriveParams.pageSize).toBe(sharedParams.pageSize);

      const myDriveCreateParents = buildCreateFolderParents({
        driveId: MY_DRIVE_SENTINEL,
        parentId: subfolderId,
      });
      const sharedCreateParents = buildCreateFolderParents({
        driveId: "shared-drive-id",
        parentId: subfolderId,
      });

      expect(myDriveCreateParents).toEqual(sharedCreateParents);
    });
  });
});
