/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/tolls/jobs/[id]/route";
import { prisma } from "@/lib/prisma";
import type { JobTollsResponse } from "@/lib/tolls/toll-types";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tollTrip: { findMany: vi.fn() },
    jobs: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user-123" }),
  requireAuthWithPermission: vi.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: new Headers({ "X-RateLimit-Limit": "100" }),
  }),
  rateLimitConfigs: { general: {} },
}));

const mocked = vi.mocked(prisma, { deep: true });

function makeJob({
  id,
  registration = "CTJ450",
  startTime,
  finishTime,
  citylink = 1,
}: {
  id: number;
  registration?: string;
  startTime: string;
  finishTime: string;
  citylink?: number;
}) {
  return {
    id,
    date: new Date(`${startTime.slice(0, 10)}T00:00:00.000Z`),
    driver: "JOHN",
    customer: "Acme",
    registration,
    startTime: new Date(startTime),
    finishTime: new Date(finishTime),
    citylink,
    eastlink: null,
  };
}

function makeTrip({
  id,
  tripStart,
  registration = "CTJ450",
  tripDetails = "Tullamarine Fwy to Monash Fwy",
}: {
  id: number;
  tripStart: string;
  registration?: string;
  tripDetails?: string;
}) {
  return {
    id,
    tripStart: new Date(tripStart),
    tripEnd: null,
    tripDetails,
    lpn: registration,
    tagNumber: null,
    registration,
    vehicleClass: "HCV",
    amount: 12.5,
  };
}

async function getJobTolls({ id }: { id: string }) {
  return GET(new NextRequest(`http://localhost/api/tolls/jobs/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/tolls/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the trips matched to the job, not a later job's trips", async () => {
    const job = makeJob({
      id: 50,
      startTime: "2026-10-05T06:00:00.000Z",
      finishTime: "2026-10-05T10:00:00.000Z",
    });
    mocked.jobs.findUnique.mockResolvedValue(job as never);
    mocked.jobs.findMany.mockResolvedValue([
      job,
      makeJob({
        id: 51,
        startTime: "2026-10-05T14:00:00.000Z",
        finishTime: "2026-10-05T18:00:00.000Z",
      }),
      makeJob({
        id: 52,
        registration: "XYZ123",
        startTime: "2026-10-05T06:00:00.000Z",
        finishTime: "2026-10-05T10:00:00.000Z",
      }),
    ] as never);
    mocked.tollTrip.findMany.mockResolvedValue([
      makeTrip({ id: 1, tripStart: "2026-10-05T07:00:00.000Z" }),
      makeTrip({ id: 2, tripStart: "2026-10-05T15:00:00.000Z" }),
      makeTrip({ id: 3, tripStart: "2026-10-05T07:30:00.000Z", registration: "XYZ123" }),
      makeTrip({
        id: 4,
        tripStart: "2026-10-05T08:00:00.000Z",
        registration: "ctj 450",
        tripDetails: "EL Mitcham Rd to Ringwood Bypass",
      }),
    ] as never);

    const response = await getJobTolls({ id: "50" });
    const body = (await response.json()) as JobTollsResponse;

    expect(response.status).toBe(200);
    expect(body.trips.map((trip) => trip.id)).toEqual([1, 4]);
    expect(body).toMatchObject({
      jobId: 50,
      jobDay: "2026-10-05",
      registration: "CTJ450",
      recordedCitylink: 1,
      actualCitylink: 1,
      actualEastlink: 1,
      tollCost: 25,
      isMismatch: true,
    });
    expect(body.trips[1]).toMatchObject({ road: "eastlink", amount: 12.5 });
  });

  it("returns 404 when the job does not exist", async () => {
    mocked.jobs.findUnique.mockResolvedValue(null);

    const response = await getJobTolls({ id: "999" });

    expect(response.status).toBe(404);
    expect(mocked.tollTrip.findMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid job ID", async () => {
    const response = await getJobTolls({ id: "abc" });

    expect(response.status).toBe(400);
  });
});
