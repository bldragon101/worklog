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

describe("POST /api/jobs-report driver name", () => {
  it("puts the driver's full name on the report", async () => {
    mocks.driverFindUnique.mockResolvedValue({
      id: 7,
      driver: "JOHN",
      lastName: "Smith",
      truck: "ABC123",
      type: "Employee",
    });

    const response = await createJobsReport(createRequest());

    expect(response.status).toBe(201);
    expect(mocks.reportCreate.mock.calls[0][0].data.driverName).toBe(
      "JOHN Smith",
    );
  });

  it("uses the first name alone when there is no last name", async () => {
    mocks.driverFindUnique.mockResolvedValue({
      id: 7,
      driver: "JOHN",
      lastName: null,
      truck: "ABC123",
      type: "Employee",
    });

    await createJobsReport(createRequest());

    expect(mocks.reportCreate.mock.calls[0][0].data.driverName).toBe("JOHN");
  });
});
