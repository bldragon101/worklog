/**
 * @vitest-environment node
 */

const {
  mockRequireAuthFn,
  mockGetUserRoleFn,
  mockRateLimitFn,
  mockUpdateMetadataFn,
} = vi.hoisted(() => ({
  mockRequireAuthFn: vi.fn(),
  mockGetUserRoleFn: vi.fn(),
  mockRateLimitFn: vi.fn(),
  mockUpdateMetadataFn: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mockRequireAuthFn,
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: vi.fn(() => mockRateLimitFn),
  rateLimitConfigs: { general: {} },
}));

vi.mock("@/lib/permissions", () => ({
  getUserRole: mockGetUserRoleFn,
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(() => ({
    users: {
      updateUserMetadata: mockUpdateMetadataFn,
    },
  })),
}));

// Import AFTER mocks are set up
import { NextResponse } from "next/server";
import { POST } from "@/app/api/user/sync-role/route";

describe("POST /api/user/sync-role", () => {
  let mockRequest: any;

  beforeEach(() => {
    vi.clearAllMocks();

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
      expect(data.message).toBe("Role synced to Clerk metadata successfully.");
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

      expect(data.message).toBe("Role synced to Clerk metadata successfully.");
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
