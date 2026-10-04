/**
 * @vitest-environment node
 */
import { importTollTrips } from "@/lib/tolls/import-toll-trips";
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
  });

  it("does not move a tag back to its old vehicle when an older export is uploaded", async () => {
    tx.tollTrip.findMany.mockResolvedValue([
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
    tx.tollTrip.findMany.mockResolvedValue([
      { tagNumber: "221101895540", tripStart: new Date("2026-09-20T08:00:00.000Z") },
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
      where: { tagNumber: "221101895540", lpn: null, registration: null },
      data: { registration: "NEWREG" },
    });
  });

  it("uses the saved mapping for a tag not seen with a plate in the export", async () => {
    tx.tollTrip.findMany.mockResolvedValue([]);

    await importTollTrips({ source: "upload", trips: [makeTrip({ lpn: null })] });

    const saved = tx.tollTrip.createMany.mock.calls[0][0].data as { registration: string }[];
    expect(saved[0].registration).toBe("NEWREG");
  });
});
