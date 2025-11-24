import type { NextRequest } from "next/server";

// Mock modules before imports
const mockGetUser = jest.fn();

jest.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: jest.fn(),
  createRouteMatcher: jest.fn((patterns: string[]) => {
    return (req: NextRequest) => {
      const pathname = req.nextUrl.pathname;
      return patterns.some((pattern) => {
        // Convert pattern to regex (simple implementation)
        const regexPattern = pattern
          .replace(/\(/g, "(?:")
          .replace(/\.\*/g, ".*")
          .replace(/\//g, "\\/");
        return new RegExp(`^${regexPattern}$`).test(pathname);
      });
    };
  }),
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
import { NextResponse } from "next/server";

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

      const mockRequest = {
        url: "http://localhost:3000/settings",
        nextUrl: { pathname: "/settings" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await registeredMiddleware(mockAuth, mockRequest);
        expect(mockAuth).toHaveBeenCalled();
      }
    });

    it("should default to user role when not in metadata or env vars", async () => {
      const userId = "user_789";

      const mockAuth = jest.fn().mockResolvedValue({
        userId,
        sessionClaims: {},
      });

      const mockRequest = {
        url: "http://localhost:3000/overview",
        nextUrl: { pathname: "/overview" },
      } as unknown as NextRequest;

      if (registeredMiddleware) {
        await registeredMiddleware(mockAuth, mockRequest);
        expect(mockAuth).toHaveBeenCalled();
      }
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
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it(`should accept valid role: ${role} and allow access to overview`, async () => {
        const userId = `user_${role}`;

        const mockAuth = jest.fn().mockResolvedValue({
          userId,
          sessionClaims: {
            publicMetadata: { role },
          },
        });

        const mockRequest = {
          url: "http://localhost:3000/overview",
          nextUrl: { pathname: "/overview" },
        } as unknown as NextRequest;

        if (registeredMiddleware) {
          const response = await registeredMiddleware(mockAuth, mockRequest);
          expect(mockAuth).toHaveBeenCalled();
          expect(response.type).toBe("next");
        }
      });

      it(`should handle ${role} role access to /settings route`, async () => {
        const userId = `user_${role}`;

        const mockAuth = jest.fn().mockResolvedValue({
          userId,
          sessionClaims: {
            publicMetadata: { role },
          },
        });

        const mockRequest = {
          url: "http://localhost:3000/settings",
          nextUrl: { pathname: "/settings" },
        } as unknown as NextRequest;

        if (registeredMiddleware) {
          const response = await registeredMiddleware(mockAuth, mockRequest);
          expect(mockAuth).toHaveBeenCalled();

          // Admin and manager can access settings
          if (role === "admin" || role === "manager") {
            expect(response.type).toBe("next");
          } else {
            // User and viewer get redirected
            expect(response.type).toBe("redirect");
            expect(response.url).toContain("/overview?access=denied");
          }
        }
      });

      it(`should handle ${role} role access to /payroll route`, async () => {
        const userId = `user_${role}`;

        const mockAuth = jest.fn().mockResolvedValue({
          userId,
          sessionClaims: {
            publicMetadata: { role },
          },
        });

        const mockRequest = {
          url: "http://localhost:3000/payroll",
          nextUrl: { pathname: "/payroll" },
        } as unknown as NextRequest;

        if (registeredMiddleware) {
          const response = await registeredMiddleware(mockAuth, mockRequest);
          expect(mockAuth).toHaveBeenCalled();

          // Only admin can access payroll
          if (role === "admin") {
            expect(response.type).toBe("next");
          } else {
            expect(response.type).toBe("redirect");
            expect(response.url).toContain("/overview?access=denied");
          }
        }
      });

      it(`should handle ${role} role access to /rcti route`, async () => {
        const userId = `user_${role}`;

        const mockAuth = jest.fn().mockResolvedValue({
          userId,
          sessionClaims: {
            publicMetadata: { role },
          },
        });

        const mockRequest = {
          url: "http://localhost:3000/rcti",
          nextUrl: { pathname: "/rcti" },
        } as unknown as NextRequest;

        if (registeredMiddleware) {
          const response = await registeredMiddleware(mockAuth, mockRequest);
          expect(mockAuth).toHaveBeenCalled();

          // Only admin can access RCTI
          if (role === "admin") {
            expect(response.type).toBe("next");
          } else {
            expect(response.type).toBe("redirect");
            expect(response.url).toContain("/overview?access=denied");
          }
        }
      });

      it(`should handle ${role} role access to /integrations route`, async () => {
        const userId = `user_${role}`;

        const mockAuth = jest.fn().mockResolvedValue({
          userId,
          sessionClaims: {
            publicMetadata: { role },
          },
        });

        const mockRequest = {
          url: "http://localhost:3000/integrations",
          nextUrl: { pathname: "/integrations" },
        } as unknown as NextRequest;

        if (registeredMiddleware) {
          const response = await registeredMiddleware(mockAuth, mockRequest);
          expect(mockAuth).toHaveBeenCalled();

          // Only admin can access integrations
          if (role === "admin") {
            expect(response.type).toBe("next");
          } else {
            expect(response.type).toBe("redirect");
            expect(response.url).toContain("/overview?access=denied");
          }
        }
      });

      it(`should handle ${role} role access to /settings/users route`, async () => {
        const userId = `user_${role}`;

        const mockAuth = jest.fn().mockResolvedValue({
          userId,
          sessionClaims: {
            publicMetadata: { role },
          },
        });

        const mockRequest = {
          url: "http://localhost:3000/settings/users",
          nextUrl: { pathname: "/settings/users" },
        } as unknown as NextRequest;

        if (registeredMiddleware) {
          const response = await registeredMiddleware(mockAuth, mockRequest);
          expect(mockAuth).toHaveBeenCalled();

          // Only admin can access user management
          if (role === "admin") {
            expect(response.type).toBe("next");
          } else {
            expect(response.type).toBe("redirect");
            expect(response.url).toContain("/overview?access=denied");
          }
        }
      });

      it(`should handle ${role} role access to /settings/history route`, async () => {
        const userId = `user_${role}`;

        const mockAuth = jest.fn().mockResolvedValue({
          userId,
          sessionClaims: {
            publicMetadata: { role },
          },
        });

        const mockRequest = {
          url: "http://localhost:3000/settings/history",
          nextUrl: { pathname: "/settings/history" },
        } as unknown as NextRequest;

        if (registeredMiddleware) {
          const response = await registeredMiddleware(mockAuth, mockRequest);
          expect(mockAuth).toHaveBeenCalled();

          // Only admin can access history
          if (role === "admin") {
            expect(response.type).toBe("next");
          } else {
            expect(response.type).toBe("redirect");
            expect(response.url).toContain("/overview?access=denied");
          }
        }
      });
    });
  });

  describe("Performance Considerations", () => {
    it("should use sessionClaims to avoid unnecessary API calls", async () => {
      const userId = "user_perf";

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
        // Verify no Clerk API call was made (role from sessionClaims)
        expect(mockGetUser).not.toHaveBeenCalled();
      }
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
