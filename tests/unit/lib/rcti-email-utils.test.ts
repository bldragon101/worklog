/**
 * @jest-environment node
 */
import {
  formatRctiWeekEndingShort,
  formatRctiWeekEndingLong,
  buildRctiEmailSubject,
} from "@/lib/rcti-email-utils";

describe("rcti-email-utils", () => {
  describe("formatRctiWeekEndingShort", () => {
    it("should format a standard ISO date string to DD.MM.YYYY", () => {
      const result = formatRctiWeekEndingShort({
        isoString: "2025-06-15T00:00:00.000Z",
      });
      expect(result).toBe("15.06.2025");
    });

    it("should format date-only ISO string to DD.MM.YYYY", () => {
      const result = formatRctiWeekEndingShort({
        isoString: "2025-01-07",
      });
      expect(result).toBe("07.01.2025");
    });

    it("should preserve leading zeros in day and month", () => {
      const result = formatRctiWeekEndingShort({
        isoString: "2025-03-05T00:00:00.000Z",
      });
      expect(result).toBe("05.03.2025");
    });

    it("should handle end of year dates", () => {
      const result = formatRctiWeekEndingShort({
        isoString: "2025-12-31T23:59:59.000Z",
      });
      expect(result).toBe("31.12.2025");
    });

    it("should handle start of year dates", () => {
      const result = formatRctiWeekEndingShort({
        isoString: "2025-01-01T00:00:00.000Z",
      });
      expect(result).toBe("01.01.2025");
    });

    it("should handle leap year date", () => {
      const result = formatRctiWeekEndingShort({
        isoString: "2024-02-29T00:00:00.000Z",
      });
      expect(result).toBe("29.02.2024");
    });

    it("should not throw on a malformed string with three hyphen-separated parts", () => {
      expect(() =>
        formatRctiWeekEndingShort({ isoString: "not-a-date" }),
      ).not.toThrow();
    });

    it("should throw on a string with fewer than three hyphen-separated parts", () => {
      expect(() =>
        formatRctiWeekEndingShort({ isoString: "nodashes" }),
      ).toThrow("Invalid ISO date");
    });

    it("should throw on an empty string", () => {
      expect(() => formatRctiWeekEndingShort({ isoString: "" })).toThrow(
        "Invalid ISO date",
      );
    });
  });

  describe("formatRctiWeekEndingLong", () => {
    it("should format to 'D MonthName YYYY' with full month name", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-06-15T00:00:00.000Z",
      });
      expect(result).toBe("15 June 2025");
    });

    it("should strip leading zero from day", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-03-05T00:00:00.000Z",
      });
      expect(result).toBe("5 March 2025");
    });

    it("should format January correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-01-01T00:00:00.000Z",
      });
      expect(result).toBe("1 January 2025");
    });

    it("should format February correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-02-14T00:00:00.000Z",
      });
      expect(result).toBe("14 February 2025");
    });

    it("should format April correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-04-22T00:00:00.000Z",
      });
      expect(result).toBe("22 April 2025");
    });

    it("should format May correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-05-10T00:00:00.000Z",
      });
      expect(result).toBe("10 May 2025");
    });

    it("should format July correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-07-04T00:00:00.000Z",
      });
      expect(result).toBe("4 July 2025");
    });

    it("should format August correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-08-18T00:00:00.000Z",
      });
      expect(result).toBe("18 August 2025");
    });

    it("should format September correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-09-30T00:00:00.000Z",
      });
      expect(result).toBe("30 September 2025");
    });

    it("should format October correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-10-15T00:00:00.000Z",
      });
      expect(result).toBe("15 October 2025");
    });

    it("should format November correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-11-01T00:00:00.000Z",
      });
      expect(result).toBe("1 November 2025");
    });

    it("should format December correctly", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-12-25T00:00:00.000Z",
      });
      expect(result).toBe("25 December 2025");
    });

    it("should handle date-only ISO string", () => {
      const result = formatRctiWeekEndingLong({
        isoString: "2025-09-08",
      });
      expect(result).toBe("8 September 2025");
    });

    it("should throw on a string with fewer than three hyphen-separated parts", () => {
      expect(() => formatRctiWeekEndingLong({ isoString: "nodashes" })).toThrow(
        "Invalid ISO date",
      );
    });
  });

  describe("buildRctiEmailSubject", () => {
    it("should build subject with company name and formatted week ending", () => {
      const result = buildRctiEmailSubject({
        weekEndingIso: "2025-06-15T00:00:00.000Z",
        companyName: "Acme Transport Pty Ltd",
      });
      expect(result).toBe("RCTI W/E 15.06.2025 from Acme Transport Pty Ltd");
    });

    it("should omit company name suffix when companyName is null", () => {
      const result = buildRctiEmailSubject({
        weekEndingIso: "2025-06-15T00:00:00.000Z",
        companyName: null,
      });
      expect(result).toBe("RCTI W/E 15.06.2025");
    });

    it("should omit company name suffix when companyName is empty string", () => {
      const result = buildRctiEmailSubject({
        weekEndingIso: "2025-06-15T00:00:00.000Z",
        companyName: "",
      });
      expect(result).toBe("RCTI W/E 15.06.2025");
    });

    it("should omit company name suffix when companyName is whitespace only", () => {
      const result = buildRctiEmailSubject({
        weekEndingIso: "2025-06-15T00:00:00.000Z",
        companyName: "   ",
      });
      expect(result).toBe("RCTI W/E 15.06.2025");
    });

    it("should trim whitespace from company name", () => {
      const result = buildRctiEmailSubject({
        weekEndingIso: "2025-01-07T00:00:00.000Z",
        companyName: "  My Company  ",
      });
      expect(result).toBe("RCTI W/E 07.01.2025 from My Company");
    });

    it("should use the short date format in the subject", () => {
      const result = buildRctiEmailSubject({
        weekEndingIso: "2025-03-05T00:00:00.000Z",
        companyName: "Test Co",
      });
      expect(result).toContain("05.03.2025");
    });

    it("should handle date-only ISO string", () => {
      const result = buildRctiEmailSubject({
        weekEndingIso: "2025-12-31",
        companyName: "Year End Corp",
      });
      expect(result).toBe("RCTI W/E 31.12.2025 from Year End Corp");
    });

    it("should handle company name with special characters", () => {
      const result = buildRctiEmailSubject({
        weekEndingIso: "2025-06-15T00:00:00.000Z",
        companyName: "O'Brien & Sons Pty Ltd",
      });
      expect(result).toBe("RCTI W/E 15.06.2025 from O'Brien & Sons Pty Ltd");
    });
  });
});
