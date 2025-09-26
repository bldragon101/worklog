import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { VersionButton } from "@/components/layout/version-button";
import type { Release } from "@/lib/changelog";

// Mock the Button component first
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

// Mock the useSidebar hook - set default state
const mockUseSidebar = jest.fn(() => ({ state: "expanded" }));
jest.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => mockUseSidebar(),
}));

// Mock the ChangelogDialog component
jest.mock("@/components/layout/changelog-dialog", () => ({
  ChangelogDialog: ({ open, onOpenChange, releases, currentVersion }: any) =>
    open ? (
      <div data-testid="changelog-dialog">
        <div>Current Version: {currentVersion}</div>
        <div>Releases Count: {releases.length}</div>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}));

describe("VersionButton", () => {
  const mockReleases: Release[] = [
    {
      version: "1.1.0",
      date: "2024-01-15",
      features: ["Feature 1", "Feature 2"],
      bugFixes: ["Bug fix 1"],
      breaking: [],
    },
    {
      version: "1.0.0",
      date: "2024-01-01",
      features: ["Initial release"],
      bugFixes: [],
      breaking: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to expanded state by default
    mockUseSidebar.mockReturnValue({ state: "expanded" });
  });

  it("should render version button with current version", () => {
    render(<VersionButton releases={mockReleases} currentVersion="1.1.0" />);

    expect(
      screen.getByRole("button", { name: /v1\.1\.0/i }),
    ).toBeInTheDocument();
  });

  it("should not render when sidebar is collapsed", () => {
    mockUseSidebar.mockReturnValue({ state: "collapsed" });

    const { container } = render(
      <VersionButton releases={mockReleases} currentVersion="1.1.0" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should open dialog when button is clicked", () => {
    render(<VersionButton releases={mockReleases} currentVersion="1.1.0" />);

    const button = screen.getByRole("button", { name: /v1\.1\.0/i });
    fireEvent.click(button);

    expect(screen.getByTestId("changelog-dialog")).toBeInTheDocument();
    expect(screen.getByText("Current Version: 1.1.0")).toBeInTheDocument();
    expect(screen.getByText("Releases Count: 2")).toBeInTheDocument();
  });

  it("should close dialog when onOpenChange is called", () => {
    render(<VersionButton releases={mockReleases} currentVersion="1.1.0" />);

    // Open dialog
    const button = screen.getByRole("button", { name: /v1\.1\.0/i });
    fireEvent.click(button);

    expect(screen.getByTestId("changelog-dialog")).toBeInTheDocument();

    // Close dialog
    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(screen.queryByTestId("changelog-dialog")).not.toBeInTheDocument();
  });

  it("should pass releases to dialog correctly", () => {
    const customReleases: Release[] = [
      {
        version: "2.0.0",
        date: "2024-02-01",
        features: ["Major feature"],
        bugFixes: [],
        breaking: ["Breaking change"],
        userNotes: {
          whatsNew: ["New capability"],
          improvements: ["Better performance"],
        },
      },
    ];

    render(<VersionButton releases={customReleases} currentVersion="2.0.0" />);

    const button = screen.getByRole("button", { name: /v2\.0\.0/i });
    fireEvent.click(button);

    expect(screen.getByText("Current Version: 2.0.0")).toBeInTheDocument();
    expect(screen.getByText("Releases Count: 1")).toBeInTheDocument();
  });

  it("should handle empty releases array", () => {
    render(<VersionButton releases={[]} currentVersion="1.0.0" />);

    const button = screen.getByRole("button", { name: /v1\.0\.0/i });
    fireEvent.click(button);

    expect(screen.getByText("Releases Count: 0")).toBeInTheDocument();
  });
});
