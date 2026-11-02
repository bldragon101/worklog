import {
  buildInvoiceReference,
  getInvoiceWeekEnding,
  getInvoiceWeekRange,
  getReferenceGroup,
  groupJobsIntoAutomaticInvoices,
} from "@/lib/customer-invoices/grouping";

describe("invoice weeks", () => {
  it.each([
    ["2026-10-26T00:00:00.000Z", "2026-11-01"],
    ["2026-11-01T00:00:00.000Z", "2026-11-01"],
    ["2026-11-02T00:00:00.000Z", "2026-11-08"],
    ["2026-12-29T00:00:00.000Z", "2027-01-03"],
    // Saved as Melbourne midnight: Monday 2 November (AEDT) and Sunday 1 November
    ["2026-11-01T13:00:00.000Z", "2026-11-08"],
    ["2026-10-31T13:00:00.000Z", "2026-11-01"],
    // Monday 22 June (AEST)
    ["2026-06-21T14:00:00.000Z", "2026-06-28"],
  ])("puts a job on %s in the week ending %s", (jobDate, weekEnding) => {
    expect(getInvoiceWeekEnding({ jobDate })).toBe(weekEnding);
    expect(getInvoiceWeekEnding({ jobDate: new Date(jobDate) })).toBe(weekEnding);
  });

  it("covers Monday to Sunday, however the job dates were saved", () => {
    const range = getInvoiceWeekRange({ weekEnding: "2026-11-01" });
    const inWeek = ({ iso }: { iso: string }) => {
      const time = new Date(iso).getTime();
      return time >= range.gte.getTime() && time < range.lt.getTime();
    };

    expect(range.gte.toISOString()).toBe("2026-10-25T12:00:00.000Z");
    expect(range.lt.toISOString()).toBe("2026-11-01T12:00:00.000Z");
    // Monday 26 October and Sunday 1 November, at UTC and Melbourne midnight
    expect(inWeek({ iso: "2026-10-26T00:00:00.000Z" })).toBe(true);
    expect(inWeek({ iso: "2026-10-25T13:00:00.000Z" })).toBe(true);
    expect(inWeek({ iso: "2026-11-01T00:00:00.000Z" })).toBe(true);
    expect(inWeek({ iso: "2026-10-31T13:00:00.000Z" })).toBe(true);
    // Monday 2 November and Sunday 25 October, at Melbourne midnight
    expect(inWeek({ iso: "2026-11-01T13:00:00.000Z" })).toBe(false);
    expect(inWeek({ iso: "2026-10-24T13:00:00.000Z" })).toBe(false);
  });
});

describe("invoice references", () => {
  it("joins the run or customer name without spaces to the week ending", () => {
    expect(buildInvoiceReference({ label: "Bowens Cheltenham", weekEnding: "2026-11-01" })).toBe(
      "BowensCheltenham-01/11/26",
    );
  });

  it("only groups by reference for customers that separate invoices by reference", () => {
    expect(
      getReferenceGroup({ jobReference: " Bowens  Cheltenham ", separateInvoicesByReference: true }),
    ).toBe("bowens cheltenham");
    expect(
      getReferenceGroup({ jobReference: "Bowens Cheltenham", separateInvoicesByReference: false }),
    ).toBeNull();
    expect(getReferenceGroup({ jobReference: "  ", separateInvoicesByReference: true })).toBeNull();
  });
});

describe("groupJobsIntoAutomaticInvoices", () => {
  const job = ({
    id,
    customer,
    jobReference = null,
  }: {
    id: number;
    customer: string;
    jobReference?: string | null;
  }) => ({ id, customer, jobReference });

  it("makes one draft per customer, and one per run for customers separated by reference", () => {
    const groups = groupJobsIntoAutomaticInvoices({
      jobs: [
        job({ id: 1, customer: "Xperia Group", jobReference: "Bowens Cheltenham" }),
        job({ id: 2, customer: "xperia group", jobReference: "bowens cheltenham" }),
        job({ id: 3, customer: "Xperia Group", jobReference: "Bowens DC" }),
        job({ id: 4, customer: "Xperia Group" }),
        job({ id: 5, customer: "Acme", jobReference: "PO-1" }),
        job({ id: 6, customer: "Acme", jobReference: "PO-2" }),
      ],
      weekEnding: "2026-11-01",
      isSeparatedByReference: ({ customerKey }) => customerKey === "xperia group",
    });

    expect(
      groups.map((group) => ({
        key: group.key,
        jobReference: group.jobReference,
        jobIds: group.jobs.map((entry) => entry.id),
      })),
    ).toEqual([
      {
        key: "auto:xperia group:2026-11-01:bowens cheltenham",
        jobReference: "Bowens Cheltenham",
        jobIds: [1, 2],
      },
      { key: "auto:xperia group:2026-11-01:bowens dc", jobReference: "Bowens DC", jobIds: [3] },
      { key: "auto:xperia group:2026-11-01:", jobReference: null, jobIds: [4] },
      { key: "auto:acme:2026-11-01:", jobReference: null, jobIds: [5, 6] },
    ]);
  });
});
