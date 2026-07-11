/**
 * @vitest-environment node
 *
 * Server-side tests for the bulk attachment upload route.
 * The key guarantee: each unique (week + customer/billTo) Google Drive folder
 * is created exactly once per batch, regardless of how many jobs map to it.
 */
import { NextRequest } from "next/server";

const FOLDER_MIME = "application/vnd.google-apps.folder";

const { mockDrive, mockPrisma } = vi.hoisted(() => ({
  mockDrive: {
    files: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    permissions: {
      create: vi.fn(),
    },
  },
  mockPrisma: {
    jobs: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    googleDriveSettings: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/google-auth", () => ({
  createGoogleDriveClient: vi.fn(() => Promise.resolve(mockDrive)),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: { "X-RateLimit-Remaining": "99" },
  }),
  rateLimitConfigs: { general: {} },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "@/app/api/jobs/attachments/bulk/route";
import { folderCache } from "@/lib/folder-cache";

interface TestJob {
  id: number;
  date: string;
  driver: string;
  customer: string;
  billTo: string;
  truckType: string;
  attachmentRunsheet: string[];
  attachmentDocket: string[];
  attachmentDeliveryPhotos: string[];
}

function makeJob({
  id,
  customer,
  billTo,
  date = "2026-04-20",
}: {
  id: number;
  customer: string;
  billTo: string;
  date?: string;
}): TestJob {
  return {
    id,
    date,
    driver: "Driver A",
    customer,
    billTo,
    truckType: "Truck",
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  };
}

function buildRequest({
  entries,
}: {
  entries: Array<{ jobId: number; type: string; fileName: string }>;
}): NextRequest {
  const formData = new FormData();
  entries.forEach(({ jobId, type, fileName }, index) => {
    const file = new File(["content"], fileName, { type: "application/pdf" });
    formData.append("files", file);
    formData.append(`jobIds[${index}]`, String(jobId));
    formData.append(`attachmentTypes[${index}]`, type);
  });
  formData.append("baseFolderId", "base-folder-id");
  formData.append("driveId", "drive-id");

  return new NextRequest("http://localhost:3000/api/jobs/attachments/bulk", {
    method: "POST",
    body: formData,
  });
}

function folderCreateNames(): string[] {
  return mockDrive.files.create.mock.calls
    .filter((call) => call[0]?.requestBody?.mimeType === FOLDER_MIME)
    .map((call) => call[0].requestBody.name as string);
}

function fileUploadCount(): number {
  return mockDrive.files.create.mock.calls.filter(
    (call) => call[0]?.requestBody?.mimeType !== FOLDER_MIME,
  ).length;
}

describe("Bulk attachment upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    folderCache.clearCache();

    // No existing folders or files in Drive, so every folder must be created.
    mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

    let fileCounter = 0;
    let folderCounter = 0;
    mockDrive.files.create.mockImplementation(async (params) => {
      const mimeType = params?.requestBody?.mimeType;
      if (mimeType === FOLDER_MIME) {
        folderCounter += 1;
        // Drive IDs contain no dots; the folder name (e.g. "26.04.26") must not
        // leak into the ID or downstream validation rejects it.
        return { data: { id: `folderid-${folderCounter}` } };
      }
      fileCounter += 1;
      return { data: { id: `fileid-${fileCounter}` } };
    });

    mockDrive.permissions.create.mockResolvedValue({});

    // Authorised Drive configuration by default.
    mockPrisma.googleDriveSettings.findFirst.mockResolvedValue({ id: 1 });

    mockPrisma.jobs.update.mockImplementation(async ({ where, data }) => ({
      ...makeJob({ id: where.id, customer: "X", billTo: "X" }),
      ...data,
    }));
  });

  it("creates the shared customer folder only once for many jobs", async () => {
    const jobs = [
      makeJob({ id: 1, customer: "Acme", billTo: "Acme" }),
      makeJob({ id: 2, customer: "Acme", billTo: "Acme" }),
      makeJob({ id: 3, customer: "Acme", billTo: "Acme" }),
    ];
    mockPrisma.jobs.findMany.mockResolvedValue(jobs);

    const request = buildRequest({
      entries: [
        { jobId: 1, type: "runsheet", fileName: "a.pdf" },
        { jobId: 2, type: "runsheet", fileName: "b.pdf" },
        { jobId: 3, type: "docket", fileName: "c.pdf" },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toHaveLength(3);
    expect(data.results.every((r: { success: boolean }) => r.success)).toBe(
      true,
    );

    const folderNames = folderCreateNames();
    // The "Acme" customer folder is created exactly once - this is the fix.
    expect(folderNames.filter((name) => name === "Acme")).toHaveLength(1);
    // The week-ending folder is also created exactly once.
    expect(
      folderNames.filter((name) => name !== "Acme"),
    ).toHaveLength(1);
    // One folder per level: week + customer = 2 folder creations total.
    expect(folderNames).toHaveLength(2);
    // One uploaded file per job.
    expect(fileUploadCount()).toBe(3);
    expect(mockPrisma.jobs.update).toHaveBeenCalledTimes(3);
  });

  it("creates a separate folder per distinct customer/billTo combination", async () => {
    const jobs = [
      makeJob({ id: 1, customer: "Acme", billTo: "Acme" }),
      makeJob({ id: 2, customer: "Acme", billTo: "Acme" }),
      makeJob({ id: 3, customer: "Globex", billTo: "Globex" }),
      makeJob({ id: 4, customer: "Acme", billTo: "Globex" }),
    ];
    mockPrisma.jobs.findMany.mockResolvedValue(jobs);

    const request = buildRequest({
      entries: [
        { jobId: 1, type: "runsheet", fileName: "a.pdf" },
        { jobId: 2, type: "runsheet", fileName: "b.pdf" },
        { jobId: 3, type: "runsheet", fileName: "c.pdf" },
        { jobId: 4, type: "runsheet", fileName: "d.pdf" },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(4);

    const folderNames = folderCreateNames();
    // Each distinct customer folder created exactly once.
    expect(folderNames.filter((name) => name === "Acme")).toHaveLength(1);
    expect(folderNames.filter((name) => name === "Globex")).toHaveLength(1);
    expect(folderNames.filter((name) => name === "Acme_Globex")).toHaveLength(
      1,
    );
    // 3 customer folders + 1 shared week folder = 4 folder creations.
    expect(folderNames).toHaveLength(4);
    expect(mockPrisma.jobs.update).toHaveBeenCalledTimes(4);
  });

  it("numbers files with the same prefix sequentially within one folder", async () => {
    const jobs = [makeJob({ id: 1, customer: "Acme", billTo: "Acme" })];
    mockPrisma.jobs.findMany.mockResolvedValue(jobs);

    const request = buildRequest({
      entries: [
        { jobId: 1, type: "runsheet", fileName: "a.pdf" },
        { jobId: 1, type: "runsheet", fileName: "b.pdf" },
      ],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results[0].success).toBe(true);

    const uploadedNames = mockDrive.files.create.mock.calls
      .filter((call) => call[0]?.requestBody?.mimeType !== FOLDER_MIME)
      .map((call) => call[0].requestBody.name as string);

    // First file has no suffix; the second is _2 - no name collision.
    expect(uploadedNames).toHaveLength(2);
    expect(uploadedNames[0]).not.toContain("_2.");
    expect(uploadedNames[1]).toContain("_2.");
  });

  it("rejects an unauthorised Drive configuration with 403 and no Drive writes", async () => {
    mockPrisma.googleDriveSettings.findFirst.mockResolvedValue(null);
    mockPrisma.jobs.findMany.mockResolvedValue([
      makeJob({ id: 1, customer: "Acme", billTo: "Acme" }),
    ]);

    const request = buildRequest({
      entries: [{ jobId: 1, type: "runsheet", fileName: "a.pdf" }],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/not authorised/i);
    expect(mockDrive.files.create).not.toHaveBeenCalled();
    expect(mockPrisma.jobs.update).not.toHaveBeenCalled();
  });

  it("includes rate-limit headers on early error responses", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/jobs/attachments/bulk",
      { method: "POST", body: new FormData() },
    );

    const response = await POST(request);

    // Missing baseFolderId/driveId -> 400, but headers must still be present.
    expect(response.status).toBe(400);
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
  });
});
