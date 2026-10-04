import { NextRequest } from "next/server";
import { POST as createJobsReport } from "@/app/api/jobs-report/route";

const mocks = vi.hoisted(() => ({
  driverFindUnique: vi.fn(),
  reportFindFirst: vi.fn(),
  reportFindMany: vi.fn(),
  reportCreate: vi.fn(),
  jobsFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driver: { findUnique: mocks.driverFindUnique },
    jobsReport: {
      findFirst: mocks.reportFindFirst,
      findMany: mocks.reportFindMany,
      create: mocks.reportCreate,
    },
    jobs: { findMany: mocks.jobsFindMany },
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user_admin" }),
}));
vi.mock("@/lib/permissions", () => ({
  getUserRole: async () => "admin",
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));

function createRequest() {
  return new NextRequest("http://localhost/api/jobs-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driverId: 7, weekEnding: "2026-09-20" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reportFindFirst.mockResolvedValue(null);
  mocks.reportFindMany.mockResolvedValue([]);
  mocks.jobsFindMany.mockResolvedValue([]);
  mocks.reportCreate.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data }),
  );
});

const driver = {
  id: 7,
  driver: "JOHN",
  lastName: "Smith",
  truck: "ABC123",
  type: "Employee",
};

function reportJob({
  overrides = {},
}: {
  overrides?: Record<string, unknown>;
} = {}) {
  return {
    id: 1,
    date: new Date("2026-09-15T00:00:00.000Z"),
    customer: "Test Customer",
    truckType: "Tray",
    startTime: null,
    finishTime: null,
    chargedHours: 8,
    travelTimeHours: 1,
    driverCharge: null,
    deductionHours: 1,
    hideDeduction: false,
    ...overrides,
  };
}

async function createdLines() {
  const response = await createJobsReport(createRequest());
  expect(response.status).toBe(201);
  return mocks.reportCreate.mock.calls[0][0].data.lines.create;
}

describe("POST /api/jobs-report hidden deductions", () => {
  beforeEach(() => {
    mocks.driverFindUnique.mockResolvedValue(driver);
  });

  it("shows a deduction by default", async () => {
    mocks.jobsFindMany.mockResolvedValue([reportJob()]);

    const [line] = await createdLines();

    expect(line).toMatchObject({
      chargedHours: 8,
      travelTimeHours: 1,
      driverCharge: 8,
    });
  });

  it("shows only the hours paid when the deduction is hidden", async () => {
    mocks.jobsFindMany.mockResolvedValue([
      reportJob({ overrides: { hideDeduction: true } }),
    ]);

    const [line] = await createdLines();

    expect(line).toMatchObject({
      chargedHours: 7,
      travelTimeHours: 1,
      driverCharge: 8,
    });
  });
});
