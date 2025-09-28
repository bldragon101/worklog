import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import JobsPage from "@/app/jobs/page";
import { jobColumns } from "@/components/entities/job/job-columns";
import { Job } from "@/lib/types";
import { ColumnDef, VisibilityState } from "@tanstack/react-table";

interface ColumnMeta {
  hidden?: boolean;
  [key: string]: unknown;
}

interface TestColumnDef {
  accessorKey?: string;
  id?: string;
  meta?: ColumnMeta;
  [key: string]: unknown;
}

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { id: "test-user" } }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/components/layout/protected-layout", () => ({
  ProtectedLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock("@/components/ui/skeleton", () => ({
  TableLoadingSkeleton: ({
    rows,
    columns,
  }: {
    rows: number;
    columns: number;
  }) => (
    <div data-testid="table-loading-skeleton">
      Loading skeleton with {rows} rows and {columns} columns
    </div>
  ),
  Spinner: () => <div data-testid="spinner">Loading...</div>,
  Skeleton: () => <div data-testid="skeleton">Skeleton</div>,
}));

// Mock the data table component to test column visibility
jest.mock("@/components/data-table/jobs/jobs-unified-data-table", () => ({
  JobsUnifiedDataTable: ({
    columns,
    columnVisibility,
    onColumnVisibilityChange,
    data,
  }: {
    columns: ColumnDef<Job>[];
    columnVisibility: VisibilityState;
    onColumnVisibilityChange: (visibility: VisibilityState) => void;
    data: Job[];
  }) => {
    const [localVisibility, setLocalVisibility] = React.useState(
      columnVisibility || {},
    );

    React.useEffect(() => {
      if (columnVisibility !== undefined) {
        setLocalVisibility(columnVisibility);
      }
    }, [columnVisibility]);

    const handleToggleColumn = (columnKey: string) => {
      const newVisibility = {
        ...localVisibility,
        [columnKey]: !localVisibility[columnKey],
      };
      setLocalVisibility(newVisibility);
      if (onColumnVisibilityChange) {
        onColumnVisibilityChange(newVisibility);
      }
    };

    return (
      <div data-testid="jobs-unified-data-table">
        <div data-testid="column-visibility-state">
          {JSON.stringify(localVisibility)}
        </div>
        <div data-testid="columns-count">{columns.length}</div>
        <div data-testid="data-count">{data.length}</div>
        {/* Simulate column visibility toggles */}
        <button
          data-testid="toggle-runsheet"
          onClick={() => handleToggleColumn("runsheet")}
        >
          Toggle Runsheet
        </button>
        <button
          data-testid="toggle-invoiced"
          onClick={() => handleToggleColumn("invoiced")}
        >
          Toggle Invoiced
        </button>
        <button
          data-testid="toggle-driverCharge"
          onClick={() => handleToggleColumn("driverCharge")}
        >
          Toggle Driver Charge
        </button>
        <button
          data-testid="toggle-eastlink"
          onClick={() => handleToggleColumn("eastlink")}
        >
          Toggle Eastlink
        </button>
        <button
          data-testid="toggle-citylink"
          onClick={() => handleToggleColumn("citylink")}
        >
          Toggle Citylink
        </button>
      </div>
    );
  },
}));

// Mock other components
jest.mock("@/components/layout/page-controls", () => ({
  PageControls: () => <div data-testid="page-controls">Page Controls</div>,
}));

jest.mock("@/components/entities/job/job-form", () => ({
  JobForm: () => <div data-testid="job-form">Job Form</div>,
}));

jest.mock("@/components/ui/delete-dialog", () => ({
  DeleteDialog: () => <div data-testid="delete-dialog">Delete Dialog</div>,
}));

jest.mock("@/components/ui/progress-dialog", () => ({
  ProgressDialog: () => (
    <div data-testid="progress-dialog">Progress Dialog</div>
  ),
}));

jest.mock("@/components/ui/job-attachment-upload", () => ({
  JobAttachmentUpload: () => (
    <div data-testid="job-attachment-upload">Job Attachment Upload</div>
  ),
}));

// Mock API calls
global.fetch = jest.fn();

const mockJobs: Job[] = [
  {
    id: 1,
    date: new Date().toISOString().split("T")[0], // Use current date to pass filtering
    driver: "John Doe",
    customer: "ABC Company",
    billTo: "ABC Company",
    registration: "ABC123",
    truckType: "Tray",
    pickup: "123 Main St",
    dropoff: "456 Oak Ave",
    runsheet: true,
    invoiced: false,
    chargedHours: 8.5,
    driverCharge: 350.0,
    startTime: new Date().toISOString().replace(/T.*/, "T08:00:00Z"),
    finishTime: new Date().toISOString().replace(/T.*/, "T16:30:00Z"),
    comments: "Test job",
    jobReference: "JOB-001",
    eastlink: 2,
    citylink: 1,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
  },
];

describe("Jobs Page Column Visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
    });

    // Mock successful API responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/api/jobs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockJobs),
        });
      }
      if (url.includes("/api/google-drive/settings")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: false }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });
  });

  it("shows loading skeleton when jobs are loading", async () => {
    // Mock slow API response
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve(mockJobs),
              }),
            100,
          ),
        ),
    );

    render(<JobsPage />);

    // Should show loading skeleton initially
    expect(screen.getByTestId("table-loading-skeleton")).toBeInTheDocument();
    expect(
      screen.getByText("Loading skeleton with 10 rows and 12 columns"),
    ).toBeInTheDocument();

    // Wait for data to load and table to appear
    await waitFor(
      () => {
        expect(
          screen.getByTestId("jobs-unified-data-table"),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("renders data table when jobs are loaded", async () => {
    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("jobs-unified-data-table")).toBeInTheDocument();
    });

    // Should show the correct number of columns and data
    expect(screen.getByTestId("columns-count")).toHaveTextContent("21"); // Total columns including actions
    expect(screen.getByTestId("data-count")).toHaveTextContent("1");
  });

  it("initializes with undefined column visibility to allow meta.hidden to work", async () => {
    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("jobs-unified-data-table")).toBeInTheDocument();
    });

    // Initial column visibility should be undefined/empty to let data table handle hidden columns
    const visibilityState = screen.getByTestId(
      "column-visibility-state",
    ).textContent;
    expect(visibilityState).toBe("{}"); // Empty object initially
  });

  it("allows toggling column visibility for runsheet column", async () => {
    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("jobs-unified-data-table")).toBeInTheDocument();
    });

    // Toggle runsheet column
    fireEvent.click(screen.getByTestId("toggle-runsheet"));

    await waitFor(() => {
      const visibilityState = JSON.parse(
        screen.getByTestId("column-visibility-state").textContent || "{}",
      );
      expect(visibilityState.runsheet).toBe(true);
    });
  });

  it("allows toggling column visibility for invoiced column", async () => {
    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("jobs-unified-data-table")).toBeInTheDocument();
    });

    // Toggle invoiced column
    fireEvent.click(screen.getByTestId("toggle-invoiced"));

    await waitFor(() => {
      const visibilityState = JSON.parse(
        screen.getByTestId("column-visibility-state").textContent || "{}",
      );
      expect(visibilityState.invoiced).toBe(true);
    });
  });

  it("allows toggling column visibility for driverCharge column", async () => {
    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("jobs-unified-data-table")).toBeInTheDocument();
    });

    // Toggle driverCharge column
    fireEvent.click(screen.getByTestId("toggle-driverCharge"));

    await waitFor(() => {
      const visibilityState = JSON.parse(
        screen.getByTestId("column-visibility-state").textContent || "{}",
      );
      expect(visibilityState.driverCharge).toBe(true);
    });
  });

  it("allows toggling column visibility for toll columns (eastlink, citylink)", async () => {
    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("jobs-unified-data-table")).toBeInTheDocument();
    });

    // Toggle eastlink column
    fireEvent.click(screen.getByTestId("toggle-eastlink"));

    await waitFor(() => {
      const visibilityState = JSON.parse(
        screen.getByTestId("column-visibility-state").textContent || "{}",
      );
      expect(visibilityState.eastlink).toBe(true);
    });

    // Toggle citylink column
    fireEvent.click(screen.getByTestId("toggle-citylink"));

    await waitFor(() => {
      const visibilityState = JSON.parse(
        screen.getByTestId("column-visibility-state").textContent || "{}",
      );
      expect(visibilityState.citylink).toBe(true);
    });
  });

  it("maintains column visibility state across multiple toggles", async () => {
    render(<JobsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("jobs-unified-data-table")).toBeInTheDocument();
    });

    // Toggle multiple columns
    fireEvent.click(screen.getByTestId("toggle-runsheet"));
    fireEvent.click(screen.getByTestId("toggle-invoiced"));
    fireEvent.click(screen.getByTestId("toggle-driverCharge"));

    await waitFor(() => {
      const visibilityState = JSON.parse(
        screen.getByTestId("column-visibility-state").textContent || "{}",
      );
      expect(visibilityState).toEqual({
        runsheet: true,
        invoiced: true,
        driverCharge: true,
      });
    });

    // Toggle one column off
    fireEvent.click(screen.getByTestId("toggle-runsheet"));

    await waitFor(() => {
      const visibilityState = JSON.parse(
        screen.getByTestId("column-visibility-state").textContent || "{}",
      );
      expect(visibilityState).toEqual({
        runsheet: false,
        invoiced: true,
        driverCharge: true,
      });
    });
  });
});

describe("Job Columns Meta Configuration", () => {
  it("should have meta.hidden = true for specified columns", () => {
    const columns = jobColumns(
      jest.fn(), // onEdit
      jest.fn(), // onDelete
      false, // isLoading
      jest.fn(), // onUpdateStatus
      jest.fn(), // onAttach
    );

    const hiddenColumns = [
      "runsheet",
      "invoiced",
      "driverCharge",
      "eastlink",
      "citylink",
    ];

    hiddenColumns.forEach((columnKey) => {
      const column = columns.find(
        (col) => "accessorKey" in col && col.accessorKey === columnKey,
      );

      expect(column).toBeDefined();
      expect((column as TestColumnDef)?.meta?.hidden).toBe(true);
    });
  });

  it("should not have meta.hidden = true for visible columns", () => {
    const columns = jobColumns(
      jest.fn(), // onEdit
      jest.fn(), // onDelete
      false, // isLoading
      jest.fn(), // onUpdateStatus
      jest.fn(), // onAttach
    );

    const visibleColumns = [
      "date",
      "driver",
      "customer",
      "startTime",
      "finishTime",
      "status",
    ];

    visibleColumns.forEach((columnKey) => {
      const column = columns.find(
        (col) => "accessorKey" in col && col.accessorKey === columnKey,
      );

      expect(column).toBeDefined();
      expect((column as TestColumnDef)?.meta?.hidden).toBeFalsy();
    });
  });
});
