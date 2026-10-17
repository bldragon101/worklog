import { describe, expect, it } from "vitest";
import {
  formatDriverDisplayName,
  formatDriverFullName,
  getSubcontractorCompanyName,
  groupDriversByCompany,
} from "@/lib/utils/driver-name";

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

describe("getSubcontractorCompanyName", () => {
  it("uses the business name", () => {
    expect(
      getSubcontractorCompanyName({
        businessName: "ABC Transport",
        truck: "ABC",
      }),
    ).toBe("ABC Transport");
  });

  it("falls back to the truck abbreviation when business name is blank", () => {
    expect(
      getSubcontractorCompanyName({ businessName: "  ", truck: "ABC" }),
    ).toBe("ABC");
    expect(
      getSubcontractorCompanyName({ businessName: null, truck: "ABC" }),
    ).toBe("ABC");
  });
});

describe("formatDriverDisplayName", () => {
  it("shows the company name for subcontractors", () => {
    expect(
      formatDriverDisplayName({
        driver: "JOHN",
        lastName: "SMITH",
        type: "Subcontractor",
        businessName: "ABC Transport",
        truck: "ABC",
      }),
    ).toBe("ABC Transport");
  });

  it("shows the full name for employees and contractors", () => {
    expect(
      formatDriverDisplayName({
        driver: "JOHN",
        lastName: "SMITH",
        type: "Contractor",
        businessName: "Smith Haulage",
        truck: "XYZ123",
      }),
    ).toBe("JOHN SMITH");
  });
});

describe("groupDriversByCompany", () => {
  it("groups and sorts subcontractors by company name", () => {
    const drivers = [
      { id: 1, driver: "ZED", truck: "ZED", businessName: "Zed Cranes" },
      { id: 2, driver: "ABC", truck: "ABC", businessName: "ABC Transport" },
      { id: 3, driver: "BOB", truck: "ABC", businessName: "ABC Transport" },
      { id: 4, driver: "QRS", truck: "QRS", businessName: null },
    ];

    expect(groupDriversByCompany({ drivers })).toEqual([
      { label: "ABC Transport", drivers: [drivers[1], drivers[2]] },
      { label: "QRS", drivers: [drivers[3]] },
      { label: "Zed Cranes", drivers: [drivers[0]] },
    ]);
  });
});
