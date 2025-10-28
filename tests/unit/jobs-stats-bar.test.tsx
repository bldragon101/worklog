import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JobsStatsBar } from "@/components/data-table/jobs/jobs-stats-bar";
import { Job } from "@/lib/types";
import { Table, Row } from "@tanstack/react-table";
import "@testing-library/jest-dom";

// Mock job data with various truck types and tolls
const mockJobs: Job[] = [
  {
    id: 1,
    date: "2024-01-15",
    driver: "John Doe",
    customer: "ABC Company",
    billTo: "ABC Company",
    registration: "ABC123",
    truckType: "TRAY",
    pickup: "123 Main St",
    dropoff: "456 Oak Ave",
    runsheet: true,
    invoiced: false,
    chargedHours: 8.5,
    driverCharge: 350.0,
    startTime: "2024-01-15T08:00:00",
    finishTime: "2024-01-15T16:30:00",
    comments: "Test job",
    jobReference: "JOB-001",
    eastlink: 2,
    citylink: 1,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 2,
    date: "2024-01-16",
    driver: "Jane Smith",
    customer: "XYZ Corp",
    billTo: "XYZ Corp",
    registration: "XYZ789",
    truckType: "CRANE",
    pickup: "789 First Ave",
    dropoff: "321 Second St",
    runsheet: false,
    invoiced: true,
    chargedHours: 6.0,
    driverCharge: 280.0,
    startTime: "2024-01-16T09:00:00",
    finishTime: "2024-01-16T15:00:00",
    comments: null,
    jobReference: null,
    eastlink: 3,
    citylink: 0,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 3,
    date: "2024-01-17",
    driver: "Bob Wilson",
    customer: "Test Co",
    billTo: "Test Co",
    registration: "TEST456",
    truckType: "SEMI",
    pickup: "100 Test St",
    dropoff: "200 Test Ave",
    runsheet: true,
    invoiced: false,
    chargedHours: 10.0,
    driverCharge: 450.0,
    startTime: "2024-01-17T07:00:00",
    finishTime: "2024-01-17T17:00:00",
    comments: "Semi truck job",
    jobReference: "JOB-003",
    eastlink: 1,
    citylink: 2,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 4,
    date: "2024-01-18",
    driver: "Alice Brown",
    customer: "Heavy Lift",
    billTo: "Heavy Lift",
    registration: "SEMI123",
    truckType: "SEMI CRANE",
    pickup: "300 Heavy St",
    dropoff: "400 Crane Ave",
    runsheet: true,
    invoiced: true,
    chargedHours: 12.5,
    driverCharge: 600.0,
    startTime: "2024-01-18T06:00:00",
    finishTime: "2024-01-18T18:30:00",
    comments: "Heavy lifting job",
    jobReference: "JOB-004",
    eastlink: 0,
    citylink: 3,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
  {
    id: 5,
    date: "2024-01-19",
    driver: "John Doe",
    customer: "ABC Company",
    billTo: "ABC Company",
    registration: "ABC124",
    truckType: "TRAY",
    pickup: "500 Main St",
    dropoff: "600 Oak Ave",
    runsheet: false,
    invoiced: false,
    chargedHours: 7.5,
    driverCharge: 320.0,
    startTime: "2024-01-19T08:00:00",
    finishTime: "2024-01-19T15:30:00",
    comments: null,
    jobReference: "JOB-005",
    eastlink: 1,
    citylink: 1,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
];

// Mock table with filtered row model
const createMockTable = (data: Job[]): Partial<Table<Job>> => ({
  getFilteredRowModel: () => ({
    rows: data.map((job, index) => ({
      id: String(job.id),
      index,
      original: job,
      getValue: (columnId: string) => job[columnId as keyof Job],
    })) as unknown as Row<Job>[],
    flatRows: [],
    rowsById: {},
  }),
});

describe("JobsStatsBar", () => {
  beforeEach(() => {
    // Reset window size to non-compact view
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1400,
    });
  });

  describe("Stats Calculation", () => {
    it("should calculate truck type counts correctly", () => {
      const mockTable = createMockTable(mockJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render
      // Check if stats are displayed (TT = 2, CT = 1, ST = 1, SCT = 1)
      expect(screen.getByText("TT")).toBeInTheDocument();
      expect(screen.getByText("CT")).toBeInTheDocument();
      expect(screen.getByText("ST")).toBeInTheDocument();
      expect(screen.getByText("SCT")).toBeInTheDocument();
    });

    it("should calculate hours correctly for each truck type", () => {
      const mockTable = createMockTable(mockJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render
      // TT: 8.5 + 7.5 = 16.0 hours
      expect(screen.getByText("2 - 16.0h")).toBeInTheDocument();
      // CT: 6.0 hours
      expect(screen.getByText("1 - 6.0h")).toBeInTheDocument();
      // ST: 10.0 hours
      expect(screen.getByText("1 - 10.0h")).toBeInTheDocument();
      // SCT: 12.5 hours
      expect(screen.getByText("1 - 12.5h")).toBeInTheDocument();
    });

    it("should calculate toll counts correctly", () => {
      const mockTable = createMockTable(mockJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render
      // Eastlink: 2 + 3 + 1 + 0 + 1 = 7
      // Citylink: 1 + 0 + 2 + 3 + 1 = 7
      // Both should be 7, so we get all instances
      const tollCounts = screen.getAllByText("7");
      expect(tollCounts).toHaveLength(2);
    });

    it("should handle jobs with null hours", () => {
      const jobsWithNullHours: Job[] = [
        {
          ...mockJobs[0],
          chargedHours: null,
        },
        {
          ...mockJobs[1],
          chargedHours: 5.0,
        },
      ];

      const mockTable = createMockTable(jobsWithNullHours) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render

      // Should treat null as 0
      expect(screen.getByText("1 - 0.0h")).toBeInTheDocument();
      expect(screen.getByText("1 - 5.0h")).toBeInTheDocument();
    });

    it("should handle jobs with null tolls", () => {
      const jobsWithNullTolls: Job[] = [
        {
          ...mockJobs[0],
          eastlink: null,
          citylink: null,
        },
      ];

      const mockTable = createMockTable(jobsWithNullTolls) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render

      // Should not show toll stats if all are null/0
      expect(screen.queryByText("EL")).not.toBeInTheDocument();
      expect(screen.queryByText("CL")).not.toBeInTheDocument();
    });
  });

  describe("Filtered Data", () => {
    it("should only calculate stats for filtered rows", () => {
      // Only TRAY jobs
      const filteredJobs = mockJobs.filter((job) => job.truckType === "TRAY");
      const mockTable = createMockTable(filteredJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render
      // Should only show TT stats
      expect(screen.getByText("TT")).toBeInTheDocument();
      expect(screen.queryByText("CT")).not.toBeInTheDocument();
      expect(screen.queryByText("ST")).not.toBeInTheDocument();
      expect(screen.queryByText("SCT")).not.toBeInTheDocument();
    });

    it("should auto-update stats when table data changes", () => {
      const mockTable = createMockTable(mockJobs) as Table<Job>;
      const { rerender } = render(<JobsStatsBar table={mockTable} />);

      // Initial stats auto-calculated
      expect(screen.getByText("2 - 16.0h")).toBeInTheDocument();

      // Update with new filtered data
      const newFilteredJobs = [mockJobs[0]];
      const newMockTable = createMockTable(newFilteredJobs) as Table<Job>;
      rerender(<JobsStatsBar table={newMockTable} />);

      // Stats should auto-update to reflect new data
      expect(screen.getByText("1 - 8.5h")).toBeInTheDocument();
    });
  });

  describe("Dialog Functionality", () => {
    it("should open dialog when stats section is clicked", async () => {
      const mockTable = createMockTable(mockJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render
      // Click on stats section to open dialog
      const statsSection = screen.getByTitle("Click to view detailed stats");
      fireEvent.click(statsSection);

      await waitFor(() => {
        expect(
          screen.getByText("Filtered Jobs Statistics"),
        ).toBeInTheDocument();
      });
    });

    it("should display legend in dialog", async () => {
      const mockTable = createMockTable(mockJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render
      const statsSection = screen.getByTitle("Click to view detailed stats");
      fireEvent.click(statsSection);

      await waitFor(() => {
        expect(screen.getByText("Legend")).toBeInTheDocument();
        expect(screen.getByText("- Tray")).toBeInTheDocument();
        expect(screen.getByText("- Crane")).toBeInTheDocument();
        expect(screen.getByText("- Semi")).toBeInTheDocument();
        expect(screen.getByText("- Semi Crane")).toBeInTheDocument();
        expect(screen.getByText("- Eastlink")).toBeInTheDocument();
        expect(screen.getByText("- Citylink")).toBeInTheDocument();
      });
    });

    it("should calculate toll costs correctly in dialog", async () => {
      const mockTable = createMockTable(mockJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render
      const statsSection = screen.getByTitle("Click to view detailed stats");
      fireEvent.click(statsSection);

      await waitFor(() => {
        // Eastlink: 7 trips * $18.50 = $129.50
        expect(screen.getByText("$129.50")).toBeInTheDocument();
        // Citylink: 7 trips * $31.00 = $217.00
        expect(screen.getByText("$217.00")).toBeInTheDocument();
      });
    });

    it("should display total summary in dialog", async () => {
      const mockTable = createMockTable(mockJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render
      const statsSection = screen.getByTitle("Click to view detailed stats");
      fireEvent.click(statsSection);

      await waitFor(() => {
        expect(screen.getByText("Total Jobs")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument(); // 5 jobs total

        expect(screen.getByText("Total Hours")).toBeInTheDocument();
        expect(screen.getByText("44.50")).toBeInTheDocument(); // 8.5+6+10+12.5+7.5

        expect(screen.getByText("Total Tolls")).toBeInTheDocument();
        // 7*18.5 + 7*31 = 129.50 + 217.00 = 346.50
        expect(screen.getByText("$346.50")).toBeInTheDocument();
      });
    });
  });

  describe("Truck Type Categorization", () => {
    it("should categorize TRAY correctly", () => {
      const trayJobs: Job[] = [
        { ...mockJobs[0], truckType: "TRAY" },
        { ...mockJobs[0], id: 10, truckType: "Tray" },
        { ...mockJobs[0], id: 11, truckType: "tray" },
      ];

      const mockTable = createMockTable(trayJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render

      expect(screen.getByText("3 - 25.5h")).toBeInTheDocument();
    });

    it("should categorize CRANE correctly (not SEMI CRANE)", () => {
      const craneJobs: Job[] = [
        { ...mockJobs[1], truckType: "CRANE" },
        { ...mockJobs[1], id: 20, truckType: "Crane" },
      ];

      const mockTable = createMockTable(craneJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render

      expect(screen.getByText("2 - 12.0h")).toBeInTheDocument();
    });

    it("should categorize SEMI correctly (not SEMI CRANE)", () => {
      const semiJobs: Job[] = [
        { ...mockJobs[2], truckType: "SEMI" },
        { ...mockJobs[2], id: 30, truckType: "Semi" },
      ];

      const mockTable = createMockTable(semiJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render

      expect(screen.getByText("2 - 20.0h")).toBeInTheDocument();
    });

    it("should categorize SEMI CRANE correctly", () => {
      const semiCraneJobs: Job[] = [
        { ...mockJobs[3], truckType: "SEMI CRANE" },
        { ...mockJobs[3], id: 40, truckType: "Semi Crane" },
      ];

      const mockTable = createMockTable(semiCraneJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render

      expect(screen.getByText("2 - 25.0h")).toBeInTheDocument();
    });
  });

  describe("Empty States", () => {
    it("should not render when no stats are available", () => {
      const emptyJobs: Job[] = [];
      const mockTable = createMockTable(emptyJobs) as Table<Job>;
      const { container } = render(<JobsStatsBar table={mockTable} />);

      expect(container.firstChild).toBeNull();
    });

    it("should handle jobs with zero hours and tolls", () => {
      const zeroJobs: Job[] = [
        {
          ...mockJobs[0],
          chargedHours: 0,
          eastlink: 0,
          citylink: 0,
        },
      ];

      const mockTable = createMockTable(zeroJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Stats auto-calculate on render
      expect(screen.getByText("1 - 0.0h")).toBeInTheDocument();
      expect(screen.queryByText("EL")).not.toBeInTheDocument();
      expect(screen.queryByText("CL")).not.toBeInTheDocument();
    });
  });

  describe("Compact Mode", () => {
    it("should show compact button when window width is less than 1200px", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1000,
      });

      const mockTable = createMockTable(mockJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      // Trigger resize
      fireEvent(window, new Event("resize"));

      const compactButton = screen.getByRole("button", { name: /stats/i });
      expect(compactButton).toBeInTheDocument();
      expect(screen.queryByText("TT")).not.toBeInTheDocument();
    });

    it("should open dialog when compact stats button is clicked", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1000,
      });

      const mockTable = createMockTable(mockJobs) as Table<Job>;
      render(<JobsStatsBar table={mockTable} />);

      fireEvent(window, new Event("resize"));

      const compactButton = screen.getByRole("button", { name: /stats/i });
      fireEvent.click(compactButton);

      await waitFor(() => {
        expect(
          screen.getByText("Filtered Jobs Statistics"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Auto-Update Behavior", () => {
    it("should automatically recalculate stats when filtered rows change", () => {
      const mockTable1 = createMockTable(mockJobs) as Table<Job>;
      const { rerender } = render(<JobsStatsBar table={mockTable1} />);

      // Initial stats auto-calculated
      const initialStats = screen.getByText("2 - 16.0h");
      expect(initialStats).toBeInTheDocument();

      // Create new table reference with different filtered data
      const newJobs = [mockJobs[0]];
      const mockTable2 = createMockTable(newJobs) as Table<Job>;
      rerender(<JobsStatsBar table={mockTable2} />);

      // Stats should auto-update to reflect new filtered data
      expect(screen.getByText("1 - 8.5h")).toBeInTheDocument();
      expect(screen.queryByText("2 - 16.0h")).not.toBeInTheDocument();
    });

    it("should show stats when switching from empty to populated week", () => {
      // Start with empty table
      const emptyTable = createMockTable([]) as Table<Job>;
      const { rerender } = render(<JobsStatsBar table={emptyTable} />);

      // No stats should be visible
      expect(screen.queryByText("TT")).not.toBeInTheDocument();

      // Switch to week with jobs
      const populatedTable = createMockTable(mockJobs) as Table<Job>;
      rerender(<JobsStatsBar table={populatedTable} />);

      // Stats should now appear automatically
      expect(screen.getByText("TT")).toBeInTheDocument();
      expect(screen.getByText("2 - 16.0h")).toBeInTheDocument();
    });

    it("should hide stats when switching from populated to empty week", () => {
      // Start with populated table
      const populatedTable = createMockTable(mockJobs) as Table<Job>;
      const { rerender } = render(<JobsStatsBar table={populatedTable} />);

      // Stats should be visible
      expect(screen.getByText("TT")).toBeInTheDocument();

      // Switch to empty week
      const emptyTable = createMockTable([]) as Table<Job>;
      rerender(<JobsStatsBar table={emptyTable} />);

      // Stats should disappear
      expect(screen.queryByText("TT")).not.toBeInTheDocument();
    });
  });
});
