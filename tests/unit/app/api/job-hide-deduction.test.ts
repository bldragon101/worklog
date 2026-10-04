/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { POST as createJob } from "@/app/api/jobs/route";
import { PATCH as updateJob } from "@/app/api/jobs/[id]/route";
import type { UserRole } from "@/lib/permissions";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  rctiLineFindMany: vi.fn(),
  userRole: { current: "admin" as UserRole },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rctiLine: { findMany: mocks.rctiLineFindMany },
    jobs: {
      create: mocks.create,
      update: mocks.update,
      findUnique: mocks.findUnique,
    },
  },
}));
vi.mock("@/lib/permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/permissions")>()),
  getUserRole: async () => mocks.userRole.current,
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));
vi.mock("@/lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/write-security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/write-security")>()),
  secureWriteOperation: async (
    request: NextRequest,
    { schema }: { schema: z.ZodType },
  ) => ({
    success: true,
    data: schema.parse(await request.json()),
    userId: "test-user",
    userRole: mocks.userRole.current,
  }),
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
  deductionHours: 1,
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
  mocks.userRole.current = "admin";
  mocks.rctiLineFindMany.mockResolvedValue([]);
  mocks.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data }),
  );
  mocks.findUnique.mockResolvedValue({
    id: 1,
    ...baseJob,
    hideDeduction: false,
  });
  mocks.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 1,
      ...baseJob,
      ...data,
    }),
  );
});

describe("hiding a job's deduction", () => {
  it("lets an admin create a job with the deduction hidden", async () => {
    const response = await createJob(
      jsonRequest({ body: { ...baseJob, hideDeduction: true } }),
    );

    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.hideDeduction).toBe(true);
  });

  it("lets an admin hide the deduction on an existing job", async () => {
    const response = await updateJob(
      jsonRequest({ body: { hideDeduction: true }, method: "PATCH" }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { hideDeduction: true },
    });
  });

  it.each(["manager", "user"] as const)(
    "creates a %s's job with the deduction shown",
    async (role) => {
      mocks.userRole.current = role;

      const response = await createJob(
        jsonRequest({ body: { ...baseJob, hideDeduction: true } }),
      );

      expect(response.status).toBe(201);
      expect(mocks.create.mock.calls[0][0].data.hideDeduction).toBe(false);
    },
  );

  it.each(["manager", "user"] as const)(
    "ignores a %s's change to the setting",
    async (role) => {
      mocks.userRole.current = role;

      const response = await updateJob(
        jsonRequest({
          body: { hideDeduction: true, chargedHours: 9 },
          method: "PATCH",
        }),
        { params: Promise.resolve({ id: "1" }) },
      );

      expect(response.status).toBe(200);
      expect(mocks.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { chargedHours: 9 },
      });
    },
  );

  it("lets a manager save a job on a finalised RCTI from a stale form", async () => {
    mocks.userRole.current = "manager";
    mocks.findUnique.mockResolvedValue({
      id: 1,
      ...baseJob,
      hideDeduction: true,
    });
    mocks.rctiLineFindMany.mockResolvedValue([
      { jobId: 1, rcti: { invoiceNumber: "RCTI-1", status: "finalised" } },
    ]);

    const response = await updateJob(
      jsonRequest({
        body: { hideDeduction: false, comments: "Gate code 1234" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { comments: "Gate code 1234" },
    });
  });

  it("still stops an admin changing the setting on a finalised RCTI", async () => {
    mocks.rctiLineFindMany.mockResolvedValue([
      { jobId: 1, rcti: { invoiceNumber: "RCTI-1", status: "finalised" } },
    ]);

    const response = await updateJob(
      jsonRequest({ body: { hideDeduction: true }, method: "PATCH" }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
