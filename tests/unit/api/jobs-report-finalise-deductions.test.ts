/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { POST as finalise } from "@/app/api/jobs-report/[id]/finalise/route";
import { POST as unfinalise } from "@/app/api/jobs-report/[id]/unfinalise/route";
import { prisma } from "@/lib/prisma";
import {
  applyDeductionsToJobsReport,
  removeDeductionsFromJobsReport,
} from "@/lib/rcti-deductions";

vi.mock("@/lib/prisma", () => {
  const client = {
    jobsReport: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(
    (callback: (tx: typeof client) => unknown) => callback(client),
  );
  return { prisma: client };
});

vi.mock("@/lib/rcti-deductions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rcti-deductions")>();
  return {
    ...actual,
    applyDeductionsToJobsReport: vi.fn().mockResolvedValue({
      applied: 1,
      totalDeductionAmount: 50,
      totalReimbursementAmount: 0,
    }),
    removeDeductionsFromJobsReport: vi.fn().mockResolvedValue(undefined),
  };
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
const weekEnding = new Date("2026-11-22T00:00:00.000Z");

function postRequest({ body }: { body?: unknown } = {}) {
  return new NextRequest("http://localhost/api/jobs-report/5/finalise", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.jobsReport.updateMany).mockResolvedValue({ count: 1 });
});

describe("POST /api/jobs-report/[id]/finalise", () => {
  const draftReport = {
    id: 5,
    driverId: 10,
    weekEnding,
    status: "draft",
    lines: [{ id: 1 }],
  };

  it("finalises the report and applies the driver's deductions with overrides", async () => {
    vi.mocked(prisma.jobsReport.findUnique)
      .mockResolvedValueOnce(draftReport as never)
      .mockResolvedValueOnce({ id: 5, status: "finalised" } as never);

    const response = await finalise(
      postRequest({ body: { deductionOverrides: { "3": 20, "4": null } } }),
      params,
    );

    expect(response.status).toBe(200);
    expect(prisma.jobsReport.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: "draft" },
      data: { status: "finalised" },
    });
    expect(applyDeductionsToJobsReport).toHaveBeenCalledWith({
      reportId: 5,
      driverId: 10,
      weekEnding,
      amountOverrides: new Map([
        [3, 20],
        [4, null],
      ]),
      tx: prisma,
    });
  });

  it("finalises without a body", async () => {
    vi.mocked(prisma.jobsReport.findUnique)
      .mockResolvedValueOnce(draftReport as never)
      .mockResolvedValueOnce({ id: 5, status: "finalised" } as never);

    const response = await finalise(postRequest(), params);

    expect(response.status).toBe(200);
    expect(applyDeductionsToJobsReport).toHaveBeenCalledWith(
      expect.objectContaining({ amountOverrides: undefined }),
    );
  });

  it("rejects an invalid override", async () => {
    const response = await finalise(
      postRequest({ body: { deductionOverrides: { "3": "abc" } } }),
      params,
    );

    expect(response.status).toBe(400);
    expect(applyDeductionsToJobsReport).not.toHaveBeenCalled();
  });

  it("does not apply deductions if the report is finalised mid-request", async () => {
    vi.mocked(prisma.jobsReport.findUnique).mockResolvedValueOnce(
      draftReport as never,
    );
    vi.mocked(prisma.jobsReport.updateMany).mockResolvedValueOnce({
      count: 0,
    });

    const response = await finalise(postRequest(), params);

    expect(response.status).toBe(409);
    expect(applyDeductionsToJobsReport).not.toHaveBeenCalled();
  });

  it("does not finalise a report with no lines", async () => {
    vi.mocked(prisma.jobsReport.findUnique).mockResolvedValueOnce({
      ...draftReport,
      lines: [],
    } as never);

    const response = await finalise(postRequest(), params);

    expect(response.status).toBe(400);
    expect(prisma.jobsReport.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/jobs-report/[id]/unfinalise", () => {
  it("reverts to draft and gives the applied deductions back", async () => {
    vi.mocked(prisma.jobsReport.findUnique)
      .mockResolvedValueOnce({ id: 5, status: "finalised" } as never)
      .mockResolvedValueOnce({ id: 5, status: "draft" } as never);

    const response = await unfinalise(postRequest(), params);

    expect(response.status).toBe(200);
    expect(prisma.jobsReport.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: "finalised" },
      data: { status: "draft" },
    });
    expect(removeDeductionsFromJobsReport).toHaveBeenCalledWith({
      reportId: 5,
      tx: prisma,
    });
  });

  it("does not touch deductions on a draft", async () => {
    vi.mocked(prisma.jobsReport.findUnique).mockResolvedValueOnce({
      id: 5,
      status: "draft",
    } as never);

    const response = await unfinalise(postRequest(), params);

    expect(response.status).toBe(400);
    expect(removeDeductionsFromJobsReport).not.toHaveBeenCalled();
  });
});
