import { act, renderHook, waitFor } from "@testing-library/react";
import { useJobsReportByDriver } from "@/hooks/use-jobs-report-by-driver";
import { createQueryWrapper } from "../helpers/query-client";

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const reports = [
  { id: 1, driverId: 4, weekEnding: "2024-12-29T00:00:00.000Z" },
  { id: 2, driverId: 4, weekEnding: "2025-01-12T00:00:00.000Z" },
  { id: 3, driverId: 4, weekEnding: "2025-01-05T00:00:00.000Z" },
];

describe("useJobsReportByDriver", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => reports,
    });
  });

  const renderByDriver = () =>
    renderHook(() => useJobsReportByDriver(), {
      wrapper: createQueryWrapper(),
    });

  it("does not load until a driver is chosen", () => {
    const { result } = renderByDriver();

    expect(result.current.byDriverReports).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("loads the driver's reports grouped by year with the latest year expanded", async () => {
    const { result } = renderByDriver();

    act(() => result.current.setByDriverSelectedId("4"));

    await waitFor(() => expect(result.current.byDriverReports).toHaveLength(3));
    expect(mockFetch).toHaveBeenCalledWith("/api/jobs-report?driverId=4", {
      cache: "no-store",
    });
    expect(result.current.byDriverGroupedReports.map((g) => g.year)).toEqual([
      2025, 2024,
    ]);
    expect(
      result.current.byDriverGroupedReports[0].reports.map((r) => r.id),
    ).toEqual([2, 3]);
    expect([...result.current.byDriverExpandedYears]).toEqual([2025]);

    act(() => result.current.toggleByDriverYear({ year: 2024 }));
    expect([...result.current.byDriverExpandedYears].sort()).toEqual([
      2024, 2025,
    ]);
  });

  it("reports a failure to load", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const { result } = renderByDriver();

    act(() => result.current.setByDriverSelectedId("4"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to fetch reports",
        variant: "destructive",
      }),
    );
    expect(result.current.byDriverReports).toEqual([]);
  });
});
