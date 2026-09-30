import { getLiveRctiLineAmounts } from "@/lib/utils/rcti-live-totals";
import type { RctiLine } from "@/lib/types";

function createLine(overrides: Partial<RctiLine> = {}): RctiLine {
  return {
    id: 1,
    rctiId: 1,
    jobId: 1,
    jobDate: "2026-09-21T00:00:00.000Z",
    customer: "Acme Logistics",
    truckType: "Tray",
    description: null,
    chargedHours: 8,
    travelTimeHours: 1,
    driverCharge: null,
    ratePerHour: 50,
    amountExGst: 450,
    gstAmount: 45,
    amountIncGst: 495,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
    ...overrides,
  };
}

const gst = { gstStatus: "registered", gstMode: "exclusive" } as const;

describe("getLiveRctiLineAmounts", () => {
  it("returns the stored amounts and hours when the line has no edits", () => {
    expect(
      getLiveRctiLineAmounts({ line: createLine(), edits: undefined, ...gst }),
    ).toEqual({
      amountExGst: 450,
      gstAmount: 45,
      amountIncGst: 495,
      hours: 8,
      travelHours: 1,
      totalDriverHours: 9,
    });
  });

  it("recalculates amounts from edited hours given as a string", () => {
    expect(
      getLiveRctiLineAmounts({
        line: createLine(),
        edits: { chargedHours: "6" },
        ...gst,
      }),
    ).toEqual({
      amountExGst: 350,
      gstAmount: 35,
      amountIncGst: 385,
      hours: 6,
      travelHours: 1,
      totalDriverHours: 7,
    });
  });

  it("keeps the line's driver-hours deduction when the hours are edited", () => {
    const result = getLiveRctiLineAmounts({
      line: createLine({ driverCharge: 8 }),
      edits: { chargedHours: 6 },
      ...gst,
    });

    expect(result.totalDriverHours).toBe(6);
    expect(result.hours + result.travelHours - result.totalDriverHours).toBe(1);
    expect(result.amountExGst).toBe(300);
  });

  it("treats an unparseable edited rate as zero", () => {
    const result = getLiveRctiLineAmounts({
      line: createLine(),
      edits: { ratePerHour: "abc" },
      ...gst,
    });

    expect(result.amountIncGst).toBe(0);
  });
});
