import { NextRequest } from "next/server";
import { z } from "zod";
import Papa from "papaparse";
import { POST as createJob } from "@/app/api/jobs/route";
import { PATCH as updateJob, PUT as replaceJob } from "@/app/api/jobs/[id]/route";
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
  travelTimeHours: 1,
};

function jsonRequest({ body, method = "POST" }: { body: unknown; method?: string }) {
  return new NextRequest("http://localhost/api/jobs", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function importCsv({ rows }: { rows: Record<string, string>[] }) {
  const csv = Papa.unparse(rows.map((row) => ({
    Date: "2026-09-01",
    Driver: "Test Driver",
    Customer: "Test Customer",
    "Bill To": "Test Customer",
    "Charged Hours": "8",
    "Travel Time Hours": "1",
    "Driver Hours": "",
    ...row,
  })));
  const request = new NextRequest("http://localhost/api/import/jobs", {
    method: "POST",
  });
  vi.spyOn(request, "formData").mockResolvedValue({
    get: () => ({ text: async () => csv }),
  } as unknown as FormData);
  return importJobs(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data }));
  mocks.findUnique.mockResolvedValue({ id: 1, ...baseJob, driverCharge: 9 });
  mocks.findMany.mockResolvedValue([{ id: 1 }]);
  mocks.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 1,
    ...baseJob,
    driverCharge: 9,
    ...data,
  }));
  mocks.transaction.mockImplementation(async (operation: (tx: unknown) => Promise<unknown>) =>
    operation({ jobs: { create: mocks.create, update: mocks.update } }),
  );
});

for (const mode of ["single", "bulk"] as const) {
  describe(`${mode} job hours persistence`, () => {
    it.each([
      { label: "omitted override", override: {}, expected: null },
      { label: "explicit null", override: { driverCharge: null }, expected: null },
      { label: "manual override equal to derived hours", override: { driverCharge: 9 }, expected: 9 },
      { label: "different manual override", override: { driverCharge: 12 }, expected: 12 },
    ])("creates with $label", async ({ override, expected }) => {
      const job = { ...baseJob, ...override };
      const response = mode === "single"
        ? await createJob(jsonRequest({ body: job }))
        : await saveBatch(jsonRequest({ body: { creates: [job] } }));
      expect(response.status).toBe(mode === "single" ? 201 : 200);
      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ chargedHours: 8, travelTimeHours: 1, driverCharge: expected }),
      });
    });

    it.each([
      { label: "charged hours", data: { chargedHours: 10 } },
      { label: "travel hours", data: { travelTimeHours: 2 } },
      { label: "both hours", data: { chargedHours: 10, travelTimeHours: 2 } },
      { label: "cleared travel hours", data: { travelTimeHours: null } },
    ])("preserves an equal-to-sum historical override when changing $label", async ({ data }) => {
      const response = mode === "single"
        ? await updateJob(jsonRequest({ body: data, method: "PATCH" }), { params: Promise.resolve({ id: "1" }) })
        : await saveBatch(jsonRequest({ body: { updates: [{ id: 1, data }] } }));
      expect(response.status).toBe(200);
      expect(mocks.update).toHaveBeenCalledWith({ where: { id: 1 }, data });
      expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("driverCharge");
      expect(await mocks.update.mock.results[0].value).toMatchObject({ driverCharge: 9 });
    });

    it.each([
      { label: "clear to derived", driverCharge: null },
      { label: "set manual override", driverCharge: 12 },
      { label: "set override equal to sum", driverCharge: 9 },
    ])("allows an explicit $label", async ({ driverCharge }) => {
      const data = { chargedHours: 8, travelTimeHours: 1, driverCharge };
      const response = mode === "single"
        ? await updateJob(jsonRequest({ body: data, method: "PATCH" }), { params: Promise.resolve({ id: "1" }) })
        : await saveBatch(jsonRequest({ body: { updates: [{ id: 1, data }] } }));
      expect(response.status).toBe(200);
      expect(mocks.update).toHaveBeenCalledWith({ where: { id: 1 }, data });
      expect(await mocks.update.mock.results[0].value).toMatchObject({ driverCharge });
    });
  });
}

for (const mode of ["single", "bulk"] as const) {
  describe(`${mode} job deduction persistence`, () => {
    it.each([
      { label: "omitted deduction", override: {}, expected: null },
      {
        label: "explicit null",
        override: { deductionHours: null },
        expected: null,
      },
      { label: "zero", override: { deductionHours: 0 }, expected: 0 },
      { label: "a deduction", override: { deductionHours: 1.5 }, expected: 1.5 },
    ])("creates with $label", async ({ override, expected }) => {
      const job = { ...baseJob, ...override };
      const response =
        mode === "single"
          ? await createJob(jsonRequest({ body: job }))
          : await saveBatch(jsonRequest({ body: { creates: [job] } }));
      expect(response.status).toBe(mode === "single" ? 201 : 200);
      expect(mocks.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ deductionHours: expected }),
      });
    });

    it("updates the deduction without touching driver hours", async () => {
      const data = { deductionHours: 2 };
      const response =
        mode === "single"
          ? await updateJob(jsonRequest({ body: data, method: "PATCH" }), {
              params: Promise.resolve({ id: "1" }),
            })
          : await saveBatch(
              jsonRequest({ body: { updates: [{ id: 1, data }] } }),
            );
      expect(response.status).toBe(200);
      expect(mocks.update).toHaveBeenCalledWith({ where: { id: 1 }, data });
      expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty(
        "driverCharge",
      );
    });

    it("rejects a negative deduction", async () => {
      const job = { ...baseJob, deductionHours: -1 };
      if (mode === "single") {
        // The mocked write-security helper surfaces the schema error directly
        await expect(createJob(jsonRequest({ body: job }))).rejects.toThrow();
      } else {
        const response = await saveBatch(
          jsonRequest({ body: { creates: [job] } }),
        );
        expect(response.status).toBe(400);
      }
      expect(mocks.create).not.toHaveBeenCalled();
    });
  });
}

it("preserves the override on a full single-job PUT without driverCharge", async () => {
  const response = await replaceJob(jsonRequest({ body: baseJob, method: "PUT" }), {
    params: Promise.resolve({ id: "1" }),
  });
  expect(response.status).toBe(200);
  expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty("driverCharge");
});

describe("job CSV hours", () => {
  for (const field of ["Charged Hours", "Travel Time Hours"]) {
    it.each(["1.5hours", "1,5", "NaN", "Infinity", "1e309", "-1"])(
      `rejects invalid ${field}: %s without writing a job`,
      async (value) => {
        const response = await importCsv({ rows: [{ [field]: value }] });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          imported: 0,
          errors: [`Row 2: ${field} must be zero or greater`],
        });
        expect(mocks.create).not.toHaveBeenCalled();
      },
    );
  }

  it.each(["1.5hours", "1,5", "NaN", "Infinity", "1e309"])(
    "rejects invalid Driver Hours: %s without writing a job",
    async (value) => {
      const response = await importCsv({ rows: [{ "Driver Hours": value }] });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        imported: 0,
        errors: ["Row 2: Driver Hours must be a number"],
      });
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it("imports a negative Driver Hours deduction", async () => {
    const response = await importCsv({ rows: [{ "Driver Hours": "-1.5" }] });
    expect(await response.json()).toMatchObject({ imported: 1, errors: [] });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ driverCharge: -1.5 }),
    });
  });

  it("falls back to the legacy Driver Charge column", async () => {
    const response = await importCsv({ rows: [{ "Driver Charge": "7.5" }] });
    expect(await response.json()).toMatchObject({ imported: 1, errors: [] });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ driverCharge: 7.5 }),
    });
  });

  it("imports a deduction", async () => {
    const response = await importCsv({ rows: [{ "Deduction Hours": "1.5" }] });
    expect(await response.json()).toMatchObject({ imported: 1, errors: [] });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deductionHours: 1.5 }),
    });
  });

  it.each(["-1", "1.5hours", "NaN"])(
    "rejects an invalid deduction: %s",
    async (value) => {
      const response = await importCsv({ rows: [{ "Deduction Hours": value }] });
      expect(await response.json()).toMatchObject({
        imported: 0,
        errors: ["Row 2: Deduction Hours must be zero or greater"],
      });
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { value: "", expected: null },
    { value: "  ", expected: null },
    { value: "0", expected: 0 },
    { value: " 1.25 ", expected: 1.25 },
    { value: "1e1", expected: 10 },
  ])("imports complete numeric hours or blanks: '$value'", async ({ value, expected }) => {
    const response = await importCsv({ rows: [{
      "Charged Hours": value,
      "Travel Time Hours": value,
      "Driver Hours": value,
    }] });
    expect(await response.json()).toMatchObject({ imported: 1, errors: [] });
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      chargedHours: expected,
      travelTimeHours: expected,
      driverCharge: expected,
    }) });
  });

  it("does not store derived driver hours when the CSV override is blank", async () => {
    const response = await importCsv({ rows: [{}] });
    expect(await response.json()).toMatchObject({ imported: 1, errors: [] });
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      chargedHours: 8, travelTimeHours: 1, driverCharge: null,
    }) });
  });

  it("exports null hours as blanks and zero hours as zero", async () => {
    const date = new Date("2026-09-01T00:00:00.000Z");
    mocks.findMany.mockResolvedValue([null, 0, 9].map((hours) => ({
      ...baseJob,
      date,
      createdAt: date,
      updatedAt: date,
      chargedHours: hours,
      travelTimeHours: hours,
      driverCharge: hours,
    })));
    const response = await exportJobs(new NextRequest("http://localhost/api/export/jobs"));
    expect(response.status).toBe(200);
    const csv = Papa.parse<Record<string, string>>(await response.text(), { header: true });
    expect(csv.errors).toEqual([]);
    expect(csv.data.map((row) => ({
      charged: row["Charged Hours"],
      travel: row["Travel Time Hours"],
      driver: row["Driver Hours"],
    }))).toEqual([
      { charged: "", travel: "", driver: "" },
      { charged: "0", travel: "0", driver: "0" },
      { charged: "9", travel: "9", driver: "9" },
    ]);
  });
});
