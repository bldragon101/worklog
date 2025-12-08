/**
 * @jest-environment node
 */
 

// Use var instead of const to allow hoisting
 
var mockRequireAuthFn: any;
var mockGetUserRoleFn: any;
var mockRateLimitFn: any;
var mockGetUserFn: any;
var mockUpdateMetadataFn: any;
 

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
  if (!mockGetUserFn) mockGetUserFn = jest.fn();
  if (!mockUpdateMetadataFn) mockUpdateMetadataFn = jest.fn();
  return {
    clerkClient: jest.fn(() => ({
      users: {
        getUser: mockGetUserFn,
        updateUserMetadata: mockUpdateMetadataFn,
      },
    })),
  };
});

// Import AFTER mocks are set up
import { NextResponse } from "next/server";
import { GET } from "@/app/api/user/role/route";

describe("GET /api/user/role", () => {
  let mockRequest: any;

  beforeEach(() => {
    // Ensure mocks are initialised
    if (!mockRateLimitFn) mockRateLimitFn = jest.fn();
    if (!mockRequireAuthFn) mockRequireAuthFn = jest.fn();
    if (!mockGetUserRoleFn) mockGetUserRoleFn = jest.fn();
    if (!mockGetUserFn) mockGetUserFn = jest.fn();
    if (!mockUpdateMetadataFn) mockUpdateMetadataFn = jest.fn();

    jest.clearAllMocks();

    // Create a mock Request object compatible with Next.js API routes
    mockRequest = {
      method: "GET",
      url: "http://localhost:3000/api/user/role",
      headers: new Map(),
    };

    // Default setup for successful flow
    mockRateLimitFn.mockReturnValue({ headers: new Headers() });
    mockRequireAuthFn.mockResolvedValue({ userId: "user_123" });
    mockGetUserRoleFn.mockResolvedValue("user");
    mockGetUserFn.mockResolvedValue({
      publicMetadata: { role: "user" },
    });
    mockUpdateMetadataFn.mockResolvedValue(undefined);
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockRateLimitFn.mockReturnValue(rateLimitResponse);

      const response = await GET(mockRequest);

      expect(mockRateLimitFn).toHaveBeenCalledWith(mockRequest);
      expect(response.status).toBe(429);
      expect(mockRequireAuthFn).not.toHaveBeenCalled();
    });

    it("should continue if rate limit not exceeded", async () => {
      mockRateLimitFn.mockReturnValue({ headers: new Headers() });

      await GET(mockRequest);

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

      const response = await GET(mockRequest);

      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(response.status).toBe(401);
      expect(mockGetUserRoleFn).not.toHaveBeenCalled();
    });

    it("should proceed if authenticated", async () => {
      mockRequireAuthFn.mockResolvedValue({ userId: "user_123" });

      await GET(mockRequest);

      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(mockGetUserRoleFn).toHaveBeenCalled();
    });
  });

  describe("Role Fetching", () => {
    it("should fetch role from database", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");

      await GET(mockRequest);

      expect(mockGetUserRoleFn).toHaveBeenCalledWith("user_123");
    });

    it("should handle admin role", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "admin" },
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.role).toBe("admin");
    });

    it("should handle manager role", async () => {
      mockGetUserRoleFn.mockResolvedValue("manager");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "manager" },
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.role).toBe("manager");
    });

    it("should handle user role", async () => {
      mockGetUserRoleFn.mockResolvedValue("user");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "user" },
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.role).toBe("user");
    });

    it("should handle viewer role", async () => {
      mockGetUserRoleFn.mockResolvedValue("viewer");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "viewer" },
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.role).toBe("viewer");
    });
  });

  describe("Conditional Metadata Update", () => {
    it("should NOT update metadata when role matches current metadata", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "admin" },
      });

      await GET(mockRequest);

      expect(mockGetUserFn).toHaveBeenCalledWith("user_123");
      expect(mockUpdateMetadataFn).not.toHaveBeenCalled();
    });

    it("should update metadata when role differs from current metadata", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "user" },
      });

      await GET(mockRequest);

      expect(mockGetUserFn).toHaveBeenCalledWith("user_123");
      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "admin",
        },
      });
    });

    it("should update metadata when current metadata has no role", async () => {
      mockGetUserRoleFn.mockResolvedValue("manager");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: {},
      });

      await GET(mockRequest);

      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "manager",
        },
      });
    });

    it("should update metadata when publicMetadata is undefined", async () => {
      mockGetUserRoleFn.mockResolvedValue("viewer");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: undefined,
      });

      await GET(mockRequest);

      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "viewer",
        },
      });
    });

    it("should handle role upgrade (user to admin)", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "user" },
      });

      await GET(mockRequest);

      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "admin",
        },
      });
    });

    it("should handle role downgrade (admin to viewer)", async () => {
      mockGetUserRoleFn.mockResolvedValue("viewer");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "admin" },
      });

      await GET(mockRequest);

      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_123", {
        publicMetadata: {
          role: "viewer",
        },
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle errors from getUserRole gracefully", async () => {
      mockGetUserRoleFn.mockRejectedValue(new Error("Database error"));

      const response = await GET(mockRequest);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });

    it("should continue on Clerk getUser error (non-critical)", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");
      mockGetUserFn.mockRejectedValue(new Error("Clerk API error"));

      const response = await GET(mockRequest);

      // Should still return role even if metadata sync fails
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.role).toBe("admin");
      expect(data.userId).toBe("user_123");
    });

    it("should continue on updateUserMetadata error (non-critical)", async () => {
      mockGetUserRoleFn.mockResolvedValue("manager");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "user" },
      });
      mockUpdateMetadataFn.mockRejectedValue(new Error("Update failed"));

      const response = await GET(mockRequest);

      // Should still return role even if metadata sync fails
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.role).toBe("manager");
      expect(data.userId).toBe("user_123");
    });

    it("should log metadata sync errors but not fail request", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockGetUserRoleFn.mockResolvedValue("admin");
      mockGetUserFn.mockRejectedValue(new Error("Clerk API error"));

      const response = await GET(mockRequest);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error syncing Clerk metadata:",
        expect.any(Error),
      );
      expect(response.status).toBe(200);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Response Format", () => {
    it("should return role in response", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.role).toBe("admin");
    });

    it("should return userId in response", async () => {
      mockRequireAuthFn.mockResolvedValue({ userId: "user_456" });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.userId).toBe("user_456");
    });

    it("should return 200 status code on success", async () => {
      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
    });
  });

  describe("Response Headers", () => {
    it("should include rate limit headers in response", async () => {
      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set("X-RateLimit-Limit", "100");
      rateLimitHeaders.set("X-RateLimit-Remaining", "99");

      mockRateLimitFn.mockReturnValue({ headers: rateLimitHeaders });

      const response = await GET(mockRequest);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
    });
  });

  describe("Performance Optimisation", () => {
    it("should avoid unnecessary Clerk API calls when role unchanged", async () => {
      mockGetUserRoleFn.mockResolvedValue("user");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "user" },
      });

      await GET(mockRequest);

      // getUser is called to check current metadata
      expect(mockGetUserFn).toHaveBeenCalledTimes(1);
      // updateUserMetadata should NOT be called (performance optimisation)
      expect(mockUpdateMetadataFn).not.toHaveBeenCalled();
    });

    it("should only call updateUserMetadata when necessary", async () => {
      mockGetUserRoleFn.mockResolvedValue("admin");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "user" },
      });

      await GET(mockRequest);

      // Both getUser and updateUserMetadata called (role changed)
      expect(mockGetUserFn).toHaveBeenCalledTimes(1);
      expect(mockUpdateMetadataFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Integration Scenarios", () => {
    it("should complete full flow successfully when role unchanged", async () => {
      mockRequireAuthFn.mockResolvedValue({ userId: "user_789" });
      mockGetUserRoleFn.mockResolvedValue("manager");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "manager" },
      });

      const response = await GET(mockRequest);

      // Verify full flow
      expect(mockRateLimitFn).toHaveBeenCalled();
      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(mockGetUserRoleFn).toHaveBeenCalledWith("user_789");
      expect(mockGetUserFn).toHaveBeenCalledWith("user_789");
      expect(mockUpdateMetadataFn).not.toHaveBeenCalled(); // Performance optimisation

      const data = await response.json();
      expect(data.role).toBe("manager");
      expect(data.userId).toBe("user_789");
      expect(response.status).toBe(200);
    });

    it("should complete full flow successfully when role changed", async () => {
      mockRequireAuthFn.mockResolvedValue({ userId: "user_321" });
      mockGetUserRoleFn.mockResolvedValue("admin");
      mockGetUserFn.mockResolvedValue({
        publicMetadata: { role: "manager" },
      });

      const response = await GET(mockRequest);

      // Verify full flow
      expect(mockRateLimitFn).toHaveBeenCalled();
      expect(mockRequireAuthFn).toHaveBeenCalled();
      expect(mockGetUserRoleFn).toHaveBeenCalledWith("user_321");
      expect(mockGetUserFn).toHaveBeenCalledWith("user_321");
      expect(mockUpdateMetadataFn).toHaveBeenCalledWith("user_321", {
        publicMetadata: {
          role: "admin",
        },
      });

      const data = await response.json();
      expect(data.role).toBe("admin");
      expect(data.userId).toBe("user_321");
      expect(response.status).toBe(200);
    });

    it("should fail early on rate limit", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockRateLimitFn.mockReturnValue(rateLimitResponse);

      const response = await GET(mockRequest);

      expect(response.status).toBe(429);
      expect(mockRequireAuthFn).not.toHaveBeenCalled();
      expect(mockGetUserRoleFn).not.toHaveBeenCalled();
      expect(mockGetUserFn).not.toHaveBeenCalled();
      expect(mockUpdateMetadataFn).not.toHaveBeenCalled();
    });

    it("should fail early on authentication failure", async () => {
      const authResponse = NextResponse.json(
        { error: "Unauthorised" },
        { status: 401 },
      );
      mockRequireAuthFn.mockResolvedValue(authResponse);

      const response = await GET(mockRequest);

      expect(response.status).toBe(401);
      expect(mockGetUserRoleFn).not.toHaveBeenCalled();
      expect(mockGetUserFn).not.toHaveBeenCalled();
      expect(mockUpdateMetadataFn).not.toHaveBeenCalled();
    });
  });
});
