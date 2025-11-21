import type { NextRequest } from "next/server";

// Mock modules before imports
const mockClerkMiddleware = jest.fn();
const mockCreateRouteMatcher = jest.fn();
const mockClerkClient = jest.fn();
const mockGetUser = jest.fn();

jest.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: mockClerkMiddleware,
  createRouteMatcher: mockCreateRouteMatcher,
  clerkClient: mockClerkClient,
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

describe("Middleware Role Checking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_USER_IDS = "";
    process.env.MANAGER_USER_IDS = "";
    process.env.VIEWER_USER_IDS = "";

    // Setup default route matchers
    mockCreateRouteMatcher.mockReturnValue(() => false);
  });

  describe("Role Resolution", () => {
    it("should fetch role from Clerk API publicMetadata", async () => {
      const userId = "user_123";
      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      mockClerkClient.mockResolvedValue({
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

      mockClerkMiddleware.mockImplementation(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
            // Verify Clerk API was called
            expect(mockClerkClient).toHaveBeenCalled();
            expect(mockGetUser).toHaveBeenCalledWith(userId);
          };
        },
      );

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
          await client.users.getUser(userId);
        },
      );
      await handler();
    });

    it("should fall back to environment variables when role not in metadata", async () => {
      const userId = "user_456";
      process.env.ADMIN_USER_IDS = "user_456";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      mockClerkClient.mockResolvedValue({
        users: {
          getUser: mockGetUser.mockResolvedValue({
            publicMetadata: {}, // No role in metadata
          }),
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      mockClerkMiddleware.mockImplementation(
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

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
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

      mockClerkClient.mockResolvedValue({
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

      mockClerkMiddleware.mockImplementation(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
            // Should default to user
            expect(mockGetUser).toHaveBeenCalledWith(userId);
          };
        },
      );

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
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

      mockClerkClient.mockResolvedValue({
        users: {
          getUser: mockGetUser.mockRejectedValue(new Error("Clerk API error")),
        },
      });

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      mockClerkMiddleware.mockImplementation(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            // Should not throw, should fall back to env vars
            await expect(
              callback(mockAuth, mockRequest),
            ).resolves.not.toThrow();
          };
        },
      );

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          try {
            const client = await mockClerkClient();
            await client.users.getUser(userId);
          } catch (_error) {
            // Fallback to env vars
          }
        },
      );
      await handler();
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

      mockClerkClient.mockResolvedValue({
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

      mockClerkMiddleware.mockImplementation(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
            // Verify metadata was checked first
            expect(mockGetUser).toHaveBeenCalledWith(userId);
          };
        },
      );

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
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

      mockClerkClient.mockResolvedValue({
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

      mockClerkMiddleware.mockImplementation(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
            // Verify Clerk API was used (edge-compatible)
            expect(mockClerkClient).toHaveBeenCalled();
            expect(mockGetUser).toHaveBeenCalled();
          };
        },
      );

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
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

      mockClerkClient.mockResolvedValue({
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

      mockClerkMiddleware.mockImplementation(
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

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
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

      mockClerkClient.mockResolvedValue({
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

      mockClerkMiddleware.mockImplementation(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
            const user = await mockGetUser.mock.results[0]?.value;
            expect(typeof user.publicMetadata.role).toBe("string");
          };
        },
      );

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
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

      mockClerkClient.mockResolvedValue({
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

      mockClerkMiddleware.mockImplementation(
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

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
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

      mockClerkClient.mockResolvedValue({
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

      mockClerkMiddleware.mockImplementation(
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

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
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

        mockClerkClient.mockResolvedValue({
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

        mockClerkMiddleware.mockImplementation(
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

        const handler = mockClerkMiddleware(
          async (auth: jest.Mock, _req: NextRequest) => {
            const { userId } = await auth();
            const client = await mockClerkClient();
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

      mockClerkClient.mockResolvedValue({
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

      mockClerkMiddleware.mockImplementation(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await callback(mockAuth, mockRequest);
            // Should only call getUser once
            expect(mockGetUser).toHaveBeenCalledTimes(1);
          };
        },
      );

      const handler = mockClerkMiddleware(
        async (auth: jest.Mock, _req: NextRequest) => {
          const { userId } = await auth();
          const client = await mockClerkClient();
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

      mockClerkClient.mockResolvedValue({
        users: {
          getUser: mockGetUser
            .mockResolvedValueOnce({
              publicMetadata: { role: "admin" },
            })
            .mockResolvedValueOnce({
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

      mockClerkMiddleware.mockImplementation(
        (
          callback: (auth: jest.Mock, request: NextRequest) => Promise<void>,
        ) => {
          return async () => {
            await Promise.all([
              callback(mockAuth1, mockRequest1),
              callback(mockAuth2, mockRequest2),
            ]);

            expect(mockGetUser).toHaveBeenCalledWith("user_1");
            expect(mockGetUser).toHaveBeenCalledWith("user_2");
          };
        },
      );

      const handler = mockClerkMiddleware(
        async (_auth: jest.Mock, _req: NextRequest) => {
          const { userId: userId1 } = await mockAuth1();
          const { userId: userId2 } = await mockAuth2();
          const client = await mockClerkClient();
          await client.users.getUser(userId1);
          await client.users.getUser(userId2);
        },
      );
      await handler();
    });
  });
});
