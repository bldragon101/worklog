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

const TAG = "221101895540";

interface SavedTrip {
  id: number;
  fingerprint: string;
  tagNumber: string;
  lpn: string | null;
  registration: string | null;
  tripStart: Date;
}

interface TripQuery {
  where: {
    lpn?: null | { not: null };
    tripStart?: { gte: Date; lte: Date };
    OR?: ({ registration: null } | { fingerprint: { in: string[] } })[];
  };
  distinct?: string[];
}

/**
 * Answer the importer's trip queries from a list of saved trips, applying
 * the same filters the database would.
 */
function mockSavedTrips({ saved }: { saved: SavedTrip[] }) {
  tx.tollTrip.findMany.mockImplementation(async ({ where, distinct }: TripQuery) => {
    if (where.lpn === null) {
      const fingerprints = where.OR?.flatMap((condition) =>
        "fingerprint" in condition ? condition.fingerprint.in : [],
      );
      return saved.filter(
        (trip) =>
          trip.lpn === null &&
          (trip.registration === null || fingerprints?.includes(trip.fingerprint)),
      );
    }

    const withPlates = saved.filter((trip) => trip.lpn !== null);
    if (distinct) {
      const latest = [...withPlates].sort((a, b) => b.tripStart.getTime() - a.tripStart.getTime());
      return latest.slice(0, 1);
    }
    return withPlates.filter(
      (trip) =>
        !where.tripStart ||
        (trip.tripStart >= where.tripStart.gte && trip.tripStart <= where.tripStart.lte),
    );
  });
}

function makeTrip({ ...overrides }: Partial<ParsedTollTrip>): ParsedTollTrip {
  return {
    fingerprint: `fp-${Math.random()}`,
    tripStart: new Date("2026-09-01T08:00:00.000Z"),
    tripEnd: null,
    tripDetails: "Punt Rd to Monash Fwy/Toorak Rd",
    lpn: null,
    tagNumber: TAG,
    vehicleClass: "HCV",
    amount: "20.44",
    ...overrides,
  };
}

function savedRegistrations(): (string | null)[] {
  const data = tx.tollTrip.createMany.mock.calls[0][0].data as { registration: string | null }[];
  return data.map((trip) => trip.registration);
}

describe("importTollTrips tag mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.tollTag.findMany.mockResolvedValue([{ tagNumber: TAG, registration: "NEWREG" }]);
    tx.tollImport.create.mockResolvedValue({ id: 7 });
    tx.tollTrip.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({
      count: data.length,
    }));
    mockSavedTrips({ saved: [] });
  });

  it("does not move a tag back to its old vehicle when an older export is uploaded", async () => {
    mockSavedTrips({
      saved: [
        {
          id: 1,
          fingerprint: "saved-new",
          tagNumber: TAG,
          lpn: "NEWREG",
          registration: "NEWREG",
          tripStart: new Date("2026-09-20T08:00:00.000Z"),
        },
      ],
    });

    await importTollTrips({
      source: "upload",
      trips: [
        makeTrip({ lpn: "OLDREG", tripStart: new Date("2026-09-01T08:00:00.000Z") }),
        makeTrip({ lpn: null, tripStart: new Date("2026-09-01T09:00:00.000Z") }),
      ],
    });

    expect(tx.tollTag.upsert).not.toHaveBeenCalled();
    expect(tx.tollTrip.updateMany).not.toHaveBeenCalled();
    expect(savedRegistrations()).toEqual(["OLDREG", "OLDREG"]);
  });

  it("updates the mapping from a newer export and fills earlier unregistered trips", async () => {
    mockSavedTrips({
      saved: [
        {
          id: 1,
          fingerprint: "saved-plate",
          tagNumber: TAG,
          lpn: "OLDREG",
          registration: "OLDREG",
          tripStart: new Date("2026-09-20T08:00:00.000Z"),
        },
        {
          id: 9,
          fingerprint: "saved-unregistered",
          tagNumber: TAG,
          lpn: null,
          registration: null,
          tripStart: new Date("2026-09-26T08:00:00.000Z"),
        },
      ],
    });

    await importTollTrips({
      source: "upload",
      trips: [makeTrip({ lpn: "NEWREG", tripStart: new Date("2026-09-25T08:00:00.000Z") })],
    });

    expect(tx.tollTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tagNumber: TAG },
        update: { registration: "NEWREG", source: "linkt" },
      }),
    );
    expect(tx.tollTrip.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [9] } },
      data: { registration: "NEWREG" },
    });
  });

  it("uses the saved mapping for a tag with no sightings at all", async () => {
    await importTollTrips({ source: "upload", trips: [makeTrip({ lpn: null })] });

    expect(savedRegistrations()).toEqual(["NEWREG"]);
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

    expect(savedRegistrations()).toEqual(["AAA111", "AAA111", "AAA111", "BBB222", "BBB222"]);
    expect(tx.tollTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { registration: "BBB222", source: "linkt" } }),
    );
  });

  it("repairs this export's saved tag-only trip when it has the wrong plate", async () => {
    mockSavedTrips({
      saved: [
        {
          id: 21,
          fingerprint: "fp-tag-only",
          tagNumber: TAG,
          lpn: null,
          registration: "BBB222",
          tripStart: new Date("2026-09-02T08:00:00.000Z"),
        },
      ],
    });

    await importTollTrips({
      source: "upload",
      trips: [
        makeTrip({ lpn: "AAA111", tripStart: new Date("2026-09-01T08:00:00.000Z") }),
        makeTrip({
          fingerprint: "fp-tag-only",
          lpn: null,
          tripStart: new Date("2026-09-02T08:00:00.000Z"),
        }),
        makeTrip({ lpn: "BBB222", tripStart: new Date("2026-09-10T08:00:00.000Z") }),
      ],
    });

    const tagOnlyQuery = tx.tollTrip.findMany.mock.calls
      .map(([query]) => query as TripQuery)
      .find((query) => query.where.lpn === null);
    expect(tagOnlyQuery?.where.OR).toContainEqual({ fingerprint: { in: ["fp-tag-only"] } });
    expect(tx.tollTrip.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.tollTrip.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [21] } },
      data: { registration: "AAA111" },
    });
  });

  it("keeps a plate set from a wider export when a shorter one lacks the earlier sighting", async () => {
    mockSavedTrips({
      saved: [
        {
          id: 30,
          fingerprint: "wide-plate-a",
          tagNumber: TAG,
          lpn: "AAA111",
          registration: "AAA111",
          tripStart: new Date("2026-09-01T08:00:00.000Z"),
        },
        {
          id: 31,
          fingerprint: "fp-tag-only",
          tagNumber: TAG,
          lpn: null,
          registration: "AAA111",
          tripStart: new Date("2026-09-02T08:00:00.000Z"),
        },
        {
          id: 32,
          fingerprint: "wide-plate-b",
          tagNumber: TAG,
          lpn: "BBB222",
          registration: "BBB222",
          tripStart: new Date("2026-09-10T08:00:00.000Z"),
        },
      ],
    });

    await importTollTrips({
      source: "upload",
      trips: [
        makeTrip({
          fingerprint: "fp-tag-only",
          lpn: null,
          tripStart: new Date("2026-09-02T08:00:00.000Z"),
        }),
        makeTrip({
          fingerprint: "wide-plate-b",
          lpn: "BBB222",
          tripStart: new Date("2026-09-10T08:00:00.000Z"),
        }),
      ],
    });

    expect(tx.tollTrip.updateMany).not.toHaveBeenCalled();
    expect(savedRegistrations()[0]).toBe("AAA111");
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
