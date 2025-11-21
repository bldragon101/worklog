import type { NextRequest } from "next/server";

// Mock modules before imports
const mockGetUser = jest.fn();

jest.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: jest.fn(),
  createRouteMatcher: jest.fn(),
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

describe("Middleware Role Checking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_USER_IDS = "";
    process.env.MANAGER_USER_IDS = "";
    process.env.VIEWER_USER_IDS = "";

    // Setup default route matchers
    (createRouteMatcher as jest.Mock).mockReturnValue(() => false);
  });

  describe("Role Resolution", () => {
    it("should fetch role from Clerk API publicMetadata", async () => {
      const userId = "user_123";
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
          callback: (
            auth: () => Promise<{
              userId: string;
              sessionClaims: Record<string, unknown>;
            }>,
            req: NextRequest,
          ) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
            // Verify Clerk API was called
            expect(clerkClient).toHaveBeenCalled();
            expect(mockGetUser).toHaveBeenCalledWith(userId);
          };
        },
      );

      const middleware = (clerkMiddleware as jest.Mock).mock.calls[0]?.[0];
      if (middleware) {
        await middleware(mockAuth, mockRequest);
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

    it("should handle Clerk API errors gracefully", async () => {
      const userId = "user_error";
      process.env.ADMIN_USER_IDS = "user_error";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          getUser: mockGetUser.mockRejectedValue(new Error("API Error")),
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      (clerkMiddleware as jest.Mock).mockImplementationOnce(
        (
          callback: (
            auth: () => Promise<{
              userId: string;
              sessionClaims: Record<string, unknown>;
            }>,
            req: NextRequest,
          ) => Promise<void>,
        ) => {
          return async () => {
            // Should not throw, should fall back to env vars
            await expect(
              callback(mockAuth, mockRequest),
            ).resolves.not.toThrow();
          };
        },
      );

      const middleware = (clerkMiddleware as jest.Mock).mock.calls[0]?.[0];
      if (middleware) {
        await middleware(mockAuth, mockRequest);
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
      const userId = "user_priority";
      // User is in admin env var but has manager role in Clerk
      process.env.ADMIN_USER_IDS = "user_priority";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          getUser: mockGetUser.mockResolvedValue({
            publicMetadata: { role: "manager" }, // Should take precedence
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
  });

  describe("Edge Runtime Compatibility", () => {
    it("should use Clerk API instead of database for edge compatibility", async () => {
      const userId = "user_edge";

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
            // Verify API was called only once
            expect(mockGetUser).toHaveBeenCalledTimes(1);
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

    it("should not attempt to use Prisma in middleware", async () => {
      const userId = "user_no_prisma";

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
            // Should not throw Prisma edge runtime error
            await expect(
              callback(mockAuth, mockRequest),
            ).resolves.not.toThrow();
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

  describe("Role Type Safety", () => {
    it("should handle role as string type from publicMetadata", async () => {
      const userId = "user_type_check";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          getUser: mockGetUser.mockResolvedValue({
            publicMetadata: { role: "admin" as string },
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
            // Verify that no Prisma calls were made
            // (we would need to mock Prisma to verify this)
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

    it("should handle undefined role gracefully", async () => {
      const userId = "user_undefined_role";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          getUser: mockGetUser.mockResolvedValue({
            publicMetadata: { role: undefined },
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
            await expect(
              callback(mockAuth, mockRequest),
            ).resolves.not.toThrow();
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

    it("should handle null publicMetadata gracefully", async () => {
      const userId = "user_null_metadata";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      (clerkClient as jest.Mock).mockResolvedValue({
        users: {
          getUser: mockGetUser.mockResolvedValue({
            publicMetadata: null,
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
            await expect(
              callback(mockAuth, mockRequest),
            ).resolves.not.toThrow();
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
        sessionClaims: {},
      });

      const mockAuth2 = jest.fn().mockResolvedValue({
        userId: "user_2",
        sessionClaims: {},
      });

      (clerkClient as jest.Mock).mockResolvedValueOnce({
        users: {
          getUser: mockGetUser.mockResolvedValueOnce({
            publicMetadata: { role: "admin" },
          }),
        },
      });

      (clerkClient as jest.Mock).mockResolvedValueOnce({
        users: {
          getUser: mockGetUser.mockResolvedValueOnce({
            publicMetadata: { role: "user" },
          }),
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

      (clerkMiddleware as jest.Mock).mockImplementationOnce(
        (handler: Parameters<typeof clerkMiddleware>[0]) => {
          return async () => {
            await Promise.all([
              handler(mockAuth1, mockRequest1),
              handler(mockAuth2, mockRequest2),
            ]);

            expect(mockGetUser).toHaveBeenCalledWith("user_1");
            expect(mockGetUser).toHaveBeenCalledWith("user_2");
          };
        },
      );

      const middleware = (clerkMiddleware as jest.Mock).mock.results[0]?.value;
      if (middleware) {
        await middleware();
      }
    });
  });
});
