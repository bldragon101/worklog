import { NextRequest } from "next/server";
import { POST as createRcti } from "@/app/api/rcti/route";
import { POST as refreshRcti } from "@/app/api/rcti/[id]/refresh/route";

const mocks = vi.hoisted(() => ({
  driverFindUnique: vi.fn(),
  rctiFindMany: vi.fn(),
  rctiFindUnique: vi.fn(),
  rctiCreate: vi.fn(),
  rctiUpdate: vi.fn(),
  rctiLineFindMany: vi.fn(),
  rctiLineDeleteMany: vi.fn(),
  rctiLineCreateMany: vi.fn(),
  jobsFindMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    driver: { findUnique: mocks.driverFindUnique },
    rcti: {
      findMany: mocks.rctiFindMany,
      findUnique: mocks.rctiFindUnique,
      findUniqueOrThrow: async (args: unknown) => ({
        ...(await mocks.rctiFindUnique(args)),
        driver: await mocks.driverFindUnique(),
      }),
      create: mocks.rctiCreate,
      update: mocks.rctiUpdate,
    },
    rctiLine: {
      findMany: mocks.rctiLineFindMany,
      deleteMany: mocks.rctiLineDeleteMany,
      createMany: mocks.rctiLineCreateMany,
    },
    jobs: { findMany: mocks.jobsFindMany },
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
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));

const WEEK_ENDING = "2026-09-20T02:00:00.000Z";

const subcontractor = {
  id: 7,
  driver: "SUB",
  truck: "SUB-01",
  type: "Subcontractor",
  tray: 70,
  crane: 90,
  semi: 100,
  semiCrane: 120,
  breaks: 0.5,
  tolls: true,
  fuelLevy: 10,
  businessName: "Sub Pty Ltd",
  address: null,
  abn: null,
  gstStatus: "registered",
  gstMode: "exclusive",
  bankAccountName: null,
  bankBsb: null,
  bankAccountNumber: null,
};

function buildJob({
  id,
  overrides,
}: {
  id: number;
  overrides: Record<string, unknown>;
}) {
  return {
    id,
    date: new Date("2026-09-16T02:00:00.000Z"),
    driver: "SUB",
    customer: "Acme",
    billTo: "Acme",
    registration: "SUB-01",
    truckType: "TRAY",
    pickup: "Dandenong",
    dropoff: "Richmond",
    chargedHours: null,
    travelTimeHours: null,
    driverCharge: null,
    deductionHours: null,
    driverOnly: false,
    startTime: null,
    finishTime: null,
    comments: null,
    jobReference: null,
    eastlink: null,
    citylink: null,
    ...overrides,
  };
}

const workedExampleJobs = [
  buildJob({ id: 1, overrides: { chargedHours: 8, travelTimeHours: 1, eastlink: 2 } }),
  buildJob({ id: 2, overrides: { chargedHours: 6, deductionHours: 0.5, citylink: 1 } }),
  buildJob({
    id: 3,
    overrides: { truckType: "CRANE", chargedHours: 8, driverCharge: 10 },
  }),
];

function jsonRequest({ body }: { body: unknown }) {
  return new NextRequest("http://localhost/api/rcti", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Creates an RCTI the way the RCTI page does, sending the driver's GST
 * settings with the request.
 */
async function createForDriver() {
  const driver = await mocks.driverFindUnique();
  return createRcti(
    jsonRequest({
      body: {
        driverId: subcontractor.id,
        weekEnding: WEEK_ENDING,
        gstStatus: driver?.gstStatus,
        gstMode: driver?.gstMode,
      },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.driverFindUnique.mockResolvedValue(subcontractor);
  mocks.rctiFindMany.mockResolvedValue([]);
  mocks.rctiLineFindMany.mockResolvedValue([]);
  mocks.jobsFindMany.mockResolvedValue(workedExampleJobs);
  // Row locks: the RCTI lock returns the RCTI's status
  mocks.queryRaw.mockImplementation(async () => {
    const rcti = await mocks.rctiFindUnique();
    return rcti ? [{ status: rcti.status }] : [];
  });
  mocks.rctiCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: 99, ...data }),
  );
  mocks.rctiUpdate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: 99, ...data }),
  );
});

function createdRcti() {
  return mocks.rctiCreate.mock.calls[0][0].data as {
    subtotal: number;
    gst: number;
    total: number;
    status: string;
    lines: {
      create: Array<{
        jobId: number | null;
        customer: string;
        truckType: string;
        amountExGst: number;
      }>;
    };
  };
}

describe("POST /api/rcti", () => {
  it("totals the worked example to the cent", async () => {
    const response = await createForDriver();

    expect(response.status).toBe(201);
    const rcti = createdRcti();
    expect(rcti.status).toBe("draft");
    expect(rcti.subtotal).toBe(2086.5);
    expect(rcti.gst).toBe(208.65);
    expect(rcti.total).toBe(2295.15);
  });

  it("builds job, break, toll and fuel levy lines", async () => {
    await createForDriver();

    const lines = createdRcti().lines.create.map((line) => ({
      jobId: line.jobId,
      customer: line.customer,
      truckType: line.truckType,
      amountExGst: line.amountExGst,
    }));
    expect(lines).toEqual([
      { jobId: 1, customer: "Acme", truckType: "TRAY", amountExGst: 630 },
      { jobId: 2, customer: "Acme", truckType: "TRAY", amountExGst: 385 },
      { jobId: 3, customer: "Acme", truckType: "CRANE", amountExGst: 900 },
      { jobId: null, customer: "Break Deduction", truckType: "TRAY", amountExGst: -35 },
      { jobId: null, customer: "Break Deduction", truckType: "CRANE", amountExGst: -45 },
      { jobId: null, customer: "Tolls", truckType: "Eastlink", amountExGst: 37 },
      { jobId: null, customer: "Tolls", truckType: "CityLink", amountExGst: 31 },
      // 10% of the job lines after break deductions: 10% of (1915 - 80)
      { jobId: null, customer: "Fuel Levy", truckType: "10%", amountExGst: 183.5 },
    ]);
  });

  it("charges no GST for a driver who is not GST registered", async () => {
    mocks.driverFindUnique.mockResolvedValue({
      ...subcontractor,
      gstStatus: "not_registered",
    });

    await createForDriver();

    const rcti = createdRcti();
    expect(rcti.gst).toBe(0);
    expect(rcti.subtotal).toBe(2086.5);
    expect(rcti.total).toBe(2086.5);
  });

  it("treats amounts as GST inclusive when the driver is on inclusive GST", async () => {
    mocks.driverFindUnique.mockResolvedValue({
      ...subcontractor,
      gstMode: "inclusive",
      breaks: null,
      tolls: false,
      fuelLevy: null,
    });
    mocks.jobsFindMany.mockResolvedValue([
      buildJob({ id: 1, overrides: { chargedHours: 1 } }),
    ]);

    await createForDriver();

    const rcti = createdRcti();
    expect(rcti.total).toBe(70);
    expect(rcti.subtotal).toBe(63.64);
    expect(rcti.gst).toBe(6.36);
  });

  it("matches subcontractor jobs by truck registration", async () => {
    await createForDriver();

    expect(mocks.jobsFindMany.mock.calls[0][0].where).toMatchObject({
      registration: "SUB-01",
    });
    expect(mocks.jobsFindMany.mock.calls[0][0].where).not.toHaveProperty(
      "driver",
    );
  });

  it("matches contractor jobs by driver name", async () => {
    mocks.driverFindUnique.mockResolvedValue({
      ...subcontractor,
      type: "Contractor",
    });

    await createForDriver();

    expect(mocks.jobsFindMany.mock.calls[0][0].where).toMatchObject({
      driver: "SUB",
    });
    expect(mocks.jobsFindMany.mock.calls[0][0].where).not.toHaveProperty(
      "registration",
    );
  });

  it("limits jobs to the Monday-to-Sunday week that ends on the week ending", async () => {
    await createForDriver();

    const { date } = mocks.jobsFindMany.mock.calls[0][0].where;
    expect(date.gte).toEqual(new Date(2026, 8, 14, 0, 0, 0, 0));
    expect(date.lte).toEqual(new Date(2026, 8, 20, 23, 59, 59, 999));
  });

  it("rejects employees", async () => {
    mocks.driverFindUnique.mockResolvedValue({
      ...subcontractor,
      type: "Employee",
    });

    const response = await createForDriver();

    expect(response.status).toBe(400);
    expect(mocks.rctiCreate).not.toHaveBeenCalled();
  });

  it("leaves out jobs already on another RCTI", async () => {
    mocks.rctiLineFindMany.mockResolvedValue([{ jobId: 1 }, { jobId: null }]);

    await createForDriver();

    const jobLineIds = createdRcti()
      .lines.create.map((line) => line.jobId)
      .filter((jobId) => jobId !== null);
    expect(jobLineIds).toEqual([2, 3]);
  });

  it("refuses to create an RCTI when every job is already paid on another", async () => {
    mocks.rctiLineFindMany.mockResolvedValue([
      { jobId: 1 },
      { jobId: 2 },
      { jobId: 3 },
    ]);

    const response = await createForDriver();

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "No eligible jobs found for this driver and week",
    });
    expect(mocks.rctiCreate).not.toHaveBeenCalled();
  });

  it(
    "falls back to the driver's GST settings when the request omits them",
    async () => {
      await createRcti(
        jsonRequest({
          body: { driverId: subcontractor.id, weekEnding: WEEK_ENDING },
        }),
      );

      expect(createdRcti().gst).toBe(208.65);
    },
  );

  it("puts the driver's full name on the RCTI but keeps the invoice number on the first name", async () => {
    mocks.driverFindUnique.mockResolvedValue({
      ...subcontractor,
      businessName: null,
      lastName: "Smith",
    });

    await createForDriver();

    const rcti = createdRcti() as unknown as {
      driverName: string;
      invoiceNumber: string;
    };
    expect(rcti.driverName).toBe("SUB Smith");
    expect(rcti.invoiceNumber).toMatch(/-SUB$/);
  });

  it("returns 404 for an unknown driver", async () => {
    mocks.driverFindUnique.mockResolvedValue(null);

    const response = await createForDriver();

    expect(response.status).toBe(404);
  });
});

describe("POST /api/rcti/[id]/refresh", () => {
  const manualLine = {
    id: 50,
    jobId: null,
    jobDate: new Date(WEEK_ENDING),
    customer: "Yard cleanup",
    truckType: "TRAY",
    description: "Manual",
    chargedHours: 1,
    travelTimeHours: null,
    driverCharge: null,
    ratePerHour: 50,
    amountExGst: 50,
    gstAmount: 5,
    amountIncGst: 55,
  };

  function draftRcti({ status = "draft" }: { status?: string } = {}) {
    return {
      id: 99,
      driverId: subcontractor.id,
      status,
      weekEnding: new Date(WEEK_ENDING),
      gstStatus: "registered",
      gstMode: "exclusive",
      lines: [
        { ...manualLine },
        { ...manualLine, id: 51, jobId: 1, customer: "Acme" },
        { ...manualLine, id: 52, customer: "Fuel Levy" },
      ],
    };
  }

  async function refresh() {
    return refreshRcti(
      new NextRequest("http://localhost/api/rcti/99/refresh", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "99" }) },
    );
  }

  it("rebuilds job lines, keeps manual lines and recalculates totals", async () => {
    mocks.rctiFindUnique.mockResolvedValue(draftRcti());

    const response = await refresh();

    expect(response.status).toBe(200);
    const created = mocks.rctiLineCreateMany.mock.calls[0][0].data as Array<{
      jobId: number | null;
      customer: string;
    }>;
    expect(created.filter((line) => line.customer === "Yard cleanup")).toHaveLength(1);
    expect(created.filter((line) => line.jobId !== null).map((line) => line.jobId)).toEqual([
      1, 2, 3,
    ]);
    expect(mocks.rctiUpdate.mock.calls[0][0].data).toEqual({
      subtotal: 2136.5,
      gst: 213.65,
      total: 2350.15,
      waivedBreakDeductions: [],
    });
  });

  it("leaves out jobs that are on a different RCTI", async () => {
    mocks.rctiFindUnique.mockResolvedValue(draftRcti());
    mocks.rctiLineFindMany.mockResolvedValue([{ jobId: 3 }]);

    await refresh();

    expect(mocks.rctiLineFindMany.mock.calls[0][0].where).toMatchObject({
      rctiId: { not: 99 },
    });
    const created = mocks.rctiLineCreateMany.mock.calls[0][0].data as Array<{
      jobId: number | null;
    }>;
    expect(created.map((line) => line.jobId).filter(Boolean)).toEqual([1, 2]);
  });

  it.each(["finalised", "paid"])("refuses to refresh a %s RCTI", async (status) => {
    mocks.rctiFindUnique.mockResolvedValue(draftRcti({ status }));

    const response = await refresh();

    expect(response.status).toBe(400);
    expect(mocks.rctiLineDeleteMany).not.toHaveBeenCalled();
  });
});
