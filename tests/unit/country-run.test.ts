import { describe, expect, it } from "vitest";
import {
  applyCountryRunComment,
  buildCountryRunComment,
  formatCountryRunCharge,
} from "@/lib/utils/country-run";

describe("formatCountryRunCharge", () => {
  it("formats hours and percentages", () => {
    expect(formatCountryRunCharge({ value: 1.5, unit: "hours" })).toBe(
      "1.5 hours",
    );
    expect(formatCountryRunCharge({ value: 1, unit: "hours" })).toBe("1 hour");
    expect(formatCountryRunCharge({ value: 10, unit: "percentage" })).toBe(
      "10%",
    );
  });
});

describe("buildCountryRunComment", () => {
  it("includes the suburbs and charge", () => {
    expect(
      buildCountryRunComment({
        suburbs: ["Belmont"],
        value: 1.5,
        unit: "hours",
      }),
    ).toBe("*country run Belmont + 1.5 hours*");
    expect(
      buildCountryRunComment({
        suburbs: ["Belmont", "Bendigo"],
        value: 15,
        unit: "percentage",
      }),
    ).toBe("*country run Belmont, Bendigo + 15%*");
  });

  it("omits the location when there are no suburbs", () => {
    expect(buildCountryRunComment({ suburbs: [], value: 2, unit: "hours" })).toBe(
      "*country run + 2 hours*",
    );
  });
});

describe("applyCountryRunComment", () => {
  const base = { suburbs: ["Belmont"], unit: "hours" as const };

  it("appends the note after existing comments", () => {
    expect(
      applyCountryRunComment({ ...base, comments: "Gate code 1234", value: 1.5 }),
    ).toBe("Gate code 1234\n*country run Belmont + 1.5 hours*");
  });

  it("uses the note alone when comments are empty", () => {
    expect(applyCountryRunComment({ ...base, comments: "", value: 2 })).toBe(
      "*country run Belmont + 2 hours*",
    );
  });

  it("replaces an existing note instead of duplicating it", () => {
    expect(
      applyCountryRunComment({
        ...base,
        comments: "Gate code 1234\n*country run Belmont + 1.5 hours*",
        value: 2,
      }),
    ).toBe("Gate code 1234\n*country run Belmont + 2 hours*");
  });

  it("removes the note when the charge is cleared", () => {
    expect(
      applyCountryRunComment({
        ...base,
        comments: "Gate code 1234\n*country run Belmont + 1.5 hours*",
        value: null,
      }),
    ).toBe("Gate code 1234");
    expect(
      applyCountryRunComment({
        ...base,
        comments: "*country run Belmont + 1.5 hours*",
        value: 0,
      }),
    ).toBe("");
  });

  it("keeps other text on the same line and blank lines elsewhere", () => {
    expect(
      applyCountryRunComment({
        ...base,
        comments: "Line one\n\nCall ahead *country run Belmont + 1 hour*",
        value: 10,
        unit: "percentage",
      }),
    ).toBe("Line one\n\nCall ahead\n*country run Belmont + 10%*");
  });
});
