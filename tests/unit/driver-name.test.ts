import { describe, expect, it } from "vitest";
import {
  formatDriverDisplayName,
  formatDriverFullName,
  formatDriverSearchName,
  formatSubcontractorDriverName,
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

describe("formatSubcontractorDriverName", () => {
  it("returns the person's name when it differs from the truck", () => {
    expect(
      formatSubcontractorDriverName({
        driver: "JOHN",
        lastName: "SMITH",
        type: "Subcontractor",
        truck: "ABC",
      }),
    ).toBe("JOHN SMITH");
  });

  it("returns null when the first name repeats the truck abbreviation", () => {
    expect(
      formatSubcontractorDriverName({
        driver: "ABC",
        type: "Subcontractor",
        truck: "ABC",
      }),
    ).toBeNull();
  });

  it("returns null for employees and contractors", () => {
    expect(
      formatSubcontractorDriverName({
        driver: "JOHN",
        type: "Contractor",
        truck: "XYZ123",
      }),
    ).toBeNull();
  });
});

describe("formatDriverSearchName", () => {
  it("includes the company and person's name for subcontractors", () => {
    expect(
      formatDriverSearchName({
        driver: "JOHN",
        lastName: "SMITH",
        type: "Subcontractor",
        businessName: "ABC Transport",
        truck: "ABC",
      }),
    ).toBe("ABC Transport JOHN SMITH");
  });

  it("uses the full name for employees", () => {
    expect(
      formatDriverSearchName({
        driver: "JOHN",
        lastName: "SMITH",
        type: "Employee",
        truck: "XYZ123",
      }),
    ).toBe("JOHN SMITH");
  });
});
