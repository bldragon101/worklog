/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Use var instead of const to allow hoisting
/* eslint-disable no-var */
var mockRequireAuthFn: any;
var mockGetUserRoleFn: any;
var mockRateLimitFn: any;
var mockUpdateMetadataFn: any;
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
    if (!mockGetUserRoleFn) mockGetUserRoleFn = jest.fn();
    return mockGetUserRoleFn(...args);
  });
  return { getUserRole: mock };
});

jest.mock("@clerk/nextjs/server", () => {
  if (!mockUpdateMetadataFn) mockUpdateMetadataFn = jest.fn();
  return {
    clerkClient: jest.fn(() => ({
      users: {
        updateUserMetadata: mockUpdateMetadataFn,
      },
    })),
  };
});

// Import AFTER mocks are set up
import { NextResponse } from "next/server";
import { POST } from "@/app/api/user/sync-role/route";

describe("POST /api/user/sync-role", () => {
  let mockRequest: any;

  beforeEach(() => {
    // Ensure mocks are initialized
    if (!mockRateLimitFn) mockRateLimitFn = jest.fn();
    if (!mockRequireAuthFn) mockRequireAuthFn = jest.fn();
    if (!mockGetUserRoleFn) mockGetUserRoleFn = jest.fn();
    if (!mockUpdateMetadataFn) mockUpdateMetadataFn = jest.fn();

    jest.clearAllMocks();

    // Create a mock Request object compatible with Next.js API routes
    mockRequest = {
      method: "POST",
      url: "http://localhost:3000/api/user/sync-role",
      headers: new Map(),
    };

    // Default setup for successful flow
    mockRateLimitFn.mockReturnValue({ headers: new Headers() });
    mockRequireAuthFn.mockResolvedValue({ userId: "user_123" });
    mockGetUserRoleFn.mockResolvedValue("user");
    mockUpdateMetadataFn.mockResolvedValue(undefined);
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockRateLimitFn.mockReturnValue(rateLimitResponse);

      const response = await POST(mockRequest);

      expect(mockRateLimitFn).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(429);
      expect(mockRequireAuthFn).not.toHaveBeenCalled();
    });

    it("should continue if rate limit not exceeded", async () => {
      mockRateLimitFn.mockReturnValue({ headers: new Headers() });

      await POST(mockRequest);

      expect(mockRateLimitFn).toHaveBeenCalledWith(mockRequest);
      expect(mockRequireAuthFn).toHaveBeenCalled();
    });
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      const authResponse = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
      mockRequireAuthFn.mockResolvedValue(authResponse);

      const response = await POST(mockRequest);

      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(response.status).toBe(401);
      expect(mockGetUserRoleFn).not.toHaveBeenCalled();
    });

    it("should proceed if authenticated", async () => {
      mockRequireAuthFn.mockResolvedValue({ userId: "user_123" });

      await POST(mockRequest);

      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(mockGetUserRoleFn).toHaveBeenCalled();
    });
  });

  describe("Role Syncing", () => {
    it("should fetch role from database and sync to Clerk metadata", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");

      const response = await POST(mockRequest);

      expect(mockGetUserRoleFn).toHaveBeenCalledWith("user_123");
      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "admin",
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("admin");
      expect(data.message).toBe(
        "Role synced to Clerk metadata. You must sign out and sign back in for changes to take effect.",
      );
    });

    it("should handle manager role", async () => {
      mockGetUserRoleFn.mockResolvedValue("manager");

      const response = await POST(mockRequest);

      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "manager",
        },
      });

      const data = await response.json();
      expect(data.role).toBe("manager");
    });

    it("should handle user role", async () => {
      mockGetUserRoleFn.mockResolvedValue("user");

      const response = await POST(mockRequest);

      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "user",
        },
      });

      const data = await response.json();
      expect(data.role).toBe("user");
    });

    it("should handle viewer role", async () => {
      mockGetUserRoleFn.mockResolvedValue("viewer");

      const response = await POST(mockRequest);

      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "viewer",
        },
      });

      const data = await response.json();
      expect(data.role).toBe("viewer");
    });
  });

  describe("Error Handling", () => {
    it("should handle errors from getUserRole", async () => {
      mockGetUserRoleFn.mockRejectedValue(new Error("Database error"));

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to sync user role");
    });

    it("should handle errors from Clerk client", async () => {
      mockUpdateMetadataFn.mockRejectedValue(new Error("Clerk API error"));

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to sync user role");
    });

    it("should handle errors from updateUserMetadata", async () => {
      mockUpdateMetadataFn.mockRejectedValue(new Error("Update failed"));

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to sync user role");
    });
  });

  describe("Response Headers", () => {
    it("should include rate limit headers in response", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Limit", "100");
      rateLimitHeaders.set("X-RateLimit-Remaining", "99");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });

      const response = await POST(mockRequest);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  describe("Success Response Format", () => {
    it("should return success flag in response", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it("should return role in response", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.role).toBe("admin");
    });

    it("should return success message", async () => {
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.message).toBe(
        "Role synced to Clerk metadata. You must sign out and sign back in for changes to take effect.",
      );
    });

    it("should return 200 status code on success", async () => {
      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });
  });

  describe("Integration Scenarios", () => {
    it("should complete full sync flow successfully", async () => {
      mockRequireAuthFn.mockResolvedValue({ userId: "user_456" });
      mockGetUserRoleFn.mockResolvedValue("manager");

      const response = await POST(mockRequest);

      // Verify
      expect(mockRateLimitFn).toHaveBeenCalled();
      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(mockGetUserRoleFn).toHaveBeenCalledWith("user_456");
      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_456", {
        publicMetadata: {
          role: "manager",
        },
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.role).toBe("manager");
      expect(response.status).toBe(200);
    });

    it("should fail early on rate limit", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockRateLimitFn.mockReturnValue(rateLimitResponse);

      const response = await POST(mockRequest);

      expect(response.status).toBe(429);
      expect(mockRequireAuthFn).not.toHaveBeenCalled();
      expect(mockGetUserRoleFn).not.toHaveBeenCalled();
      expect(mockUpdateMetadataFn).not.toHaveBeenCalled();
    });

    it("should fail early on authentication failure", async () => {
      const authResponse = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
      mockRequireAuthFn.mockResolvedValue(authResponse);

      const response = await POST(mockRequest);

      expect(response.status).toBe(401);
      expect(mockGetUserRoleFn).not.toHaveBeenCalled();
      expect(mockUpdateMetadataFn).not.toHaveBeenCalled();
    });
  });
});
