import { NextRequest } from "next/server";
import { POST as addLines } from "@/app/api/rcti/[id]/lines/route";

const mocks = vi.hoisted(() => ({
  rctiFindUnique: vi.fn(),
  rctiUpdate: vi.fn(),
  jobsFindMany: vi.fn(),
  lineCreate: vi.fn(),
  lineFindMany: vi.fn(),
  lineDeleteMany: vi.fn(),
  lineCreateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: { findUnique: mocks.rctiFindUnique, update: mocks.rctiUpdate },
    jobs: { findMany: mocks.jobsFindMany },
    rctiLine: {
      create: mocks.lineCreate,
      findMany: mocks.lineFindMany,
      deleteMany: mocks.lineDeleteMany,
      createMany: mocks.lineCreateMany,
    },
  },
}));
vi.mock("@/lib/permissions", () => ({
  checkPermission: async () => true,
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user_admin" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));

const driver = {
  id: 7,
  driver: "SUB",
  truck: "SUB-01",
  type: "Subcontractor",
  tray: 70,
  crane: 90,
  semi: 100,
  semiCrane: 120,
  breaks: null,
};

function buildJob({ overrides }: { overrides: Record<string, unknown> }) {
  return {
    id: 40,
    date: new Date("2026-09-16T02:00:00.000Z"),
    driver: "SUB",
    customer: "Acme",
    billTo: "Acme",
    registration: "SUB-01",
    truckType: "TRAY",
    pickup: "Dandenong",
    dropoff: "Richmond",
    chargedHours: 8,
    travelTimeHours: null,
    driverCharge: null,
    deductionHours: null,
    startTime: null,
    finishTime: null,
    comments: null,
    jobReference: null,
    ...overrides,
  };
}

async function addJobs({ jobIds }: { jobIds: number[] }) {
  return addLines(
    new NextRequest("http://localhost/api/rcti/5/lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobIds }),
    }),
    { params: Promise.resolve({ id: "5" }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rctiFindUnique.mockResolvedValue({
    id: 5,
    status: "draft",
    driverId: driver.id,
    gstStatus: "registered",
    gstMode: "exclusive",
    weekEnding: new Date("2026-09-20T02:00:00.000Z"),
    lines: [],
    driver,
  });
  mocks.lineCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data }),
  );
  mocks.lineFindMany.mockResolvedValue([]);
  mocks.rctiUpdate.mockResolvedValue({});
});

describe("POST /api/rcti/[id]/lines with jobIds", () => {
  it("adds a job line priced at the driver's rate", async () => {
    mocks.jobsFindMany.mockResolvedValue([buildJob({ overrides: {} })]);

    const response = await addJobs({ jobIds: [40] });

    expect(response.status).toBe(201);
    expect(mocks.lineCreate.mock.calls[0][0].data).toMatchObject({
      rctiId: 5,
      jobId: 40,
      amountExGst: 560,
    });
  });

  it.fails(
    "refuses a job that is already on another RCTI (known gap: it can be paid twice)",
    async () => {
      mocks.jobsFindMany.mockResolvedValue([buildJob({ overrides: {} })]);
      mocks.lineFindMany.mockResolvedValue([{ jobId: 40, rctiId: 9 }]);

      const response = await addJobs({ jobIds: [40] });

      expect(response.status).toBe(400);
      expect(mocks.lineCreate).not.toHaveBeenCalled();
    },
  );

  it.fails(
    "refuses another driver's job (known gap: any job id is accepted)",
    async () => {
      mocks.jobsFindMany.mockResolvedValue([
        buildJob({ overrides: { driver: "OTHER", registration: "OTHER-01" } }),
      ]);

      const response = await addJobs({ jobIds: [40] });

      expect(response.status).toBe(400);
      expect(mocks.lineCreate).not.toHaveBeenCalled();
    },
  );
});
