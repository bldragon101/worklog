import {
  buildRctiStatement,
  buildRctiStatementEmailSubject,
  buildRctiStatementFilename,
  formatMelbourneDate,
  formatStatementDate,
  formatStatementPeriod,
  isStatementEligibleStatus,
  type StatementRctiInput,
} from "@/lib/rcti-statement";
import { rctiStatementSchema } from "@/lib/validation";

function makeRcti({
  overrides,
}: {
  overrides: Partial<StatementRctiInput>;
}): StatementRctiInput {
  return {
    id: 1,
    invoiceNumber: "RCTI-1",
    weekEnding: "2026-01-04T00:00:00.000Z",
    status: "finalised",
    paidAt: null,
    subtotal: 1000,
    gst: 100,
    total: 1100,
    ...overrides,
  };
}

describe("buildRctiStatement", () => {
  it("orders rows by week ending and totals paid and outstanding", () => {
    const statement = buildRctiStatement({
      rctis: [
        makeRcti({
          overrides: {
            id: 2,
            invoiceNumber: "RCTI-2",
            weekEnding: "2026-01-11T00:00:00.000Z",
            status: "paid",
            paidAt: "2026-01-15T02:00:00.000Z",
            subtotal: 500,
            gst: 50,
            total: 550,
          },
        }),
        makeRcti({ overrides: {} }),
      ],
    });

    expect(statement.rows.map(({ id }) => id)).toEqual([1, 2]);
    expect(statement.periodStart).toBe("2026-01-04T00:00:00.000Z");
    expect(statement.periodEnd).toBe("2026-01-11T00:00:00.000Z");
    expect(statement.totals).toMatchObject({
      count: 2,
      subtotal: 1500,
      gst: 150,
      grossTotal: 1650,
      adjustments: 0,
      amountPayable: 1650,
      paid: 550,
      paidCount: 1,
      outstanding: 1100,
      outstandingCount: 1,
    });
  });

  it("recovers the gross total from a total that includes deductions and reimbursements", () => {
    const statement = buildRctiStatement({
      rctis: [
        makeRcti({
          overrides: {
            // 1100 gross - 150 deduction + 20.10 reimbursement
            total: 970.1,
            deductionApplications: [
              { amount: 150, deduction: { type: "deduction" } },
              { amount: 20.1, deduction: { type: "reimbursement" } },
            ],
          },
        }),
      ],
    });

    expect(statement.rows[0]).toMatchObject({
      grossTotal: 1100,
      adjustments: -129.9,
      amountPayable: 970.1,
    });
    expect(statement.totals.adjustments).toBe(-129.9);
    expect(statement.totals.outstanding).toBe(970.1);
  });

  it("returns an empty statement for no RCTIs", () => {
    const statement = buildRctiStatement({ rctis: [] });
    expect(statement.rows).toEqual([]);
    expect(statement.periodStart).toBeNull();
    expect(statement.totals.amountPayable).toBe(0);
  });

  it("avoids floating point drift in totals", () => {
    const statement = buildRctiStatement({
      rctis: [0.1, 0.2, 0.3].map((total, index) =>
        makeRcti({
          overrides: {
            id: index + 1,
            invoiceNumber: `RCTI-${index + 1}`,
            subtotal: total,
            gst: 0,
            total,
          },
        }),
      ),
    });
    expect(statement.totals.amountPayable).toBe(0.6);
  });
});

describe("statement formatting", () => {
  it("formats week ending dates without timezone conversion", () => {
    expect(formatStatementDate({ isoString: "2026-03-01T00:00:00.000Z" })).toBe(
      "01/03/2026",
    );
  });

  it("formats paid timestamps as Melbourne dates", () => {
    // 3pm UTC on 1 March is 2am on 2 March in Melbourne (AEDT)
    expect(formatMelbourneDate({ isoString: "2026-03-01T15:00:00.000Z" })).toBe(
      "02/03/2026",
    );
  });

  it("describes a single week and a range of weeks", () => {
    expect(
      formatStatementPeriod({
        periodStart: "2026-01-04T00:00:00.000Z",
        periodEnd: "2026-01-04T00:00:00.000Z",
      }),
    ).toBe("W/E 04/01/2026");
    expect(
      formatStatementPeriod({
        periodStart: "2026-01-04T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      }),
    ).toBe("W/E 04/01/2026 - 01/02/2026");
  });

  it("builds subjects for statements and for re-sent RCTIs", () => {
    const period = {
      periodStart: "2026-01-04T00:00:00.000Z",
      periodEnd: "2026-02-01T00:00:00.000Z",
    };
    expect(
      buildRctiStatementEmailSubject({
        ...period,
        companyName: " Acme Transport ",
        includeStatement: true,
      }),
    ).toBe("RCTI Statement W/E 04/01/2026 - 01/02/2026 from Acme Transport");
    expect(
      buildRctiStatementEmailSubject({
        ...period,
        companyName: null,
        includeStatement: false,
      }),
    ).toBe("RCTIs W/E 04/01/2026 - 01/02/2026");
  });

  it("builds safe file names", () => {
    expect(
      buildRctiStatementFilename({
        driverName: "John O'Brien / Smith",
        periodStart: "2026-01-04T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
        includeStatement: true,
      }),
    ).toBe("Statement-John-O-Brien-Smith-2026-01-04-to-2026-02-01.pdf");
    expect(
      buildRctiStatementFilename({
        driverName: "",
        periodStart: "2026-01-04T00:00:00.000Z",
        periodEnd: "2026-01-04T00:00:00.000Z",
        includeStatement: false,
      }),
    ).toBe("RCTIs-Driver-2026-01-04.pdf");
  });

  it("only allows finalised and paid RCTIs", () => {
    expect(isStatementEligibleStatus({ status: "finalised" })).toBe(true);
    expect(isStatementEligibleStatus({ status: "paid" })).toBe(true);
    expect(isStatementEligibleStatus({ status: "draft" })).toBe(false);
  });
});

describe("rctiStatementSchema", () => {
  it("defaults to the statement only", () => {
    expect(rctiStatementSchema.parse({ driverId: 1, rctiIds: [1] })).toEqual({
      driverId: 1,
      rctiIds: [1],
      includeStatement: true,
      includeRctis: false,
    });
  });

  it("requires the statement, the RCTIs or both", () => {
    expect(
      rctiStatementSchema.safeParse({
        driverId: 1,
        rctiIds: [1],
        includeStatement: false,
        includeRctis: false,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty selection", () => {
    expect(
      rctiStatementSchema.safeParse({ driverId: 1, rctiIds: [] }).success,
    ).toBe(false);
  });
});
