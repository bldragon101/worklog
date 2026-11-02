import {
  describeBreakKey,
  getInvoicePeriodOptions,
  getInvoiceWeekForMonth,
  getLatestSundayOnOrBefore,
  getSplitReference,
  getSundaysInMonth,
  normaliseInvoiceWeekEnding,
  toSelectedWeekEnding,
} from "@/components/customer-invoices/invoice-week";

describe("invoice period selects", () => {
  it("lists every Sunday in a month", () => {
    expect(getSundaysInMonth({ year: 2026, monthIndex: 10 })).toEqual([
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
      "2026-11-22",
      "2026-11-29",
    ]);
    expect(getSundaysInMonth({ year: 2027, monthIndex: 1 })).toEqual([
      "2027-02-07",
      "2027-02-14",
      "2027-02-21",
      "2027-02-28",
    ]);
  });

  it("opens a month on its latest week up to the default week", () => {
    const defaultWeekEnding = "2026-11-01";

    expect(getInvoiceWeekForMonth({ year: 2026, monthIndex: 9, defaultWeekEnding })).toBe(
      "2026-10-25",
    );
    expect(getInvoiceWeekForMonth({ year: 2026, monthIndex: 10, defaultWeekEnding })).toBe(
      "2026-11-01",
    );
    expect(getInvoiceWeekForMonth({ year: 2026, monthIndex: 11, defaultWeekEnding })).toBe(
      "2026-12-06",
    );
  });

  it("selects the year and month of the week's Sunday", () => {
    const options = getInvoicePeriodOptions({
      weekEnding: "2026-11-01",
      defaultWeekEnding: "2026-11-01",
    });

    expect(options).toMatchObject({ selectedYear: 2026, selectedMonth: 10 });
    expect(options.years).toEqual([2023, 2024, 2025, 2026]);
    expect(options.months).toHaveLength(12);
    expect(options.weekEndings[0]).toBe("2026-11-01");
  });

  it("keeps an older selected year in the year options", () => {
    const { years } = getInvoicePeriodOptions({
      weekEnding: "2021-03-07",
      defaultWeekEnding: "2026-11-01",
    });

    expect(years).toEqual([2021, 2023, 2024, 2025, 2026]);
  });

  it("reads the picked week ending as a calendar day", () => {
    expect(toSelectedWeekEnding({ value: "2026-11-08" })).toBe("2026-11-08");
    expect(toSelectedWeekEnding({ value: new Date(2026, 10, 8) })).toBe("2026-11-08");
  });
});

describe("invoice week helpers", () => {
  it("keeps a Sunday and moves other days back to the previous Sunday", () => {
    expect(getLatestSundayOnOrBefore({ isoDate: "2026-11-01" })).toBe("2026-11-01");
    expect(getLatestSundayOnOrBefore({ isoDate: "2026-11-02" })).toBe("2026-11-01");
    expect(getLatestSundayOnOrBefore({ isoDate: "2026-11-07" })).toBe("2026-11-01");
    expect(getLatestSundayOnOrBefore({ isoDate: "2027-01-02" })).toBe("2026-12-27");
  });

  it("normalises a requested week to its week ending Sunday", () => {
    expect(normaliseInvoiceWeekEnding({ value: "2026-11-01" })).toBe("2026-11-01");
    expect(normaliseInvoiceWeekEnding({ value: "2026-10-28" })).toBe("2026-11-01");
    expect(normaliseInvoiceWeekEnding({ value: "2026-02-30" })).toBeNull();
    expect(normaliseInvoiceWeekEnding({ value: "not-a-date" })).toBeNull();
    expect(normaliseInvoiceWeekEnding({ value: null })).toBeNull();
  });

  it("describes break keys and suggests a split reference", () => {
    expect(describeBreakKey({ breakKey: "Semi Crane|165.5" })).toBe("Semi Crane at $165.50/h");
    expect(getSplitReference({ reference: "BowensDC-01/11/26" })).toBe("BowensDC-01/11/26-Adhoc");
    expect(getSplitReference({ reference: "" })).toBe("Adhoc");
  });
});
