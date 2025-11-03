import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { usePermissions } from "@/hooks/use-permissions";

// Mock the usePermissions hook
jest.mock("@/hooks/use-permissions");

// Mock next/link
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe("ProtectedRoute", () => {
  const mockUsePermissions = usePermissions as jest.MockedFunction<
    typeof usePermissions
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should show loading spinner when permissions are loading", () => {
      mockUsePermissions.mockReturnValue({
        userRole: null,
        permissions: [],
        checkPermission: jest.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: true,
      });

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Loading permissions...")).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("should show loading icon when loading", () => {
      mockUsePermissions.mockReturnValue({
        userRole: null,
        permissions: [],
        checkPermission: jest.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: true,
      });

      const { container } = render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      // Check for the loading spinner (Loader2 icon with animate-spin class)
      const loadingIcon = container.querySelector(".animate-spin");
      expect(loadingIcon).toBeInTheDocument();
    });
  });

  describe("Role-Based Access", () => {
    it("should grant access to admin when requiredRole is admin", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: [],
        checkPermission: jest.fn(),
        isAdmin: true,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredRole="admin">
          <div>Admin Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Admin Content")).toBeInTheDocument();
      expect(screen.queryByText("Access Restricted")).not.toBeInTheDocument();
    });

    it("should deny access to non-admin when requiredRole is admin", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredRole="admin">
          <div>Admin Content</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    });

    it("should grant access to manager when requiredRole is manager", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "manager",
        permissions: [],
        checkPermission: jest.fn(),
        isAdmin: false,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredRole="manager">
          <div>Manager Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Manager Content")).toBeInTheDocument();
    });

    it("should deny access to user when requiredRole is manager", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredRole="manager">
          <div>Manager Content</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText("Manager Content")).not.toBeInTheDocument();
      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    });
  });

  describe("Permission-Based Access", () => {
    it("should grant access when user has required permission", () => {
      const mockCheckPermission = jest.fn().mockReturnValue(true);

      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: ["manage_integrations"],
        checkPermission: mockCheckPermission,
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredPermission="manage_integrations">
          <div>Integration Settings</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Integration Settings")).toBeInTheDocument();
      expect(mockCheckPermission).toHaveBeenCalledWith("manage_integrations");
    });

    it("should deny access when user lacks required permission", () => {
      const mockCheckPermission = jest.fn().mockReturnValue(false);

      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: mockCheckPermission,
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredPermission="manage_integrations">
          <div>Integration Settings</div>
        </ProtectedRoute>,
      );

      expect(
        screen.queryByText("Integration Settings"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
      expect(mockCheckPermission).toHaveBeenCalledWith("manage_integrations");
    });
  });

  describe("Custom Fallback Messages", () => {
    it("should display custom fallback title when provided", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute
          requiredRole="admin"
          fallbackTitle="Admin Access Required"
        >
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Admin Access Required")).toBeInTheDocument();
      expect(screen.queryByText("Access Restricted")).not.toBeInTheDocument();
    });

    it("should display custom fallback description when provided", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute
          requiredRole="admin"
          fallbackDescription="You need administrator permission to access this feature."
        >
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(
        screen.getByText(
          "You need administrator permission to access this feature.",
        ),
      ).toBeInTheDocument();
    });

    it("should display default message when no custom fallback provided", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredRole="admin">
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
      expect(
        screen.getByText(/You don't have permission to access this page/),
      ).toBeInTheDocument();
    });
  });

  describe("Access Denied UI", () => {
    it("should show shield icon when access is denied", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      const { container } = render(
        <ProtectedRoute requiredRole="admin">
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      // Shield icon should be present
      const shieldIcon = container.querySelector("svg");
      expect(shieldIcon).toBeInTheDocument();
    });

    it("should display current user role in access denied message", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "viewer",
        permissions: [],
        checkPermission: jest.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredRole="admin">
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText(/Your current role:/)).toBeInTheDocument();
      expect(screen.getByText(/viewer/)).toBeInTheDocument();
    });

    it("should show Back to Overview button when access is denied", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredRole="admin">
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      const backButton = screen.getByText("Back to Overview");
      expect(backButton).toBeInTheDocument();
      expect(backButton.closest("a")).toHaveAttribute("href", "/overview");
    });

    it("should show contact administrator message", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute requiredRole="admin">
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(
        screen.getByText(
          /Contact your administrator if you believe this is an error/,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("No Restrictions (No required role or permission)", () => {
    it("should grant access when no role or permission is required", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute>
          <div>Public Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Public Content")).toBeInTheDocument();
    });
  });

  describe("Combined Role and Permission Checks", () => {
    it("should deny access if role matches but permission is missing", () => {
      const mockCheckPermission = jest.fn().mockReturnValue(false);

      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: [],
        checkPermission: mockCheckPermission,
        isAdmin: true,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute
          requiredRole="admin"
          requiredPermission="manage_payroll"
        >
          <div>Payroll Content</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText("Payroll Content")).not.toBeInTheDocument();
      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    });

    it("should grant access if both role and permission match", () => {
      const mockCheckPermission = jest.fn().mockReturnValue(true);

      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_payroll"],
        checkPermission: mockCheckPermission,
        isAdmin: true,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      render(
        <ProtectedRoute
          requiredRole="admin"
          requiredPermission="manage_payroll"
        >
          <div>Payroll Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Payroll Content")).toBeInTheDocument();
    });
  });
});
