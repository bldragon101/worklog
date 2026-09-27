import { describe, expect, it } from "vitest";
import {
  FUEL_LEVY_MAX,
  isFuelLevyInRange,
  parseFuelLevy,
} from "@/lib/utils/fuel-levy";

describe("parseFuelLevy", () => {
  it("returns null for empty or non-numeric input", () => {
    expect(parseFuelLevy({ value: "" })).toBeNull();
    expect(parseFuelLevy({ value: "abc" })).toBeNull();
  });

  it("keeps whole and two-decimal percentages", () => {
    expect(parseFuelLevy({ value: "15" })).toBe(15);
    expect(parseFuelLevy({ value: "15.69" })).toBe(15.69);
  });

  it("rounds to two decimal places", () => {
    expect(parseFuelLevy({ value: "15.694" })).toBe(15.69);
    expect(parseFuelLevy({ value: "15.696" })).toBe(15.7);
  });
});

describe("isFuelLevyInRange", () => {
  it("accepts the 0-100 boundaries", () => {
    expect(isFuelLevyInRange({ value: 0 })).toBe(true);
    expect(isFuelLevyInRange({ value: FUEL_LEVY_MAX })).toBe(true);
  });

  it("rejects negative and over-limit values", () => {
    expect(isFuelLevyInRange({ value: -0.01 })).toBe(false);
    expect(isFuelLevyInRange({ value: 100.01 })).toBe(false);
  });
});
