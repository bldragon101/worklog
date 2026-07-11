/**
 * @vitest-environment node
 */

import { NextRequest, NextResponse } from "next/server";

// Apply mocks
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  checkPermission: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(() => ({
    users: {
      getUserList: vi.fn(),
      createUser: vi.fn(),
    },
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: vi.fn(() => vi.fn(() => ({ headers: {} }))),
  rateLimitConfigs: { general: {} },
}));

// Mock zod
vi.mock("zod", () => ({
  z: {
    object: vi.fn(() => ({
      parse: vi.fn((data) => data),
    })),
    string: vi.fn(() => ({
      email: vi.fn(() => ({ optional: vi.fn() })),
      optional: vi.fn(),
    })),
    enum: vi.fn(() => ({ default: vi.fn() })),
  },
}));

// Import after mocks
import { GET, POST } from "@/app/api/users/route";
import { requireAuth } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";

const mockUser = {
  id: "user_123",
  email: "test@example.com",
  firstName: "John",
  lastName: "Doe",
  role: "user",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Users API Routes", () => {
  beforeEach(() => {
    // Clear all mocks
    (requireAuth as vi.Mock).mockClear();
    (checkPermission as vi.Mock).mockClear();
    (prisma.user.findMany as vi.Mock).mockClear();
    (prisma.user.create as vi.Mock).mockClear();
    (clerkClient as vi.Mock).mockClear();

    // Set default mocks
    (requireAuth as vi.Mock).mockResolvedValue({ userId: "admin_123" });
    (checkPermission as vi.Mock).mockResolvedValue(true);
  });

  describe("GET /api/users", () => {
    it("returns 401 when not authenticated", async () => {
      (requireAuth as vi.Mock).mockResolvedValue(
        NextResponse.json({}, { status: 401 }),
      );

      const request = new NextRequest("http://localhost:3000/api/users");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("returns 403 when permission denied", async () => {
      (checkPermission as vi.Mock).mockResolvedValue(false);

      const request = new NextRequest("http://localhost:3000/api/users");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe(
        "Forbidden - User management permission required",
      );
    });

    it("returns users list when authorized", async () => {
      (prisma.user.findMany as vi.Mock).mockResolvedValue([mockUser]);
      (clerkClient as vi.Mock).mockResolvedValue({
        users: {
          getUserList: vi.fn().mockResolvedValue({ data: [] }),
        },
      });

      const request = new NextRequest("http://localhost:3000/api/users");
      const response = await GET(request);
      const data = await response.json();

      if (response.status !== 200) {
        console.error("Response error:", data);
      }

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(prisma.user.findMany as vi.Mock).toHaveBeenCalled();
    });
  });

  describe("POST /api/users", () => {
    const validUserData = {
      email: "newuser@example.com",
      firstName: "New",
      lastName: "User",
      role: "user",
      sendInvitation: true,
    };

    it("creates user successfully", async () => {
      const mockClerkUser = {
        id: "user_456",
        imageUrl: "https://example.com/avatar.jpg",
      };

      (clerkClient as vi.Mock).mockResolvedValue({
        users: {
          createUser: vi.fn().mockResolvedValue(mockClerkUser),
        },
      });
      (prisma.user.create as vi.Mock).mockResolvedValue({
        ...mockUser,
        id: "user_456",
      });

      const request = new NextRequest("http://localhost:3000/api/users", {
        method: "POST",
        body: JSON.stringify(validUserData),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user).toBeDefined();
      expect(data.message).toContain("User created successfully");
    });

    it("handles Clerk errors gracefully", async () => {
      // Mock console.error to prevent test output noise
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const clerkError = new Error("Email already exists");
      (clerkError as Error & { errors: Array<{ message: string }> }).errors = [
        { message: "Email already exists" },
      ];

      (clerkClient as vi.Mock).mockResolvedValue({
        users: {
          createUser: vi.fn().mockRejectedValue(clerkError),
        },
      });

      const request = new NextRequest("http://localhost:3000/api/users", {
        method: "POST",
        body: JSON.stringify(validUserData),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Failed to create user in Clerk");

      // Restore console.error
      consoleSpy.mockRestore();
    });
  });
});
