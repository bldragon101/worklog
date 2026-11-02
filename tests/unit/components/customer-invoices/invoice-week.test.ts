import {
  describeBreakKey,
  getLatestSundayOnOrBefore,
  getSplitReference,
  normaliseInvoiceWeekEnding,
} from "@/components/customer-invoices/invoice-week";

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
