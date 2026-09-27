import { describe, expect, it } from "vitest";
import {
  getRegionalDropoffs,
  isRegionalSuburb,
} from "@/lib/utils/regional-suburbs";

describe("isRegionalSuburb", () => {
  it("flags suburbs outside Greater Melbourne", () => {
    expect(isRegionalSuburb({ name: "Belmont" })).toBe(true);
    expect(isRegionalSuburb({ name: "Ballarat Central" })).toBe(true);
    expect(isRegionalSuburb({ name: " bendigo " })).toBe(true);
  });

  it("does not flag Greater Melbourne suburbs", () => {
    for (const name of ["Melbourne", "Dandenong", "Frankston", "Pakenham"]) {
      expect(isRegionalSuburb({ name })).toBe(false);
    }
  });

  it("does not flag custom or ambiguous names", () => {
    expect(isRegionalSuburb({ name: "Depot" })).toBe(false);
    expect(isRegionalSuburb({ name: "Hillside" })).toBe(false);
  });
});

describe("getRegionalDropoffs", () => {
  it("returns regional drop-offs for a metro pickup", () => {
    expect(
      getRegionalDropoffs({
        pickup: ["Dandenong"],
        dropoff: ["Belmont", "Richmond", "Bendigo"],
      }),
    ).toEqual(["Belmont", "Bendigo"]);
  });

  it("returns nothing when a pickup is regional", () => {
    expect(
      getRegionalDropoffs({ pickup: ["Geelong"], dropoff: ["Belmont"] }),
    ).toEqual([]);
  });

  it("returns nothing when all drop-offs are metro", () => {
    expect(
      getRegionalDropoffs({ pickup: ["Dandenong"], dropoff: ["Richmond"] }),
    ).toEqual([]);
  });
});
