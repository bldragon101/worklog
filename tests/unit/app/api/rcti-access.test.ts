/**
 * @vitest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import * as rctiRoute from "@/app/api/rcti/route";
import * as rctiIdRoute from "@/app/api/rcti/[id]/route";
import * as payBatchRoute from "@/app/api/rcti/pay-batch/route";
import * as finaliseRoute from "@/app/api/rcti/[id]/finalize/route";
import * as unfinaliseRoute from "@/app/api/rcti/[id]/unfinalize/route";
import * as payRoute from "@/app/api/rcti/[id]/pay/route";
import * as revertRoute from "@/app/api/rcti/[id]/revert/route";
import * as refreshRoute from "@/app/api/rcti/[id]/refresh/route";
import * as pdfRoute from "@/app/api/rcti/[id]/pdf/route";
import * as emailRoute from "@/app/api/rcti/[id]/email/route";
import * as linesRoute from "@/app/api/rcti/[id]/lines/route";
import * as lineRoute from "@/app/api/rcti/[id]/lines/[lineId]/route";
import * as availableJobsRoute from "@/app/api/rcti/[id]/available-jobs/route";
import * as deductionsRoute from "@/app/api/rcti-deductions/route";
import * as deductionRoute from "@/app/api/rcti-deductions/[id]/route";
import * as pendingDeductionsRoute from "@/app/api/rcti-deductions/pending/route";
import * as rctiSettingsRoute from "@/app/api/rcti-settings/route";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  requireAuth: vi.fn(),
  prismaAccess: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, property) => {
        mocks.prismaAccess(property);
        throw new Error(`Unexpected database access: ${String(property)}`);
      },
    },
  ),
}));
vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));

type Handler = (
  request: NextRequest,
  context: { params: Promise<{ id: string; lineId: string }> },
) => Promise<Response>;

const handlers: Array<{ name: string; method: string; handler: Handler }> = [
  { name: "GET /api/rcti", method: "GET", handler: rctiRoute.GET },
  { name: "POST /api/rcti", method: "POST", handler: rctiRoute.POST },
  { name: "GET /api/rcti/[id]", method: "GET", handler: rctiIdRoute.GET },
  { name: "PATCH /api/rcti/[id]", method: "PATCH", handler: rctiIdRoute.PATCH },
  {
    name: "DELETE /api/rcti/[id]",
    method: "DELETE",
    handler: rctiIdRoute.DELETE,
  },
  {
    name: "POST /api/rcti/pay-batch",
    method: "POST",
    handler: payBatchRoute.POST,
  },
  {
    name: "POST /api/rcti/[id]/finalize",
    method: "POST",
    handler: finaliseRoute.POST,
  },
  {
    name: "POST /api/rcti/[id]/unfinalize",
    method: "POST",
    handler: unfinaliseRoute.POST,
  },
  { name: "POST /api/rcti/[id]/pay", method: "POST", handler: payRoute.POST },
  {
    name: "POST /api/rcti/[id]/revert",
    method: "POST",
    handler: revertRoute.POST,
  },
  {
    name: "POST /api/rcti/[id]/refresh",
    method: "POST",
    handler: refreshRoute.POST,
  },
  { name: "GET /api/rcti/[id]/pdf", method: "GET", handler: pdfRoute.GET },
  {
    name: "POST /api/rcti/[id]/email",
    method: "POST",
    handler: emailRoute.POST,
  },
  {
    name: "POST /api/rcti/[id]/lines",
    method: "POST",
    handler: linesRoute.POST,
  },
  {
    name: "DELETE /api/rcti/[id]/lines/[lineId]",
    method: "DELETE",
    handler: lineRoute.DELETE,
  },
  {
    name: "GET /api/rcti/[id]/available-jobs",
    method: "GET",
    handler: availableJobsRoute.GET,
  },
  {
    name: "GET /api/rcti-deductions",
    method: "GET",
    handler: deductionsRoute.GET,
  },
  {
    name: "POST /api/rcti-deductions",
    method: "POST",
    handler: deductionsRoute.POST,
  },
  {
    name: "GET /api/rcti-deductions/[id]",
    method: "GET",
    handler: deductionRoute.GET,
  },
  {
    name: "PATCH /api/rcti-deductions/[id]",
    method: "PATCH",
    handler: deductionRoute.PATCH,
  },
  {
    name: "DELETE /api/rcti-deductions/[id]",
    method: "DELETE",
    handler: deductionRoute.DELETE,
  },
  {
    name: "GET /api/rcti-deductions/pending",
    method: "GET",
    handler: pendingDeductionsRoute.GET,
  },
  {
    name: "GET /api/rcti-settings",
    method: "GET",
    handler: rctiSettingsRoute.GET,
  },
  {
    name: "POST /api/rcti-settings",
    method: "POST",
    handler: rctiSettingsRoute.POST,
  },
];

function buildRequest({ method }: { method: string }) {
  return new NextRequest(
    "http://localhost/api/rcti/5?driverId=7&weekEnding=2026-09-20",
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify({}),
    },
  );
}

const context = { params: Promise.resolve({ id: "5", lineId: "9" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue({ userId: "user_viewer" });
  mocks.checkPermission.mockResolvedValue(false);
});

describe("RCTI API access", () => {
  it.each(handlers)(
    "$name rejects a signed-in user without RCTI permission",
    async ({ method, handler }) => {
      const response = await handler(buildRequest({ method }), context);

      expect(response.status).toBe(403);
      expect(mocks.checkPermission).toHaveBeenCalledWith("manage_jobs_report");
      expect(mocks.prismaAccess).not.toHaveBeenCalled();
    },
  );

  it.each(handlers)(
    "$name rejects a signed-out request before checking permissions",
    async ({ method, handler }) => {
      mocks.requireAuth.mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );

      const response = await handler(buildRequest({ method }), context);

      expect(response.status).toBe(401);
      expect(mocks.checkPermission).not.toHaveBeenCalled();
      expect(mocks.prismaAccess).not.toHaveBeenCalled();
    },
  );
});
