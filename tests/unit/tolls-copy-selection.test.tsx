import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UnifiedDataTable } from "@/components/data-table/core/unified-data-table";
import { tollJobColumns } from "@/components/tolls/toll-columns";
import { TollJobsToolbar } from "@/components/tolls/toll-toolbars";
import type { TollJobRow } from "@/lib/tolls/toll-types";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), writeText: vi.fn(), search: "" }));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

vi.mock("@/contexts/search-context", () => ({
  useSearch: () => ({ globalSearchValue: mocks.search }),
}));

function makeJob({
  jobId,
  jobDay,
  driver,
  amount,
}: {
  jobId: number;
  jobDay: string;
  driver: string;
  amount: number;
}): TollJobRow {
  return {
    jobId,
    jobDay,
    driver,
    customer: "Acme",
    registration: "CTJ450",
    truckType: "Semi",
    recordedCitylink: 1,
    recordedEastlink: 0,
    actualCitylink: 1,
    actualEastlink: 0,
    tollCost: amount,
    isMismatch: false,
    trips: [
      {
        id: jobId * 10,
        tripStart: `${jobDay}T07:00:00.000Z`,
        tripEnd: null,
        tripDetails: "Tullamarine Fwy to Monash Fwy",
        road: "citylink",
        amount,
      },
    ],
  };
}

const jobs = [
  makeJob({ jobId: 1, jobDay: "2026-10-05", driver: "JOHN", amount: 10 }),
  makeJob({ jobId: 2, jobDay: "2026-10-06", driver: "MARY", amount: 20 }),
];

function jobsTable() {
  return (
    <UnifiedDataTable
      data={jobs}
      columns={tollJobColumns}
      getItemId={(job) => job.jobId}
      ToolbarComponent={TollJobsToolbar}
    />
  );
}

function renderJobsTable() {
  return render(jobsTable());
}

describe("Copying selected toll jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = "";
    mocks.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mocks.writeText },
      configurable: true,
    });
  });

  it("copies every listed job when nothing is selected", async () => {
    renderJobsTable();

    fireEvent.click(await screen.findByRole("button", { name: "Copy all" }));

    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledTimes(1));
    const text = mocks.writeText.mock.calls[0][0] as string;
    expect(text).toContain("JOHN");
    expect(text).toContain("MARY");
    expect(text).toContain("Grand total: $30.00 (2 trips)");
  });

  it("copies only the selected jobs, and clearing the selection copies all again", async () => {
    renderJobsTable();

    const [firstRowCheckbox] = await screen.findAllByRole("checkbox", { name: "Select row" });
    fireEvent.click(firstRowCheckbox);
    fireEvent.click(await screen.findByRole("button", { name: "Copy 1 selected" }));

    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledTimes(1));
    expect(mocks.writeText).toHaveBeenCalledWith(
      [
        "Tolls 05/10/2026 - CTJ450 - JOHN",
        "07:00 CityLink Tullamarine Fwy to Monash Fwy $10.00",
        "Total: $10.00 (1 trip)",
      ].join("\n"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(await screen.findByRole("button", { name: "Copy all" })).toBeInTheDocument();
  });

  it("does not fall back to copying all while selected rows are hidden by filters", async () => {
    const { rerender } = renderJobsTable();

    const [firstRowCheckbox] = await screen.findAllByRole("checkbox", { name: "Select row" });
    fireEvent.click(firstRowCheckbox);
    mocks.search = "MARY";
    rerender(jobsTable());

    const copyButton = await screen.findByRole("button", { name: "Copy 0 selected" });
    expect(copyButton).toBeDisabled();
    expect(screen.getByText(/1 hidden by filters/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    mocks.search = "";
    rerender(jobsTable());

    expect(await screen.findByRole("button", { name: "Copy all" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: "Select row" })).toHaveLength(2);
    for (const checkbox of screen.getAllByRole("checkbox", { name: "Select row" })) {
      expect(checkbox).not.toBeChecked();
    }
  });
});
