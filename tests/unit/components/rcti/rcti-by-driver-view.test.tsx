import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RctiByDriverView } from "@/components/rcti/rcti-by-driver-view";
import type { Driver, Rcti } from "@/lib/types";

// Mock useToast hook
const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock fetch
global.fetch = jest.fn();

describe("RctiByDriverView", () => {
  const mockOnNavigateToRcti = jest.fn();

  const mockDrivers: Driver[] = [
    {
      id: 1,
      driver: "John Contractor",
      truck: "ABC123",
      tray: 50,
      crane: null,
      semi: null,
      semiCrane: null,
      breaks: 0.5,
      type: "Contractor",
      tolls: true,
      fuelLevy: 10,
      businessName: "John's Transport",
      address: "123 Main St",
      abn: "12345678901",
      gstStatus: "registered",
      gstMode: "exclusive",
      bankAccountName: "John Contractor",
      bankBsb: "123-456",
      bankAccountNumber: "12345678",
      isArchived: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      driver: "Jane Subcontractor",
      truck: "XYZ789",
      tray: 60,
      crane: null,
      semi: null,
      semiCrane: null,
      breaks: 0.5,
      type: "Subcontractor",
      tolls: false,
      fuelLevy: null,
      businessName: "Jane's Haulage",
      address: "456 Other St",
      abn: "98765432109",
      gstStatus: "not_registered",
      gstMode: "exclusive",
      bankAccountName: null,
      bankBsb: null,
      bankAccountNumber: null,
      isArchived: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: 3,
      driver: "Bob Employee",
      truck: "DEF456",
      tray: 55,
      crane: null,
      semi: null,
      semiCrane: null,
      breaks: 0.5,
      type: "Employee",
      tolls: false,
      fuelLevy: null,
      businessName: null,
      address: null,
      abn: null,
      gstStatus: "not_registered",
      gstMode: "exclusive",
      bankAccountName: null,
      bankBsb: null,
      bankAccountNumber: null,
      isArchived: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ];

  const mockRctis: Rcti[] = [
    {
      id: 1,
      driverId: 1,
      driverName: "John Contractor",
      businessName: "John's Transport",
      driverAddress: "123 Main St",
      driverAbn: "12345678901",
      gstStatus: "registered",
      gstMode: "exclusive",
      bankAccountName: "John Contractor",
      bankBsb: "123-456",
      bankAccountNumber: "12345678",
      weekEnding: "2024-12-15T00:00:00.000Z",
      invoiceNumber: "RCTI-2024-001",
      subtotal: 1000,
      gst: 100,
      total: 1100,
      status: "paid",
      notes: null,
      paidAt: "2024-12-20T00:00:00.000Z",
      revertedToDraftAt: null,
      revertedToDraftReason: null,
      createdAt: "2024-12-10T00:00:00.000Z",
      updatedAt: "2024-12-20T00:00:00.000Z",
      lines: [],
    },
    {
      id: 2,
      driverId: 1,
      driverName: "John Contractor",
      businessName: "John's Transport",
      driverAddress: "123 Main St",
      driverAbn: "12345678901",
      gstStatus: "registered",
      gstMode: "exclusive",
      bankAccountName: "John Contractor",
      bankBsb: "123-456",
      bankAccountNumber: "12345678",
      weekEnding: "2024-12-08T00:00:00.000Z",
      invoiceNumber: "RCTI-2024-002",
      subtotal: 1500,
      gst: 150,
      total: 1650,
      status: "finalised",
      notes: null,
      paidAt: null,
      revertedToDraftAt: null,
      revertedToDraftReason: null,
      createdAt: "2024-12-03T00:00:00.000Z",
      updatedAt: "2024-12-05T00:00:00.000Z",
      lines: [],
    },
    {
      id: 3,
      driverId: 1,
      driverName: "John Contractor",
      businessName: "John's Transport",
      driverAddress: "123 Main St",
      driverAbn: "12345678901",
      gstStatus: "registered",
      gstMode: "exclusive",
      bankAccountName: "John Contractor",
      bankBsb: "123-456",
      bankAccountNumber: "12345678",
      weekEnding: "2023-06-15T00:00:00.000Z",
      invoiceNumber: "RCTI-2023-001",
      subtotal: 800,
      gst: 80,
      total: 880,
      status: "paid",
      notes: null,
      paidAt: "2023-06-20T00:00:00.000Z",
      revertedToDraftAt: null,
      revertedToDraftReason: null,
      createdAt: "2023-06-10T00:00:00.000Z",
      updatedAt: "2023-06-20T00:00:00.000Z",
      lines: [],
    },
    {
      id: 4,
      driverId: 1,
      driverName: "John Contractor",
      businessName: "John's Transport",
      driverAddress: "123 Main St",
      driverAbn: "12345678901",
      gstStatus: "registered",
      gstMode: "exclusive",
      bankAccountName: "John Contractor",
      bankBsb: "123-456",
      bankAccountNumber: "12345678",
      weekEnding: "2024-12-22T00:00:00.000Z",
      invoiceNumber: "RCTI-2024-003",
      subtotal: 500,
      gst: 50,
      total: 550,
      status: "draft",
      notes: null,
      paidAt: null,
      revertedToDraftAt: null,
      revertedToDraftReason: null,
      createdAt: "2024-12-18T00:00:00.000Z",
      updatedAt: "2024-12-18T00:00:00.000Z",
      lines: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe("Rendering", () => {
    it("should render driver selection dropdown", () => {
      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      expect(screen.getByText("Select Driver")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should show placeholder message when no driver is selected", () => {
      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      expect(
        screen.getByText("Select a driver to view their RCTIs"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Choose a contractor or subcontractor from the dropdown above",
        ),
      ).toBeInTheDocument();
    });

    it("should only show contractors and subcontractors in dropdown", async () => {
      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Open the dropdown
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      // Wait for dropdown content
      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
        expect(screen.getByText("Jane Subcontractor")).toBeInTheDocument();
      });

      // Employee should not be visible
      expect(screen.queryByText("Bob Employee")).not.toBeInTheDocument();
    });
  });

  describe("Driver Selection", () => {
    it("should fetch RCTIs when driver is selected", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRctis),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Open dropdown and select driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/rcti?driverId=1",
          expect.objectContaining({ cache: "no-store" }),
        );
      });
    });

    it("should show driver business info when driver is selected", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      await waitFor(() => {
        expect(screen.getByText("John's Transport")).toBeInTheDocument();
        expect(screen.getByText("12345678901")).toBeInTheDocument();
      });
    });

    it("should show error toast when fetch fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Error",
            description: "Failed to fetch RCTIs for this driver",
            variant: "destructive",
          }),
        );
      });
    });
  });

  describe("Summary Statistics", () => {
    it("should display correct summary statistics", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRctis),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Wait for data to load
      await waitFor(() => {
        // Total RCTIs: 4
        expect(screen.getByText("4")).toBeInTheDocument();
      });

      // Check for specific amounts using getAllByText since amounts may appear multiple times
      // Total paid: 1100 + 880 = 1980
      const paidAmounts = screen.getAllByText("$1980.00");
      expect(paidAmounts.length).toBeGreaterThanOrEqual(1);
      // Outstanding (finalised): 1650 - appears in summary and in RCTI row
      const outstandingAmounts = screen.getAllByText("$1650.00");
      expect(outstandingAmounts.length).toBeGreaterThanOrEqual(1);
      // Total amount: 1100 + 1650 + 880 + 550 = 4180
      const totalAmounts = screen.getAllByText("$4180.00");
      expect(totalAmounts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Year Grouping", () => {
    it("should group RCTIs by year", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRctis),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Wait for years to appear
      await waitFor(() => {
        expect(screen.getByText("2024")).toBeInTheDocument();
        expect(screen.getByText("2023")).toBeInTheDocument();
      });
    });

    it("should expand most recent year by default", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRctis),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Wait for data to load - 2024 should be expanded (most recent)
      await waitFor(() => {
        // 2024 RCTIs should be visible
        expect(screen.getByText("RCTI-2024-001")).toBeInTheDocument();
        expect(screen.getByText("RCTI-2024-002")).toBeInTheDocument();
        expect(screen.getByText("RCTI-2024-003")).toBeInTheDocument();
      });
    });

    it("should toggle year expansion when clicked", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRctis),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Wait for 2023 year header
      await waitFor(() => {
        expect(screen.getByText("2023")).toBeInTheDocument();
      });

      // 2023 RCTI should not be visible initially (2024 is expanded by default)
      expect(screen.queryByText("RCTI-2023-001")).not.toBeInTheDocument();

      // Click on 2023 to expand
      fireEvent.click(screen.getByText("2023"));

      // Now 2023 RCTI should be visible
      await waitFor(() => {
        expect(screen.getByText("RCTI-2023-001")).toBeInTheDocument();
      });
    });
  });

  describe("RCTI Actions", () => {
    it("should call onNavigateToRcti when view button is clicked", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRctis),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Wait for RCTIs to load
      await waitFor(() => {
        expect(screen.getByText("RCTI-2024-001")).toBeInTheDocument();
      });

      // Click the view button for first RCTI (using id, not data-testid)
      const viewButton = document.getElementById("view-rcti-1");
      expect(viewButton).toBeInTheDocument();
      fireEvent.click(viewButton!);

      expect(mockOnNavigateToRcti).toHaveBeenCalledWith({
        rcti: expect.objectContaining({ id: 1 }),
        weekEnding: expect.any(Date),
      });
    });

    it("should download PDF when download button is clicked", async () => {
      const mockBlob = new Blob(["test"], { type: "application/pdf" });
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRctis),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(mockBlob),
        });

      // Mock URL.createObjectURL and revokeObjectURL
      const mockCreateObjectURL = jest.fn(() => "blob:test-url");
      const mockRevokeObjectURL = jest.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Wait for RCTIs to load
      await waitFor(() => {
        expect(screen.getByText("RCTI-2024-001")).toBeInTheDocument();
      });

      // Click download button (using id, not data-testid)
      const downloadButton = document.getElementById("download-pdf-1");
      expect(downloadButton).toBeInTheDocument();
      fireEvent.click(downloadButton!);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/rcti/1/pdf");
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Success",
            description: "PDF downloaded successfully",
          }),
        );
      });
    });

    it("should show error toast when PDF download fails", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRctis),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: "PDF generation failed" }),
        });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Wait for RCTIs to load
      await waitFor(() => {
        expect(screen.getByText("RCTI-2024-001")).toBeInTheDocument();
      });

      // Click download button (using id, not data-testid)
      const downloadButton = document.getElementById("download-pdf-1");
      expect(downloadButton).toBeInTheDocument();
      fireEvent.click(downloadButton!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Error",
            description: "PDF generation failed",
            variant: "destructive",
          }),
        );
      });
    });
  });

  describe("Status Badges", () => {
    it("should display correct status badges", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRctis),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Wait for RCTIs to load
      await waitFor(() => {
        // Should have status badges - look for them in the RCTI rows and year summaries
        // "paid" appears in year summary badges and individual RCTI badges
        const paidBadges = screen.getAllByText(/paid/i);
        const finalisedBadges = screen.getAllByText(/finalised/i);
        const draftBadges = screen.getAllByText(/draft/i);

        // We have paid, finalised, and draft RCTIs
        expect(paidBadges.length).toBeGreaterThanOrEqual(1);
        expect(finalisedBadges.length).toBeGreaterThanOrEqual(1);
        expect(draftBadges.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Empty State", () => {
    it("should show no RCTIs message when driver has no RCTIs", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      await waitFor(() => {
        expect(screen.getByText("No RCTIs found")).toBeInTheDocument();
        expect(
          screen.getByText("This driver has no RCTIs generated yet"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Loading State", () => {
    it("should show loading skeleton while fetching RCTIs", async () => {
      // Create a promise that we can control
      let resolvePromise: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise);

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Loading skeleton should be visible (skeletons have data-slot="skeleton")
      await waitFor(() => {
        const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });

      // Resolve the fetch
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve(mockRctis),
      });

      // Loading should be gone and data should be visible
      await waitFor(() => {
        expect(screen.getByText("RCTI-2024-001")).toBeInTheDocument();
      });
    });
  });

  describe("Year Statistics", () => {
    it("should display correct year-level statistics", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRctis),
      });

      render(
        <RctiByDriverView
          drivers={mockDrivers}
          onNavigateToRcti={mockOnNavigateToRcti}
        />,
      );

      // Select a driver
      const combobox = screen.getByRole("combobox");
      fireEvent.click(combobox);

      await waitFor(() => {
        expect(screen.getByText("John Contractor")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("John Contractor"));

      // Wait for year headers with statistics
      await waitFor(() => {
        // 2024 has 3 RCTIs, 2023 has 1 RCTI
        // Use regex to find the RCTI count text
        const rctiCounts = screen.getAllByText(/\d+ RCTIs?/);
        expect(rctiCounts.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
