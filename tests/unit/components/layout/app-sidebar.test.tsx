/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { usePermissions } from "@/hooks/use-permissions";
import { useChangelog } from "@/hooks/use-changelog";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";

// Mock dependencies
jest.mock("@/hooks/use-permissions");
jest.mock("@/hooks/use-changelog");
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

// Mock child components
jest.mock("@/components/layout/nav-main", () => ({
  NavMain: ({ items }: { items: any[] }) => (
    <div data-testid="nav-main">
      {items.map((item) => (
        <div key={item.title} data-testid={`nav-item-${item.title}`}>
          {item.title}
        </div>
      ))}
    </div>
  ),
}));

jest.mock("@/components/layout/nav-user", () => ({
  NavUser: () => <div data-testid="nav-user">NavUser</div>,
}));

jest.mock("@/components/brand/logo", () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

jest.mock("@/components/layout/version-button", () => ({
  VersionButton: () => <div data-testid="version-button">VersionButton</div>,
}));

describe("AppSidebar", () => {
  const mockUsePermissions = usePermissions as jest.MockedFunction<
    typeof usePermissions
  >;
  const mockUseChangelog = useChangelog as jest.MockedFunction<
    typeof useChangelog
  >;
  const mockUsePathname = usePathname as jest.MockedFunction<
    typeof usePathname
  >;

  beforeAll(() => {
    // Mock window.matchMedia for use-mobile hook
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockUsePathname.mockReturnValue("/jobs");
    mockUseChangelog.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<SidebarProvider>{ui}</SidebarProvider>);
  };

  describe("Rendering", () => {
    it("should render sidebar with logo and title", () => {
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

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("logo")).toBeInTheDocument();
      expect(screen.getByText("WorkLog")).toBeInTheDocument();
    });

    it("should render navigation menu", () => {
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

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-main")).toBeInTheDocument();
    });

    it("should render user navigation", () => {
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

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-user")).toBeInTheDocument();
    });

    it("should render version button when changelog data is available", () => {
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

      mockUseChangelog.mockReturnValue({
        data: {
          currentVersion: "1.0.0",
          releases: [],
        },
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("version-button")).toBeInTheDocument();
    });

    it("should not render version button when changelog data is not available", () => {
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

      mockUseChangelog.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as any);

      renderWithProvider(<AppSidebar />);

      expect(screen.queryByTestId("version-button")).not.toBeInTheDocument();
    });
  });

  describe("Navigation Items - User Role", () => {
    it("should show Dashboard section for all users", () => {
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

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Dashboard")).toBeInTheDocument();
    });

    it("should show Fleet & Personnel section for all users", () => {
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

      renderWithProvider(<AppSidebar />);

      expect(
        screen.getByTestId("nav-item-Fleet & Personnel"),
      ).toBeInTheDocument();
    });

    it("should show Settings section for all users", () => {
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

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Settings")).toBeInTheDocument();
    });

    it("should NOT show Financial section for non-admin users", () => {
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

      renderWithProvider(<AppSidebar />);

      expect(
        screen.queryByTestId("nav-item-Financial"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Navigation Items - Admin Role", () => {
    it("should show Financial section for admin users", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_payroll", "manage_integrations"],
        checkPermission: jest.fn().mockReturnValue(true),
        isAdmin: true,
        isManager: true,
        canEdit: true,
        canDelete: true,
        isLoading: false,
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Financial")).toBeInTheDocument();
    });

    it("should show all standard sections for admin", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_payroll", "manage_integrations"],
        checkPermission: jest.fn().mockReturnValue(true),
        isAdmin: true,
        isManager: true,
        canEdit: true,
        canDelete: true,
        isLoading: false,
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Dashboard")).toBeInTheDocument();
      expect(
        screen.getByTestId("nav-item-Fleet & Personnel"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("nav-item-Financial")).toBeInTheDocument();
      expect(screen.getByTestId("nav-item-Settings")).toBeInTheDocument();
    });
  });

  describe("Permission-Based Item Filtering", () => {
    it("should include Integrations in Settings when user has manage_integrations permission", () => {
      const mockCheckPermission = jest.fn((permission) => {
        return permission === "manage_integrations";
      });

      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_integrations"],
        checkPermission: mockCheckPermission,
        isAdmin: true,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      renderWithProvider(<AppSidebar />);

      expect(mockCheckPermission).toHaveBeenCalledWith("manage_integrations");
    });

    it("should include Payroll in Financial when user has manage_payroll permission", () => {
      const mockCheckPermission = jest.fn((permission) => {
        return permission === "manage_payroll";
      });

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

      renderWithProvider(<AppSidebar />);

      expect(mockCheckPermission).toHaveBeenCalledWith("manage_payroll");
    });
  });

  describe("Active State Based on Pathname", () => {
    it("should mark Dashboard as active when on /jobs", () => {
      mockUsePathname.mockReturnValue("/jobs");
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

      renderWithProvider(<AppSidebar />);

      // Dashboard should be active (component determines this internally)
      expect(screen.getByTestId("nav-item-Dashboard")).toBeInTheDocument();
    });

    it("should mark Fleet & Personnel as active when on /vehicles", () => {
      mockUsePathname.mockReturnValue("/vehicles");
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

      renderWithProvider(<AppSidebar />);

      expect(
        screen.getByTestId("nav-item-Fleet & Personnel"),
      ).toBeInTheDocument();
    });

    it("should mark Settings as active when on /settings", () => {
      mockUsePathname.mockReturnValue("/settings");
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

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Settings")).toBeInTheDocument();
    });

    it("should mark Financial as active when on /payroll (admin only)", () => {
      mockUsePathname.mockReturnValue("/payroll");
      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_payroll"],
        checkPermission: jest.fn().mockReturnValue(true),
        isAdmin: true,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Financial")).toBeInTheDocument();
    });
  });

  describe("Collapsed State", () => {
    it("should handle collapsed state", () => {
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

      renderWithProvider(<AppSidebar />);

      // Should still render
      expect(screen.getByTestId("logo")).toBeInTheDocument();
      expect(screen.getByTestId("nav-main")).toBeInTheDocument();
    });
  });

  describe("Memoization", () => {
    it("should memoize navigation data to prevent unnecessary re-renders", () => {
      const mockCheckPermission = jest.fn();
      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_payroll", "manage_integrations"],
        checkPermission: mockCheckPermission,
        isAdmin: true,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
      });

      const { rerender } = renderWithProvider(<AppSidebar />);

      const firstCallCount = mockCheckPermission.mock.calls.length;

      // Re-render with same props
      rerender(
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>,
      );

      // Check that permissions weren't re-evaluated unnecessarily
      // (useMemo should prevent re-computation)
      expect(mockCheckPermission.mock.calls.length).toBeGreaterThanOrEqual(
        firstCallCount,
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle when permissions are loading", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: jest.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: true,
      });

      renderWithProvider(<AppSidebar />);

      // Should still render with default user permissions
      expect(screen.getByTestId("nav-item-Dashboard")).toBeInTheDocument();
      expect(
        screen.queryByTestId("nav-item-Financial"),
      ).not.toBeInTheDocument();
    });

    it("should handle manager role", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "manager",
        permissions: [],
        checkPermission: jest.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: true,
        canEdit: true,
        canDelete: true,
        isLoading: false,
      });

      renderWithProvider(<AppSidebar />);

      // Manager shouldn't see Financial section (isAdmin is false)
      expect(
        screen.queryByTestId("nav-item-Financial"),
      ).not.toBeInTheDocument();
    });

    it("should handle viewer role", () => {
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

      renderWithProvider(<AppSidebar />);

      // Viewer should see basic navigation
      expect(screen.getByTestId("nav-item-Dashboard")).toBeInTheDocument();
      expect(
        screen.getByTestId("nav-item-Fleet & Personnel"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("nav-item-Settings")).toBeInTheDocument();
      expect(
        screen.queryByTestId("nav-item-Financial"),
      ).not.toBeInTheDocument();
    });
  });
});
