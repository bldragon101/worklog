import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { Release } from "@/lib/changelog";

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock sidebar context
jest.mock("@/components/ui/sidebar", () => ({
  useSidebar: jest.fn(() => ({ state: "expanded" })),
  Sidebar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar">{children}</div>
  ),
  SidebarHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-header">{children}</div>
  ),
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-footer">{children}</div>
  ),
  SidebarRail: () => <div data-testid="sidebar-rail" />,
}));

// Mock other dependencies
jest.mock("next/navigation", () => ({
  usePathname: () => "/jobs",
}));

jest.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    checkPermission: () => true,
  }),
}));

jest.mock("@/components/layout/nav-main", () => ({
  NavMain: () => <div data-testid="nav-main">Navigation</div>,
}));

jest.mock("@/components/layout/nav-user", () => ({
  NavUser: () => <div data-testid="nav-user">User Menu</div>,
}));

jest.mock("@/components/brand/logo", () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

describe("Changelog Feature Integration", () => {
  let queryClient: QueryClient;

  const renderWithProviders = (component: React.ReactElement) => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  const mockApiResponse = {
    releases: [
      {
        version: "1.1.0",
        date: "2024-01-15",
        features: [{ text: "New feature 1" }, { text: "New feature 2" }],
        bugFixes: [{ text: "Bug fix 1" }],
        breaking: [],
        userNotes: {
          whatsNew: ["User-friendly new feature"],
          improvements: ["Performance boost"],
        },
      },
      {
        version: "1.0.0",
        date: "2024-01-01",
        features: [{ text: "Initial release" }],
        bugFixes: [],
        breaking: [],
      },
    ] as Release[],
    currentVersion: "1.1.0",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should load and display version button on sidebar mount", async () => {
    renderWithProviders(<AppSidebar />);

    // Wait for API call to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/changelog");
    });

    // Version button should be displayed with current version
    await waitFor(() => {
      const versionButton = screen.getByRole("button", { name: /v1\.1\.0/i });
      expect(versionButton).toBeInTheDocument();
    });
  });

  it("should open changelog dialog when version button is clicked", async () => {
    renderWithProviders(<AppSidebar />);

    // Wait for version button to appear
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /v1\.1\.0/i }),
      ).toBeInTheDocument();
    });

    // Click version button
    const versionButton = screen.getByRole("button", { name: /v1\.1\.0/i });
    fireEvent.click(versionButton);

    // Dialog should open with release history
    await waitFor(() => {
      expect(screen.getByText("Release History")).toBeInTheDocument();
      // Use getAllByText since version appears in both button and dialog
      const v110Elements = screen.getAllByText("v1.1.0");
      expect(v110Elements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    });
  });

  it("should display user notes and technical details separately", async () => {
    renderWithProviders(<AppSidebar />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /v1\.1\.0/i }),
      ).toBeInTheDocument();
    });

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /v1\.1\.0/i }));

    // User notes should be visible
    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
      expect(screen.getByText("User-friendly new feature")).toBeInTheDocument();
      expect(screen.getByText("Improvements")).toBeInTheDocument();
      expect(screen.getByText("Performance boost")).toBeInTheDocument();
    });

    // Technical details should be behind expandable
    expect(screen.getByText("Technical Details")).toBeInTheDocument();
    expect(screen.queryByText("New feature 1")).not.toBeInTheDocument();

    // Expand technical details
    fireEvent.click(screen.getByText("Technical Details").closest("button")!);

    await waitFor(() => {
      expect(screen.getByText("New feature 1")).toBeInTheDocument();
      expect(screen.getByText("Bug fix 1")).toBeInTheDocument();
    });
  });

  it("should handle API errors gracefully", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    renderWithProviders(<AppSidebar />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/changelog");
    });

    // Should not show version button when API fails
    const versionButton = screen.queryByRole("button", {
      name: /v\d+\.\d+\.\d+/i,
    });
    expect(versionButton).not.toBeInTheDocument();

    // The sidebar should still render without the version button
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("nav-main")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("should expand/collapse versions independently", async () => {
    renderWithProviders(<AppSidebar />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /v1\.1\.0/i }),
      ).toBeInTheDocument();
    });

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /v1\.1\.0/i }));

    await waitFor(() => {
      expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    });

    // Click on v1.0.0 to expand it
    const v100Button = screen.getByText("v1.0.0").closest("button");
    fireEvent.click(v100Button!);

    // v1.0.0 content should be visible
    await waitFor(() => {
      const techButtons = screen.getAllByText("Technical Details");
      expect(techButtons).toHaveLength(2); // Both versions expanded
    });

    // Collapse v1.1.0 - get all instances and find the one in the dialog (not sidebar)
    const allV110Elements = screen.getAllByText("v1.1.0");
    const v110InDialog = allV110Elements.find(
      (el) => el.closest('[role="dialog"]') !== null,
    );
    const v110Button = v110InDialog?.closest("button");
    fireEvent.click(v110Button!);

    // Only v1.0.0 should have technical details button now
    await waitFor(() => {
      const techButtons = screen.getAllByText("Technical Details");
      expect(techButtons).toHaveLength(1);
    });
  });

  it("should show Current badge for current version", async () => {
    renderWithProviders(<AppSidebar />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /v1\.1\.0/i }),
      ).toBeInTheDocument();
    });

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /v1\.1\.0/i }));

    await waitFor(() => {
      const currentBadge = screen.getByText("Current");
      expect(currentBadge).toBeInTheDocument();

      // Should be near v1.1.0 in the dialog
      const allV110Elements = screen.getAllByText("v1.1.0");
      const v110InDialog = allV110Elements.find(
        (el) => el.closest('[role="dialog"]') !== null,
      );
      expect(v110InDialog?.parentElement?.parentElement).toContainElement(
        currentBadge,
      );
    });
  });

  it("should handle empty changelog data", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ releases: [], currentVersion: "1.0.0" }),
    });

    renderWithProviders(<AppSidebar />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /v1\.0\.0/i }),
      ).toBeInTheDocument();
    });

    // Open dialog
    fireEvent.click(screen.getByRole("button", { name: /v1\.0\.0/i }));

    await waitFor(() => {
      expect(screen.getByText("Release History")).toBeInTheDocument();
      // Should show empty state - no version text in the dialog content
      const dialog = screen.getByRole("dialog");
      const versionInDialog = within(dialog).queryByText(/^v\d+\.\d+\.\d+$/);
      expect(versionInDialog).not.toBeInTheDocument();
    });
  });
});
