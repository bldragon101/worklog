import { describe, expect, it } from "vitest";
import { formatDriverFullName } from "@/lib/utils/driver-name";

describe("formatDriverFullName", () => {
  it("joins first and last name", () => {
    expect(formatDriverFullName({ driver: "JOHN", lastName: "SMITH" })).toBe(
      "JOHN SMITH",
    );
  });

  it("returns the first name when last name is missing or blank", () => {
    expect(formatDriverFullName({ driver: "JOHN", lastName: null })).toBe(
      "JOHN",
    );
    expect(formatDriverFullName({ driver: "JOHN", lastName: "  " })).toBe(
      "JOHN",
    );
    expect(formatDriverFullName({ driver: "JOHN" })).toBe("JOHN");
  });
});
