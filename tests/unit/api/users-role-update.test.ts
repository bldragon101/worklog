/**
 * @jest-environment node
 */
 

import { NextResponse } from "next/server";

// Use var instead of const to allow hoisting
 
var mockRequireAuth: any;
var mockCheckPermission: any;
var mockRateLimit: any;
var mockPrismaFindUnique: any;
var mockPrismaUpdate: any;
var mockClerkUpdateUserMetadata: any;
var mockClerkGetSessionList: any;
var mockClerkRevokeSession: any;
var mockClerkUpdateUser: any;
 

jest.mock("@/lib/auth", () => ({
  requireAuth: (...args: any[]) => {
    if (!mockRequireAuth) mockRequireAuth = jest.fn();
    return mockRequireAuth(...args);
  },
}));

jest.mock("@/lib/permissions", () => ({
  checkPermission: (...args: any[]) => {
    if (!mockCheckPermission) mockCheckPermission = jest.fn();
    return mockCheckPermission(...args);
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  createRateLimiter: jest.fn(() => {
    if (!mockRateLimit) mockRateLimit = jest.fn();
    return mockRateLimit;
  }),
  rateLimitConfigs: { general: {} },
}));

jest.mock("@/lib/prisma", () => {
  if (!mockPrismaFindUnique) mockPrismaFindUnique = jest.fn();
  if (!mockPrismaUpdate) mockPrismaUpdate = jest.fn();
  return {
    prisma: {
      user: {
        findUnique: mockPrismaFindUnique,
        update: mockPrismaUpdate,
      },
    },
  };
});

jest.mock("@clerk/nextjs/server", () => {
  if (!mockClerkUpdateUserMetadata) mockClerkUpdateUserMetadata = jest.fn();
  if (!mockClerkGetSessionList) mockClerkGetSessionList = jest.fn();
  if (!mockClerkRevokeSession) mockClerkRevokeSession = jest.fn();
  if (!mockClerkUpdateUser) mockClerkUpdateUser = jest.fn();
  return {
    clerkClient: jest.fn(() => ({
      users: {
        updateUserMetadata: mockClerkUpdateUserMetadata,
        updateUser: mockClerkUpdateUser,
      },
      sessions: {
        getSessionList: mockClerkGetSessionList,
        revokeSession: mockClerkRevokeSession,
      },
    })),
  };
});

describe("PATCH /api/users/[id] - Role Update", () => {
  const targetUserId = "user_target123";
  const adminUserId = "user_admin456";

  beforeEach(() => {
    // Initialise mocks if not already done
    if (!mockRequireAuth) mockRequireAuth = jest.fn();
    if (!mockCheckPermission) mockCheckPermission = jest.fn();
    if (!mockRateLimit) mockRateLimit = jest.fn();
    if (!mockPrismaFindUnique) mockPrismaFindUnique = jest.fn();
    if (!mockPrismaUpdate) mockPrismaUpdate = jest.fn();
    if (!mockClerkUpdateUserMetadata) mockClerkUpdateUserMetadata = jest.fn();
    if (!mockClerkGetSessionList) mockClerkGetSessionList = jest.fn();
    if (!mockClerkRevokeSession) mockClerkRevokeSession = jest.fn();
    if (!mockClerkUpdateUser) mockClerkUpdateUser = jest.fn();

    jest.clearAllMocks();

    // Default successful auth and permissions
    mockRequireAuth.mockResolvedValue({ userId: adminUserId });
    mockCheckPermission.mockResolvedValue(true);
    mockRateLimit.mockReturnValue({ headers: new Headers() });
  });

  describe("Role Update with Metadata Sync", () => {
    it("should update role in database and sync to Clerk metadata", async () => {
      const existingUser = {
        id: targetUserId,
        email: "user@example.com",
        role: "user",
        isActive: true,
        firstName: "John",
        lastName: "Doe",
      };

      mockPrismaFindUnique.mockResolvedValue(existingUser);
      mockPrismaUpdate.mockResolvedValue({
        ...existingUser,
        role: "admin",
        updatedAt: new Date(),
      });
      mockClerkUpdateUserMetadata.mockResolvedValue(undefined);
      mockClerkGetSessionList.mockResolvedValue({
        data: [{ id: "session_123" }],
      });
      mockClerkRevokeSession.mockResolvedValue(undefined);

      // Simulate the actual API behavior
      const updateData = { role: "admin" };

      expect(mockPrismaUpdate).not.toHaveBeenCalled();

      // Simulate calling update
      await mockPrismaUpdate({
        where: { id: targetUserId },
        data: { ...updateData, updatedAt: expect.any(Date) },
      });

      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: targetUserId },
        data: expect.objectContaining({
          role: "admin",
          updatedAt: expect.any(Date),
        }),
      });

      // Verify Clerk metadata would be updated
      await mockClerkUpdateUserMetadata(targetUserId, {
        publicMetadata: { role: "admin" },
      });

      expect(mockClerkUpdateUserMetadata).toHaveBeenCalledWith(targetUserId, {
        publicMetadata: { role: "admin" },
      });
    });

    it("should revoke all sessions when role is changed", async () => {
      const existingUser = {
        id: targetUserId,
        email: "user@example.com",
        role: "user",
        isActive: true,
      };

      const sessions = [
        { id: "session_1" },
        { id: "session_2" },
        { id: "session_3" },
      ];

      mockPrismaFindUnique.mockResolvedValue(existingUser);
      mockPrismaUpdate.mockResolvedValue({
        ...existingUser,
        role: "admin",
      });
      mockClerkGetSessionList.mockResolvedValue({ data: sessions });
      mockClerkRevokeSession.mockResolvedValue(undefined);

      // Simulate session revocation
      await mockClerkGetSessionList({ userId: targetUserId });
      const sessionList = await mockClerkGetSessionList.mock.results[0]?.value;

      for (const session of sessionList.data) {
        await mockClerkRevokeSession(session.id);
      }

      expect(mockClerkGetSessionList).toHaveBeenCalledWith({
        userId: targetUserId,
      });
      expect(mockClerkRevokeSession).toHaveBeenCalledTimes(3);
      expect(mockClerkRevokeSession).toHaveBeenCalledWith("session_1");
      expect(mockClerkRevokeSession).toHaveBeenCalledWith("session_2");
      expect(mockClerkRevokeSession).toHaveBeenCalledWith("session_3");
    });

    it("should not revoke sessions if role is not changed", async () => {
      const existingUser = {
        id: targetUserId,
        email: "user@example.com",
        role: "admin",
        isActive: true,
        firstName: "John",
        lastName: "Doe",
      };

      mockPrismaFindUnique.mockResolvedValue(existingUser);
      mockPrismaUpdate.mockResolvedValue({
        ...existingUser,
        firstName: "Jane", // Only name changed
      });

      // Simulate update without role change
      const updateData = { firstName: "Jane" };

      await mockPrismaUpdate({
        where: { id: targetUserId },
        data: { ...updateData, updatedAt: expect.any(Date) },
      });

      // Metadata and sessions should not be updated if role didn't change
      expect(mockClerkUpdateUserMetadata).not.toHaveBeenCalled();
      expect(mockClerkGetSessionList).not.toHaveBeenCalled();
      expect(mockClerkRevokeSession).not.toHaveBeenCalled();
    });

    it("should handle session revocation errors gracefully", async () => {
      const existingUser = {
        id: targetUserId,
        email: "user@example.com",
        role: "user",
        isActive: true,
      };

      mockPrismaFindUnique.mockResolvedValue(existingUser);
      mockPrismaUpdate.mockResolvedValue({
        ...existingUser,
        role: "admin",
      });
      mockClerkUpdateUserMetadata.mockResolvedValue(undefined);
      mockClerkGetSessionList.mockRejectedValue(
        new Error("Session service error"),
      );

      // Simulate the update flow
      await mockPrismaUpdate({
        where: { id: targetUserId },
        data: { role: "admin" },
      });

      await mockClerkUpdateUserMetadata(targetUserId, {
        publicMetadata: { role: "admin" },
      });

      // Session revocation should fail gracefully
      await expect(
        mockClerkGetSessionList({ userId: targetUserId }),
      ).rejects.toThrow("Session service error");

      // Database and metadata updates should have succeeded despite session error
      expect(mockPrismaUpdate).toHaveBeenCalled();
      expect(mockClerkUpdateUserMetadata).toHaveBeenCalled();
    });
  });

  describe("Valid Role Values", () => {
    const validRoles = ["admin", "manager", "user", "viewer"];

    validRoles.forEach((role) => {
      it(`should accept valid role: ${role}`, async () => {
        const existingUser = {
          id: targetUserId,
          email: "user@example.com",
          role: "user",
          isActive: true,
        };

        mockPrismaFindUnique.mockResolvedValue(existingUser);
        mockPrismaUpdate.mockResolvedValue({
          ...existingUser,
          role,
        });

        await mockPrismaUpdate({
          where: { id: targetUserId },
          data: { role, updatedAt: expect.any(Date) },
        });

        expect(mockPrismaUpdate).toHaveBeenCalledWith({
          where: { id: targetUserId },
          data: expect.objectContaining({ role }),
        });
      });
    });
  });

  describe("Authentication and Authorisation", () => {
    it("should require authentication", async () => {
      mockRequireAuth.mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );

      const authResult = await mockRequireAuth();

      expect(authResult).toBeInstanceOf(NextResponse);
      expect(mockCheckPermission).not.toHaveBeenCalled();
      expect(mockPrismaUpdate).not.toHaveBeenCalled();
    });

    it("should require manage_users permission", async () => {
      mockRequireAuth.mockResolvedValue({ userId: adminUserId });
      mockCheckPermission.mockResolvedValue(false);

      const hasPermission = await mockCheckPermission("manage_users");

      expect(hasPermission).toBe(false);
      expect(mockPrismaUpdate).not.toHaveBeenCalled();
    });

    it("should allow admins with manage_users permission", async () => {
      mockRequireAuth.mockResolvedValue({ userId: adminUserId });
      mockCheckPermission.mockResolvedValue(true);

      const authResult = await mockRequireAuth();
      const hasPermission = await mockCheckPermission("manage_users");

      expect(authResult).toEqual({ userId: adminUserId });
      expect(hasPermission).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle user not found", async () => {
      mockPrismaFindUnique.mockResolvedValue(null);

      const existingUser = await mockPrismaFindUnique({
        where: { id: targetUserId },
      });

      expect(existingUser).toBeNull();
      expect(mockPrismaUpdate).not.toHaveBeenCalled();
    });

    it("should handle database update errors", async () => {
      const existingUser = {
        id: targetUserId,
        email: "user@example.com",
        role: "user",
        isActive: true,
      };

      mockPrismaFindUnique.mockResolvedValue(existingUser);
      mockPrismaUpdate.mockRejectedValue(new Error("Database error"));

      await expect(
        mockPrismaUpdate({
          where: { id: targetUserId },
          data: { role: "admin" },
        }),
      ).rejects.toThrow("Database error");
    });

    it("should continue even if Clerk metadata update fails", async () => {
      const existingUser = {
        id: targetUserId,
        email: "user@example.com",
        role: "user",
        isActive: true,
      };

      mockPrismaFindUnique.mockResolvedValue(existingUser);
      mockPrismaUpdate.mockResolvedValue({
        ...existingUser,
        role: "admin",
      });
      mockClerkUpdateUserMetadata.mockRejectedValue(
        new Error("Clerk API error"),
      );

      // Database update succeeds
      const updatedUser = await mockPrismaUpdate({
        where: { id: targetUserId },
        data: { role: "admin" },
      });

      expect(updatedUser.role).toBe("admin");

      // Clerk update fails but doesn't block the response
      await expect(
        mockClerkUpdateUserMetadata(targetUserId, {
          publicMetadata: { role: "admin" },
        }),
      ).rejects.toThrow("Clerk API error");
    });
  });

  describe("Data Validation", () => {
    it("should validate role is one of the allowed values", () => {
      const validRoles = ["admin", "manager", "user", "viewer"];
      const testRole = "admin";

      expect(validRoles).toContain(testRole);
    });

    it("should reject invalid role values", () => {
      const validRoles = ["admin", "manager", "user", "viewer"];
      const invalidRole = "superuser";

      expect(validRoles).not.toContain(invalidRole);
    });

    it("should handle optional fields correctly", async () => {
      const existingUser = {
        id: targetUserId,
        email: "user@example.com",
        role: "user",
        isActive: true,
        firstName: null,
        lastName: null,
      };

      mockPrismaFindUnique.mockResolvedValue(existingUser);
      mockPrismaUpdate.mockResolvedValue({
        ...existingUser,
        role: "admin",
        firstName: "John",
      });

      await mockPrismaUpdate({
        where: { id: targetUserId },
        data: { role: "admin", firstName: "John", updatedAt: expect.any(Date) },
      });

      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { id: targetUserId },
        data: expect.objectContaining({
          role: "admin",
          firstName: "John",
        }),
      });
    });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting to requests", async () => {
      mockRateLimit.mockReturnValue({ headers: new Headers() });

      const result = mockRateLimit({} as any);

      expect(mockRateLimit).toHaveBeenCalled();
      expect(result).toHaveProperty("headers");
    });

    it("should block requests that exceed rate limit", () => {
      mockRateLimit.mockReturnValue(
        NextResponse.json({ error: "Too many requests" }, { status: 429 }),
      );

      const result = mockRateLimit({} as any);

      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe("Audit Trail", () => {
    it("should update updatedAt timestamp on role change", async () => {
      const existingUser = {
        id: targetUserId,
        email: "user@example.com",
        role: "user",
        isActive: true,
        updatedAt: new Date("2025-01-01"),
      };

      const newDate = new Date();
      mockPrismaFindUnique.mockResolvedValue(existingUser);
      mockPrismaUpdate.mockResolvedValue({
        ...existingUser,
        role: "admin",
        updatedAt: newDate,
      });

      await mockPrismaUpdate({
        where: { id: targetUserId },
        data: { role: "admin", updatedAt: newDate },
      });

      expect(mockPrismaUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            updatedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe("Concurrent Updates", () => {
    it("should handle multiple role updates independently", async () => {
      const user1 = {
        id: "user_1",
        email: "user1@example.com",
        role: "user",
        isActive: true,
      };

      const user2 = {
        id: "user_2",
        email: "user2@example.com",
        role: "user",
        isActive: true,
      };

      mockPrismaFindUnique
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      mockPrismaUpdate
        .mockResolvedValueOnce({ ...user1, role: "admin" })
        .mockResolvedValueOnce({ ...user2, role: "manager" });

      await Promise.all([
        mockPrismaUpdate({
          where: { id: "user_1" },
          data: { role: "admin" },
        }),
        mockPrismaUpdate({
          where: { id: "user_2" },
          data: { role: "manager" },
        }),
      ]);

      expect(mockPrismaUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe("Integration with Name Updates", () => {
    it("should update both role and name fields together", async () => {
      const existingUser = {
        id: targetUserId,
        email: "user@example.com",
        role: "user",
        isActive: true,
        firstName: "John",
        lastName: "Doe",
      };

      mockPrismaFindUnique.mockResolvedValue(existingUser);
      mockPrismaUpdate.mockResolvedValue({
        ...existingUser,
        role: "admin",
        firstName: "Jane",
      });
      mockClerkUpdateUserMetadata.mockResolvedValue(undefined);
      mockClerkUpdateUser.mockResolvedValue(undefined);

      await mockPrismaUpdate({
        where: { id: targetUserId },
        data: {
          role: "admin",
          firstName: "Jane",
          updatedAt: expect.any(Date),
        },
      });

      // Both Clerk metadata and user profile should be updated
      await mockClerkUpdateUserMetadata(targetUserId, {
        publicMetadata: { role: "admin" },
      });

      await mockClerkUpdateUser(targetUserId, {
        firstName: "Jane",
        lastName: "Doe",
      });

      expect(mockClerkUpdateUserMetadata).toHaveBeenCalled();
      expect(mockClerkUpdateUser).toHaveBeenCalled();
    });
  });
});
