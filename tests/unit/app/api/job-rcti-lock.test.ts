import { NextRequest } from "next/server";
import { z } from "zod";
import {
  DELETE as deleteJob,
  PATCH as updateJob,
} from "@/app/api/jobs/[id]/route";
import {
  DELETE as bulkDelete,
  PATCH as bulkUpdate,
  POST as saveBatch,
} from "@/app/api/jobs/bulk/route";
import { getChangedLockedFields } from "@/lib/rcti-locked-jobs";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  rctiLineFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rctiLine: { findMany: mocks.rctiLineFindMany },
    jobs: {
      update: mocks.update,
      updateMany: mocks.updateMany,
      delete: mocks.delete,
      deleteMany: mocks.deleteMany,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user" }),
  requireAuthWithPermission: vi.fn().mockResolvedValue({ userId: "test-user" }),
  forbidWithoutPermission: vi.fn().mockResolvedValue(null),
  forbidWithoutPermissions: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/permissions", () => ({ getUserRole: async () => "admin" }));
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
vi.mock("@/lib/api-helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-helpers")>()),
  withApiProtection: async () => ({ headers: {} }),
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

const storedJob = {
  id: 1,
  date: new Date("2026-09-16T00:00:00.000Z"),
  driver: "TEST DRIVER",
  customer: "Test Customer",
  billTo: "Test Customer",
  truckType: "Tray",
  registration: "ABC123",
  pickup: "Melbourne",
  dropoff: null,
  chargedHours: 8,
  travelTimeHours: null,
  driverCharge: null,
  deductionHours: null,
  eastlink: null,
  citylink: null,
  startTime: new Date("2026-09-16T06:00:00.000Z"),
  finishTime: new Date("2026-09-16T14:00:00.000Z"),
  invoiced: false,
  runsheet: false,
  comments: null,
};

// What the job form sends back for the stored job when nothing is changed
const unchangedForm = {
  date: "2026-09-16",
  driver: "Test Driver",
  customer: "Test Customer",
  billTo: "Test Customer",
  truckType: "Tray",
  registration: "abc123",
  pickup: "Melbourne",
  chargedHours: 8,
  travelTimeHours: 0,
  driverCharge: null,
  deductionHours: null,
  eastlink: 0,
  citylink: 0,
  startTime: "2026-09-16T06:00:00.000Z",
  finishTime: "2026-09-16T14:00:00.000Z",
};

function jsonRequest({ body, method }: { body: unknown; method: string }) {
  return new NextRequest("http://localhost/api/jobs/1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "1" });

function onRcti({ status }: { status: "draft" | "finalised" | "paid" }) {
  mocks.rctiLineFindMany.mockImplementation(
    async ({ where }: { where: { rcti: { status: { in: string[] } } } }) =>
      where.rcti.status.in.includes(status)
        ? [{ jobId: 1, rcti: { invoiceNumber: "RCTI-20092026", status } }]
        : [],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rctiLineFindMany.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue(storedJob);
  mocks.findMany.mockResolvedValue([storedJob]);
  mocks.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...storedJob,
      ...data,
    }),
  );
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.delete.mockResolvedValue(storedJob);
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(
    async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({
        jobs: {
          update: mocks.update,
          updateMany: mocks.updateMany,
          deleteMany: mocks.deleteMany,
        },
      }),
  );
});

describe("getChangedLockedFields", () => {
  it("ignores values the job form sends back unchanged", () => {
    expect(
      getChangedLockedFields({ existing: storedJob, update: unchangedForm }),
    ).toEqual([]);
  });

  it("lists the pay fields that change", () => {
    expect(
      getChangedLockedFields({
        existing: storedJob,
        update: {
          ...unchangedForm,
          chargedHours: 9,
          eastlink: 1,
          finishTime: "2026-09-16T15:00:00.000Z",
        },
      }),
    ).toEqual(["chargedHours", "eastlink", "finishTime"]);
  });

  it("treats a zero driver hours override as a change from blank", () => {
    expect(
      getChangedLockedFields({
        existing: storedJob,
        update: { driverCharge: 0 },
      }),
    ).toEqual(["driverCharge"]);
  });
});

describe("PATCH /api/jobs/[id] on a job on an RCTI", () => {
  it.each(["finalised", "paid"] as const)(
    "refuses to change pay fields while the RCTI is %s",
    async (status) => {
      onRcti({ status });

      const response = await updateJob(
        jsonRequest({
          method: "PATCH",
          body: { ...unchangedForm, chargedHours: 10 },
        }),
        { params },
      );

      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain(
        `Job 1 is on ${status} RCTI RCTI-20092026`,
      );
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );

  it("allows fields that are not on the RCTI to change", async () => {
    onRcti({ status: "paid" });

    const response = await updateJob(
      jsonRequest({
        method: "PATCH",
        body: { ...unchangedForm, invoiced: true, comments: "Checked" },
      }),
      { params },
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalled();
  });

  it("allows pay fields to change while the RCTI is a draft", async () => {
    onRcti({ status: "draft" });

    const response = await updateJob(
      jsonRequest({
        method: "PATCH",
        body: { ...unchangedForm, chargedHours: 10 },
      }),
      { params },
    );

    expect(response.status).toBe(200);
  });
});

describe("DELETE /api/jobs/[id] on a job on an RCTI", () => {
  it("refuses to delete a job on a finalised RCTI", async () => {
    onRcti({ status: "finalised" });

    const response = await deleteJob(
      new NextRequest("http://localhost/api/jobs/1", { method: "DELETE" }),
      { params },
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("before deleting it");
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});

describe("bulk job changes on an RCTI", () => {
  it("refuses to bulk delete a job on a paid RCTI", async () => {
    onRcti({ status: "paid" });

    const response = await bulkDelete(
      jsonRequest({ method: "DELETE", body: { jobIds: [1] } }),
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain(
      "Revert the RCTI to draft before deleting it",
    );
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses a quick edit that changes a pay field", async () => {
    onRcti({ status: "finalised" });

    const response = await saveBatch(
      jsonRequest({
        method: "POST",
        body: { updates: [{ id: 1, data: { customer: "Other Customer" } }] },
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses a quick edit that deletes a job on a finalised RCTI", async () => {
    onRcti({ status: "finalised" });

    const response = await saveBatch(
      jsonRequest({ method: "POST", body: { deletes: [1] } }),
    );

    expect(response.status).toBe(409);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("allows marking jobs on a paid RCTI as invoiced", async () => {
    onRcti({ status: "paid" });

    const response = await bulkUpdate(
      jsonRequest({
        method: "PATCH",
        body: { jobIds: [1], updates: { invoiced: true } },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalled();
  });
});
