/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/tolls/route";
import { prisma } from "@/lib/prisma";
import type { TollsResponse } from "@/lib/tolls/toll-types";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tollTrip: { findMany: vi.fn(), findFirst: vi.fn(), groupBy: vi.fn() },
    jobs: { findMany: vi.fn() },
    tollImport: { findFirst: vi.fn() },
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

vi.mock("@/lib/tolls/drive-import", () => ({
  isLinktDriveFolderConfigured: vi.fn().mockResolvedValue(false),
}));

const mocked = vi.mocked(prisma, { deep: true });

function makeTrip({ id, tripStart }: { id: number; tripStart: string }) {
  return {
    id,
    tripStart: new Date(tripStart),
    tripEnd: null,
    tripDetails: "Tullamarine Fwy to Monash Fwy/Toorak Rd",
    lpn: "CTJ450",
    tagNumber: null,
    registration: "CTJ450",
    vehicleClass: "HCV",
    amount: 38.32,
  };
}

describe("GET /api/tolls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.tollTrip.findMany.mockResolvedValue([
      makeTrip({ id: 2, tripStart: "2026-11-01T02:00:00.000Z" }),
      makeTrip({ id: 1, tripStart: "2026-10-31T23:00:00.000Z" }),
    ] as never);
    mocked.tollTrip.findFirst.mockResolvedValue(null);
    mocked.tollTrip.groupBy.mockResolvedValue([] as never);
    mocked.tollImport.findFirst.mockResolvedValue(null);
    mocked.jobs.findMany.mockResolvedValue([
      {
        id: 50,
        date: new Date("2026-10-31T00:00:00.000Z"),
        driver: "JOHN",
        customer: "Acme",
        registration: "CTJ450",
        truckType: "Semi",
        startTime: new Date("2026-10-31T22:00:00.000Z"),
        finishTime: new Date("2026-10-31T06:00:00.000Z"),
        citylink: 2,
        eastlink: null,
      },
    ] as never);
  });

  it("counts the morning trips of an overnight job on the last day without listing them", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/tolls?from=2026-10-01&to=2026-10-31"),
      { params: Promise.resolve({}) },
    );
    const body = (await response.json()) as TollsResponse;

    expect(mocked.tollTrip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tripStart: {
            gte: new Date("2026-10-01T00:00:00.000Z"),
            lt: new Date("2026-11-02T00:00:00.000Z"),
          },
        },
      }),
    );
    expect(body.trips.map((trip) => trip.id)).toEqual([1]);
    expect(body.trips[0]).toMatchObject({ matchStatus: "matched", job: { id: 50 } });
    expect(body.jobs).toEqual([
      expect.objectContaining({
        jobId: 50,
        recordedCitylink: 2,
        actualCitylink: 2,
        tollCost: 76.64,
        isMismatch: false,
      }),
    ]);
    expect(body.jobs[0].trips.map((trip) => trip.id)).toEqual([1, 2]);
  });

  it("lets a next-day job win a morning trip without listing that job", async () => {
    mocked.tollTrip.findMany.mockResolvedValue([
      makeTrip({ id: 3, tripStart: "2026-11-01T06:30:00.000Z" }),
      makeTrip({ id: 1, tripStart: "2026-10-31T23:00:00.000Z" }),
    ] as never);
    mocked.jobs.findMany.mockResolvedValue([
      {
        id: 50,
        date: new Date("2026-10-31T00:00:00.000Z"),
        driver: "JOHN",
        customer: "Acme",
        registration: "CTJ450",
        truckType: "Semi",
        startTime: new Date("2026-10-31T22:00:00.000Z"),
        finishTime: new Date("2026-10-31T06:00:00.000Z"),
        citylink: 1,
        eastlink: null,
      },
      {
        id: 51,
        date: new Date("2026-11-01T00:00:00.000Z"),
        driver: "JOHN",
        customer: "Beta",
        registration: "CTJ450",
        truckType: "Semi",
        startTime: new Date("2026-11-01T06:00:00.000Z"),
        finishTime: new Date("2026-11-01T14:00:00.000Z"),
        citylink: 1,
        eastlink: null,
      },
    ] as never);

    const response = await GET(
      new NextRequest("http://localhost/api/tolls?from=2026-10-01&to=2026-10-31"),
      { params: Promise.resolve({}) },
    );
    const body = (await response.json()) as TollsResponse;

    expect(mocked.jobs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date: {
            gte: new Date("2026-09-29T00:00:00.000Z"),
            lt: new Date("2026-11-03T00:00:00.000Z"),
          },
        },
      }),
    );
    expect(body.jobs.map((job) => job.jobId)).toEqual([50]);
    expect(body.jobs[0]).toMatchObject({ actualCitylink: 1, isMismatch: false });
  });
});
