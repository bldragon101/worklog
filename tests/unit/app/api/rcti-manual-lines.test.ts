/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/rcti/[id]/lines/route";
import { DELETE } from "@/app/api/rcti/[id]/lines/[lineId]/route";
import { prisma } from "@/lib/prisma";

// Mock calculation utilities
jest.mock("@/lib/utils/rcti-calculations", () => ({
  calculateLineAmounts: jest.fn(({ chargedHours, ratePerHour, gstStatus }) => {
    const amountExGst = chargedHours * ratePerHour;
    const gstAmount = gstStatus === "registered" ? amountExGst * 0.1 : 0;
    const amountIncGst = amountExGst + gstAmount;
    return { amountExGst, gstAmount, amountIncGst };
  }),
  calculateLunchBreakLines: jest.fn(() => []), // No breaks by default
  getDriverRateForTruckType: jest.fn(
    ({ truckType, tray, crane, semi, semiCrane }) => {
      const normalizedType = truckType.toLowerCase().trim();
      if (normalizedType.includes("semi") && normalizedType.includes("crane")) {
        return semiCrane;
      }
      if (normalizedType.includes("semi")) {
        return semi;
      }
      if (normalizedType.includes("crane")) {
        return crane;
      }
      if (normalizedType.includes("tray")) {
        return tray;
      }
      return tray;
    },
  ),
}));

// Mock dependencies
jest.mock("@/lib/prisma", () => {
  const mockRcti = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  const mockJobs = {
    findMany: jest.fn(),
  };

  const mockRctiLine = {
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };

  return {
    prisma: {
      rcti: mockRcti,
      jobs: mockJobs,
      rctiLine: mockRctiLine,
      $transaction: jest.fn((callback) => {
        // Execute the callback with the mocked transaction client
        return callback({
          rcti: mockRcti,
          rctiLine: mockRctiLine,
        });
      }),
    },
  };
});

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: "test-user-123" }),
}));

jest.mock("@/lib/rate-limit", () => ({
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

describe("Manual RCTI Lines API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/rcti/[id]/lines - Manual Line Entry", () => {
    const createMockRequest = (body: unknown) => {
      return new NextRequest("http://localhost:3000/api/rcti/1/lines", {
        method: "POST",
        body: JSON.stringify(body),
      });
    };

    const mockDraftRcti = {
      id: 1,
      driverId: 10,
      driverName: "John Doe",
      status: "draft",
      gstStatus: "registered",
      gstMode: "exclusive",
      subtotal: 0,
      gst: 0,
      total: 0,
      weekEnding: new Date("2024-11-10"),
      lines: [],
      driver: {
        id: 10,
        driver: "John Doe",
        breaks: 0.5,
      },
    };

    it("should add a manual line successfully with GST registered", async () => {
      const manualLineData = {
        jobDate: "2024-11-04",
        customer: "ABC Transport",
        truckType: "10T Crane",
        description: "Special delivery",
        chargedHours: "8.5",
        ratePerHour: "85.00",
      };

      const expectedLine = {
        id: 123,
        rctiId: 1,
        jobId: null,
        jobDate: "2024-11-04T00:00:00.000Z",
        customer: "ABC Transport",
        truckType: "10T Crane",
        description: "Special delivery",
        chargedHours: 8.5,
        ratePerHour: 85.0,
        amountExGst: 722.5,
        gstAmount: 72.25,
        amountIncGst: 794.75,
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.rctiLine.create as jest.Mock).mockResolvedValue(expectedLine);
      (prisma.rctiLine.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue([expectedLine]);
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockDraftRcti,
        subtotal: 722.5,
        gst: 72.25,
        total: 794.75,
      });

      const request = createMockRequest({ manualLine: manualLineData });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("Manual line added successfully");
      expect(data.line).toEqual(expectedLine);

      expect(prisma.rctiLine.create).toHaveBeenCalledWith({
        data: {
          rctiId: 1,
          jobId: null,
          jobDate: new Date("2024-11-04"),
          customer: "ABC Transport",
          truckType: "10T Crane",
          description: "Special delivery",
          chargedHours: 8.5,
          ratePerHour: 85.0,
          amountExGst: 722.5,
          gstAmount: 72.25,
          amountIncGst: 794.75,
        },
      });

      // Verify totals were recalculated
      expect(prisma.rcti.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          subtotal: 722.5,
          gst: 72.25,
          total: 794.75,
        },
      });
    });

    it("should add a manual line with no GST when not registered", async () => {
      const manualLineData = {
        jobDate: "2024-11-04",
        customer: "Test Customer",
        truckType: "Tray",
        description: "No GST job",
        chargedHours: "10",
        ratePerHour: "50",
      };

      const notRegisteredRcti = {
        ...mockDraftRcti,
        gstStatus: "not_registered",
      };

      const expectedLine = {
        id: 124,
        rctiId: 1,
        jobId: null,
        jobDate: new Date("2024-11-04"),
        customer: "Test Customer",
        truckType: "Tray",
        description: "No GST job",
        chargedHours: 10,
        ratePerHour: 50,
        amountExGst: 500,
        gstAmount: 0,
        amountIncGst: 500,
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
        notRegisteredRcti,
      );
      (prisma.rctiLine.create as jest.Mock).mockResolvedValue(expectedLine);
      (prisma.rctiLine.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue([expectedLine]);
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...notRegisteredRcti,
        subtotal: 500,
        gst: 0,
        total: 500,
      });

      const request = createMockRequest({ manualLine: manualLineData });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.line.gstAmount).toBe(0);
      expect(data.line.amountExGst).toBe(500);
      expect(data.line.amountIncGst).toBe(500);
    });

    it("should trim whitespace from customer and truck type", async () => {
      const manualLineData = {
        jobDate: "2024-11-04",
        customer: "  ABC Transport  ",
        truckType: "  10T Crane  ",
        description: "  Test  ",
        chargedHours: "8",
        ratePerHour: "50",
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.rctiLine.create as jest.Mock).mockResolvedValue({
        id: 125,
        rctiId: 1,
        jobId: null,
        jobDate: new Date("2024-11-04"),
        customer: "ABC Transport",
        truckType: "10T Crane",
        description: "Test",
        chargedHours: 8,
        ratePerHour: 50,
        amountExGst: 400,
        gstAmount: 40,
        amountIncGst: 440,
      });
      (prisma.rctiLine.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.rcti.update as jest.Mock).mockResolvedValue(mockDraftRcti);

      const request = createMockRequest({ manualLine: manualLineData });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(201);
      expect(prisma.rctiLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customer: "ABC Transport",
            truckType: "10T Crane",
            description: "Test",
          }),
        }),
      );
    });

    it("should allow null description", async () => {
      const manualLineData = {
        jobDate: "2024-11-04",
        customer: "ABC Transport",
        truckType: "10T Crane",
        description: "",
        chargedHours: "8",
        ratePerHour: "50",
      };

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.rctiLine.create as jest.Mock).mockResolvedValue({
        id: 126,
        rctiId: 1,
        jobId: null,
        description: null,
      });
      (prisma.rctiLine.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.rcti.update as jest.Mock).mockResolvedValue(mockDraftRcti);

      const request = createMockRequest({ manualLine: manualLineData });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });

      expect(response.status).toBe(201);
      expect(prisma.rctiLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: null,
          }),
        }),
      );
    });

    it("should return 400 for invalid RCTI ID", async () => {
      const request = createMockRequest({
        manualLine: {
          jobDate: "2024-11-04",
          customer: "Test",
          truckType: "Tray",
          chargedHours: "8",
          ratePerHour: "50",
        },
      });
      const params = Promise.resolve({ id: "invalid" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid RCTI ID");
    });

    it("should return 404 when RCTI not found", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest({
        manualLine: {
          jobDate: "2024-11-04",
          customer: "Test",
          truckType: "Tray",
          chargedHours: "8",
          ratePerHour: "50",
        },
      });
      const params = Promise.resolve({ id: "999" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("RCTI not found");
    });

    it("should return 400 when RCTI is not draft", async () => {
      const finalisedRcti = { ...mockDraftRcti, status: "finalised" };
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(finalisedRcti);

      const request = createMockRequest({
        manualLine: {
          jobDate: "2024-11-04",
          customer: "Test",
          truckType: "Tray",
          chargedHours: "8",
          ratePerHour: "50",
        },
      });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Can only add lines to draft RCTIs");
    });

    it("should return 400 for missing required fields", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

      const testCases = [
        {
          jobDate: "",
          customer: "Test",
          truckType: "Tray",
          chargedHours: "8",
          ratePerHour: "50",
          expectedError: "Missing required fields for manual line entry",
        },
        {
          jobDate: "2024-11-04",
          customer: "",
          truckType: "Tray",
          chargedHours: "8",
          ratePerHour: "50",
          expectedError: "Missing required fields for manual line entry",
        },
        {
          jobDate: "2024-11-04",
          customer: "Test",
          truckType: "",
          chargedHours: "8",
          ratePerHour: "50",
          expectedError: "Missing required fields for manual line entry",
        },
        {
          jobDate: "2024-11-04",
          customer: "Test",
          truckType: "Tray",
          chargedHours: "",
          ratePerHour: "50",
          expectedError: "Invalid hours or rate",
        },
        {
          jobDate: "2024-11-04",
          customer: "Test",
          truckType: "Tray",
          chargedHours: "8",
          ratePerHour: "",
          expectedError: "Invalid hours or rate",
        },
      ];

      for (const testCase of testCases) {
        const { expectedError, ...manualLineData } = testCase;
        const request = createMockRequest({ manualLine: manualLineData });
        const params = Promise.resolve({ id: "1" });
        const response = await POST(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe(expectedError);
      }
    });

    it("should return 400 for invalid hours", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

      const request = createMockRequest({
        manualLine: {
          jobDate: "2024-11-04",
          customer: "Test",
          truckType: "Tray",
          chargedHours: "invalid",
          ratePerHour: "50",
        },
      });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid hours or rate");
    });

    it("should return 400 for negative hours", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

      const request = createMockRequest({
        manualLine: {
          jobDate: "2024-11-04",
          customer: "Test",
          truckType: "Tray",
          chargedHours: "-5",
          ratePerHour: "50",
        },
      });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid hours or rate");
    });

    it("should return 400 for negative rate", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

      const request = createMockRequest({
        manualLine: {
          jobDate: "2024-11-04",
          customer: "Test",
          truckType: "Tray",
          chargedHours: "8",
          ratePerHour: "-50",
        },
      });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid hours or rate");
    });

    it("should return 400 when neither jobIds nor manualLine provided", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

      const request = createMockRequest({});
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Must provide either jobIds or manualLine");
    });
  });

  describe("POST /api/rcti/[id]/lines - Import Jobs", () => {
    const createMockRequest = (body: unknown) => {
      return new NextRequest("http://localhost:3000/api/rcti/1/lines", {
        method: "POST",
        body: JSON.stringify(body),
      });
    };

    const mockDraftRcti = {
      id: 1,
      driverId: 10,
      driverName: "John Doe",
      status: "draft",
      gstStatus: "registered",
      gstMode: "exclusive",
      subtotal: 0,
      gst: 0,
      total: 0,
      weekEnding: new Date("2024-11-10"),
      lines: [],
      driver: {
        id: 10,
        driver: "John Doe",
        breaks: 0.5,
        tray: 80,
        crane: 85,
        semi: 90,
        semiCrane: 95,
        type: "Contractor",
      },
    };

    it("should import jobs successfully", async () => {
      const mockJobs = [
        {
          id: 100,
          date: new Date("2024-11-04"),
          customer: "ABC Transport",
          truckType: "10T Crane",
          comments: "Job notes",
          chargedHours: 8,
          driverCharge: 50,
        },
        {
          id: 101,
          date: new Date("2024-11-05"),
          customer: "XYZ Logistics",
          truckType: "Tray",
          comments: "Another job",
          chargedHours: 6,
          driverCharge: 45,
        },
      ];

      (prisma.rcti.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockDraftRcti)
        .mockResolvedValueOnce(mockDraftRcti);
      (prisma.jobs.findMany as jest.Mock).mockResolvedValue(mockJobs);
      (prisma.rctiLine.create as jest.Mock)
        .mockResolvedValueOnce({
          id: 200,
          rctiId: 1,
          jobId: 100,
          amountExGst: 400,
          gstAmount: 40,
          amountIncGst: 440,
        })
        .mockResolvedValueOnce({
          id: 201,
          rctiId: 1,
          jobId: 101,
          amountExGst: 270,
          gstAmount: 27,
          amountIncGst: 297,
        });
      (prisma.rctiLine.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue([
        {
          id: 200,
          rctiId: 1,
          jobId: 100,
          amountExGst: 400,
          gstAmount: 40,
          amountIncGst: 440,
          chargedHours: 50,
          ratePerHour: 85,
          truckType: "10T Crane",
        },
        {
          id: 201,
          rctiId: 1,
          jobId: 101,
          amountExGst: 270,
          gstAmount: 27,
          amountIncGst: 297,
          chargedHours: 45,
          ratePerHour: 80,
          truckType: "Tray",
        },
      ]);
      (prisma.rcti.update as jest.Mock).mockResolvedValue(mockDraftRcti);

      const request = createMockRequest({ jobIds: [100, 101] });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("Jobs added successfully");
      expect(data.lines).toHaveLength(2);
      expect(prisma.rctiLine.create).toHaveBeenCalledTimes(2);
    });

    it("should return 400 when no valid jobs found", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.jobs.findMany as jest.Mock).mockResolvedValue([]);

      const request = createMockRequest({ jobIds: [999] });
      const params = Promise.resolve({ id: "1" });
      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No valid jobs found");
    });
  });

  describe("DELETE /api/rcti/[id]/lines/[lineId]", () => {
    const createMockRequest = () => {
      return new NextRequest("http://localhost:3000/api/rcti/1/lines/123", {
        method: "DELETE",
      });
    };

    const mockDraftRcti = {
      id: 1,
      driverId: 10,
      status: "draft",
      gstStatus: "registered",
      gstMode: "exclusive",
      weekEnding: new Date("2024-11-10"),
      driver: {
        id: 10,
        driver: "John Doe",
        breaks: 0.5,
      },
    };

    const mockLine = {
      id: 123,
      rctiId: 1,
      jobId: null,
      amountExGst: 400,
      gstAmount: 40,
      amountIncGst: 440,
    };

    it("should delete line successfully", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.rctiLine.findUnique as jest.Mock).mockResolvedValue(mockLine);
      (prisma.rctiLine.delete as jest.Mock).mockResolvedValue(mockLine);
      (prisma.rctiLine.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockDraftRcti,
        subtotal: 0,
        gst: 0,
        total: 0,
      });

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1", lineId: "123" });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Line removed successfully");
      expect(prisma.rctiLine.delete).toHaveBeenCalledWith({
        where: { id: 123 },
      });
    });

    it("should recalculate totals after deletion", async () => {
      const remainingLines = [
        { id: 124, amountExGst: 100, gstAmount: 10, amountIncGst: 110 },
        { id: 125, amountExGst: 200, gstAmount: 20, amountIncGst: 220 },
      ];

      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.rctiLine.findUnique as jest.Mock).mockResolvedValue(mockLine);
      (prisma.rctiLine.delete as jest.Mock).mockResolvedValue(mockLine);
      (prisma.rctiLine.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(remainingLines);
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockDraftRcti,
        subtotal: 300,
        gst: 30,
        total: 330,
      });

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1", lineId: "123" });
      await DELETE(request, { params });

      // recalculateBreaksAndTotals now includes deleteMany and additional queries
      expect(prisma.rcti.update).toHaveBeenCalled();
    });

    it("should return 400 for invalid RCTI ID", async () => {
      const request = createMockRequest();
      const params = Promise.resolve({ id: "invalid", lineId: "123" });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid RCTI ID or Line ID");
    });

    it("should return 400 for invalid Line ID", async () => {
      const request = createMockRequest();
      const params = Promise.resolve({ id: "1", lineId: "invalid" });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid RCTI ID or Line ID");
    });

    it("should return 404 when RCTI not found", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest();
      const params = Promise.resolve({ id: "999", lineId: "123" });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("RCTI not found");
    });

    it("should return 400 when RCTI is not draft", async () => {
      const finalisedRcti = { ...mockDraftRcti, status: "finalised" };
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(finalisedRcti);

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1", lineId: "123" });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Can only remove lines from draft RCTIs");
    });

    it("should return 404 when line not found", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.rctiLine.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1", lineId: "999" });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Line not found");
    });

    it("should return 400 when line belongs to different RCTI", async () => {
      const differentRctiLine = { ...mockLine, rctiId: 2 };
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.rctiLine.findUnique as jest.Mock).mockResolvedValue(
        differentRctiLine,
      );

      const request = createMockRequest();
      const params = Promise.resolve({ id: "1", lineId: "123" });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Line does not belong to this RCTI");
    });
  });
});
