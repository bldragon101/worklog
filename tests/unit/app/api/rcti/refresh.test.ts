/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/rcti/[id]/refresh/route";
import { prisma } from "@/lib/prisma";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    driver: {
      findUnique: vi.fn(),
    },
    jobs: {
      findMany: vi.fn(),
    },
    rctiLine: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
    },
  }),
  rateLimitConfigs: {
    general: {},
  },
}));

describe("RCTI Refresh API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (id: string) =>
    new NextRequest(`http://localhost:3000/api/rcti/${id}/refresh`, {
      method: "POST",
    });

  const mockDraftRcti = {
    id: 1,
    driverId: 10,
    weekEnding: new Date("2025-01-19"), // Sunday
    status: "draft",
    gstStatus: "not_registered",
    gstMode: "exclusive",
    total: 500,
    subtotal: 500,
    gst: 0,
    lines: [
      // Existing (stale) job line
      {
        id: 1,
        rctiId: 1,
        jobId: 100,
        jobDate: new Date("2025-01-15"),
        customer: "Old Customer",
        truckType: "Tray",
        description: "08:00 - 16:00",
        chargedHours: 5,
        ratePerHour: 100,
        amountExGst: 500,
        gstAmount: 0,
        amountIncGst: 500,
      },
      // Manually added line (should be preserved)
      {
        id: 2,
        rctiId: 1,
        jobId: null,
        jobDate: new Date("2025-01-16"),
        customer: "Manual Extra",
        truckType: "Tray",
        description: "Manual adjustment",
        chargedHours: 2,
        ratePerHour: 50,
        amountExGst: 100,
        gstAmount: 0,
        amountIncGst: 100,
      },
    ],
  };

  const mockDriver = {
    id: 10,
    driver: "John Smith",
    type: "Contractor",
    truck: "ABC123",
    tray: 100,
    crane: null,
    semi: null,
    semiCrane: null,
    breaks: 0,
    tolls: false,
    fuelLevy: 0,
  };

  const mockJobs = [
    {
      id: 100,
      date: new Date("2025-01-15"),
      driver: "John Smith",
      customer: "Customer A",
      truckType: "Tray",
      driverCharge: 6,
      chargedHours: 6,
      startTime: null,
      finishTime: null,
      jobReference: "REF-A",
      comments: null,
      eastlink: 0,
      citylink: 0,
    },
    {
      // A new job that was not previously on the RCTI
      id: 101,
      date: new Date("2025-01-16"),
      driver: "John Smith",
      customer: "Customer B",
      truckType: "Tray",
      driverCharge: 4,
      chargedHours: 4,
      startTime: null,
      finishTime: null,
      jobReference: "REF-B",
      comments: null,
      eastlink: 0,
      citylink: 0,
    },
  ];

  const setupTransaction = () => {
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const update = vi.fn().mockImplementation((args) =>
      Promise.resolve({
        ...mockDraftRcti,
        ...args.data,
        driver: mockDriver,
        lines: [],
      }),
    );

    (prisma.$transaction as vi.Mock).mockImplementation(async (callback) =>
      callback({
        rctiLine: { deleteMany, createMany },
        rcti: { update },
      }),
    );

    return { createMany, deleteMany, update };
  };

  describe("Successful refresh", () => {
    it("regenerates job lines from source jobs and preserves manual lines", async () => {
      (prisma.rcti.findUnique as vi.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.driver.findUnique as vi.Mock).mockResolvedValue(mockDriver);
      (prisma.jobs.findMany as vi.Mock).mockResolvedValue(mockJobs);
      (prisma.rctiLine.findMany as vi.Mock).mockResolvedValue([]);
      const { createMany, deleteMany, update } = setupTransaction();

      const response = await POST(createMockRequest("1"), {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(200);
      expect(deleteMany).toHaveBeenCalledWith({ where: { rctiId: 1 } });

      const created = createMany.mock.calls[0][0].data;
      // Two job lines (job 100 and the new job 101) + one preserved manual line
      const jobLines = created.filter((l: { jobId: number | null }) => l.jobId !== null);
      const manualLines = created.filter(
        (l: { jobId: number | null }) => l.jobId === null,
      );
      expect(jobLines).toHaveLength(2);
      expect(manualLines).toHaveLength(1);
      expect(manualLines[0].customer).toBe("Manual Extra");
      // New job picked up
      expect(
        created.some((l: { jobId: number | null }) => l.jobId === 101),
      ).toBe(true);

      // Totals recalculated: 6*100 + 4*100 + 100 manual = 1100
      expect(update.mock.calls[0][0].data.total).toBe(1100);
    });

    it("excludes jobs already attached to other RCTIs", async () => {
      (prisma.rcti.findUnique as vi.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.driver.findUnique as vi.Mock).mockResolvedValue(mockDriver);
      (prisma.jobs.findMany as vi.Mock).mockResolvedValue(mockJobs);
      // Job 101 is used on another RCTI
      (prisma.rctiLine.findMany as vi.Mock).mockResolvedValue([
        { jobId: 101 },
      ]);
      const { createMany } = setupTransaction();

      const response = await POST(createMockRequest("1"), {
        params: Promise.resolve({ id: "1" }),
      });

      expect(response.status).toBe(200);
      const created = createMany.mock.calls[0][0].data;
      expect(
        created.some((l: { jobId: number | null }) => l.jobId === 101),
      ).toBe(false);
      expect(
        created.some((l: { jobId: number | null }) => l.jobId === 100),
      ).toBe(true);
    });

    it("matches subcontractor jobs by registration", async () => {
      (prisma.rcti.findUnique as vi.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.driver.findUnique as vi.Mock).mockResolvedValue({
        ...mockDriver,
        type: "Subcontractor",
        truck: "REGO99",
      });
      (prisma.jobs.findMany as vi.Mock).mockResolvedValue([]);
      (prisma.rctiLine.findMany as vi.Mock).mockResolvedValue([]);
      setupTransaction();

      await POST(createMockRequest("1"), {
        params: Promise.resolve({ id: "1" }),
      });

      const where = (prisma.jobs.findMany as vi.Mock).mock.calls[0][0].where;
      expect(where.registration).toBe("REGO99");
      expect(where.driver).toBeUndefined();
    });
  });

  describe("Validation and business rules", () => {
    it("rejects an invalid RCTI ID", async () => {
      const response = await POST(createMockRequest("abc"), {
        params: Promise.resolve({ id: "abc" }),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid RCTI ID");
    });

    it("returns 404 when the RCTI does not exist", async () => {
      (prisma.rcti.findUnique as vi.Mock).mockResolvedValue(null);
      const response = await POST(createMockRequest("999"), {
        params: Promise.resolve({ id: "999" }),
      });
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("RCTI not found");
    });

    it("rejects refreshing a finalised RCTI", async () => {
      (prisma.rcti.findUnique as vi.Mock).mockResolvedValue({
        ...mockDraftRcti,
        status: "finalised",
      });
      const response = await POST(createMockRequest("1"), {
        params: Promise.resolve({ id: "1" }),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Only draft RCTIs can be refreshed");
    });

    it("rejects refreshing a paid RCTI", async () => {
      (prisma.rcti.findUnique as vi.Mock).mockResolvedValue({
        ...mockDraftRcti,
        status: "paid",
      });
      const response = await POST(createMockRequest("1"), {
        params: Promise.resolve({ id: "1" }),
      });
      expect(response.status).toBe(400);
    });

    it("returns 404 when the driver no longer exists", async () => {
      (prisma.rcti.findUnique as vi.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.driver.findUnique as vi.Mock).mockResolvedValue(null);
      const response = await POST(createMockRequest("1"), {
        params: Promise.resolve({ id: "1" }),
      });
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Driver not found for this RCTI");
    });
  });

  describe("Error handling", () => {
    it("returns 500 when the database fails", async () => {
      (prisma.rcti.findUnique as vi.Mock).mockRejectedValue(
        new Error("Database connection error"),
      );
      const response = await POST(createMockRequest("1"), {
        params: Promise.resolve({ id: "1" }),
      });
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to refresh RCTI");
    });
  });
});
