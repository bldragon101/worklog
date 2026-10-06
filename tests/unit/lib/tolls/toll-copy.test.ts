import {
  formatTollGroupsForCopy,
  groupTollJobsForCopy,
  groupTollTripsForCopy,
} from "@/lib/tolls/toll-copy";
import type { TollTripRow } from "@/lib/tolls/toll-types";

function makeTrip({
  id,
  tripStart,
  tripDetails = "Tullamarine Fwy to Monash Fwy",
  road = "citylink",
  amount = 10,
  registration = "CTJ450",
  driver = "JOHN",
}: {
  id: number;
  tripStart: string;
  tripDetails?: string;
  road?: TollTripRow["road"];
  amount?: number;
  registration?: string | null;
  driver?: string | null;
}): TollTripRow {
  return {
    id,
    tripStart,
    tripEnd: null,
    tripDetails,
    road,
    lpn: registration,
    tagNumber: registration ? null : "123456",
    registration,
    vehicleClass: "HCV",
    amount,
    matchStatus: driver ? "matched" : "no-job",
    job: driver
      ? { id: 50, driver, customer: "Acme", startTime: null, finishTime: null }
      : null,
  };
}

describe("formatTollGroupsForCopy", () => {
  it("lists one job's trips in time order with a total", () => {
    const text = formatTollGroupsForCopy({
      groups: groupTollJobsForCopy({
        jobs: [
          {
            jobDay: "2026-10-05",
            registration: "CTJ450",
            driver: "JOHN",
            trips: [
              {
                id: 2,
                tripStart: "2026-10-05T09:15:00.000Z",
                tripEnd: null,
                tripDetails: "EL Mitcham Rd to Ringwood Bypass",
                road: "eastlink",
                amount: 6.2,
              },
              {
                id: 1,
                tripStart: "2026-10-05T06:05:00.000Z",
                tripEnd: null,
                tripDetails: "Tullamarine Fwy to Monash Fwy",
                road: "citylink",
                amount: 38.32,
              },
            ],
          },
        ],
      }),
    });

    expect(text).toBe(
      [
        "Tolls 05/10/2026 - CTJ450 - JOHN",
        "06:05 CityLink Tullamarine Fwy to Monash Fwy $38.32",
        "09:15 EastLink Mitcham Rd to Ringwood Bypass $6.20",
        "Total: $44.52 (2 trips)",
      ].join("\n"),
    );
  });

  it("groups trips by day and vehicle and adds a grand total", () => {
    const text = formatTollGroupsForCopy({
      groups: groupTollTripsForCopy({
        trips: [
          makeTrip({ id: 3, tripStart: "2026-10-06T07:00:00.000Z", amount: 0.1 }),
          makeTrip({ id: 2, tripStart: "2026-10-05T08:00:00.000Z", amount: 0.2 }),
          makeTrip({
            id: 1,
            tripStart: "2026-10-05T07:00:00.000Z",
            registration: null,
            driver: null,
          }),
        ],
      }),
    });

    expect(text).toBe(
      [
        "Tolls 05/10/2026 - CTJ450 - JOHN",
        "08:00 CityLink Tullamarine Fwy to Monash Fwy $0.20",
        "Total: $0.20 (1 trip)",
        "",
        "Tolls 05/10/2026 - Tag 123456",
        "07:00 CityLink Tullamarine Fwy to Monash Fwy $10.00",
        "Total: $10.00 (1 trip)",
        "",
        "Tolls 06/10/2026 - CTJ450 - JOHN",
        "07:00 CityLink Tullamarine Fwy to Monash Fwy $0.10",
        "Total: $0.10 (1 trip)",
        "",
        "Grand total: $10.30 (3 trips)",
      ].join("\n"),
    );
  });

  it("gives each driver of a shared vehicle their own heading", () => {
    const groups = groupTollTripsForCopy({
      trips: [
        makeTrip({ id: 1, tripStart: "2026-10-05T07:00:00.000Z", driver: "JOHN" }),
        makeTrip({ id: 2, tripStart: "2026-10-05T15:00:00.000Z", driver: "MARY" }),
        makeTrip({ id: 3, tripStart: "2026-10-05T20:00:00.000Z", driver: null }),
      ],
    });

    expect(
      groups.map((group) => [group.driver, group.trips.map((trip) => trip.tripStart.slice(11, 16))]),
    ).toEqual([
      [null, ["20:00"]],
      ["JOHN", ["07:00"]],
      ["MARY", ["15:00"]],
    ]);
  });

  it("returns an empty string when there are no trips", () => {
    expect(
      formatTollGroupsForCopy({
        groups: [{ day: "2026-10-05", registration: "CTJ450", driver: null, trips: [] }],
      }),
    ).toBe("");
  });
});
