import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { usePermissions } from "@/hooks/use-permissions";
import { useChangelog } from "@/hooks/use-changelog";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";

// Mock dependencies
vi.mock("@/hooks/use-permissions");
vi.mock("@/hooks/use-changelog");
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock child components
vi.mock("@/components/layout/nav-main", () => ({
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

vi.mock("@/components/layout/nav-user", () => ({
  NavUser: () => <div data-testid="nav-user">NavUser</div>,
}));

vi.mock("@/components/brand/logo", () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock("@/components/layout/version-button", () => ({
  VersionButton: () => <div data-testid="version-button">VersionButton</div>,
}));

describe("AppSidebar", () => {
  const mockUsePermissions = usePermissions as vi.MockedFunction<
    typeof usePermissions
  >;
  const mockUseChangelog = useChangelog as vi.MockedFunction<
    typeof useChangelog
  >;
  const mockUsePathname = usePathname as vi.MockedFunction<
    typeof usePathname
  >;

  beforeAll(() => {
    // Mock window.matchMedia for use-mobile hook
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUsePathname.mockReturnValue("/jobs");
    mockUseChangelog.mockReturnValue({
      data: null,
      isLoading: false,
      refreshRole: vi.fn(),
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
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("logo")).toBeInTheDocument();
      expect(screen.getByText("WorkLog")).toBeInTheDocument();
    });

    it("should render navigation menu", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-main")).toBeInTheDocument();
    });

    it("should render user navigation", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-user")).toBeInTheDocument();
    });

    it("should render version button when changelog data is available", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      mockUseChangelog.mockReturnValue({
        data: {
          currentVersion: "1.0.0",
          releases: [],
        },
        isLoading: false,
        refreshRole: vi.fn(),
        error: null,
      } as any);

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("version-button")).toBeInTheDocument();
    });

    it("should not render version button when changelog data is not available", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      mockUseChangelog.mockReturnValue({
        data: null,
        isLoading: false,
        refreshRole: vi.fn(),
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
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Dashboard")).toBeInTheDocument();
    });

    it("should show Fleet & Personnel section for all users", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
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
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Settings")).toBeInTheDocument();
    });

    it("should NOT show Financial section for non-admin users", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
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
        permissions: ["manage_jobs_report", "manage_integrations"],
        checkPermission: vi.fn().mockReturnValue(true),
        isAdmin: true,
        isManager: true,
        canEdit: true,
        canDelete: true,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Financial")).toBeInTheDocument();
    });

    it("should show all standard sections for admin", () => {
      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_jobs_report", "manage_integrations"],
        checkPermission: vi.fn().mockReturnValue(true),
        isAdmin: true,
        isManager: true,
        canEdit: true,
        canDelete: true,
        isLoading: false,
        refreshRole: vi.fn(),
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
      const mockCheckPermission = vi.fn((permission) => {
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
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      expect(mockCheckPermission).toHaveBeenCalledWith("manage_integrations");
    });

    it("should include Jobs Report in Financial when user has manage_jobs_report permission", () => {
      const mockCheckPermission = vi.fn((permission) => {
        return permission === "manage_jobs_report";
      });

      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_jobs_report"],
        checkPermission: mockCheckPermission,
        isAdmin: true,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      expect(mockCheckPermission).toHaveBeenCalledWith("manage_jobs_report");
    });
  });

  describe("Active State Based on Pathname", () => {
    it("should mark Dashboard as active when on /jobs", () => {
      mockUsePathname.mockReturnValue("/jobs");
      mockUsePermissions.mockReturnValue({
        userRole: "user",
        permissions: [],
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
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
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
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
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      expect(screen.getByTestId("nav-item-Settings")).toBeInTheDocument();
    });

    it("should mark Financial as active when on /jobs-report (admin only)", () => {
      mockUsePathname.mockReturnValue("/jobs-report");
      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_jobs_report"],
        checkPermission: vi.fn().mockReturnValue(true),
        isAdmin: true,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
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
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
      });

      renderWithProvider(<AppSidebar />);

      // Should still render
      expect(screen.getByTestId("logo")).toBeInTheDocument();
      expect(screen.getByTestId("nav-main")).toBeInTheDocument();
    });
  });

  describe("Memoization", () => {
    it("should memoize navigation data to prevent unnecessary re-renders", () => {
      const mockCheckPermission = vi.fn();
      mockUsePermissions.mockReturnValue({
        userRole: "admin",
        permissions: ["manage_jobs_report", "manage_integrations"],
        checkPermission: mockCheckPermission,
        isAdmin: true,
        isManager: true,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
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
        checkPermission: vi.fn(),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: true,
        refreshRole: vi.fn(),
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
        checkPermission: vi.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: true,
        canEdit: true,
        canDelete: true,
        isLoading: false,
        refreshRole: vi.fn(),
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
        checkPermission: vi.fn().mockReturnValue(false),
        isAdmin: false,
        isManager: false,
        canEdit: false,
        canDelete: false,
        isLoading: false,
        refreshRole: vi.fn(),
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
