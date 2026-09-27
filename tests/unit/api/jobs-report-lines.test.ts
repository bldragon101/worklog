/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/jobs-report/[id]/lines/route";
import { DELETE } from "@/app/api/jobs-report/[id]/lines/[lineId]/route";
import { prisma } from "@/lib/prisma";
import { getUserRole } from "@/lib/permissions";

vi.mock("@/lib/prisma", () => {
  const client = {
    jobsReport: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    jobsReportLine: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(
    (callback: (tx: typeof client) => unknown) => callback(client),
  );
  return { prisma: client };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

vi.mock("@/lib/permissions", () => ({
  getUserRole: vi.fn().mockResolvedValue("admin"),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: new Headers({ "X-RateLimit-Limit": "100" }),
  }),
  rateLimitConfigs: { general: {} },
}));

const validManualLine = {
  jobDate: "2026-09-22",
  customer: "  Acme Pty Ltd ",
  truckType: "Tray",
  startTime: "06:00",
  finishTime: "",
  chargedHours: "7.5",
};

function postRequest({ body }: { body: unknown }) {
  return new NextRequest("http://localhost/api/jobs-report/5/lines", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const postParams = { params: Promise.resolve({ id: "5" }) };
const deleteParams = { params: Promise.resolve({ id: "5", lineId: "9" }) };

describe("POST /api/jobs-report/[id]/lines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserRole).mockResolvedValue("admin");
    vi.mocked(prisma.jobsReport.updateMany).mockResolvedValue({ count: 1 });
  });

  it("adds a manual line to a draft report", async () => {
    vi.mocked(prisma.jobsReport.findUnique)
      .mockResolvedValueOnce({ id: 5, status: "draft" } as never)
      .mockResolvedValueOnce({ id: 5, lines: [] } as never);

    const response = await POST(
      postRequest({ body: { manualLine: validManualLine } }),
      postParams,
    );

    expect(response.status).toBe(201);
    expect(prisma.jobsReportLine.create).toHaveBeenCalledWith({
      data: {
        reportId: 5,
        jobId: null,
        jobDate: new Date("2026-09-22T00:00:00.000Z"),
        customer: "Acme Pty Ltd",
        truckType: "Tray",
        startTime: "06:00",
        finishTime: null,
        chargedHours: 7.5,
        travelTimeHours: null,
        driverCharge: null,
      },
    });
  });

  it("rejects a line without hours", async () => {
    const response = await POST(
      postRequest({
        body: { manualLine: { ...validManualLine, chargedHours: "" } },
      }),
      postParams,
    );

    expect(response.status).toBe(400);
    expect(prisma.jobsReportLine.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid time", async () => {
    const response = await POST(
      postRequest({
        body: { manualLine: { ...validManualLine, startTime: "25:00" } },
      }),
      postParams,
    );

    expect(response.status).toBe(400);
  });

  it("does not add lines to a finalised report", async () => {
    vi.mocked(prisma.jobsReport.findUnique).mockResolvedValueOnce({
      id: 5,
      status: "finalised",
    } as never);

    const response = await POST(
      postRequest({ body: { manualLine: validManualLine } }),
      postParams,
    );

    expect(response.status).toBe(409);
    expect(prisma.jobsReportLine.create).not.toHaveBeenCalled();
  });

  it("does not add a line if the report is finalised mid-request", async () => {
    vi.mocked(prisma.jobsReport.findUnique).mockResolvedValueOnce({
      id: 5,
      status: "draft",
    } as never);
    vi.mocked(prisma.jobsReport.updateMany).mockResolvedValueOnce({
      count: 0,
    });

    const response = await POST(
      postRequest({ body: { manualLine: validManualLine } }),
      postParams,
    );

    expect(response.status).toBe(409);
    expect(prisma.jobsReport.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: "draft" },
      data: { updatedAt: expect.any(Date) },
    });
    expect(prisma.jobsReportLine.create).not.toHaveBeenCalled();
  });

  it("requires an admin", async () => {
    vi.mocked(getUserRole).mockResolvedValueOnce("user" as never);

    const response = await POST(
      postRequest({ body: { manualLine: validManualLine } }),
      postParams,
    );

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/jobs-report/[id]/lines/[lineId]", () => {
  const deleteRequest = () =>
    new NextRequest("http://localhost/api/jobs-report/5/lines/9", {
      method: "DELETE",
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserRole).mockResolvedValue("admin");
    vi.mocked(prisma.jobsReport.updateMany).mockResolvedValue({ count: 1 });
  });

  it("removes a manual line from a draft report", async () => {
    vi.mocked(prisma.jobsReportLine.findFirst).mockResolvedValueOnce({
      id: 9,
      jobId: null,
      report: { status: "draft" },
    } as never);
    vi.mocked(prisma.jobsReport.findUnique).mockResolvedValueOnce({
      id: 5,
      lines: [],
    } as never);

    const response = await DELETE(deleteRequest(), deleteParams);

    expect(response.status).toBe(200);
    expect(prisma.jobsReportLine.deleteMany).toHaveBeenCalledWith({
      where: { id: 9, reportId: 5, jobId: null },
    });
  });

  it("does not remove a line if the report is finalised mid-request", async () => {
    vi.mocked(prisma.jobsReportLine.findFirst).mockResolvedValueOnce({
      id: 9,
      jobId: null,
      report: { status: "draft" },
    } as never);
    vi.mocked(prisma.jobsReport.updateMany).mockResolvedValueOnce({
      count: 0,
    });

    const response = await DELETE(deleteRequest(), deleteParams);

    expect(response.status).toBe(409);
    expect(prisma.jobsReportLine.deleteMany).not.toHaveBeenCalled();
  });

  it("does not remove a line built from a job", async () => {
    vi.mocked(prisma.jobsReportLine.findFirst).mockResolvedValueOnce({
      id: 9,
      jobId: 42,
      report: { status: "draft" },
    } as never);

    const response = await DELETE(deleteRequest(), deleteParams);

    expect(response.status).toBe(400);
    expect(prisma.jobsReportLine.deleteMany).not.toHaveBeenCalled();
  });

  it("does not remove lines from a finalised report", async () => {
    vi.mocked(prisma.jobsReportLine.findFirst).mockResolvedValueOnce({
      id: 9,
      jobId: null,
      report: { status: "finalised" },
    } as never);

    const response = await DELETE(deleteRequest(), deleteParams);

    expect(response.status).toBe(409);
    expect(prisma.jobsReportLine.deleteMany).not.toHaveBeenCalled();
  });
});
