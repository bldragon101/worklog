/**
 * @vitest-environment node
 */
import { splitDateRange } from "../../../scripts/linkt/linkt-client";

describe("splitDateRange", () => {
  it("splits a range into 7-day windows that end on the last day", () => {
    expect(splitDateRange({ from: "2026-09-21", to: "2026-10-04" })).toEqual([
      { from: "2026-09-21", to: "2026-09-27" },
      { from: "2026-09-28", to: "2026-10-04" },
    ]);
  });

  it("shortens the last window and handles a single day", () => {
    expect(splitDateRange({ from: "2026-12-29", to: "2027-01-06" })).toEqual([
      { from: "2026-12-29", to: "2027-01-04" },
      { from: "2027-01-05", to: "2027-01-06" },
    ]);
    expect(splitDateRange({ from: "2026-10-04", to: "2026-10-04" })).toEqual([
      { from: "2026-10-04", to: "2026-10-04" },
    ]);
  });
});
