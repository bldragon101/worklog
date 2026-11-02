import {
  buildCustomerInvoiceLines,
  calculateInvoiceTotals,
  getTruckClass,
  type InvoiceCustomerInput,
  type InvoiceJobInput,
} from "@/lib/customer-invoices/line-builder";

const tollRates = { eastlink: 19.45, citylink: 34.9 };

const customer: InvoiceCustomerInput = {
  tray: 100,
  crane: 120,
  semi: 130,
  semiCrane: 150,
  fuelLevy: null,
  tolls: false,
  breakDeduction: null,
};

function job({ overrides = {} }: { overrides?: Partial<InvoiceJobInput> } = {}): InvoiceJobInput {
  return {
    id: 1,
    date: "2026-10-27",
    driver: "Sam Driver",
    registration: "CTJ450",
    truckType: "Tray",
    chargedHours: 6,
    startTime: "2026-10-27T06:00:00.000Z",
    finishTime: "2026-10-27T12:00:00.000Z",
    eastlink: null,
    citylink: null,
    countryRunValue: null,
    countryRunUnit: null,
    hasRunsheet: true,
    ...overrides,
  };
}

function build({
  jobs,
  customerOverrides = {},
  waivedBreakDeductions,
}: {
  jobs: InvoiceJobInput[];
  customerOverrides?: Partial<InvoiceCustomerInput>;
  waivedBreakDeductions?: string[];
}) {
  return buildCustomerInvoiceLines({
    jobs,
    customer: { ...customer, ...customerOverrides },
    tollRates,
    waivedBreakDeductions,
  });
}

describe("getTruckClass", () => {
  it.each([
    ["Tray", "tray"],
    ["TRAY", "tray"],
    ["Crane", "crane"],
    ["SEMI", "semi"],
    ["Prime Mover", "semi"],
    ["Semi Crane", "semiCrane"],
    ["SEMI CRANE", "semiCrane"],
    ["UTE", null],
    ["Tautliner", null],
  ])("classes %s as %s", (truckType, expected) => {
    expect(getTruckClass({ truckType })).toBe(expected);
  });
});

describe("customer invoice job lines", () => {
  it("charges the customer's rate for the truck class with 10% GST", () => {
    const { lines, warnings } = build({ jobs: [job({ overrides: { truckType: "Crane" } })] });

    expect(warnings).toEqual([]);
    expect(lines).toEqual([
      expect.objectContaining({
        kind: "job",
        jobId: 1,
        jobDate: "2026-10-27",
        truckClass: "crane",
        quantity: 6,
        unitAmount: 120,
        amountExGst: 720,
        gstAmount: 72,
        amountIncGst: 792,
        description: "27/10/26 | CTJ450 | Sam Driver | 06:00 - 12:00",
      }),
    ]);
  });

  it("adds country run hours to the quantity", () => {
    const { lines } = build({
      jobs: [job({ overrides: { countryRunValue: 1.5, countryRunUnit: "hours" } })],
    });

    expect(lines[0]).toMatchObject({ quantity: 7.5, unitAmount: 100, amountExGst: 750 });
    expect(lines[0].description).toContain("Country run + 1.5 hours");
  });

  it("raises the rate by a country run percentage", () => {
    const { lines } = build({
      jobs: [job({ overrides: { countryRunValue: 10, countryRunUnit: "percentage" } })],
    });

    expect(lines[0]).toMatchObject({ quantity: 6, unitAmount: 110, amountExGst: 660 });
    expect(lines[0].description).toContain("Country run + 10%");
  });

  it("orders job lines by date then id", () => {
    const { lines } = build({
      jobs: [
        job({ overrides: { id: 3, date: "2026-10-28" } }),
        job({ overrides: { id: 2, date: "2026-10-27" } }),
        job({ overrides: { id: 1, date: "2026-10-28" } }),
      ],
    });

    expect(lines.map((line) => line.jobId)).toEqual([2, 1, 3]);
  });

  it("flags a truck type that has no rate class instead of charging tray", () => {
    const { lines, warnings } = build({ jobs: [job({ overrides: { truckType: "UTE" } })] });

    expect(lines[0]).toMatchObject({ truckClass: null, unitAmount: 0, amountExGst: 0 });
    expect(warnings).toEqual([expect.objectContaining({ code: "unknown_truck_type", jobId: 1 })]);
  });

  it("flags a missing customer rate", () => {
    const { warnings } = build({
      jobs: [job({ overrides: { truckType: "Semi Crane" } })],
      customerOverrides: { semiCrane: null },
    });

    expect(warnings).toEqual([
      expect.objectContaining({ code: "missing_rate", message: "The customer has no Semi Crane rate" }),
    ]);
  });

  it("flags missing hours and a missing runsheet", () => {
    const { lines, warnings } = build({
      jobs: [job({ overrides: { chargedHours: null, hasRunsheet: false } })],
    });

    expect(lines[0]).toMatchObject({ quantity: 0, amountExGst: 0 });
    expect(warnings.map((warning) => warning.code).sort()).toEqual([
      "missing_hours",
      "missing_runsheet",
    ]);
  });
});

describe("customer invoice break deductions", () => {
  const longJob = ({ id, truckType = "Tray" }: { id: number; truckType?: string }) =>
    job({ overrides: { id, chargedHours: 8, truckType } });

  it("deducts the customer's break hours from each job over 7 hours, grouped by truck type and rate", () => {
    const { lines } = build({
      jobs: [
        longJob({ id: 1 }),
        longJob({ id: 2 }),
        longJob({ id: 3, truckType: "Crane" }),
        job({ overrides: { id: 4, chargedHours: 7 } }),
      ],
      customerOverrides: { breakDeduction: 0.5 },
    });

    expect(lines.filter((line) => line.kind === "break")).toEqual([
      expect.objectContaining({
        breakKey: "Tray|100",
        quantity: -1,
        unitAmount: 100,
        amountExGst: -100,
        description: "Breaks - Tray (2 × 0.5h)",
      }),
      expect.objectContaining({
        breakKey: "Crane|120",
        quantity: -0.5,
        unitAmount: 120,
        amountExGst: -60,
      }),
    ]);
  });

  it("judges the 7 hours before country run hours are added", () => {
    const { lines } = build({
      jobs: [job({ overrides: { chargedHours: 6.5, countryRunValue: 2, countryRunUnit: "hours" } })],
      customerOverrides: { breakDeduction: 0.5 },
    });

    expect(lines.some((line) => line.kind === "break")).toBe(false);
  });

  it("deducts breaks at the country run rate for percentage runs", () => {
    const { lines } = build({
      jobs: [
        job({ overrides: { chargedHours: 8, countryRunValue: 10, countryRunUnit: "percentage" } }),
      ],
      customerOverrides: { breakDeduction: 0.5 },
    });

    expect(lines.find((line) => line.kind === "break")).toMatchObject({
      breakKey: "Tray|110",
      unitAmount: 110,
      amountExGst: -55,
    });
  });

  it("leaves out waived break deductions", () => {
    const { lines } = build({
      jobs: [longJob({ id: 1 }), longJob({ id: 2, truckType: "Crane" })],
      customerOverrides: { breakDeduction: 0.5 },
      waivedBreakDeductions: ["Tray|100"],
    });

    expect(lines.filter((line) => line.kind === "break").map((line) => line.breakKey)).toEqual([
      "Crane|120",
    ]);
  });

  it("has no break lines when the customer has no break deduction", () => {
    const { lines } = build({ jobs: [longJob({ id: 1 })] });

    expect(lines.some((line) => line.kind === "break")).toBe(false);
  });
});

describe("customer invoice tolls and fuel levy", () => {
  it("charges tolls at the configured rates only when the customer is charged tolls", () => {
    const jobs = [
      job({ overrides: { id: 1, eastlink: 2, citylink: 1 } }),
      job({ overrides: { id: 2, eastlink: 1 } }),
    ];

    expect(build({ jobs }).lines.some((line) => line.kind === "toll")).toBe(false);

    const tollLines = build({ jobs, customerOverrides: { tolls: true } }).lines.filter(
      (line) => line.kind === "toll",
    );
    expect(tollLines).toEqual([
      expect.objectContaining({ tollRoad: "eastlink", quantity: 3, unitAmount: 19.45, amountExGst: 58.35 }),
      expect.objectContaining({ tollRoad: "citylink", quantity: 1, unitAmount: 34.9, amountExGst: 34.9 }),
    ]);
  });

  it("charges the fuel levy on jobs after breaks, not on tolls", () => {
    const { lines } = build({
      jobs: [job({ overrides: { chargedHours: 8, eastlink: 1 } })],
      customerOverrides: { breakDeduction: 0.5, fuelLevy: 10, tolls: true },
    });

    // (8h - 0.5h) at $100 = $750, 10% = $75
    expect(lines.find((line) => line.kind === "fuelLevy")).toMatchObject({
      fuelLevyPercent: 10,
      quantity: 1,
      unitAmount: 75,
      amountExGst: 75,
      gstAmount: 7.5,
      description: "Fuel levy 10%",
    });
    expect(lines.map((line) => line.kind)).toEqual(["job", "break", "toll", "fuelLevy"]);
  });

  it("totals all lines", () => {
    const { lines } = build({
      jobs: [job({ overrides: { chargedHours: 8, citylink: 1 } })],
      customerOverrides: { breakDeduction: 0.5, fuelLevy: 10, tolls: true },
    });

    // 800 - 50 + 34.90 + 75 = 859.90
    expect(calculateInvoiceTotals({ lines })).toEqual({
      subtotal: 859.9,
      gst: 85.99,
      total: 945.89,
    });
  });
});
