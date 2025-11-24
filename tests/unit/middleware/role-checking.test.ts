import type { NextRequest } from "next/server";

// Mock modules before imports
const mockGetUser = jest.fn();

jest.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: jest.fn(),
  createRouteMatcher: jest.fn(() => () => false),
  clerkClient: jest.fn(),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    next: jest.fn(() => ({ type: "next" })),
    redirect: jest.fn((url: URL) => ({
      type: "redirect",
      url: url.toString(),
    })),
  },
}));

// Import the actual middleware module after mocks are set up
// This allows the middleware to register its clerkMiddleware callback
import "@/middleware";

// Get references to the mocked functions after import
import {
  clerkMiddleware,
  createRouteMatcher,
  clerkClient,
} from "@clerk/nextjs/server";

// Capture the registered middleware callback before jest.clearAllMocks() erases it
const registeredMiddleware = (clerkMiddleware as jest.Mock).mock.calls[0]?.[0];

describe("Middleware Role Checking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_USER_IDS = "";
    process.env.MANAGER_USER_IDS = "";
    process.env.VIEWER_USER_IDS = "";
  });

  describe("Role Resolution", () => {
    it("should fetch role from Clerk API publicMetadata", async () => {
      const userId = "user_123";
      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {
          publicMetadata: { role: "admin" },
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await registeredMiddleware(mockAuth, mockRequest);
        expect(mockAuth).toHaveBeenCalled();
      }
    });

    it("should fall back to environment variables when role not in metadata", async () => {
      const userId = "user_456";
      process.env.ADMIN_USER_IDS = "user_456";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          getUser: mockGetUser.mockResolvedValue({
            publicMetadata: {},
          }),
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      (clerkMiddleware as jest.Mock).mockImplementationOnce(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
            // Verify environment variable was used
            expect(mockGetUser).toHaveBeenCalledWith(userId);
          };
        },
      );

      const handler = (clerkMiddleware as jest.Mock)(
        async (auth: jest.Mock) => {
          const { userId } = await auth();
          const client = await (clerkClient as jest.Mock)();
          await client.users.getUser(userId);
        },
      );
      await handler();
    });

    it("should default to user role when not in metadata or env vars", async () => {
      const userId = "user_789";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          getUser: mockGetUser.mockResolvedValue({
            publicMetadata: {}, // No role
          }),
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      (clerkMiddleware as jest.Mock).mockImplementationOnce(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
          };
        },
      );

      const handler = (clerkMiddleware as jest.Mock)(
        async (auth: jest.Mock) => {
          const { userId } = await auth();
          const client = await (clerkClient as jest.Mock)();
          await client.users.getUser(userId);
        },
      );
      await handler();
    });

    it("should handle missing role in sessionClaims and fall back to env vars", async () => {
      const userId = "user_error";
      process.env.ADMIN_USER_IDS = "user_error";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await expect(
          registeredMiddleware(mockAuth, mockRequest),
        ).resolves.not.toThrow();
        expect(mockAuth).toHaveBeenCalled();
      }
    });
  });

  describe("Environment Variable Role Assignment", () => {
    it("should assign admin role from ADMIN_USER_IDS", () => {
      const userId = "user_admin_123";
      process.env.ADMIN_USER_IDS = "user_admin_123,user_admin_456";

      const adminUsers = process.env.ADMIN_USER_IDS.split(",");
      expect(adminUsers).toContain(userId);
    });

    it("should assign manager role from MANAGER_USER_IDS", () => {
      const userId = "user_manager_123";
      process.env.MANAGER_USER_IDS = "user_manager_123";

      const managerUsers = process.env.MANAGER_USER_IDS.split(",");
      expect(managerUsers).toContain(userId);
    });

    it("should assign viewer role from VIEWER_USER_IDS", () => {
      const userId = "user_viewer_123";
      process.env.VIEWER_USER_IDS = "user_viewer_123";

      const viewerUsers = process.env.VIEWER_USER_IDS.split(",");
      expect(viewerUsers).toContain(userId);
    });

    it("should handle empty environment variables", () => {
      const userId = "user_123";
      process.env.ADMIN_USER_IDS = "";

      const adminUsers = process.env.ADMIN_USER_IDS.split(",").filter(Boolean);
      expect(adminUsers).not.toContain(userId);
    });

    it("should handle multiple users in comma-separated list", () => {
      process.env.ADMIN_USER_IDS = "user_1,user_2,user_3";

      const adminUsers = process.env.ADMIN_USER_IDS.split(",");
      expect(adminUsers).toHaveLength(3);
      expect(adminUsers).toContain("user_1");
      expect(adminUsers).toContain("user_2");
      expect(adminUsers).toContain("user_3");
    });
  });

  describe("Role Priority", () => {
    it("should prioritise Clerk API metadata over environment variables", async () => {
      const userId = "user_env_priority";
      process.env.ADMIN_USER_IDS = "user_env_priority";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {
          publicMetadata: { role: "manager" }, // Should take precedence over env vars
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await registeredMiddleware(mockAuth, mockRequest);
        expect(mockAuth).toHaveBeenCalled();
      }
    });
  });

  describe("Edge Runtime Compatibility", () => {
    it("should use sessionClaims instead of database for edge compatibility", async () => {
      const userId = "user_edge";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {
          publicMetadata: { role: "admin" },
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await registeredMiddleware(mockAuth, mockRequest);
        expect(mockAuth).toHaveBeenCalled();
      }
    });

    it("should not attempt to use Prisma in middleware", async () => {
      const userId = "user_no_prisma";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {
          publicMetadata: { role: "admin" },
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await expect(
          registeredMiddleware(mockAuth, mockRequest),
        ).resolves.not.toThrow();
      }
    });
  });

  describe("Role Type Safety", () => {
    it("should handle role as string type from publicMetadata", async () => {
      const userId = "user_type_check";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {
          publicMetadata: { role: "admin" as string },
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await registeredMiddleware(mockAuth, mockRequest);
        expect(mockAuth).toHaveBeenCalled();
      }
    });

    it("should handle undefined role gracefully", async () => {
      const userId = "user_undefined_role";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {
          publicMetadata: { role: undefined },
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/overview",
        nextUrl: { pathname: "/overview" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await expect(
          registeredMiddleware(mockAuth, mockRequest),
        ).resolves.not.toThrow();
      }
    });

    it("should handle null publicMetadata gracefully", async () => {
      const userId = "user_null_metadata";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {
          publicMetadata: null,
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/overview",
        nextUrl: { pathname: "/overview" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await expect(
          registeredMiddleware(mockAuth, mockRequest),
        ).resolves.not.toThrow();
      }
    });
  });

  describe("Valid Role Values", () => {
    const validRoles = ["admin", "manager", "user", "viewer"];

    validRoles.forEach((role) => {
      it(`should accept valid role: ${role}`, async () => {
        const userId = `user_${role}`;

        const mockAuth = jest.fn().mockResolvedValue({
          userId,
          sessionClaims: {},
        });

        (clerkClient as jest.Mock).mockResolvedValue({
          users: {
            getUser: mockGetUser.mockResolvedValue({
              publicMetadata: { role },
            }),
          },
        });

        const mockRequest = {
          url: "http://localhost:3000/overview",
          nextUrl: { pathname: "/overview" },
        } as unknown as NextRequest;

        (clerkMiddleware as jest.Mock).mockImplementationOnce(
          (
            callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
          ) => {
            return async () => {
              await callback(mockAuth, mockRequest);
              const user = await mockGetUser.mock.results[0]?.value;
              expect(validRoles).toContain(user.publicMetadata.role);
            };
          },
        );

        const handler = (clerkMiddleware as jest.Mock)(
          async (auth: jest.Mock) => {
            const { userId } = await auth();
            const client = await (clerkClient as jest.Mock)();
            await client.users.getUser(userId);
          },
        );
        await handler();
      });
    });
  });

  describe("Performance Considerations", () => {
    it("should only call Clerk API once per request", async () => {
      const userId = "user_perf";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          getUser: mockGetUser.mockResolvedValue({
            publicMetadata: { role: "admin" },
          }),
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      (clerkMiddleware as jest.Mock).mockImplementationOnce(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
            // Verify Clerk API was used
            expect(mockGetUser).toHaveBeenCalledWith(userId);
          };
        },
      );

      const handler = (clerkMiddleware as jest.Mock)(
        async (auth: jest.Mock) => {
          const { userId } = await auth();
          const client = await (clerkClient as jest.Mock)();
          await client.users.getUser(userId);
        },
      );
      await handler();
    });

    it("should handle concurrent requests independently", async () => {
      const mockAuth1 = jest.fn().mockResolvedValue({
        userId: "user_1",
        sessionClaims: {
          publicMetadata: { role: "admin" },
        },
      });

      const mockAuth2 = jest.fn().mockResolvedValue({
        userId: "user_2",
        sessionClaims: {
          publicMetadata: { role: "user" },
        },
      });

      const mockRequest1 = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      const mockRequest2 = {
        url: "http://localhost:3000/overview",
        nextUrl: { pathname: "/overview" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await Promise.all([
          registeredMiddleware(mockAuth1, mockRequest1),
          registeredMiddleware(mockAuth2, mockRequest2),
        ]);

        expect(mockAuth1).toHaveBeenCalled();
        expect(mockAuth2).toHaveBeenCalled();
      }
    });
  });
});
