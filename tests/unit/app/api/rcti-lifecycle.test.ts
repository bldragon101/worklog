import { NextRequest } from "next/server";
import { POST as finaliseRcti } from "@/app/api/rcti/[id]/finalize/route";
import { POST as unfinaliseRcti } from "@/app/api/rcti/[id]/unfinalize/route";
import { POST as revertRcti } from "@/app/api/rcti/[id]/revert/route";
import { POST as payRcti } from "@/app/api/rcti/[id]/pay/route";
import { POST as payBatch } from "@/app/api/rcti/pay-batch/route";

const mocks = vi.hoisted(() => ({
  rctiFindUnique: vi.fn(),
  rctiFindMany: vi.fn(),
  rctiUpdate: vi.fn(),
  rctiUpdateMany: vi.fn(),
  rctiLineFindMany: vi.fn(),
  statusChangeCreate: vi.fn(),
  applyDeductionsToRcti: vi.fn(),
  removeDeductionsFromRcti: vi.fn(),
  checkPermission: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    rcti: {
      findUnique: mocks.rctiFindUnique,
      findMany: mocks.rctiFindMany,
      update: mocks.rctiUpdate,
      updateMany: mocks.rctiUpdateMany,
    },
    rctiLine: { findMany: mocks.rctiLineFindMany },
    rctiStatusChange: { create: mocks.statusChangeCreate },
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
      operation(client),
  };
  return { prisma: client };
});
vi.mock("@/lib/rcti-deductions", () => ({
  applyDeductionsToRcti: mocks.applyDeductionsToRcti,
  removeDeductionsFromRcti: mocks.removeDeductionsFromRcti,
}));
vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user_admin" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));

const lines = [
  { amountExGst: 630, gstAmount: 63, amountIncGst: 693 },
  { amountExGst: -35, gstAmount: -3.5, amountIncGst: -38.5 },
];

function buildRcti({ status }: { status: string }) {
  return {
    id: 5,
    driverId: 7,
    status,
    weekEnding: new Date("2026-09-20T02:00:00.000Z"),
    subtotal: 595,
    gst: 59.5,
    total: 654.5,
    paidAt: status === "paid" ? new Date() : null,
    lines,
  };
}

function post({ body }: { body?: unknown } = {}) {
  return new NextRequest("http://localhost/api/rcti/5", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "5" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rctiLineFindMany.mockResolvedValue(lines);
  mocks.rctiUpdate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: 5, ...data }),
  );
  mocks.applyDeductionsToRcti.mockResolvedValue({
    applied: 0,
    totalDeductionAmount: 0,
    totalReimbursementAmount: 0,
  });
  mocks.removeDeductionsFromRcti.mockResolvedValue(undefined);
  mocks.checkPermission.mockResolvedValue(true);
});

function updatedData() {
  return mocks.rctiUpdate.mock.calls[0][0].data as Record<string, unknown>;
}

describe("POST /api/rcti/[id]/finalize", () => {
  it("finalises a draft and nets deductions and reimbursements into the total", async () => {
    mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status: "draft" }));
    mocks.applyDeductionsToRcti.mockResolvedValue({
      applied: 2,
      totalDeductionAmount: 100,
      totalReimbursementAmount: 25.5,
    });

    const response = await finaliseRcti(post({ body: {} }), params);

    expect(response.status).toBe(200);
    expect(updatedData()).toEqual({ status: "finalised", total: 580 });
    expect((await response.json()).deductionsSummary).toEqual({
      applied: 2,
      totalDeductions: 100,
      totalReimbursements: 25.5,
      netAdjustment: -74.5,
    });
  });

  it("passes deduction overrides through, with null meaning skip", async () => {
    mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status: "draft" }));

    await finaliseRcti(
      post({ body: { deductionOverrides: { "11": 40, "12": null, "13": "15.5" } } }),
      params,
    );

    const { amountOverrides } = mocks.applyDeductionsToRcti.mock.calls[0][0];
    expect(Object.fromEntries(amountOverrides)).toEqual({
      11: 40,
      12: null,
      13: 15.5,
    });
  });

  it.each([true, {}, [], "", "abc"])(
    "rejects an invalid override value %p",
    async (value) => {
      mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status: "draft" }));

      const response = await finaliseRcti(
        post({ body: { deductionOverrides: { "11": value } } }),
        params,
      );

      expect(response.status).toBe(400);
      expect(mocks.applyDeductionsToRcti).not.toHaveBeenCalled();
    },
  );

  it.each(["finalised", "paid"])("refuses to finalise a %s RCTI", async (status) => {
    mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status }));

    const response = await finaliseRcti(post({ body: {} }), params);

    expect(response.status).toBe(400);
    expect(mocks.applyDeductionsToRcti).not.toHaveBeenCalled();
    expect(mocks.rctiUpdate).not.toHaveBeenCalled();
  });

  it("refuses to finalise an RCTI with no lines", async () => {
    mocks.rctiFindUnique.mockResolvedValue({
      ...buildRcti({ status: "draft" }),
      lines: [],
    });

    const response = await finaliseRcti(post({ body: {} }), params);

    expect(response.status).toBe(400);
    expect(mocks.applyDeductionsToRcti).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown RCTI", async () => {
    mocks.rctiFindUnique.mockResolvedValue(null);

    const response = await finaliseRcti(post({ body: {} }), params);

    expect(response.status).toBe(404);
  });

  it.fails(
    "records who finalised the RCTI in the status history (known gap: no audit row)",
    async () => {
      mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status: "draft" }));

      await finaliseRcti(post({ body: {} }), params);

      expect(mocks.statusChangeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromStatus: "draft",
          toStatus: "finalised",
          changedBy: "user_admin",
        }),
      });
    },
  );
});

describe("POST /api/rcti/[id]/unfinalize", () => {
  it("returns a finalised RCTI to draft, reverses deductions and restores totals from lines", async () => {
    mocks.rctiFindUnique.mockResolvedValue({
      ...buildRcti({ status: "finalised" }),
      total: 580,
    });

    const response = await unfinaliseRcti(post(), params);

    expect(response.status).toBe(200);
    expect(mocks.removeDeductionsFromRcti).toHaveBeenCalledWith({ rctiId: 5 });
    expect(updatedData()).toEqual({
      status: "draft",
      subtotal: 595,
      gst: 59.5,
      total: 654.5,
    });
  });

  it.each([
    { status: "paid", error: "Cannot unfinalise a paid RCTI" },
    { status: "draft", error: "RCTI is already in draft status" },
  ])("refuses to unfinalise a $status RCTI", async ({ status, error }) => {
    mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status }));

    const response = await unfinaliseRcti(post(), params);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(error);
    expect(mocks.removeDeductionsFromRcti).not.toHaveBeenCalled();
  });
});

describe("POST /api/rcti/[id]/pay", () => {
  it("marks a finalised RCTI as paid with the payment time", async () => {
    mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status: "finalised" }));

    const response = await payRcti(post(), params);

    expect(response.status).toBe(200);
    expect(updatedData()).toEqual({
      status: "paid",
      paidAt: expect.any(Date),
    });
  });

  it.each([
    {
      status: "draft",
      error: "Cannot mark a draft RCTI as paid. Please finalise it first.",
    },
    { status: "paid", error: "RCTI is already marked as paid" },
  ])("refuses to pay a $status RCTI", async ({ status, error }) => {
    mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status }));

    const response = await payRcti(post(), params);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(error);
    expect(mocks.rctiUpdate).not.toHaveBeenCalled();
  });

  it.fails(
    "records who marked the RCTI as paid in the status history (known gap: no audit row)",
    async () => {
      mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status: "finalised" }));

      await payRcti(post(), params);

      expect(mocks.statusChangeCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromStatus: "finalised",
          toStatus: "paid",
          changedBy: "user_admin",
        }),
      });
    },
  );
});

describe("POST /api/rcti/[id]/revert", () => {
  it("reverts a paid RCTI to draft with the reason and who did it", async () => {
    mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status: "paid" }));

    const response = await revertRcti(
      post({ body: { reason: "  Paid to the wrong account  " } }),
      params,
    );

    expect(response.status).toBe(200);
    expect(mocks.removeDeductionsFromRcti).toHaveBeenCalledWith({ rctiId: 5 });
    expect(mocks.statusChangeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rctiId: 5,
        fromStatus: "paid",
        toStatus: "draft",
        reason: "Paid to the wrong account",
        changedBy: "user_admin",
      }),
    });
    expect(updatedData()).toMatchObject({
      status: "draft",
      paidAt: null,
      subtotal: 595,
      gst: 59.5,
      total: 654.5,
      revertedToDraftReason: "Paid to the wrong account",
    });
  });

  it.each([undefined, "", "oops"])("requires a reason of at least 5 characters (%p)", async (reason) => {
    mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status: "paid" }));

    const response = await revertRcti(post({ body: { reason } }), params);

    expect(response.status).toBe(400);
    expect(mocks.removeDeductionsFromRcti).not.toHaveBeenCalled();
  });

  it.each(["draft", "finalised"])("refuses to revert a %s RCTI", async (status) => {
    mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status }));

    const response = await revertRcti(
      post({ body: { reason: "Paid to the wrong account" } }),
      params,
    );

    expect(response.status).toBe(400);
    expect(mocks.statusChangeCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/rcti/pay-batch", () => {
  it("pays only finalised RCTIs and reports the rest", async () => {
    mocks.rctiFindMany.mockResolvedValue([
      { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      { id: 2, status: "draft", invoiceNumber: "RCTI-2" },
      { id: 3, status: "paid", invoiceNumber: "RCTI-3" },
      { id: 4, status: "finalised", invoiceNumber: "RCTI-4" },
    ]);
    mocks.rctiUpdateMany.mockResolvedValue({ count: 2 });

    const response = await payBatch(post({ body: { ids: [1, 2, 3, 4, 4, 9] } }));

    expect(response.status).toBe(200);
    expect(mocks.rctiUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 4] }, status: "finalised" },
      data: { status: "paid", paidAt: expect.any(Date) },
    });
    expect(await response.json()).toEqual({
      paidCount: 2,
      attemptedIds: [1, 4],
      skipped: [
        { id: 9, reason: "RCTI not found" },
        { id: 2, reason: "Only finalised RCTIs can be marked as paid" },
        { id: 3, reason: "Already marked as paid" },
      ],
    });
  });

  it("reports the number actually paid when another request pays one first", async () => {
    mocks.rctiFindMany.mockResolvedValue([
      { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      { id: 4, status: "finalised", invoiceNumber: "RCTI-4" },
    ]);
    mocks.rctiUpdateMany.mockResolvedValue({ count: 1 });

    const response = await payBatch(post({ body: { ids: [1, 4] } }));

    expect((await response.json()).paidCount).toBe(1);
  });

  it("does not update anything when nothing is payable", async () => {
    mocks.rctiFindMany.mockResolvedValue([
      { id: 2, status: "draft", invoiceNumber: "RCTI-2" },
    ]);

    const response = await payBatch(post({ body: { ids: [2] } }));

    expect(mocks.rctiUpdateMany).not.toHaveBeenCalled();
    expect((await response.json()).paidCount).toBe(0);
  });

  it.each([{}, { ids: [] }, { ids: ["1"] }])("rejects an invalid body %p", async (body) => {
    const response = await payBatch(post({ body }));

    expect(response.status).toBe(400);
    expect(mocks.rctiUpdateMany).not.toHaveBeenCalled();
  });
});

describe("RCTI payment permissions", () => {
  it.fails(
    "stops a user without RCTI permission from marking an RCTI as paid (known gap: API only checks sign-in)",
    async () => {
      mocks.checkPermission.mockResolvedValue(false);
      mocks.rctiFindUnique.mockResolvedValue(buildRcti({ status: "finalised" }));

      const response = await payRcti(post(), params);

      expect(response.status).toBe(403);
    },
  );

  it.fails(
    "stops a user without RCTI permission from batch paying RCTIs (known gap: API only checks sign-in)",
    async () => {
      mocks.checkPermission.mockResolvedValue(false);
      mocks.rctiFindMany.mockResolvedValue([
        { id: 1, status: "finalised", invoiceNumber: "RCTI-1" },
      ]);
      mocks.rctiUpdateMany.mockResolvedValue({ count: 1 });

      const response = await payBatch(post({ body: { ids: [1] } }));

      expect(response.status).toBe(403);
    },
  );
});
