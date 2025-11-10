/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, waitFor } from "@testing-library/react";
import {
  usePermissions,
  PermissionsProvider,
} from "@/contexts/permissions-context";
import { useUser } from "@clerk/nextjs";
import { getRolePermissionsClient } from "@/lib/permissions-client";

// Mock dependencies
jest.mock("@clerk/nextjs", () => ({
  useUser: jest.fn(),
}));

jest.mock("@/lib/permissions-client", () => ({
  getRolePermissionsClient: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe("PermissionsContext", () => {
  const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;
  const mockGetRolePermissionsClient =
    getRolePermissionsClient as jest.MockedFunction<
      typeof getRolePermissionsClient
    >;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockGetRolePermissionsClient.mockImplementation((role) => {
      const permissions: Record<string, any[]> = {
        admin: [
          "view_jobs",
          "edit_jobs",
          "delete_jobs",
          "manage_users",
          "manage_integrations",
          "view_history",
          "manage_payroll",
          "access_settings",
        ],
        manager: ["view_jobs", "edit_jobs", "delete_jobs", "access_settings"],
        user: ["view_jobs", "edit_jobs"],
        viewer: ["view_jobs"],
      };
      return permissions[role] || [];
    });
  });

  describe("Initialization", () => {
    it("should initialize with default 'user' role and permissions", () => {
      mockUseUser.mockReturnValue({
        user: null,
        isLoaded: false,
        isSignedIn: false,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      expect(result.current.userRole).toBe("user");
      expect(result.current.permissions).toEqual(
        expect.arrayContaining(["view_jobs"]),
      );
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isManager).toBe(false);
    });

    it("should not show loading state on initial render", () => {
      mockUseUser.mockReturnValue({
        user: null,
        isLoaded: false,
        isSignedIn: false,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Role from Clerk Metadata", () => {
    it("should read role from publicMetadata when available", async () => {
      const mockUser = {
        id: "user_123",
        publicMetadata: {
          role: "admin",
        },
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe("admin");
      });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.permissions).toContain("manage_users");
      expect(mockFetch).not.toHaveBeenCalled(); // No API call needed
    });

    it("should handle manager role from metadata", async () => {
      const mockUser = {
        id: "user_456",
        publicMetadata: {
          role: "manager",
        },
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe("manager");
      });

      expect(result.current.isManager).toBe(true);
      expect(result.current.isAdmin).toBe(false);
    });

    it("should handle viewer role from metadata", async () => {
      const mockUser = {
        id: "user_789",
        publicMetadata: {
          role: "viewer",
        },
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe("viewer");
      });

      expect(result.current.canEdit).toBe(false);
      expect(result.current.canDelete).toBe(false);
    });
  });

  describe("API Fallback When Metadata Missing", () => {
    it("should fetch role from sync API when metadata is missing", async () => {
      const mockUser = {
        id: "user_123",
        publicMetadata: {},
        reload: jest.fn().mockResolvedValue(undefined),
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ role: "admin", success: true }),
      } as Response);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe("admin");
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/user/sync-role", {
        method: "POST",
      });
      expect(mockUser.reload).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it("should fall back to role API if sync fails", async () => {
      const mockUser = {
        id: "user_123",
        publicMetadata: {},
        reload: jest.fn(),
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      // Sync API fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      // Role API succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ role: "manager" }),
      } as Response);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe("manager");
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, "/api/user/sync-role", {
        method: "POST",
      });
      expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/user/role");
    });

    it("should keep default user role if all APIs fail", async () => {
      const mockUser = {
        id: "user_123",
        publicMetadata: {},
        reload: jest.fn(),
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.userRole).toBe("user"); // Default role
    });

    it("should show loading state only when fetching from API", async () => {
      const mockUser = {
        id: "user_123",
        publicMetadata: {},
        reload: jest.fn(),
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      let resolveSync: any;
      const syncPromise = new Promise((resolve) => {
        resolveSync = resolve;
      });

      mockFetch.mockReturnValue(syncPromise as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      resolveSync({
        ok: true,
        json: async () => ({ role: "admin", success: true }),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("Permission Checking", () => {
    it("should correctly check permissions for admin", async () => {
      const mockUser = {
        id: "user_123",
        publicMetadata: { role: "admin" },
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe("admin");
      });

      expect(result.current.checkPermission("manage_users")).toBe(true);
      expect(result.current.checkPermission("manage_integrations")).toBe(true);
      expect(result.current.checkPermission("manage_payroll")).toBe(true);
      expect(result.current.checkPermission("view_history")).toBe(true);
    });

    it("should correctly check permissions for manager", async () => {
      const mockUser = {
        id: "user_456",
        publicMetadata: { role: "manager" },
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe("manager");
      });

      expect(result.current.checkPermission("edit_jobs")).toBe(true);
      expect(result.current.checkPermission("delete_jobs")).toBe(true);
      expect(result.current.checkPermission("manage_users")).toBe(false);
      expect(result.current.checkPermission("manage_integrations")).toBe(false);
    });

    it("should correctly check permissions for user", async () => {
      const mockUser = {
        id: "user_789",
        publicMetadata: { role: "user" },
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe("user");
      });

      expect(result.current.checkPermission("view_jobs")).toBe(true);
      expect(result.current.checkPermission("edit_jobs")).toBe(true);
      expect(result.current.checkPermission("delete_jobs")).toBe(false);
      expect(result.current.checkPermission("manage_users")).toBe(false);
    });
  });

  describe("Role Flags", () => {
    it("should set isAdmin flag correctly", async () => {
      const mockUser = {
        id: "user_123",
        publicMetadata: { role: "admin" },
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true);
        expect(result.current.isManager).toBe(true); // Admin is also manager
      });
    });

    it("should set isManager flag correctly", async () => {
      const mockUser = {
        id: "user_456",
        publicMetadata: { role: "manager" },
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(false);
        expect(result.current.isManager).toBe(true);
      });
    });

    it("should set canEdit and canDelete flags based on permissions", async () => {
      const mockUser = {
        id: "user_789",
        publicMetadata: { role: "user" },
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.userRole).toBe("user");
      });

      expect(result.current.canEdit).toBe(true); // Has edit_jobs
      expect(result.current.canDelete).toBe(false); // No delete permissions
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      const mockUser = {
        id: "user_123",
        publicMetadata: {},
        reload: jest.fn(),
      };

      mockUseUser.mockReturnValue({
        user: mockUser,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      mockFetch.mockRejectedValue(new Error("Network error"));

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.userRole).toBe("user"); // Falls back to default
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should throw error when used outside provider", () => {
      expect(() => {
        renderHook(() => usePermissions());
      }).toThrow("usePermissions must be used within a PermissionsProvider");
    });
  });

  describe("No User (Logged Out)", () => {
    it("should keep default user role when no user is logged in", () => {
      mockUseUser.mockReturnValue({
        user: null,
        isLoaded: true,
        isSignedIn: false,
      } as any);

      const { result } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
      });

      expect(result.current.userRole).toBe("user");
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isManager).toBe(false);
    });
  });

  describe("Re-renders and Stability", () => {
    it("should not refetch when user object reference changes but data is same", async () => {
      const mockUser1 = {
        id: "user_123",
        publicMetadata: { role: "admin" },
      };

      // Set up mock before rendering to provide valid user on first render
      mockUseUser.mockReturnValue({
        user: mockUser1,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      const { rerender } = renderHook(() => usePermissions(), {
        wrapper: PermissionsProvider,
        initialProps: {
          user: mockUser1,
          isLoaded: true,
        } as any,
      });

      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalled();
      });

      // Same user, different object reference
      const mockUser2 = {
        id: "user_123",
        publicMetadata: { role: "admin" },
      };

      mockUseUser.mockReturnValue({
        user: mockUser2,
        isLoaded: true,
        isSignedIn: true,
      } as any);

      rerender();

      // Should not fetch again
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
