import { NextRequest } from "next/server";
import { POST as addLines } from "@/app/api/rcti/[id]/lines/route";
import { GET as getAvailableJobs } from "@/app/api/rcti/[id]/available-jobs/route";

const mocks = vi.hoisted(() => ({
  rctiFindUnique: vi.fn(),
  rctiUpdate: vi.fn(),
  jobsFindMany: vi.fn(),
  driverFindMany: vi.fn(),
  lineCreate: vi.fn(),
  lineCreateManyAndReturn: vi.fn(),
  lineFindMany: vi.fn(),
  lineDeleteMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    rcti: { findUnique: mocks.rctiFindUnique, update: mocks.rctiUpdate },
    jobs: { findMany: mocks.jobsFindMany },
    driver: { findMany: mocks.driverFindMany },
    rctiLine: {
      create: mocks.lineCreate,
      createManyAndReturn: mocks.lineCreateManyAndReturn,
      findMany: mocks.lineFindMany,
      deleteMany: mocks.lineDeleteMany,
    },
    $queryRaw: mocks.queryRaw,
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
      operation(client),
  };
  return { prisma: client };
});
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

const subcontractor = {
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

const contractor = {
  ...subcontractor,
  id: 8,
  driver: "CON",
  truck: "CON-01",
  type: "Contractor",
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

function useRcti({ driver }: { driver: typeof subcontractor }) {
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
  useRcti({ driver: subcontractor });
  mocks.queryRaw.mockResolvedValue([{ status: "draft" }]);
  mocks.driverFindMany.mockResolvedValue([]);
  mocks.lineCreateManyAndReturn.mockImplementation(
    async ({ data }: { data: Array<Record<string, unknown>> }) =>
      data.map((line, index) => ({ id: index + 1, ...line })),
  );
  mocks.lineFindMany.mockResolvedValue([]);
  mocks.rctiUpdate.mockResolvedValue({});
});

describe("POST /api/rcti/[id]/lines with jobIds", () => {
  it("adds a job line priced at the driver's rate", async () => {
    mocks.jobsFindMany.mockResolvedValue([buildJob({ overrides: {} })]);

    const response = await addJobs({ jobIds: [40] });

    expect(response.status).toBe(201);
    expect(mocks.lineCreateManyAndReturn.mock.calls[0][0].data[0]).toMatchObject(
      {
        rctiId: 5,
        jobId: 40,
        amountExGst: 560,
      },
    );
  });

  it("locks the RCTI and the jobs before checking them", async () => {
    mocks.jobsFindMany.mockResolvedValue([buildJob({ overrides: {} })]);

    await addJobs({ jobIds: [40] });

    const lockedTables = mocks.queryRaw.mock.calls.map(([strings]) =>
      (strings as TemplateStringsArray).join("?"),
    );
    expect(lockedTables[0]).toContain('FROM "Rcti"');
    expect(lockedTables[1]).toContain('FROM "Jobs"');
    expect(lockedTables.every((sql) => sql.includes("FOR UPDATE"))).toBe(true);
  });

  it("refuses a job that is already on another RCTI", async () => {
    mocks.jobsFindMany.mockResolvedValue([buildJob({ overrides: {} })]);
    mocks.lineFindMany.mockResolvedValue([{ jobId: 40, rctiId: 9 }]);

    const response = await addJobs({ jobIds: [40] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Job 40 is already on another RCTI",
    );
    expect(mocks.lineCreateManyAndReturn).not.toHaveBeenCalled();
  });

  it("refuses a job that is already on this RCTI", async () => {
    mocks.jobsFindMany.mockResolvedValue([buildJob({ overrides: {} })]);
    mocks.lineFindMany.mockResolvedValue([{ jobId: 40, rctiId: 5 }]);

    const response = await addJobs({ jobIds: [40] });

    expect(response.status).toBe(400);
    expect(mocks.lineCreateManyAndReturn).not.toHaveBeenCalled();
  });

  it("refuses a job outside the RCTI's week", async () => {
    mocks.jobsFindMany.mockResolvedValue([
      buildJob({ overrides: { date: new Date("2026-09-24T02:00:00.000Z") } }),
    ]);

    const response = await addJobs({ jobIds: [40] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Job 40 is not in this RCTI's week",
    );
    expect(mocks.lineCreateManyAndReturn).not.toHaveBeenCalled();
  });

  it("refuses another driver's job on a contractor's RCTI", async () => {
    useRcti({ driver: contractor });
    mocks.jobsFindMany.mockResolvedValue([
      buildJob({ overrides: { driver: "OTHER", registration: "OTHER-01" } }),
    ]);

    const response = await addJobs({ jobIds: [40] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Job 40 belongs to OTHER, not CON",
    );
    expect(mocks.lineCreateManyAndReturn).not.toHaveBeenCalled();
  });

  it("adds a subcontractor's job done in another truck", async () => {
    mocks.jobsFindMany.mockResolvedValue([
      buildJob({ overrides: { driver: "SUB WORKER", registration: "HIRE-02" } }),
    ]);

    const response = await addJobs({ jobIds: [40] });

    expect(response.status).toBe(201);
    expect(mocks.lineCreateManyAndReturn).toHaveBeenCalled();
  });

  it("refuses an employee's job on a subcontractor's RCTI", async () => {
    mocks.jobsFindMany.mockResolvedValue([
      buildJob({ overrides: { driver: "EMP", registration: "EMP-01" } }),
    ]);
    mocks.driverFindMany.mockResolvedValue([{ driver: "EMP" }]);

    const response = await addJobs({ jobIds: [40] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Job 40 belongs to EMP, who is paid separately",
    );
  });

  it("rejects the whole request when any job is not allowed", async () => {
    mocks.jobsFindMany.mockResolvedValue([
      buildJob({ overrides: {} }),
      buildJob({ overrides: { id: 41 } }),
    ]);
    mocks.lineFindMany.mockResolvedValue([{ jobId: 41, rctiId: 9 }]);

    const response = await addJobs({ jobIds: [40, 41] });

    expect(response.status).toBe(400);
    expect((await response.json()).rejected).toEqual([
      { jobId: 41, reason: "Job 41 is already on another RCTI" },
    ]);
    expect(mocks.lineCreateManyAndReturn).not.toHaveBeenCalled();
  });

  it("reports job ids that do not exist", async () => {
    mocks.jobsFindMany.mockResolvedValue([buildJob({ overrides: {} })]);

    const response = await addJobs({ jobIds: [40, 99] });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Jobs not found: 99");
  });

  it("refuses when the RCTI was finalised before the lock was taken", async () => {
    mocks.queryRaw.mockResolvedValue([{ status: "finalised" }]);
    mocks.jobsFindMany.mockResolvedValue([buildJob({ overrides: {} })]);

    const response = await addJobs({ jobIds: [40] });

    expect(response.status).toBe(400);
    expect(mocks.lineCreateManyAndReturn).not.toHaveBeenCalled();
  });
});

describe("GET /api/rcti/[id]/available-jobs", () => {
  async function fetchAvailable() {
    const response = await getAvailableJobs(
      new NextRequest("http://localhost/api/rcti/5/available-jobs"),
      { params: Promise.resolve({ id: "5" }) },
    );
    return { status: response.status, jobs: await response.json() };
  }

  it("lists a subcontractor's jobs in any truck, own truck first, leaving out jobs already on an RCTI", async () => {
    mocks.jobsFindMany.mockResolvedValue([
      buildJob({ overrides: { id: 40, registration: "HIRE-02" } }),
      buildJob({ overrides: { id: 41 } }),
      buildJob({ overrides: { id: 42 } }),
    ]);
    mocks.lineFindMany.mockResolvedValue([{ jobId: 42, rctiId: 9 }]);

    const { status, jobs } = await fetchAvailable();

    expect(status).toBe(200);
    expect(jobs.map((job: { id: number }) => job.id)).toEqual([41, 40]);
    expect(mocks.jobsFindMany.mock.calls[0][0].where.driver).toBeUndefined();
  });

  it("lists only a contractor's own jobs", async () => {
    useRcti({ driver: contractor });
    mocks.jobsFindMany.mockResolvedValue([]);

    await fetchAvailable();

    expect(mocks.jobsFindMany.mock.calls[0][0].where.driver).toBe("CON");
  });

  it("lists nothing for an RCTI that is not a draft", async () => {
    mocks.rctiFindUnique.mockResolvedValue({
      id: 5,
      status: "finalised",
      weekEnding: new Date("2026-09-20T02:00:00.000Z"),
      driver: subcontractor,
    });

    const { jobs } = await fetchAvailable();

    expect(jobs).toEqual([]);
    expect(mocks.jobsFindMany).not.toHaveBeenCalled();
  });
});
