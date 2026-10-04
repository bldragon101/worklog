import { prisma } from "@/lib/prisma";
import type { ParsedTollTrip } from "@/lib/tolls/linkt-csv";

export type TollImportSource = "upload" | "drive";

export interface TollImportSummary {
  importId: number;
  totalRows: number;
  inserted: number;
  duplicates: number;
  learnedTags: number;
  periodFrom: string | null;
  periodTo: string | null;
}

/**
 * Tags seen with a plate in this export, mapped to the plate on their most
 * recent trip. Linkt leaves the plate blank when the tag was read, so these
 * mappings fill in the vehicle for tag-only trips.
 */
function learnTagRegistrations({ trips }: { trips: ParsedTollTrip[] }) {
  const learned = new Map<string, { registration: string; seenAt: number }>();
  for (const trip of trips) {
    if (!trip.tagNumber || !trip.lpn) continue;
    const seenAt = trip.tripStart.getTime();
    const existing = learned.get(trip.tagNumber);
    if (!existing || seenAt > existing.seenAt) {
      learned.set(trip.tagNumber, { registration: trip.lpn, seenAt });
    }
  }
  return learned;
}

/**
 * Run a query per item, one after another. An interactive transaction has a
 * single connection, and a failed query aborts the rest cleanly this way.
 */
function runInSequence<T>({
  items,
  run,
}: {
  items: T[];
  run: (item: T) => Promise<unknown>;
}): Promise<unknown> {
  return items.reduce<Promise<unknown>>(
    (previous, item) => previous.then(() => run(item)),
    Promise.resolve(),
  );
}

/**
 * Save parsed Linkt trips, skipping any already imported. Records the import,
 * learns tag-to-registration mappings and fills in the registration of
 * earlier tag-only trips that had none.
 */
export async function importTollTrips({
  trips,
  source,
  fileName,
  createdBy,
  driveFileId,
}: {
  trips: ParsedTollTrip[];
  source: TollImportSource;
  fileName?: string | null;
  createdBy?: string | null;
  /** The Drive file the trips came from, so it is only imported once */
  driveFileId?: string | null;
}): Promise<TollImportSummary> {
  const learned = learnTagRegistrations({ trips });
  const startTimes = trips.map((trip) => trip.tripStart.getTime());
  const periodFrom = startTimes.length > 0 ? new Date(Math.min(...startTimes)) : null;
  const periodTo = startTimes.length > 0 ? new Date(Math.max(...startTimes)) : null;

  return prisma.$transaction(
    async (tx) => {
      await runInSequence({
        items: [...learned],
        run: ([tagNumber, { registration }]) =>
          tx.tollTag.upsert({
            where: { tagNumber },
            create: { tagNumber, registration, source: "linkt" },
            update: { registration, source: "linkt" },
          }),
      });

      const tagNumbers = [
        ...new Set(trips.flatMap((trip) => (trip.tagNumber ? [trip.tagNumber] : []))),
      ];
      const knownTags = await tx.tollTag.findMany({
        where: { tagNumber: { in: tagNumbers } },
        select: { tagNumber: true, registration: true },
      });
      const registrationByTag = new Map(
        knownTags.map((tag) => [tag.tagNumber, tag.registration]),
      );

      const tollImport = await tx.tollImport.create({
        data: {
          source,
          fileName: fileName ?? null,
          periodFrom,
          periodTo,
          totalRows: trips.length,
          inserted: 0,
          duplicates: 0,
          createdBy: createdBy ?? null,
          driveFileId: driveFileId ?? null,
        },
      });

      const { count: inserted } = await tx.tollTrip.createMany({
        data: trips.map((trip) => ({
          fingerprint: trip.fingerprint,
          tripStart: trip.tripStart,
          tripEnd: trip.tripEnd,
          tripDetails: trip.tripDetails,
          lpn: trip.lpn,
          tagNumber: trip.tagNumber,
          registration:
            trip.lpn ??
            (trip.tagNumber ? registrationByTag.get(trip.tagNumber) : null) ??
            null,
          vehicleClass: trip.vehicleClass,
          amount: trip.amount,
          importId: tollImport.id,
        })),
        skipDuplicates: true,
      });

      await runInSequence({
        items: [...learned],
        run: ([tagNumber, { registration }]) =>
          tx.tollTrip.updateMany({
            where: { tagNumber, lpn: null, registration: null },
            data: { registration },
          }),
      });

      const duplicates = trips.length - inserted;
      await tx.tollImport.update({
        where: { id: tollImport.id },
        data: { inserted, duplicates },
      });

      return {
        importId: tollImport.id,
        totalRows: trips.length,
        inserted,
        duplicates,
        learnedTags: learned.size,
        periodFrom: periodFrom?.toISOString() ?? null,
        periodTo: periodTo?.toISOString() ?? null,
      };
    },
    { timeout: 60_000, maxWait: 15_000 },
  );
}
