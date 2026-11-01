import { render, screen } from "@testing-library/react";
import { ResponsiveJobsDataDisplay } from "@/components/data-table/jobs/responsive-jobs-data-display";
import type { DataTableColumnDef } from "@/components/data-table/core/table-features";
import type { Job } from "@/lib/types";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

vi.mock("@/components/data-table/core/data-table", () => ({
  DataTable: () => <div data-testid="desktop-data-table" />,
}));

vi.mock("@/components/entities/job/job-runsheet-preview", () => ({
  JobRunsheetPrefetcher: ({ jobs }: { jobs: Job[] }) => (
    <div data-testid="runsheet-prefetcher">
      {jobs.map((job) => job.id).join(",")}
    </div>
  ),
}));

const columns: DataTableColumnDef<Job>[] = [
  { accessorKey: "customer", header: "Customer" },
];

const jobs = Array.from(
  { length: 60 },
  (_, index) => ({ id: index + 1, customer: `Customer ${index + 1}` }) as Job,
);

describe("ResponsiveJobsDataDisplay runsheet prefetching", () => {
  it("prefetches runsheets for the jobs on the current page only", () => {
    render(
      <ResponsiveJobsDataDisplay data={jobs} columns={columns} prefetchRunsheets />,
    );

    const prefetchedIds = screen
      .getByTestId("runsheet-prefetcher")
      .textContent?.split(",");
    expect(prefetchedIds).toHaveLength(50);
    expect(prefetchedIds?.[0]).toBe("1");
    expect(prefetchedIds?.[49]).toBe("50");
  });

  it("does not prefetch when runsheet preview is off", () => {
    render(<ResponsiveJobsDataDisplay data={jobs} columns={columns} />);

    expect(screen.queryByTestId("runsheet-prefetcher")).not.toBeInTheDocument();
  });
});
