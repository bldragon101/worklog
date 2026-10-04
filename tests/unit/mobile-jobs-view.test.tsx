import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MobileJobsView } from "@/components/data-table/jobs/mobile-jobs-view";
import { ResponsiveJobsDataDisplay } from "@/components/data-table/jobs/responsive-jobs-data-display";
import { JobsUnifiedDataTable } from "@/components/data-table/jobs/jobs-unified-data-table";
import { JobDataTableToolbar } from "@/components/entities/job/job-data-table-toolbar";
import { SearchProvider } from "@/contexts/search-context";
import type {
  DataTableColumnDef,
  DataTableInstance,
} from "@/components/data-table/core/table-features";
import type { Job } from "@/lib/types";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

vi.mock("@/components/shared/csv-import-export-dropdown", () => ({
  CsvImportExportDropdown: () => <div data-testid="csv-import-export-dropdown" />,
}));

vi.mock("@/components/data-table/core/data-table", () => ({
  DataTable: () => <div data-testid="desktop-data-table" />,
}));

function makeJob({ overrides }: { overrides: Partial<Job> }): Job {
  return {
    id: 1,
    date: "2025-09-29T00:00:00.000Z",
    driver: "SIMRAN",
    customer: "Tilling",
    billTo: "Tilling",
    registration: "ABC123",
    truckType: "Tray",
    pickup: "Dandenong",
    dropoff: "Clayton",
    runsheet: false,
    invoiced: false,
    chargedHours: 8,
    driverCharge: null,
    startTime: "2025-09-29T06:00:00.000Z",
    finishTime: "2025-09-29T14:30:00.000Z",
    comments: null,
    jobReference: null,
    eastlink: null,
    citylink: null,
    attachmentRunsheet: [],
    attachmentDocket: [],
    attachmentDeliveryPhotos: [],
    ...overrides,
  };
}

const jobs: Job[] = [
  makeJob({ overrides: { id: 1 } }),
  makeJob({
    overrides: {
      id: 2,
      driver: "STEWART",
      customer: "Bayswood",
      billTo: "Bayswood",
      date: "2025-09-30T00:00:00.000Z",
      startTime: "2025-09-30T07:00:00.000Z",
      finishTime: null,
      invoiced: true,
    },
  }),
  makeJob({
    overrides: {
      id: 3,
      driver: "GAGANDEEP",
      customer: "Ace Reo",
      startTime: "2025-09-29T05:00:00.000Z",
      chargedHours: 4.5,
    },
  }),
];

describe("MobileJobsView", () => {
  it("groups jobs under day headings, ordered by start time", () => {
    render(<MobileJobsView jobs={jobs} />);

    const monday = screen.getByRole("region", { name: "Mon 29 Sep" });
    const tuesday = screen.getByRole("region", { name: "Tue 30 Sep" });
    expect(within(monday).getByText("2 jobs · 12.50 h")).toBeInTheDocument();
    expect(within(tuesday).getByText("1 job · 8.00 h")).toBeInTheDocument();

    const mondayDrivers = within(monday)
      .getAllByRole("article")
      .map((card) => within(card).getByText(/SIMRAN|GAGANDEEP/).textContent);
    expect(mondayDrivers).toEqual(["GAGANDEEP", "SIMRAN"]);
  });

  it("shows times straight from the ISO strings", () => {
    render(<MobileJobsView jobs={[jobs[0]]} />);
    expect(screen.getByText("06:00–14:30")).toBeInTheDocument();
  });

  it("summarises the visible jobs", () => {
    render(<MobileJobsView jobs={jobs} />);
    expect(
      screen.getByText("3 jobs · 20.50 h charged · 2 not invoiced"),
    ).toBeInTheDocument();
  });

  it("toggles runsheet and invoiced through the status handler", async () => {
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
    render(<MobileJobsView jobs={[jobs[1]]} onUpdateStatus={onUpdateStatus} />);

    fireEvent.click(screen.getByRole("button", { name: "Runsheet" }));
    fireEvent.click(screen.getByRole("button", { name: "Invoiced" }));

    await waitFor(() => {
      expect(onUpdateStatus).toHaveBeenCalledWith(2, "runsheet", true);
      expect(onUpdateStatus).toHaveBeenCalledWith(2, "invoiced", false);
    });
  });

  it("expands a card to show its details", () => {
    render(
      <MobileJobsView
        jobs={[makeJob({ overrides: { comments: "Gate code 1234" } })]}
      />,
    );

    expect(screen.queryByText("Gate code 1234")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("Gate code 1234")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    render(<MobileJobsView jobs={[]} />);
    expect(screen.getByText("No jobs found")).toBeInTheDocument();
  });
});

describe("ResponsiveJobsDataDisplay on mobile", () => {
  const columns: DataTableColumnDef<Job, unknown>[] = [
    {
      accessorKey: "driver",
      filterFn: (row, id, value) =>
        Array.isArray(value) && value.includes(row.getValue(id) as string),
    },
    { accessorKey: "customer" },
  ];

  const renderWithTable = () => {
    let table: DataTableInstance<Job> | null = null;
    render(
      <ResponsiveJobsDataDisplay
        data={jobs}
        columns={columns}
        onTableReady={(instance) => {
          table = instance;
        }}
      />,
    );
    return { getTable: () => table as unknown as DataTableInstance<Job> };
  };

  it("renders job cards rather than the desktop table", () => {
    renderWithTable();
    expect(screen.queryByTestId("desktop-data-table")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("only shows cards that match the column filters", async () => {
    const { getTable } = renderWithTable();
    await waitFor(() => expect(getTable()).not.toBeNull());

    act(() => {
      getTable().setColumnFilters([{ id: "driver", value: ["STEWART"] }]);
    });

    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(1);
    });
    expect(screen.getByText("STEWART")).toBeInTheDocument();
    expect(screen.queryByText("SIMRAN")).not.toBeInTheDocument();
  });

  it("only shows cards that match the search", async () => {
    const { getTable } = renderWithTable();
    await waitFor(() => expect(getTable()).not.toBeNull());

    act(() => {
      getTable().setGlobalFilter("bayswood");
    });

    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(1);
    });
    expect(screen.getByText("Bayswood")).toBeInTheDocument();
  });
});

describe("Jobs list on mobile with the toolbar", () => {
  const columns: DataTableColumnDef<Job, unknown>[] = [
    {
      accessorKey: "driver",
      filterFn: (row, id, value) =>
        Array.isArray(value) && value.includes(row.getValue(id) as string),
    },
    { accessorKey: "customer" },
  ];

  it("filters the cards from the filter sheet and shows removable chips", async () => {
    render(
      <SearchProvider>
        <JobsUnifiedDataTable
          data={jobs}
          columns={columns}
          ToolbarComponent={JobDataTableToolbar}
          onAdd={vi.fn()}
        />
      </SearchProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /filters/i }));
    fireEvent.click(await screen.findByRole("button", { name: /STEWART/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Show 1 job" }));

    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(1);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Driver filter STEWART" }),
    );

    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(3);
    });
  });
});
