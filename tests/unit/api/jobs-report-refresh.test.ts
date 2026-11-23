/**
 * @vitest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/jobs-report/[id]/refresh/route";
import { prisma } from "@/lib/prisma";
import { requireAuthWithPermission } from "@/lib/auth";

vi.mock("@/lib/prisma", () => {
  const client = {
    jobsReport: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    jobsReportLine: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    jobs: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(
    (callback: (tx: typeof client) => unknown) => callback(client),
  );
  return { prisma: client };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user-123" }),
  requireAuthWithPermission: vi
    .fn()
    .mockResolvedValue({ userId: "test-user-123" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: new Headers({ "X-RateLimit-Limit": "100" }),
  }),
  rateLimitConfigs: { general: {} },
}));

const params = { params: Promise.resolve({ id: "5" }) };
const weekEnding = new Date("2026-11-22T12:59:59.999Z");

function request() {
  return new NextRequest("http://localhost/api/jobs-report/5/refresh", {
    method: "POST",
  });
}

function job({ overrides = {} }: { overrides?: Record<string, unknown> } = {}) {
  return {
    id: 42,
    date: new Date("2026-11-18T00:00:00.000Z"),
    customer: "Acme",
    truckType: "Tray",
    startTime: new Date("2026-11-18T06:00:00.000Z"),
    finishTime: null,
    chargedHours: 8,
    travelTimeHours: 1,
    driverCharge: null,
    deductionHours: null,
    hideDeduction: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.jobsReport.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.jobsReport.findUniqueOrThrow).mockResolvedValue({
    weekEnding,
    driver: { driver: "JOHN", truck: "ABC123", type: "Employee" },
  } as never);
});

describe("POST /api/jobs-report/[id]/refresh", () => {
  it("replaces the job lines with the current jobs and keeps manual lines", async () => {
    vi.mocked(prisma.jobsReport.findUnique)
      .mockResolvedValueOnce({ status: "draft" } as never)
      .mockResolvedValueOnce({ id: 5, lines: [] } as never);
    vi.mocked(prisma.jobs.findMany).mockResolvedValue([job()] as never);

    const response = await POST(request(), params);

    expect(response.status).toBe(200);
    expect(prisma.jobs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ driver: "JOHN" }),
      }),
    );
    expect(prisma.jobsReportLine.deleteMany).toHaveBeenCalledWith({
      where: { reportId: 5, jobId: { not: null } },
    });
    expect(prisma.jobsReportLine.createMany).toHaveBeenCalledWith({
      data: [
        {
          reportId: 5,
          jobId: 42,
          jobDate: new Date("2026-11-18T00:00:00.000Z"),
          customer: "Acme",
          truckType: "Tray",
          startTime: "06:00",
          finishTime: null,
          chargedHours: 8,
          travelTimeHours: 1,
          driverCharge: 9,
        },
      ],
    });
  });

  it("matches a subcontractor's jobs by truck registration", async () => {
    vi.mocked(prisma.jobsReport.findUnique)
      .mockResolvedValueOnce({ status: "draft" } as never)
      .mockResolvedValueOnce({ id: 5 } as never);
    vi.mocked(prisma.jobsReport.findUniqueOrThrow).mockResolvedValue({
      weekEnding,
      driver: { driver: "SAM", truck: "XYZ789", type: "Subcontractor" },
    } as never);
    vi.mocked(prisma.jobs.findMany).mockResolvedValue([]);

    const response = await POST(request(), params);

    expect(response.status).toBe(200);
    expect(prisma.jobs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ registration: "XYZ789" }),
      }),
    );
    expect(prisma.jobsReportLine.deleteMany).toHaveBeenCalled();
    expect(prisma.jobsReportLine.createMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the report does not exist", async () => {
    vi.mocked(prisma.jobsReport.findUnique).mockResolvedValueOnce(null);

    const response = await POST(request(), params);

    expect(response.status).toBe(404);
  });

  it("does not refresh a finalised report", async () => {
    vi.mocked(prisma.jobsReport.findUnique).mockResolvedValueOnce({
      status: "finalised",
    } as never);

    const response = await POST(request(), params);

    expect(response.status).toBe(400);
    expect(prisma.jobsReportLine.deleteMany).not.toHaveBeenCalled();
  });

  it("does not refresh if the report is finalised mid-request", async () => {
    vi.mocked(prisma.jobsReport.findUnique).mockResolvedValueOnce({
      status: "draft",
    } as never);
    vi.mocked(prisma.jobsReport.updateMany).mockResolvedValueOnce({
      count: 0,
    });

    const response = await POST(request(), params);

    expect(response.status).toBe(409);
    expect(prisma.jobsReportLine.deleteMany).not.toHaveBeenCalled();
  });

  it("requires the jobs report permission", async () => {
    vi.mocked(requireAuthWithPermission).mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );

    const response = await POST(request(), params);

    expect(response.status).toBe(403);
    expect(prisma.jobsReport.findUnique).not.toHaveBeenCalled();
  });
});
