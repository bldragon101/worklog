/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/rcti/[id]/route";
import { prisma } from "@/lib/prisma";

// Mock dependencies
jest.mock("@/lib/prisma", () => ({
  prisma: {
    rcti: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    rctiLine: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => {
    return jest.fn(() => ({
      headers: {
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
      },
    }));
  }),
  rateLimitConfigs: {
    general: {},
  },
}));

jest.mock("@/lib/utils/rcti-calculations", () => ({
  calculateLineAmounts: jest.fn(({ chargedHours, ratePerHour, gstStatus }) => {
    const amountExGst = chargedHours * ratePerHour;
    const gstAmount = gstStatus === "registered" ? amountExGst * 0.1 : 0;
    const amountIncGst = amountExGst + gstAmount;
    return { amountExGst, gstAmount, amountIncGst };
  }),
  calculateRctiTotals: jest.fn((lines) => {
    const subtotal = lines.reduce(
      (sum: number, line: { amountExGst: number }) => sum + line.amountExGst,
      0,
    );
    const gst = lines.reduce(
      (sum: number, line: { gstAmount: number }) => sum + line.gstAmount,
      0,
    );
    const total = lines.reduce(
      (sum: number, line: { amountIncGst: number }) => sum + line.amountIncGst,
      0,
    );
    return { subtotal, gst, total };
  }),
  toNumber: jest.fn((val) => Number(val)),
}));

describe("RCTI PATCH Validation API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (body: unknown) => {
    return new NextRequest("http://localhost:3000/api/rcti/1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  };

  const mockDraftRcti = {
    id: 1,
    driverId: 10,
    driverName: "John Doe",
    businessName: "John's Trucking",
    status: "draft",
    gstStatus: "registered",
    gstMode: "exclusive",
    subtotal: 1000,
    gst: 100,
    total: 1100,
    weekEnding: new Date("2024-11-10"),
    invoiceNumber: "RCTI-20241110",
    paidAt: null,
    lines: [],
  };

  const mockFinalisedRcti = {
    ...mockDraftRcti,
    id: 2,
    status: "finalised",
  };

  const mockPaidRcti = {
    ...mockDraftRcti,
    id: 3,
    status: "paid",
    paidAt: new Date("2024-11-12"),
  };

  describe("Status Change Validation", () => {
    describe("Rejecting direct status changes to finalised", () => {
      it("should reject status change from draft to finalised", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

        const request = createMockRequest({ status: "finalised" });
        const params = Promise.resolve({ id: "1" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain(
          "Cannot set status to 'finalised' directly",
        );
        expect(data.error).toContain("POST /api/rcti/[id]/finalize");
        expect(data.error).toContain("apply deductions");
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });

      it("should include rate limit headers in rejection response", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

        const request = createMockRequest({ status: "finalised" });
        const params = Promise.resolve({ id: "1" });
        const response = await PATCH(request, { params });

        expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      });
    });

    describe("Rejecting direct status changes to paid", () => {
      it("should reject status change from draft to paid", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

        const request = createMockRequest({ status: "paid" });
        const params = Promise.resolve({ id: "1" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Cannot set status to 'paid' directly");
        expect(data.error).toContain("POST /api/rcti/[id]/pay");
        expect(data.error).toContain("paidAt timestamp");
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });

      it("should reject status change from finalised to paid", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
          mockFinalisedRcti,
        );

        const request = createMockRequest({ status: "paid" });
        const params = Promise.resolve({ id: "2" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Cannot set status to 'paid' directly");
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });

      it("should include rate limit headers in rejection response", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

        const request = createMockRequest({ status: "paid" });
        const params = Promise.resolve({ id: "1" });
        const response = await PATCH(request, { params });

        expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      });
    });

    describe("Preventing status changes from paid", () => {
      it("should reject status change from paid to draft", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);

        const request = createMockRequest({ status: "draft" });
        const params = Promise.resolve({ id: "3" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Cannot change status of a paid RCTI");
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });

      it("should reject status change from paid to finalised", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);

        const request = createMockRequest({ status: "finalised" });
        const params = Promise.resolve({ id: "3" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        // First check catches the attempt to set to finalised
        expect(response.status).toBe(400);
        expect(data.error).toContain(
          "Cannot set status to 'finalised' directly",
        );
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });
    });
  });

  describe("GST Changes Validation", () => {
    describe("Rejecting GST changes for finalised RCTIs", () => {
      it("should reject gstStatus change for finalised RCTI", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
          mockFinalisedRcti,
        );

        const request = createMockRequest({ gstStatus: "not_registered" });
        const params = Promise.resolve({ id: "2" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain(
          "Cannot change GST status or mode for a finalised or paid RCTI",
        );
        expect(data.error).toContain("Only draft RCTIs");
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });

      it("should reject gstMode change for finalised RCTI", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
          mockFinalisedRcti,
        );

        const request = createMockRequest({ gstMode: "inclusive" });
        const params = Promise.resolve({ id: "2" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain(
          "Cannot change GST status or mode for a finalised or paid RCTI",
        );
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });

      it("should reject both gstStatus and gstMode changes for finalised RCTI", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
          mockFinalisedRcti,
        );

        const request = createMockRequest({
          gstStatus: "not_registered",
          gstMode: "inclusive",
        });
        const params = Promise.resolve({ id: "2" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Cannot change GST status or mode");
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });

      it("should include rate limit headers in rejection response", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
          mockFinalisedRcti,
        );

        const request = createMockRequest({ gstStatus: "not_registered" });
        const params = Promise.resolve({ id: "2" });
        const response = await PATCH(request, { params });

        expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      });
    });

    describe("Rejecting GST changes for paid RCTIs", () => {
      it("should reject gstStatus change for paid RCTI", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);

        const request = createMockRequest({ gstStatus: "not_registered" });
        const params = Promise.resolve({ id: "3" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain(
          "Cannot change GST status or mode for a finalised or paid RCTI",
        );
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });

      it("should reject gstMode change for paid RCTI", async () => {
        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockPaidRcti);

        const request = createMockRequest({ gstMode: "inclusive" });
        const params = Promise.resolve({ id: "3" });
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain(
          "Cannot change GST status or mode for a finalised or paid RCTI",
        );
        expect(prisma.rcti.update).not.toHaveBeenCalled();
      });
    });

    describe("Allowing GST changes for draft RCTIs", () => {
      it("should allow gstStatus change for draft RCTI and recalculate", async () => {
        const mockLines = [
          {
            id: 100,
            rctiId: 1,
            chargedHours: 8,
            ratePerHour: 50,
            amountExGst: 400,
            gstAmount: 40,
            amountIncGst: 440,
          },
        ];

        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue({
          ...mockDraftRcti,
          lines: mockLines,
        });
        (prisma.rctiLine.update as jest.Mock).mockResolvedValue(mockLines[0]);
        (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(mockLines);
        (prisma.rcti.update as jest.Mock).mockResolvedValue({
          ...mockDraftRcti,
          gstStatus: "not_registered",
          gst: 0,
          total: 1000,
        });

        const request = createMockRequest({ gstStatus: "not_registered" });
        const params = Promise.resolve({ id: "1" });
        const response = await PATCH(request, { params });

        expect(response.status).toBe(200);
        expect(prisma.rctiLine.update).toHaveBeenCalled();
        expect(prisma.rcti.update).toHaveBeenCalled();
      });

      it("should allow gstMode change for draft RCTI and recalculate", async () => {
        const mockLines = [
          {
            id: 100,
            rctiId: 1,
            chargedHours: 8,
            ratePerHour: 50,
            amountExGst: 400,
            gstAmount: 40,
            amountIncGst: 440,
          },
        ];

        (prisma.rcti.findUnique as jest.Mock).mockResolvedValue({
          ...mockDraftRcti,
          lines: mockLines,
        });
        (prisma.rctiLine.update as jest.Mock).mockResolvedValue(mockLines[0]);
        (prisma.rctiLine.findMany as jest.Mock).mockResolvedValue(mockLines);
        (prisma.rcti.update as jest.Mock).mockResolvedValue({
          ...mockDraftRcti,
          gstMode: "inclusive",
        });

        const request = createMockRequest({ gstMode: "inclusive" });
        const params = Promise.resolve({ id: "1" });
        const response = await PATCH(request, { params });

        expect(response.status).toBe(200);
        expect(prisma.rctiLine.update).toHaveBeenCalled();
        expect(prisma.rcti.update).toHaveBeenCalled();
      });
    });
  });

  describe("Combined Validation Scenarios", () => {
    it("should reject combined status and GST changes for finalised RCTI", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
        mockFinalisedRcti,
      );

      const request = createMockRequest({
        status: "draft",
        gstStatus: "not_registered",
      });
      const params = Promise.resolve({ id: "2" });
      const response = await PATCH(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      // Should catch GST change first
      expect(data.error).toContain("Cannot change GST status or mode");
      expect(prisma.rcti.update).not.toHaveBeenCalled();
    });

    it("should reject attempt to set paid status with other fields", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

      const request = createMockRequest({
        status: "paid",
        driverName: "Jane Doe",
      });
      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Cannot set status to 'paid' directly");
      expect(prisma.rcti.update).not.toHaveBeenCalled();
    });
  });

  describe("Allowed Updates", () => {
    it("should allow updating driver details without status/GST changes", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockDraftRcti,
        driverName: "Jane Doe",
      });

      const request = createMockRequest({ driverName: "Jane Doe" });
      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.rcti.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            driverName: "Jane Doe",
          }),
        }),
      );
    });

    it("should allow updating notes for finalised RCTI", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
        mockFinalisedRcti,
      );
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockFinalisedRcti,
        notes: "Updated notes",
      });

      const request = createMockRequest({ notes: "Updated notes" });
      const params = Promise.resolve({ id: "2" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.rcti.update).toHaveBeenCalled();
    });

    it("should allow updating bank details for draft RCTI", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);
      (prisma.rcti.update as jest.Mock).mockResolvedValue({
        ...mockDraftRcti,
        bankAccountName: "New Account",
        bankBsb: "123456",
        bankAccountNumber: "987654321",
      });

      const request = createMockRequest({
        bankAccountName: "New Account",
        bankBsb: "123456",
        bankAccountNumber: "987654321",
      });
      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.rcti.update).toHaveBeenCalled();
    });
  });

  describe("Australian English Compliance", () => {
    it("should use Australian English spelling in error messages", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(mockDraftRcti);

      const request = createMockRequest({ status: "finalised" });
      const params = Promise.resolve({ id: "1" });
      const response = await PATCH(request, { params });
      const data = await response.json();

      expect(data.error).toContain("finalised");
      expect(data.error).not.toContain("finalized");
    });

    it("should use Australian English in GST error messages", async () => {
      (prisma.rcti.findUnique as jest.Mock).mockResolvedValue(
        mockFinalisedRcti,
      );

      const request = createMockRequest({ gstStatus: "not_registered" });
      const params = Promise.resolve({ id: "2" });
      const response = await PATCH(request, { params });
      const data = await response.json();

      expect(data.error).toContain("finalised");
      expect(data.error).not.toContain("finalized");
    });
  });
});
