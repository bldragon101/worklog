/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/rcti/[id]/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    rctiLine: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));

const draftRcti = {
  id: 1,
  status: "draft",
  gstStatus: "not_registered",
  gstMode: "exclusive",
  lines: [],
};

function lineRequest(line: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/rcti/1", {
    method: "PATCH",
    body: JSON.stringify({ lines: [line] }),
  });
}

async function patchLine({
  existingLine,
  update,
}: {
  existingLine: Record<string, unknown>;
  update: Record<string, unknown>;
}) {
  (prisma.rcti.findUnique as vi.Mock).mockResolvedValue(draftRcti);
  (prisma.rctiLine.findUnique as vi.Mock).mockResolvedValue({
    rctiId: 1,
    ...existingLine,
  });
  (prisma.rctiLine.update as vi.Mock).mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => data,
  );
  (prisma.rctiLine.findMany as vi.Mock).mockResolvedValue([]);
  (prisma.rcti.update as vi.Mock).mockResolvedValue({ ...draftRcti });

  const response = await PATCH(lineRequest({ id: 10, ...update }), {
    params: Promise.resolve({ id: "1" }),
  });
  expect(response.status).toBe(200);
  return (prisma.rctiLine.update as vi.Mock).mock.calls[0][0]
    .data as Record<string, number>;
}

describe("RCTI line hours edits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a break deduction line negative when its hours are edited", async () => {
    const data = await patchLine({
      existingLine: {
        id: 10,
        jobId: null,
        chargedHours: -0.5,
        travelTimeHours: 0,
        driverCharge: -0.5,
        ratePerHour: 100,
        jobDate: new Date("2026-09-06"),
        customer: "Break Deduction",
        truckType: "Tray",
        description: "Lunch Breaks - Tray",
      },
      update: { chargedHours: -1 },
    });

    expect(data.chargedHours).toBe(-1);
    expect(data.driverCharge).toBe(-1);
    expect(data.amountExGst).toBe(-100);
    expect(data.amountIncGst).toBe(-100);
  });

  it("keeps a negative manual line negative when its rate is edited", async () => {
    const data = await patchLine({
      existingLine: {
        id: 10,
        jobId: null,
        chargedHours: -2,
        travelTimeHours: 0,
        driverCharge: -2,
        ratePerHour: 50,
        jobDate: new Date("2026-09-06"),
        customer: "Adjustment",
        truckType: "Tray",
        description: "Manual adjustment",
      },
      update: { ratePerHour: 80 },
    });

    expect(data.driverCharge).toBe(-2);
    expect(data.amountExGst).toBe(-160);
  });

  it("re-applies a carried deduction when the hours are edited", async () => {
    // Job line built from 8 charged + 1 travel hours with a 1 hour deduction.
    const data = await patchLine({
      existingLine: {
        id: 10,
        jobId: 5,
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 8,
        ratePerHour: 100,
        jobDate: new Date("2026-09-01"),
        customer: "Test Customer",
        truckType: "Tray",
        description: "08:00 - 16:00",
      },
      update: { chargedHours: 10 },
    });

    // 10 + 1 travel - 1 deducted
    expect(data.driverCharge).toBe(10);
    expect(data.amountExGst).toBe(1000);
  });

  it("preserves a positive hours addition when the base hours are edited", async () => {
    const data = await patchLine({
      existingLine: {
        id: 10,
        jobId: 5,
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 10,
        ratePerHour: 100,
        jobDate: new Date("2026-09-01"),
        customer: "Test Customer",
        truckType: "Tray",
        description: "08:00 - 16:00",
      },
      update: { chargedHours: 9 },
    });

    // The existing +1 hour adjustment is carried onto the new 10-hour base.
    expect(data.driverCharge).toBe(11);
    expect(data.amountExGst).toBe(1100);
  });

  it("leaves the paid hours alone when only the rate changes", async () => {
    const data = await patchLine({
      existingLine: {
        id: 10,
        jobId: 5,
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 7.5,
        ratePerHour: 100,
        jobDate: new Date("2026-09-01"),
        customer: "Test Customer",
        truckType: "Tray",
        description: "08:00 - 16:00",
      },
      update: { ratePerHour: 120 },
    });

    expect(data.driverCharge).toBe(7.5);
    expect(data.amountExGst).toBe(900);
  });

  it("pays charged plus travel hours when the line carries no deduction", async () => {
    const data = await patchLine({
      existingLine: {
        id: 10,
        jobId: 5,
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 9,
        ratePerHour: 100,
        jobDate: new Date("2026-09-01"),
        customer: "Test Customer",
        truckType: "Tray",
        description: "08:00 - 16:00",
      },
      update: { travelTimeHours: 2 },
    });

    expect(data.driverCharge).toBe(10);
    expect(data.amountExGst).toBe(1000);
  });
});


describe("RCTI GST recalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function recalculateWithGst(lines: Array<Record<string, unknown>>) {
    (prisma.rcti.findUnique as vi.Mock).mockResolvedValue({
      ...draftRcti,
      lines,
    });
    (prisma.rctiLine.update as vi.Mock).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => data,
    );
    (prisma.rctiLine.findMany as vi.Mock).mockResolvedValue([]);
    (prisma.rcti.update as vi.Mock).mockResolvedValue({ ...draftRcti });

    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/rcti/1", {
        method: "PATCH",
        body: JSON.stringify({ gstStatus: "registered" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    expect(response.status).toBe(200);
    return (prisma.rctiLine.update as vi.Mock).mock.calls.map(
      (call) => call[0].data as Record<string, number>,
    );
  }

  it("keeps a negative line negative when GST is recalculated", async () => {
    const [amounts] = await recalculateWithGst([
      {
        id: 10,
        chargedHours: -0.5,
        travelTimeHours: 0,
        driverCharge: -0.5,
        ratePerHour: 100,
      },
    ]);

    expect(amounts.amountExGst).toBe(-50);
    expect(amounts.gstAmount).toBe(-5);
    expect(amounts.amountIncGst).toBe(-55);
  });

  it("keeps a deducted job line at its paid hours when GST is recalculated", async () => {
    const [amounts] = await recalculateWithGst([
      {
        id: 10,
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 7.5,
        ratePerHour: 100,
      },
    ]);

    expect(amounts.amountExGst).toBe(750);
  });
});
