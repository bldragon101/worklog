import { NextRequest } from "next/server";
import { z } from "zod";
import Papa from "papaparse";
import { POST as createJob } from "@/app/api/jobs/route";
import { PATCH as updateJob } from "@/app/api/jobs/[id]/route";
import { POST as saveBatch } from "@/app/api/jobs/bulk/route";
import { POST as importJobs } from "@/app/api/import/jobs/route";
import { GET as exportJobs } from "@/app/api/export/jobs/route";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobs: {
      create: mocks.create,
      update: mocks.update,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));
vi.mock("@/lib/permissions", () => ({ getUserRole: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));
vi.mock("@/lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/utils/attachment-utils", () => ({
  syncJobAttachmentNames: vi.fn(),
}));
vi.mock("@/lib/attachment-config", () => ({
  getJobAttachmentConfig: vi.fn(),
}));
vi.mock("@/lib/write-security", () => ({
  secureWriteOperation: async (
    request: NextRequest,
    { schema }: { schema: z.ZodType },
  ) => ({
    success: true,
    data: schema.parse(await request.json()),
    userId: "test-user",
  }),
  sanitizeWriteData: (data: Record<string, unknown>) => data,
}));

const baseJob = {
  date: "2026-09-01",
  driver: "Test Driver",
  customer: "Test Customer",
  billTo: "Test Customer",
  truckType: "Tray",
  registration: "ABC123",
  pickup: "Melbourne",
  chargedHours: 8,
};

function jsonRequest({
  body,
  method = "POST",
}: {
  body: unknown;
  method?: string;
}) {
  return new NextRequest("http://localhost/api/jobs", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data }),
  );
  mocks.findUnique.mockResolvedValue({ id: 1, ...baseJob, driverOnly: false });
  mocks.findMany.mockResolvedValue([{ id: 1 }]);
  mocks.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 1,
      ...baseJob,
      ...data,
    }),
  );
  mocks.transaction.mockImplementation(
    async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({ jobs: { create: mocks.create, update: mocks.update } }),
  );
});

for (const mode of ["single", "bulk"] as const) {
  describe(`${mode} driver-only persistence`, () => {
    it.each([
      { label: "omitted", override: {}, expected: false },
      { label: "explicit false", override: { driverOnly: false }, expected: false },
      { label: "explicit null", override: { driverOnly: null }, expected: false },
      { label: "enabled", override: { driverOnly: true }, expected: true },
    ])("creates a job with the flag $label", async ({ override, expected }) => {
      const job = { ...baseJob, ...override };
      const response =
        mode === "single"
          ? await createJob(jsonRequest({ body: job }))
          : await saveBatch(jsonRequest({ body: { creates: [job] } }));
      expect(response.status).toBe(mode === "single" ? 201 : 200);
      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ driverOnly: expected }),
      });
    });

    it("keeps charged hours so the driver is still paid", async () => {
      const job = { ...baseJob, driverOnly: true, travelTimeHours: 1 };
      const response =
        mode === "single"
          ? await createJob(jsonRequest({ body: job }))
          : await saveBatch(jsonRequest({ body: { creates: [job] } }));
      expect(response.status).toBe(mode === "single" ? 201 : 200);
      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          chargedHours: 8,
          travelTimeHours: 1,
          driverOnly: true,
        }),
      });
    });

    it("toggles the flag on an existing job", async () => {
      const data = { driverOnly: true };
      const response =
        mode === "single"
          ? await updateJob(jsonRequest({ body: data, method: "PATCH" }), {
              params: Promise.resolve({ id: "1" }),
            })
          : await saveBatch(
              jsonRequest({ body: { updates: [{ id: 1, data }] } }),
            );
      expect(response.status).toBe(200);
      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { driverOnly: true },
      });
    });

    it("leaves the flag untouched when it is not part of the update", async () => {
      const data = { chargedHours: 9 };
      const response =
        mode === "single"
          ? await updateJob(jsonRequest({ body: data, method: "PATCH" }), {
              params: Promise.resolve({ id: "1" }),
            })
          : await saveBatch(
              jsonRequest({ body: { updates: [{ id: 1, data }] } }),
            );
      expect(response.status).toBe(200);
      expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty(
        "driverOnly",
      );
    });
  });
}

describe("driver-only CSV round trip", () => {
  async function importCsv({ rows }: { rows: Record<string, string>[] }) {
    const csv = Papa.unparse(
      rows.map((row) => ({
        Date: "2026-09-01",
        Driver: "Test Driver",
        Customer: "Test Customer",
        "Bill To": "Test Customer",
        "Charged Hours": "8",
        ...row,
      })),
    );
    const request = new NextRequest("http://localhost/api/import/jobs", {
      method: "POST",
    });
    vi.spyOn(request, "formData").mockResolvedValue({
      get: () => ({ text: async () => csv }),
    } as unknown as FormData);
    return importJobs(request);
  }

  it.each([
    { value: "Yes", expected: true },
    { value: "yes", expected: true },
    { value: "true", expected: true },
    { value: "No", expected: false },
    { value: "", expected: false },
  ])("imports 'Driver Only' of '$value'", async ({ value, expected }) => {
    const response = await importCsv({ rows: [{ "Driver Only": value }] });
    expect(await response.json()).toMatchObject({ imported: 1, errors: [] });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ driverOnly: expected }),
    });
  });

  it("exports the flag as Yes or No", async () => {
    const date = new Date("2026-09-01T00:00:00.000Z");
    mocks.findMany.mockResolvedValue(
      [true, false, null].map((driverOnly) => ({
        ...baseJob,
        date,
        createdAt: date,
        updatedAt: date,
        driverOnly,
      })),
    );
    const response = await exportJobs(
      new NextRequest("http://localhost/api/export/jobs"),
    );
    expect(response.status).toBe(200);
    const csv = Papa.parse<Record<string, string>>(await response.text(), {
      header: true,
    });
    expect(csv.errors).toEqual([]);
    expect(csv.data.map((row) => row["Driver Only"])).toEqual([
      "Yes",
      "No",
      "No",
    ]);
  });
});
