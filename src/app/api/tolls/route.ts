import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api-route";
import {
  getJobDay,
  getTollRoad,
  matchTollTripsToJobs,
} from "@/lib/tolls/toll-matching";
import { importNewTollFilesFromDrive } from "@/lib/tolls/drive-import";
import type {
  TollDriveSyncInfo,
  TollJobRow,
  TollsResponse,
  TollTripRow,
} from "@/lib/tolls/toll-types";

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Dates must be YYYY-MM-DD" });

const querySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine(({ from, to }) => from <= to, {
    error: "The from date must be on or before the to date",
  });

/**
 * Import new Linkt files from Google Drive when the last check was over an
 * hour ago. A Drive problem is reported, not thrown, so the page still loads.
 */
async function importFromDriveIfDue({
  userId,
}: {
  userId: string;
}): Promise<TollDriveSyncInfo> {
  try {
    const result = await importNewTollFilesFromDrive({ force: false, createdBy: userId });
    return { configured: result.status !== "not-configured", error: null };
  } catch (error) {
    console.error(
      "Error importing Linkt files from Google Drive:",
      error instanceof Error ? error.message : error,
    );
    return {
      configured: true,
      error: "Could not read the Linkt folder in Google Drive",
    };
  }
}

export const GET = apiRoute({
  auth: { permission: "manage_tolls" },
  errorMessage: "Error fetching tolls",
  responseMessage: "Failed to fetch tolls",
  validationMessage: "Invalid date range",
  handler: async ({ request, userId }) => {
    const { searchParams } = request.nextUrl;
    const { from, to } = querySchema.parse({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    const driveSync = await importFromDriveIfDue({ userId });

    const rangeStart = new Date(`${from}T00:00:00.000Z`);
    const rangeEnd = new Date(Date.parse(`${to}T00:00:00.000Z`) + DAY_MS);

    const [trips, candidateJobs, unknownTagGroups, lastImport, earliestTrip] =
      await Promise.all([
        prisma.tollTrip.findMany({
          where: { tripStart: { gte: rangeStart, lt: rangeEnd } },
          orderBy: { tripStart: "desc" },
        }),
        // Job dates may be saved as Melbourne midnight, the previous day in UTC
        prisma.jobs.findMany({
          where: {
            date: {
              gte: new Date(rangeStart.getTime() - DAY_MS),
              lt: new Date(rangeEnd.getTime() + DAY_MS),
            },
          },
          select: {
            id: true,
            date: true,
            driver: true,
            customer: true,
            registration: true,
            truckType: true,
            startTime: true,
            finishTime: true,
            citylink: true,
            eastlink: true,
          },
        }),
        prisma.tollTrip.groupBy({
          by: ["tagNumber"],
          where: { registration: null, tagNumber: { not: null } },
          _count: { _all: true },
          _sum: { amount: true },
          _max: { tripStart: true },
        }),
        prisma.tollImport.findFirst({ orderBy: { createdAt: "desc" } }),
        prisma.tollTrip.findFirst({
          orderBy: { tripStart: "asc" },
          select: { tripStart: true },
        }),
      ]);

    const jobs = candidateJobs
      .map((job) => ({
        ...job,
        date: job.date.toISOString(),
        startTime: job.startTime?.toISOString() ?? null,
        finishTime: job.finishTime?.toISOString() ?? null,
      }))
      .filter((job) => {
        const day = getJobDay({ job });
        return day >= from && day <= to;
      });
    const jobsById = new Map(jobs.map((job) => [job.id, job]));

    const { matches, reconciliation } = matchTollTripsToJobs({
      trips: trips.map((trip) => ({
        id: trip.id,
        registration: trip.registration,
        tripStart: trip.tripStart.toISOString(),
        tripDetails: trip.tripDetails,
        amount: Number(trip.amount),
      })),
      jobs,
    });
    const matchByTripId = new Map(matches.map((match) => [match.tripId, match]));

    const tripRows: TollTripRow[] = trips.map((trip) => {
      const match = matchByTripId.get(trip.id);
      const job = match?.jobId ? jobsById.get(match.jobId) : undefined;
      return {
        id: trip.id,
        tripStart: trip.tripStart.toISOString(),
        tripEnd: trip.tripEnd?.toISOString() ?? null,
        tripDetails: trip.tripDetails,
        road: getTollRoad({ tripDetails: trip.tripDetails }),
        lpn: trip.lpn,
        tagNumber: trip.tagNumber,
        registration: trip.registration,
        vehicleClass: trip.vehicleClass,
        amount: Number(trip.amount),
        matchStatus: match?.status ?? "unknown-vehicle",
        job: job
          ? {
              id: job.id,
              driver: job.driver,
              customer: job.customer,
              startTime: job.startTime,
              finishTime: job.finishTime,
            }
          : null,
      };
    });

    const jobRows: TollJobRow[] = reconciliation.flatMap((row) => {
      const job = jobsById.get(row.jobId);
      if (!job) return [];
      return [
        {
          ...row,
          driver: job.driver,
          customer: job.customer,
          registration: job.registration,
          truckType: job.truckType,
        },
      ];
    });

    const body: TollsResponse = {
      trips: tripRows,
      jobs: jobRows.sort((a, b) => b.jobDay.localeCompare(a.jobDay)),
      unknownTags: unknownTagGroups
        .flatMap((group) =>
          group.tagNumber
            ? [
                {
                  tagNumber: group.tagNumber,
                  tripCount: group._count._all,
                  amount: Number(group._sum.amount ?? 0),
                  lastSeen: group._max.tripStart?.toISOString() ?? "",
                },
              ]
            : [],
        )
        .sort((a, b) => b.tripCount - a.tripCount),
      lastImport: lastImport
        ? {
            id: lastImport.id,
            source: lastImport.source,
            fileName: lastImport.fileName,
            periodFrom: lastImport.periodFrom?.toISOString() ?? null,
            periodTo: lastImport.periodTo?.toISOString() ?? null,
            totalRows: lastImport.totalRows,
            inserted: lastImport.inserted,
            duplicates: lastImport.duplicates,
            createdAt: lastImport.createdAt.toISOString(),
          }
        : null,
      earliestTripDate: earliestTrip?.tripStart.toISOString() ?? null,
      driveSync,
    };

    return NextResponse.json(body);
  },
});
