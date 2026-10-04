import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseISO } from "date-fns";
import TollsPage from "@/app/tolls/page";
import type { TollsResponse } from "@/lib/tolls/toll-types";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ fetchJson: mocks.fetchJson }));

vi.mock("@/components/layout/protected-layout", () => ({
  ProtectedLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/auth/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/page-controls", () => ({
  PageControls: ({
    onWeekEndingChange,
    tabs,
  }: {
    onWeekEndingChange: (weekEnding: Date | string) => void;
    tabs: ReactNode;
  }) => (
    <div>
      <button
        id="pick-week-btn"
        type="button"
        onClick={() => onWeekEndingChange(parseISO("2026-10-04"))}
      >
        Pick week
      </button>
      {tabs}
    </div>
  ),
}));

vi.mock("@/components/data-table/core/unified-data-table", () => ({
  UnifiedDataTable: ({ data }: { data: { id: number }[] }) => (
    <div data-testid="tolls-table">{data.length} rows</div>
  ),
}));

vi.mock("@/components/tolls/toll-drive-import-button", () => ({
  requestDriveImport: vi.fn(async () => ({ status: "checked-recently" })),
  hasNewTrips: () => false,
}));

function tollsResponse({ tripCount }: { tripCount: number }): TollsResponse {
  return {
    trips: Array.from({ length: tripCount }, (_, index) => ({ id: index + 1 })),
    jobs: [],
    unknownTags: [],
    lastImport: null,
    earliestTripDate: null,
    driveSync: { configured: true },
  } as unknown as TollsResponse;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <TollsPage />
    </QueryClientProvider>,
  );
}

describe("Tolls page period loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the period is loading and makes the previous period's trips inert until it arrives", async () => {
    let resolveWeek: (value: TollsResponse) => void = () => {};
    mocks.fetchJson.mockImplementation(({ url }: { url: string }) =>
      url.includes("from=2026-09-28&to=2026-10-04")
        ? new Promise<TollsResponse>((resolve) => {
            resolveWeek = resolve;
          })
        : Promise.resolve(tollsResponse({ tripCount: 5 })),
    );

    renderPage();
    expect(await screen.findByText("5 rows")).toBeInTheDocument();
    expect(screen.queryByText(/Loading tolls for/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pick week" }));

    expect(
      await screen.findByText("Loading tolls for 28/09 – 04/10..."),
    ).toBeInTheDocument();
    expect(screen.getByText("5 rows")).toBeInTheDocument();
    const content = document.getElementById("tolls-content");
    expect(content).toHaveAttribute("aria-busy", "true");
    expect(content).toHaveClass("opacity-50");
    expect(content).toHaveAttribute("inert");

    resolveWeek(tollsResponse({ tripCount: 2 }));

    expect(await screen.findByText("2 rows")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/Loading tolls for/)).not.toBeInTheDocument();
    });
    expect(document.getElementById("tolls-content")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(document.getElementById("tolls-content")).not.toHaveAttribute(
      "inert",
    );
  });
});
