import {
  getLineDriverHours,
  getLineDriverHoursBreakdown,
  getTotalDriverHours,
} from "@/lib/utils/rcti-calculations";
import {
  buildRctiLinesFromJobs,
  BREAK_DEDUCTION_CUSTOMER,
  type DriverForLines,
  type JobForLines,
} from "@/lib/rcti-line-builder";

const driver: DriverForLines = {
  type: "Contractor",
  tray: 100,
  crane: null,
  semi: null,
  semiCrane: null,
  breaks: null,
  tolls: false,
  fuelLevy: null,
};

function job(overrides: Partial<JobForLines> = {}): JobForLines {
  return {
    id: 1,
    date: new Date("2026-09-01"),
    driver: "TEST DRIVER",
    customer: "Test Customer",
    truckType: "Tray",
    driverCharge: null,
    chargedHours: 8,
    travelTimeHours: null,
    startTime: null,
    finishTime: null,
    jobReference: null,
    comments: null,
    ...overrides,
  };
}

describe("signed RCTI line hours", () => {
  it("keeps a negative line negative", () => {
    expect(
      getLineDriverHours({
        chargedHours: -1.5,
        travelTimeHours: 0,
        driverCharge: null,
      }),
    ).toBe(-1.5);
  });

  it("keeps a stored negative total negative", () => {
    // The travel-time migration copied chargedHours into driverCharge, so
    // break-deduction lines can carry a negative stored total.
    expect(
      getLineDriverHours({
        chargedHours: -1.5,
        travelTimeHours: 0,
        driverCharge: -1.5,
      }),
    ).toBe(-1.5);
  });

  it("uses a stored total as-is rather than as an adjustment", () => {
    expect(
      getLineDriverHours({
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 7,
      }),
    ).toBe(7);
  });

  it("treats a stored zero total as zero", () => {
    expect(
      getLineDriverHours({
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 0,
      }),
    ).toBe(0);
  });

  it("falls back to charged plus travel hours when no total is stored", () => {
    expect(
      getLineDriverHours({
        chargedHours: 8,
        travelTimeHours: 1.5,
        driverCharge: null,
      }),
    ).toBe(9.5);
  });

  it("reports no deduction on a negative line", () => {
    expect(
      getLineDriverHoursBreakdown({
        chargedHours: -1.5,
        travelTimeHours: 0,
        driverCharge: -1.5,
      }),
    ).toMatchObject({
      totalDriverHours: -1.5,
      deductionHours: 0,
      hasDeduction: false,
    });
  });

  it("derives the deduction a line carries from its job", () => {
    expect(
      getLineDriverHoursBreakdown({
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 7.5,
      }),
    ).toMatchObject({
      baseHours: 9,
      totalDriverHours: 7.5,
      deductionHours: 1.5,
      hasDeduction: true,
    });
  });
});

describe("job driver hours floor", () => {
  it("pays nothing when the deduction exceeds the hours worked", () => {
    expect(
      getTotalDriverHours({
        chargedHours: 8,
        travelTimeHours: 0,
        driverCharge: null,
        deductionHours: 10,
      }),
    ).toBe(0);
  });

  it("does not floor hours that were never adjusted", () => {
    expect(
      getTotalDriverHours({
        chargedHours: -1.5,
        travelTimeHours: 0,
        driverCharge: null,
      }),
    ).toBe(-1.5);
  });

  it("applies a carried positive adjustment to a changed base", () => {
    expect(
      getTotalDriverHours({
        chargedHours: 9,
        travelTimeHours: 1,
        driverCharge: null,
        hoursAdjustment: 1,
      }),
    ).toBe(11);
  });

  it("stacks a deduction on top of a legacy driver hours total", () => {
    // A deduction withholds hours from whatever the driver would be paid, so a
    // legacy total of 7 less a 1 hour deduction pays 6.
    expect(
      getTotalDriverHours({
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 7,
        deductionHours: 1,
      }),
    ).toBe(6);
  });

  it("leaves a legacy total untouched when the deduction is zero", () => {
    expect(
      getTotalDriverHours({
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 7,
        deductionHours: 0,
      }),
    ).toBe(7);
  });

  it("floors a legacy total combined with an over-sized deduction", () => {
    expect(
      getTotalDriverHours({
        chargedHours: 8,
        travelTimeHours: 1,
        driverCharge: 7,
        deductionHours: 9,
      }),
    ).toBe(0);
  });
});

describe("driver-only jobs on an RCTI", () => {
  it("bills a driver-only job to the driver in full", () => {
    const lines = buildRctiLinesFromJobs({
      eligibleJobs: [job({ driverOnly: true, chargedHours: 8 })],
      driver,
      weekEndingDate: new Date("2026-09-06"),
      gstStatus: "not_registered",
      gstMode: "exclusive",
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      jobId: 1,
      chargedHours: 8,
      driverCharge: 8,
      amountExGst: 800,
    });
  });

  it("pays a driver-only job the same as a chargeable one", () => {
    const build = (driverOnly: boolean) =>
      buildRctiLinesFromJobs({
        eligibleJobs: [job({ driverOnly, travelTimeHours: 1 })],
        driver,
        weekEndingDate: new Date("2026-09-06"),
        gstStatus: "not_registered",
        gstMode: "exclusive",
      });

    expect(build(true)).toEqual(build(false));
  });

  it("still applies a deduction on a driver-only job", () => {
    const lines = buildRctiLinesFromJobs({
      eligibleJobs: [job({ driverOnly: true, deductionHours: 1 })],
      driver,
      weekEndingDate: new Date("2026-09-06"),
      gstStatus: "not_registered",
      gstMode: "exclusive",
    });

    expect(lines[0]).toMatchObject({ driverCharge: 7, amountExGst: 700 });
  });

  it("counts a driver-only job towards break deductions", () => {
    const lines = buildRctiLinesFromJobs({
      eligibleJobs: [job({ driverOnly: true, chargedHours: 8 })],
      driver: { ...driver, breaks: 0.5 },
      weekEndingDate: new Date("2026-09-06"),
      gstStatus: "not_registered",
      gstMode: "exclusive",
    });

    const breakLine = lines.find(
      (line) => line.customer === BREAK_DEDUCTION_CUSTOMER,
    );
    expect(breakLine).toMatchObject({
      chargedHours: -0.5,
      amountExGst: -50,
    });
  });
});
