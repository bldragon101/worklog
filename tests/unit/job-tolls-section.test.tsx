import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobTollsSection } from "@/components/tolls/job-tolls-section";
import type { JobTollsResponse } from "@/lib/tolls/toll-types";
import type { Job } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  checkPermission: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ fetchJson: mocks.fetchJson }));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ checkPermission: mocks.checkPermission }),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const job = {
  id: 50,
  date: "2026-10-05T00:00:00.000Z",
  registration: "CTJ450",
  startTime: "2026-10-05T06:00:00.000Z",
  finishTime: "2026-10-05T14:00:00.000Z",
  citylink: 1,
  eastlink: null,
} as Job;

function jobTolls({ actualCitylink }: { actualCitylink: number }): JobTollsResponse {
  const trips = Array.from({ length: actualCitylink }, (_, index) => ({
    id: index + 1,
    tripStart: `2026-10-05T0${7 + index}:15:00.000Z`,
    tripEnd: null,
    tripDetails: "Tullamarine Fwy to Monash Fwy",
    road: "citylink" as const,
    amount: 38.32,
  }));
  return {
    jobId: 50,
    jobDay: "2026-10-05",
    registration: "CTJ450",
    driver: "JOHN",
    customer: "Acme",
    recordedCitylink: 1,
    recordedEastlink: 0,
    actualCitylink,
    actualEastlink: 0,
    tollCost: 38.32 * actualCitylink,
    isMismatch: actualCitylink !== 1,
    trips,
  };
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <JobTollsSection {...job} />
    </QueryClientProvider>,
  );
}

describe("JobTollsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkPermission.mockReturnValue(true);
  });

  it("lists the matched trips with a total and no warning when they match the job", async () => {
    mocks.fetchJson.mockResolvedValue(jobTolls({ actualCitylink: 1 }));
    renderSection();

    expect(await screen.findByText("CityLink 1")).toBeInTheDocument();
    expect(screen.getAllByText("$38.32")).toHaveLength(2);
    expect(screen.getByRole("list", { name: "Linkt toll trips" })).toHaveTextContent(
      "07:15CityLinkTullamarine Fwy to Monash Fwy$38.32",
    );
    expect(screen.getByRole("button", { name: "Copy tolls for invoicing" })).toBeInTheDocument();
    expect(screen.queryByText(/Job records/)).not.toBeInTheDocument();
  });

  it("warns when the job's recorded counts differ from Linkt", async () => {
    mocks.fetchJson.mockResolvedValue(jobTolls({ actualCitylink: 2 }));
    renderSection();

    expect(await screen.findByText("CityLink 2")).toBeInTheDocument();
    expect(screen.getByText("Job records CityLink 1")).toBeInTheDocument();
  });

  it("shows only the recorded counts to users who cannot manage tolls", () => {
    mocks.checkPermission.mockReturnValue(false);
    renderSection();

    expect(screen.getByText("CityLink 1")).toBeInTheDocument();
    expect(mocks.fetchJson).not.toHaveBeenCalled();
  });
});
