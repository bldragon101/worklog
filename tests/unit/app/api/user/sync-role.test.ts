import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/user/sync-role/route";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter } from "@/lib/rate-limit";
import { getUserRole } from "@/lib/permissions";
import { clerkClient } from "@clerk/nextjs/server";

// Mock dependencies
jest.mock("@/lib/auth");
jest.mock("@/lib/rate-limit");
jest.mock("@/lib/permissions");
jest.mock("@clerk/nextjs/server", () => ({
  clerkClient: jest.fn(),
}));

describe("POST /api/user/sync-role", () => {
  const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
  const mockCreateRateLimiter = createRateLimiter as jest.MockedFunction<
    typeof createRateLimiter
  >;
  const mockGetUserRole = getUserRole as jest.MockedFunction<typeof getUserRole>;
  const mockClerkClient = clerkClient as jest.MockedFunction<typeof clerkClient>;

  let mockRequest: NextRequest;
  let mockRateLimit: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      method: "POST",
      url: "http://localhost:3000/api/user/sync-role",
      headers: new Headers(),
    } as NextRequest;

    mockRateLimit = jest.fn();
    mockCreateRateLimiter.mockReturnValue(mockRateLimit);
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
      mockRateLimit.mockReturnValue(rateLimitResponse);

      const response = await POST(mockRequest);

      expect(mockRateLimit).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(429);
      expect(mockRequireAuth).not.toHaveBeenCalled();
    });

    it("should continue if rate limit not exceeded", async () => {
      mockRateLimit.mockReturnValue({ headers: new Headers() });
      mockRequireAuth.mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );

      await POST(mockRequest);

      expect(mockRateLimit).toHaveBeenCalledWith(mockRequest);
      expect(mockRequireAuth).toHaveBeenCalled();
    });
  });

  describe("Authentication", () => {
    beforeEach(() => {
      mockRateLimit.mockReturnValue({ headers: new Headers() });
    });

    it("should require authentication", async () => {
      const authResponse = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
      mockRequireAuth.mockResolvedValue(authResponse);

      const response = await POST(mockRequest);

      expect(mockRequireAuth).toHaveBeenCalled();
      expect(response.status).toBe(401);
      expect(mockGetUserRole).not.toHaveBeenCalled();
    });

    it("should proceed if authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ userId: "user_123" });
      mockGetUserRole.mockResolvedValue("user");

      const mockUpdateMetadata = jest.fn().mockResolvedValue(undefined);
      mockClerkClient.mockResolvedValue({
        users: {
          updateUserMetadata: mockUpdateMetadata,
        },
      } as any);

      await POST(mockRequest);

      expect(mockRequireAuth).toHaveBeenCalled();
      expect(mockGetUserRole).toHaveBeenCalled();
    });
  });

  describe("Role Syncing", () => {
    beforeEach(() => {
      mockRateLimit.mockReturnValue({ headers: new Headers() });
      mockRequireAuth.mockResolvedValue({ userId: "user_123" });
    });

    it("should fetch role from database and sync to Clerk metadata", async () => {
      mockGetUserRole.mockResolvedValue("admin");

      const mockUpdateMetadata = jest.fn().mockResolvedValue(undefined);
      mockClerkClient.mockResolvedValue({
        users: {
          updateUserMetadata: mockUpdateMetadata,
        },
      } as any);

      const response = await POST(mockRequest);

      expect(mockGetUserRole).toHaveBeenCalledWith("user_123");
      expect(mockClerkClient).toHaveBeenCalled();
      expect(mockUpdateMetadata).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "admin",
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("admin");
      expect(data.message).toBe("Role synced to Clerk metadata");
    });

    it("should handle manager role", async () => {
      mockGetUserRole.mockResolvedValue("manager");

      const mockUpdateMetadata = jest.fn().mockResolvedValue(undefined);
      mockClerkClient.mockResolvedValue({
        users: {
          updateUserMetadata: mockUpdateMetadata,
        },
      } as any);

      const response = await POST(mockRequest);

      expect(mockUpdateMetadata).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "manager",
        },
      });

      const data = await response.json();
      expect(data.role).toBe("manager");
    });

    it("should handle user role", async () => {
      mockGetUserRole.mockResolvedValue("user");

      const mockUpdateMetadata = jest.fn().mockResolvedValue(undefined);
      mockClerkClient.mockResolvedValue({
        users: {
          updateUserMetadata: mockUpdateMetadata,
        },
      } as any);

      const response = await POST(mockRequest);

      expect(mockUpdateMetadata).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "user",
        },
      });

      const data = await response.json();
      expect(data.role).toBe("user");
    });

    it("should handle viewer role", async () => {
      mockGetUserRole.mockResolvedValue("viewer");

      const mockUpdateMetadata = jest.fn().mockResolvedValue(undefined);
      mockClerkClient.mockResolvedValue({
        users: {
          updateUserMetadata: mockUpdateMetadata,
        },
      } as any);

      const response = await POST(mockRequest);

      expect(mockUpdateMetadata).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "viewer",
        },
      });

      const data = await response.json();
      expect(data.role).toBe("viewer");
    });
  });

  describe("Response Headers", () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue({ userId: "user_123" });
      mockGetUserRole.mockResolvedValue("admin");

      const mockUpdateMetadata = jest.fn().mockResolvedValue(undefined);
      mockClerkClient.mockResolvedValue({
        users: {
          updateUserMetadata: mockUpdateMetadata,
        },
      } as any);
    });

    it("should include rate limit headers in response", async () => {
      const rateLimitHeaders = new Headers({
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "99",
      });
      mockRateLimit.mockReturnValue({ headers: rateLimitHeaders });

      const response = await POST(mockRequest);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockRateLimit.mockReturnValue({ headers: new Headers() });
      mockRequireAuth.mockResolvedValue({ userId: "user_123" });
    });

    it("should handle errors when fetching role from database", async () => {
      mockGetUserRole.mockRejectedValue(new Error("Database error"));

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to sync user role");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error syncing user role:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle errors when updating Clerk metadata", async () => {
      mockGetUserRole.mockResolvedValue("admin");

      const mockUpdateMetadata = jest
        .fn()
        .mockRejectedValue(new Error("Clerk API error"));
      mockClerkClient.mockResolvedValue({
        users: {
          updateUserMetadata: mockUpdateMetadata,
        },
      } as any);

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to sync user role");
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should handle Clerk client initialization errors", async () => {
      mockGetUserRole.mockResolvedValue("admin");
      mockClerkClient.mockRejectedValue(new Error("Failed to initialize"));

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to sync user role");

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Success Response Format", () => {
    beforeEach(() => {
      mockRateLimit.mockReturnValue({ headers: new Headers() });
      mockRequireAuth.mockResolvedValue({ userId: "user_123" });
      mockGetUserRole.mockResolvedValue("admin");

      const mockUpdateMetadata = jest.fn().mockResolvedValue(undefined);
      mockClerkClient.mockResolvedValue({
        users: {
          updateUserMetadata: mockUpdateMetadata,
        },
      } as any);
    });

    it("should return success flag in response", async () => {
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it("should return role in response", async () => {
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.role).toBe("admin");
    });

    it("should return success message", async () => {
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.message).toBe("Role synced to Clerk metadata");
    });

    it("should return 200 status code on success", async () => {
      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });
  });

  describe("Integration Scenarios", () => {
    it("should complete full sync flow successfully", async () => {
      // Setup
      const rateLimitHeaders = new Headers({ "X-RateLimit-Remaining": "99" });
      mockRateLimit.mockReturnValue({ headers: rateLimitHeaders });
      mockRequireAuth.mockResolvedValue({ userId: "user_456" });
      mockGetUserRole.mockResolvedValue("manager");

      const mockUpdateMetadata = jest.fn().mockResolvedValue(undefined);
      mockClerkClient.mockResolvedValue({
        users: {
          updateUserMetadata: mockUpdateMetadata,
        },
      } as any);

      // Execute
      const response = await POST(mockRequest);
      const data = await response.json();

      // Verify
      expect(mockRateLimit).toHaveBeenCalled();
      expect(mockRequireAuth).toHaveBeenCalled();
      expect(mockGetUserRole).toHaveBeenCalledWith("user_456");
      expect(mockUpdateMetadata).toHaveBeenCalledWith("user_456", {
        publicMetadata: { role: "manager" },
      });
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.role).toBe("manager");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });
});
