import {
  buildRctiLinesFromJobs,
  FUEL_LEVY_CUSTOMER,
  TOLLS_CUSTOMER,
  type DriverForLines,
  type JobForLines,
} from "@/lib/rcti-line-builder";

const driver: DriverForLines = {
  type: "Employee",
  tray: 100,
  crane: null,
  semi: null,
  semiCrane: null,
  breaks: null,
  tolls: true,
  fuelLevy: 10,
};

function job({ overrides = {} }: { overrides?: Partial<JobForLines> } = {}): JobForLines {
  return {
    id: 1,
    date: new Date("2026-10-27"),
    driver: "TEST DRIVER",
    customer: "Test Customer",
    truckType: "Tray",
    driverCharge: null,
    chargedHours: 6,
    travelTimeHours: null,
    startTime: null,
    finishTime: null,
    jobReference: null,
    comments: null,
    eastlink: 2,
    citylink: 3,
    ...overrides,
  };
}

function build({ tollRates }: { tollRates: { eastlink: number; citylink: number } }) {
  return buildRctiLinesFromJobs({
    eligibleJobs: [job()],
    driver,
    weekEndingDate: new Date("2026-11-01"),
    gstStatus: "not_registered",
    gstMode: "exclusive",
    tollRates,
  });
}

describe("RCTI toll lines use the configured toll rates", () => {
  it("prices each road at its configured rate", () => {
    const tollLines = build({ tollRates: { eastlink: 19.45, citylink: 34.9 } }).filter(
      (line) => line.customer === TOLLS_CUSTOMER,
    );

    expect(tollLines).toEqual([
      expect.objectContaining({
        truckType: "Eastlink",
        chargedHours: 2,
        ratePerHour: 19.45,
        amountExGst: 38.9,
        description: "2 × $19.45",
      }),
      expect.objectContaining({
        truckType: "CityLink",
        chargedHours: 3,
        ratePerHour: 34.9,
        amountExGst: 104.7,
        description: "3 × $34.90",
      }),
    ]);
  });

  it("leaves tolls out of the fuel levy", () => {
    const fuelLevyLine = build({ tollRates: { eastlink: 50, citylink: 50 } }).find(
      (line) => line.customer === FUEL_LEVY_CUSTOMER,
    );

    // 10% of the 6 hours at $100, not including tolls
    expect(fuelLevyLine?.amountExGst).toBe(60);
  });
});
