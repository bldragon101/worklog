/**
 * @vitest-environment node
 */
import { importTollTrips, plateAtTime } from "@/lib/tolls/import-toll-trips";
import type { ParsedTollTrip } from "@/lib/tolls/linkt-csv";

const tx = vi.hoisted(() => ({
  tollTag: { upsert: vi.fn(), findMany: vi.fn() },
  tollTrip: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  tollImport: { create: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)),
  },
}));

function makeTrip({ ...overrides }: Partial<ParsedTollTrip>): ParsedTollTrip {
  return {
    fingerprint: `fp-${Math.random()}`,
    tripStart: new Date("2026-09-01T08:00:00.000Z"),
    tripEnd: null,
    tripDetails: "Punt Rd to Monash Fwy/Toorak Rd",
    lpn: null,
    tagNumber: "221101895540",
    vehicleClass: "HCV",
    amount: "20.44",
    ...overrides,
  };
}

describe("importTollTrips tag mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.tollTag.findMany.mockResolvedValue([
      { tagNumber: "221101895540", registration: "NEWREG" },
    ]);
    tx.tollImport.create.mockResolvedValue({ id: 7 });
    tx.tollTrip.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({
      count: data.length,
    }));
    tx.tollTrip.findMany.mockResolvedValue([]);
  });

  it("does not move a tag back to its old vehicle when an older export is uploaded", async () => {
    tx.tollTrip.findMany.mockResolvedValueOnce([
      { tagNumber: "221101895540", tripStart: new Date("2026-09-20T08:00:00.000Z") },
    ]);

    await importTollTrips({
      source: "upload",
      trips: [
        makeTrip({ lpn: "OLDREG", tripStart: new Date("2026-09-01T08:00:00.000Z") }),
        makeTrip({ lpn: null, tripStart: new Date("2026-09-01T09:00:00.000Z") }),
      ],
    });

    expect(tx.tollTag.upsert).not.toHaveBeenCalled();
    expect(tx.tollTrip.updateMany).not.toHaveBeenCalled();
    const saved = tx.tollTrip.createMany.mock.calls[0][0].data as { registration: string }[];
    expect(saved.map((trip) => trip.registration)).toEqual(["OLDREG", "OLDREG"]);
  });

  it("updates the mapping from a newer export", async () => {
    tx.tollTrip.findMany
      .mockResolvedValueOnce([
        { tagNumber: "221101895540", tripStart: new Date("2026-09-20T08:00:00.000Z") },
      ])
      .mockResolvedValueOnce([
        {
          id: 9,
          tagNumber: "221101895540",
          tripStart: new Date("2026-09-26T08:00:00.000Z"),
          registration: null,
        },
      ]);

    await importTollTrips({
      source: "upload",
      trips: [makeTrip({ lpn: "NEWREG", tripStart: new Date("2026-09-25T08:00:00.000Z") })],
    });

    expect(tx.tollTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tagNumber: "221101895540" },
        update: { registration: "NEWREG", source: "linkt" },
      }),
    );
    expect(tx.tollTrip.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [9] } },
      data: { registration: "NEWREG" },
    });
  });

  it("uses the saved mapping for a tag not seen with a plate in the export", async () => {
    await importTollTrips({ source: "upload", trips: [makeTrip({ lpn: null })] });

    const saved = tx.tollTrip.createMany.mock.calls[0][0].data as { registration: string }[];
    expect(saved[0].registration).toBe("NEWREG");
  });

  it("gives tag-only trips the plate the tag was on at the time when it moves vehicles", async () => {
    await importTollTrips({
      source: "upload",
      trips: [
        makeTrip({ lpn: null, tripStart: new Date("2026-08-31T08:00:00.000Z") }),
        makeTrip({ lpn: "AAA111", tripStart: new Date("2026-09-01T08:00:00.000Z") }),
        makeTrip({ lpn: null, tripStart: new Date("2026-09-02T08:00:00.000Z") }),
        makeTrip({ lpn: "BBB222", tripStart: new Date("2026-09-10T08:00:00.000Z") }),
        makeTrip({ lpn: null, tripStart: new Date("2026-09-12T08:00:00.000Z") }),
      ],
    });

    const saved = tx.tollTrip.createMany.mock.calls[0][0].data as { registration: string }[];
    expect(saved.map((trip) => trip.registration)).toEqual([
      "AAA111",
      "AAA111",
      "AAA111",
      "BBB222",
      "BBB222",
    ]);
    expect(tx.tollTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { registration: "BBB222", source: "linkt" } }),
    );
  });

  it("repairs a saved tag-only trip from this export when it has the wrong plate", async () => {
    tx.tollTrip.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 21,
        tagNumber: "221101895540",
        tripStart: new Date("2026-09-02T08:00:00.000Z"),
        registration: "BBB222",
      },
      {
        id: 22,
        tagNumber: "221101895540",
        tripStart: new Date("2026-09-12T08:00:00.000Z"),
        registration: "BBB222",
      },
    ]);

    await importTollTrips({
      source: "upload",
      trips: [
        makeTrip({ lpn: "AAA111", tripStart: new Date("2026-09-01T08:00:00.000Z") }),
        makeTrip({ lpn: "BBB222", tripStart: new Date("2026-09-10T08:00:00.000Z") }),
      ],
    });

    expect(tx.tollTrip.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.tollTrip.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [21] } },
      data: { registration: "AAA111" },
    });
  });
});

describe("plateAtTime", () => {
  const sightings = [
    { seenAt: Date.parse("2026-09-01T08:00:00.000Z"), registration: "AAA111" },
    { seenAt: Date.parse("2026-09-10T08:00:00.000Z"), registration: "BBB222" },
  ];

  it("uses the latest sighting at or before the time", () => {
    expect(plateAtTime({ sightings, time: Date.parse("2026-09-05T08:00:00.000Z") })).toBe("AAA111");
    expect(plateAtTime({ sightings, time: Date.parse("2026-09-10T08:00:00.000Z") })).toBe("BBB222");
  });

  it("uses the earliest sighting for a time before them all, and null without sightings", () => {
    expect(plateAtTime({ sightings, time: Date.parse("2026-08-01T08:00:00.000Z") })).toBe("AAA111");
    expect(plateAtTime({ sightings: undefined, time: 0 })).toBeNull();
  });
});
