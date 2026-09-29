import { act, renderHook, waitFor } from "@testing-library/react";
import { useRctiDeductions } from "@/hooks/use-rcti-deductions";
import { useRctiLines } from "@/hooks/use-rcti-lines";
import type { Rcti } from "@/lib/types";
import { createQueryWrapper } from "../helpers/query-client";

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const rctiFor = ({ id, driverId }: { id: number; driverId: number }) =>
  ({
    id,
    driverId,
    weekEnding: "2025-01-12T00:00:00.000Z",
  }) as Rcti;

describe("RCTI hooks loading with React Query", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  describe("useRctiDeductions", () => {
    beforeEach(() => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.startsWith("/api/rcti-deductions/pending")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ pending: [], summary: { count: 0 } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 7, description: "Uniform" }],
        };
      });
    });

    it("loads nothing until an RCTI is selected", () => {
      const { result } = renderHook(
        () => useRctiDeductions({ selectedRcti: null, setIsSaving: vi.fn() }),
        { wrapper: createQueryWrapper() },
      );

      expect(result.current.deductions).toEqual([]);
      expect(result.current.pendingDeductions).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("loads the driver's deductions and the pending preview for the selected RCTI", async () => {
      const { result } = renderHook(
        () =>
          useRctiDeductions({
            selectedRcti: rctiFor({ id: 1, driverId: 3 }),
            setIsSaving: vi.fn(),
          }),
        { wrapper: createQueryWrapper() },
      );

      await waitFor(() =>
        expect(result.current.deductions).toEqual([
          { id: 7, description: "Uniform" },
        ]),
      );
      await waitFor(() =>
        expect(result.current.pendingDeductions).toEqual({
          pending: [],
          summary: { count: 0 },
        }),
      );
      expect(mockFetch).toHaveBeenCalledWith("/api/rcti-deductions?driverId=3");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/rcti-deductions/pending?driverId=3&weekEnding=2025-01-12T00:00:00.000Z",
      );
    });

    it("clears pending adjustments when a different RCTI is selected", async () => {
      const { result, rerender } = renderHook(
        ({ selectedRcti }: { selectedRcti: Rcti }) =>
          useRctiDeductions({ selectedRcti, setIsSaving: vi.fn() }),
        {
          wrapper: createQueryWrapper(),
          initialProps: { selectedRcti: rctiFor({ id: 1, driverId: 3 }) },
        },
      );

      act(() =>
        result.current.setPendingDeductionAdjustments(new Map([[7, 10]])),
      );
      expect(result.current.pendingDeductionAdjustments.size).toBe(1);

      // Same RCTI refreshed: adjustments are kept
      rerender({ selectedRcti: rctiFor({ id: 1, driverId: 3 }) });
      expect(result.current.pendingDeductionAdjustments.size).toBe(1);

      rerender({ selectedRcti: rctiFor({ id: 2, driverId: 3 }) });
      expect(result.current.pendingDeductionAdjustments.size).toBe(0);
    });
  });

  describe("useRctiLines", () => {
    const renderLines = ({ selectedRcti }: { selectedRcti: Rcti | null }) =>
      renderHook(
        () =>
          useRctiLines({
            selectedRcti,
            setSelectedRcti: vi.fn(),
            fetchRctis: vi.fn().mockResolvedValue([]),
            setIsSaving: vi.fn(),
          }),
        { wrapper: createQueryWrapper() },
      );

    it("loads the jobs available to add to the selected RCTI", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: 42, customer: "Acme" }],
      });

      const { result } = renderLines({
        selectedRcti: rctiFor({ id: 5, driverId: 3 }),
      });

      await waitFor(() =>
        expect(result.current.availableJobs).toEqual([
          { id: 42, customer: "Acme" },
        ]),
      );
      expect(mockFetch).toHaveBeenCalledWith("/api/rcti/5/available-jobs");
    });

    it("reports a failure to load available jobs", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: "RCTI is finalised" }),
      });

      const { result } = renderLines({
        selectedRcti: rctiFor({ id: 5, driverId: 3 }),
      });

      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "RCTI is finalised",
          variant: "destructive",
        }),
      );
      expect(result.current.availableJobs).toEqual([]);
    });

    it("has no available jobs without a selected RCTI", () => {
      const { result } = renderLines({ selectedRcti: null });

      expect(result.current.availableJobs).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
