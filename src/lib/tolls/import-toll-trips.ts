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

interface TagSighting {
  seenAt: number;
  registration: string;
}

/**
 * Every plate each tag was seen with in this export, oldest first. Linkt
 * leaves the plate blank when only the tag was read, so these sightings
 * supply the vehicle for tag-only trips.
 */
function collectTagSightings({
  trips,
}: {
  trips: ParsedTollTrip[];
}): Map<string, TagSighting[]> {
  const sightingsByTag = new Map<string, TagSighting[]>();
  for (const trip of trips) {
    if (!trip.tagNumber || !trip.lpn) continue;
    const sightings = sightingsByTag.get(trip.tagNumber) ?? [];
    sightings.push({ seenAt: trip.tripStart.getTime(), registration: trip.lpn });
    sightingsByTag.set(trip.tagNumber, sightings);
  }
  for (const sightings of sightingsByTag.values()) {
    sightings.sort((a, b) => a.seenAt - b.seenAt);
  }
  return sightingsByTag;
}

/**
 * The plate a tag was on at a given time: its latest sighting at or before
 * that time, or its earliest sighting when the time comes before them all.
 * A tag that moves vehicles within an export keeps the right plate for trips
 * on either side of the move.
 */
export function plateAtTime({
  sightings,
  time,
}: {
  sightings: TagSighting[] | undefined;
  time: number;
}): string | null {
  if (!sightings || sightings.length === 0) return null;
  const earlier = sightings.filter((sighting) => sighting.seenAt <= time);
  return (earlier.at(-1) ?? sightings[0]).registration;
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
 * Save parsed Linkt trips, skipping any already imported, and record the
 * import.
 *
 * A tag-only trip takes the plate its tag was on at the trip's time, from the
 * sightings in the same export, and otherwise the saved tag mapping. The same
 * rule corrects this export's tag-only trips that were already saved and
 * fills in earlier tag-only trips that had no registration, so re-uploading
 * an export repairs its trips. A saved mapping only changes when the export
 * has a sighting at least as recent as the latest one already imported, so
 * uploading an older export after a tag moved vehicles does not move it back.
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
  const sightingsByTag = collectTagSightings({ trips });
  const latestPlates = [...sightingsByTag].map(
    ([tagNumber, sightings]) => [tagNumber, sightings[sightings.length - 1]] as const,
  );
  const startTimes = trips.map((trip) => trip.tripStart.getTime());
  const periodFrom = startTimes.length > 0 ? new Date(Math.min(...startTimes)) : null;
  const periodTo = startTimes.length > 0 ? new Date(Math.max(...startTimes)) : null;

  return prisma.$transaction(
    async (tx) => {
      const latestSightings = await tx.tollTrip.findMany({
        where: { tagNumber: { in: [...sightingsByTag.keys()] }, lpn: { not: null } },
        orderBy: [{ tagNumber: "asc" }, { tripStart: "desc" }],
        distinct: ["tagNumber"],
        select: { tagNumber: true, tripStart: true },
      });
      const latestSightingByTag = new Map(
        latestSightings.map((sighting) => [sighting.tagNumber, sighting.tripStart.getTime()]),
      );
      const newerMappings = latestPlates.filter(
        ([tagNumber, { seenAt }]) =>
          seenAt >= (latestSightingByTag.get(tagNumber) ?? Number.NEGATIVE_INFINITY),
      );

      await runInSequence({
        items: newerMappings,
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
            (trip.tagNumber
              ? (plateAtTime({
                  sightings: sightingsByTag.get(trip.tagNumber),
                  time: trip.tripStart.getTime(),
                }) ?? registrationByTag.get(trip.tagNumber))
              : null) ??
            null,
          vehicleClass: trip.vehicleClass,
          amount: trip.amount,
          importId: tollImport.id,
        })),
        skipDuplicates: true,
      });

      const exportTagOnlyFingerprints = trips.flatMap((trip) =>
        !trip.lpn && trip.tagNumber && sightingsByTag.has(trip.tagNumber)
          ? [trip.fingerprint]
          : [],
      );
      const tagOnlyTrips = await tx.tollTrip.findMany({
        where: {
          tagNumber: { in: [...sightingsByTag.keys()] },
          lpn: null,
          OR: [
            { registration: null },
            { fingerprint: { in: exportTagOnlyFingerprints } },
          ],
        },
        select: { id: true, tagNumber: true, tripStart: true, registration: true },
      });
      const tripIdsByPlate = new Map<string, number[]>();
      for (const trip of tagOnlyTrips) {
        const plate = plateAtTime({
          sightings: trip.tagNumber ? sightingsByTag.get(trip.tagNumber) : undefined,
          time: trip.tripStart.getTime(),
        });
        if (plate && plate !== trip.registration) {
          tripIdsByPlate.set(plate, [...(tripIdsByPlate.get(plate) ?? []), trip.id]);
        }
      }
      await runInSequence({
        items: [...tripIdsByPlate],
        run: ([registration, ids]) =>
          tx.tollTrip.updateMany({ where: { id: { in: ids } }, data: { registration } }),
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
        learnedTags: sightingsByTag.size,
        periodFrom: periodFrom?.toISOString() ?? null,
        periodTo: periodTo?.toISOString() ?? null,
      };
    },
    { timeout: 60_000, maxWait: 15_000 },
  );
}
