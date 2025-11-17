/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Use var instead of const to allow hoisting
/* eslint-disable no-var */
var mockRequireAuthFn: any;
var mockCheckPermissionFn: any;
var mockRateLimitFn: any;
var mockPrismaFindUniqueFn: any;
var mockPrismaDeleteFn: any;
var mockPrismaDeleteManyFn: any;
var mockPrismaFindManyFn: any;
var mockPrismaCreateFn: any;
var mockPrismaUpdateFn: any;
var mockPrismaTransactionFn: any;
/* eslint-enable no-var */

// Mock all dependencies BEFORE importing the route
jest.mock("@/lib/auth", () => {
  const mock = jest.fn((...args: any[]) => {
    if (!mockRequireAuthFn) mockRequireAuthFn = jest.fn();
    return mockRequireAuthFn(...args);
  });
  return { requireAuth: mock };
});

jest.mock("@/lib/rate-limit", () => {
  const creator = jest.fn(() => {
    if (!mockRateLimitFn) mockRateLimitFn = jest.fn();
    return mockRateLimitFn;
  });
  return {
    createRateLimiter: creator,
    rateLimitConfigs: { general: {} },
  };
});

jest.mock("@/lib/permissions", () => {
  const mock = jest.fn((...args: any[]) => {
    if (!mockCheckPermissionFn) mockCheckPermissionFn = jest.fn();
    return mockCheckPermissionFn(...args);
  });
  return { checkPermission: mock };
});

jest.mock("@/lib/prisma", () => {
  if (!mockPrismaFindUniqueFn) mockPrismaFindUniqueFn = jest.fn();
  if (!mockPrismaDeleteFn) mockPrismaDeleteFn = jest.fn();
  if (!mockPrismaDeleteManyFn) mockPrismaDeleteManyFn = jest.fn();
  if (!mockPrismaFindManyFn) mockPrismaFindManyFn = jest.fn();
  if (!mockPrismaCreateFn) mockPrismaCreateFn = jest.fn();
  if (!mockPrismaUpdateFn) mockPrismaUpdateFn = jest.fn();
  if (!mockPrismaTransactionFn) mockPrismaTransactionFn = jest.fn();

  return {
    prisma: {
      rcti: {
        findUnique: mockPrismaFindUniqueFn,
        update: mockPrismaUpdateFn,
      },
      rctiLine: {
        findUnique: mockPrismaFindUniqueFn,
        delete: mockPrismaDeleteFn,
        deleteMany: mockPrismaDeleteManyFn,
        findMany: mockPrismaFindManyFn,
        create: mockPrismaCreateFn,
      },
      $transaction: mockPrismaTransactionFn,
    },
  };
});

jest.mock("@/lib/utils/rcti-calculations", () => {
  const actualModule = jest.requireActual("@/lib/utils/rcti-calculations");
  return {
    ...actualModule,
    calculateLunchBreakLines: jest.fn(() => []),
    toNumber: jest.fn((val: any) => {
      if (typeof val === "number") return val;
      if (val?.toNumber) return val.toNumber();
      return parseFloat(val) || 0;
    }),
  };
});

// Import AFTER mocks are set up
import { NextResponse } from "next/server";
import { DELETE } from "@/app/api/rcti/[id]/lines/[lineId]/route";

describe("DELETE /api/rcti/[id]/lines/[lineId]", () => {
  let mockRequest: any;
  let mockParams: any;

  beforeEach(() => {
    // Ensure mocks are initialised
    if (!mockRateLimitFn) mockRateLimitFn = jest.fn();
    if (!mockRequireAuthFn) mockRequireAuthFn = jest.fn();
    if (!mockCheckPermissionFn) mockCheckPermissionFn = jest.fn();
    if (!mockPrismaFindUniqueFn) mockPrismaFindUniqueFn = jest.fn();
    if (!mockPrismaDeleteFn) mockPrismaDeleteFn = jest.fn();
    if (!mockPrismaDeleteManyFn) mockPrismaDeleteManyFn = jest.fn();
    if (!mockPrismaFindManyFn) mockPrismaFindManyFn = jest.fn();
    if (!mockPrismaCreateFn) mockPrismaCreateFn = jest.fn();
    if (!mockPrismaUpdateFn) mockPrismaUpdateFn = jest.fn();
    if (!mockPrismaTransactionFn) mockPrismaTransactionFn = jest.fn();

    jest.clearAllMocks();

    // Create a mock Request object
    mockRequest = {
      method: "DELETE",
      url: "http://localhost:3000/api/rcti/1/lines/100",
      headers: new Map(),
    };

    // Mock params
    mockParams = Promise.resolve({ id: "1", lineId: "100" });

    // Default setup for successful flow
    mockRateLimitFn.mockReturnValue({ headers: new Headers() });
    mockRequireAuthFn.mockResolvedValue({ userId: "user_123" });
    mockCheckPermissionFn.mockResolvedValue(true);

    // Mock transaction to execute callback immediately
    mockPrismaTransactionFn.mockImplementation(async (callback: any) => {
      const mockTx = {
        rcti: {
          findUnique: mockPrismaFindUniqueFn,
          update: mockPrismaUpdateFn,
        },
        rctiLine: {
          delete: mockPrismaDeleteFn,
          deleteMany: mockPrismaDeleteManyFn,
          findMany: mockPrismaFindManyFn,
          create: mockPrismaCreateFn,
        },
      };
      return await callback(mockTx);
    });

    // Default RCTI mock
    mockPrismaFindUniqueFn.mockResolvedValue({
      id: 1,
      status: "draft",
      weekEnding: new Date("2025-01-10"),
      gstStatus: "registered",
      gstMode: "exclusive",
      driver: { breaks: 0.5 },
    });

    mockPrismaFindManyFn.mockResolvedValue([
      {
        id: 101,
        rctiId: 1,
        jobId: 1,
        customer: "Customer A",
        truckType: "Tray",
        chargedHours: 8,
        ratePerHour: 50,
        amountExGst: 400,
        gstAmount: 40,
        amountIncGst: 440,
      },
    ]);

    mockPrismaDeleteFn.mockResolvedValue({ id: 100 });
    mockPrismaDeleteManyFn.mockResolvedValue({ count: 0 });
    mockPrismaUpdateFn.mockResolvedValue({ id: 1 });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockRateLimitFn.mockReturnValue(rateLimitResponse);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(mockRateLimitFn).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(429);
      expect(mockRequireAuthFn).not.toHaveBeenCalled();
    });

    it("should continue if rate limit not exceeded", async () => {
      mockRateLimitFn.mockReturnValue({ headers: new Headers() });

      // Mock line to exist
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      await DELETE(mockRequest, { params: mockParams });

      expect(mockRateLimitFn).toHaveBeenCalledWith(mockRequest);
      expect(mockRequireAuthFn).toHaveBeenCalled();
    });
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      const authResponse = NextResponse.json(
        { error: "Unauthorised" },
        { status: 401 },
      );
      mockRequireAuthFn.mockResolvedValue(authResponse);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(response.status).toBe(401);
      expect(mockCheckPermissionFn).not.toHaveBeenCalled();
    });

    it("should proceed if authenticated", async () => {
      mockRequireAuthFn.mockResolvedValue({ userId: "user_123" });

      // Mock line to exist
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      await DELETE(mockRequest, { params: mockParams });

      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(mockCheckPermissionFn).toHaveBeenCalled();
    });
  });

  describe("Permission Checks", () => {
    it("should check manage_payroll permission", async () => {
      mockCheckPermissionFn.mockResolvedValue(true);

      // Mock line to exist
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      await DELETE(mockRequest, { params: mockParams });

      expect(mockCheckPermissionFn).toHaveBeenCalledWith("manage_payroll");
    });

    it("should reject request without manage_payroll permission", async () => {
      mockCheckPermissionFn.mockResolvedValue(false);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Insufficient permissions to modify RCTIs");
      expect(mockPrismaFindUniqueFn).not.toHaveBeenCalled();
    });

    it("should include rate-limit headers when permission denied", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Limit", "100");
      rateLimitHeaders.set("X-RateLimit-Remaining", "50");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });
      mockCheckPermissionFn.mockResolvedValue(false);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(403);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("50");
    });

    it("should allow admin to delete lines", async () => {
      mockCheckPermissionFn.mockResolvedValue(true);

      // Mock line to exist
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
    });

    it("should allow manager to delete lines", async () => {
      mockCheckPermissionFn.mockResolvedValue(true);

      // Mock line to exist
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
    });

    it("should deny viewer access", async () => {
      mockCheckPermissionFn.mockResolvedValue(false);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(403);
    });

    it("should deny user access", async () => {
      mockCheckPermissionFn.mockResolvedValue(false);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(403);
    });
  });

  describe("Input Validation", () => {
    it("should validate RCTI ID is a number", async () => {
      const invalidParams = Promise.resolve({ id: "invalid", lineId: "100" });

      const response = await DELETE(mockRequest, { params: invalidParams });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid RCTI ID or Line ID");
    });

    it("should validate Line ID is a number", async () => {
      const invalidParams = Promise.resolve({ id: "1", lineId: "invalid" });

      const response = await DELETE(mockRequest, { params: invalidParams });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid RCTI ID or Line ID");
    });

    it("should reject negative RCTI ID", async () => {
      const invalidParams = Promise.resolve({ id: "-1", lineId: "100" });

      const response = await DELETE(mockRequest, { params: invalidParams });

      expect(response.status).toBe(400);
    });

    it("should reject negative Line ID", async () => {
      const invalidParams = Promise.resolve({ id: "1", lineId: "-100" });

      const response = await DELETE(mockRequest, { params: invalidParams });

      expect(response.status).toBe(400);
    });

    it("should include rate-limit headers on validation error", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Limit", "100");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });

      const invalidParams = Promise.resolve({ id: "invalid", lineId: "100" });
      const response = await DELETE(mockRequest, { params: invalidParams });

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
    });
  });

  describe("RCTI Status Validation", () => {
    it("should allow deletion from draft RCTI", async () => {
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
    });

    it("should reject deletion from finalised RCTI", async () => {
      mockPrismaFindUniqueFn.mockResolvedValueOnce({
        id: 1,
        status: "finalised",
      });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Can only remove lines from draft RCTIs");
    });

    it("should reject deletion from paid RCTI", async () => {
      mockPrismaFindUniqueFn.mockResolvedValueOnce({
        id: 1,
        status: "paid",
      });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Can only remove lines from draft RCTIs");
    });

    it("should include rate-limit headers when status check fails", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Remaining", "99");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });
      mockPrismaFindUniqueFn.mockResolvedValueOnce({
        id: 1,
        status: "finalised",
      });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  describe("RCTI Existence Validation", () => {
    it("should return 404 if RCTI not found", async () => {
      mockPrismaFindUniqueFn.mockResolvedValueOnce(null);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("RCTI not found");
    });

    it("should include rate-limit headers when RCTI not found", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Limit", "100");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });
      mockPrismaFindUniqueFn.mockResolvedValueOnce(null);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
    });
  });

  describe("Line Existence Validation", () => {
    it("should return 404 if line not found", async () => {
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce(null);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Line not found");
    });

    it("should include rate-limit headers when line not found", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Remaining", "98");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce(null);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.headers.get("X-RateLimit-Remaining")).toBe("98");
    });
  });

  describe("Line Ownership Validation", () => {
    it("should reject line that belongs to different RCTI", async () => {
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 999, // Different RCTI
        });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Line does not belong to this RCTI");
    });

    it("should allow deletion of line that belongs to specified RCTI", async () => {
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1, // Correct RCTI
        });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
    });

    it("should include rate-limit headers on ownership validation failure", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Limit", "100");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 999,
        });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
    });
  });

  describe("Line Deletion and Recalculation", () => {
    it("should delete the line in a transaction", async () => {
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      await DELETE(mockRequest, { params: mockParams });

      expect(mockPrismaTransactionFn).toHaveBeenCalled();
      expect(mockPrismaDeleteFn).toHaveBeenCalledWith({
        where: { id: 100 },
      });
    });

    it("should recalculate breaks after deletion", async () => {
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      await DELETE(mockRequest, { params: mockParams });

      expect(mockPrismaDeleteManyFn).toHaveBeenCalledWith({
        where: {
          rctiId: 1,
          customer: "Break Deduction",
        },
      });
    });

    it("should recalculate RCTI totals after deletion", async () => {
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      await DELETE(mockRequest, { params: mockParams });

      expect(mockPrismaUpdateFn).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          subtotal: expect.any(Number),
          gst: expect.any(Number),
          total: expect.any(Number),
        }),
      });
    });

    it("should return success message on successful deletion", async () => {
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe("Line removed successfully");
    });

    it("should include rate-limit headers in success response", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Limit", "100");
      rateLimitHeaders.set("X-RateLimit-Remaining", "99");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      mockPrismaFindUniqueFn.mockRejectedValue(new Error("Database error"));

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to remove line");
    });

    it("should handle transaction errors", async () => {
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      mockPrismaTransactionFn.mockRejectedValue(
        new Error("Transaction failed"),
      );

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to remove line");
    });

    it("should include rate-limit headers in error responses", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Limit", "100");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });
      mockPrismaFindUniqueFn.mockRejectedValue(new Error("Database error"));

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
    });

    it("should log errors to console", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockPrismaFindUniqueFn.mockRejectedValue(new Error("Database error"));

      await DELETE(mockRequest, { params: mockParams });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error removing line:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Integration Scenarios", () => {
    it("should complete full deletion flow successfully", async () => {
      mockRequireAuthFn.mockResolvedValue({ userId: "user_456" });
      mockCheckPermissionFn.mockResolvedValue(true);
      mockPrismaFindUniqueFn
        .mockResolvedValueOnce({
          id: 1,
          status: "draft",
          weekEnding: new Date("2025-01-10"),
          gstStatus: "registered",
          gstMode: "exclusive",
          driver: { breaks: 0.5 },
        })
        .mockResolvedValueOnce({
          id: 100,
          rctiId: 1,
        });

      const response = await DELETE(mockRequest, { params: mockParams });

      // Verify full flow
      expect(mockRateLimitFn).toHaveBeenCalled();
      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(mockCheckPermissionFn).toHaveBeenCalledWith("manage_payroll");
      expect(mockPrismaTransactionFn).toHaveBeenCalled();
      expect(mockPrismaDeleteFn).toHaveBeenCalled();

      const data = await response.json();
      expect(data.message).toBe("Line removed successfully");
      expect(response.status).toBe(200);
    });

    it("should fail early on rate limit", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockRateLimitFn.mockReturnValue(rateLimitResponse);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(429);
      expect(mockRequireAuthFn).not.toHaveBeenCalled();
      expect(mockCheckPermissionFn).not.toHaveBeenCalled();
      expect(mockPrismaFindUniqueFn).not.toHaveBeenCalled();
    });

    it("should fail early on authentication failure", async () => {
      const authResponse = NextResponse.json(
        { error: "Unauthorised" },
        { status: 401 },
      );
      mockRequireAuthFn.mockResolvedValue(authResponse);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(401);
      expect(mockCheckPermissionFn).not.toHaveBeenCalled();
      expect(mockPrismaFindUniqueFn).not.toHaveBeenCalled();
    });

    it("should fail early on permission denial", async () => {
      mockCheckPermissionFn.mockResolvedValue(false);

      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(403);
      expect(mockPrismaFindUniqueFn).not.toHaveBeenCalled();
    });
  });
});
