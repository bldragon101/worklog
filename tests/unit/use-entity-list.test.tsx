import { act, renderHook, waitFor } from "@testing-library/react";
import { useEntityList } from "@/hooks/use-entity-list";
import { createQueryWrapper } from "../helpers/query-client";

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

interface TestCustomer {
  id: number;
  customer: string;
}

describe("useEntityList", () => {
  const mockFetch = vi.fn();
  let customers: TestCustomer[];

  beforeEach(() => {
    vi.clearAllMocks();
    customers = [
      { id: 1, customer: "Acme" },
      { id: 2, customer: "Globex" },
    ];
    global.fetch = mockFetch;
    mockFetch.mockImplementation(
      async (url: string, init?: { method?: string }) => {
        if (init?.method === "DELETE") {
          const id = Number(url.split("/").pop());
          customers = customers.filter((c) => c.id !== id);
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => customers };
      },
    );
  });

  const renderList = () =>
    renderHook(
      () =>
        useEntityList<TestCustomer>({
          resource: "customers",
          singularLabel: "customer",
        }),
      { wrapper: createQueryWrapper() },
    );

  it("loads the list from the resource's API route", async () => {
    const { result } = renderList();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith("/api/customers");
  });

  it("returns an empty list when loading fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Database unavailable" }),
    });
    const { result } = renderList();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it("opens and closes the form for adding and editing", async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    act(() => result.current.openEditForm(customers[0]));
    expect(result.current.isFormOpen).toBe(true);
    expect(result.current.editingItem).toEqual({ id: 1, customer: "Acme" });

    act(() => result.current.closeForm());
    expect(result.current.isFormOpen).toBe(false);
    expect(result.current.editingItem).toBeNull();

    act(() => result.current.openAddForm());
    expect(result.current.isFormOpen).toBe(true);
    expect(result.current.editingItem).toBeNull();
  });

  it("deletes the selected rows, reports success and refetches", async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(() => result.current.requestMultiDelete([customers[0]]));
    expect(result.current.deleteDialogOpen).toBe(true);

    await act(() => result.current.confirmMultiDelete());

    expect(mockFetch).toHaveBeenCalledWith("/api/customers/1", {
      method: "DELETE",
    });
    expect(mockToast).toHaveBeenCalledWith({
      title: "Customers deleted successfully",
      description: "1 customer deleted",
      variant: "default",
    });
    expect(result.current.deleteDialogOpen).toBe(false);
    expect(result.current.itemsToDelete).toEqual([]);
    await waitFor(() =>
      expect(result.current.items).toEqual([{ id: 2, customer: "Globex" }]),
    );
  });

  it("reports partial failures when a delete is rejected by the server", async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    mockFetch.mockImplementation(
      async (_url: string, init?: { method?: string }) =>
        init?.method === "DELETE"
          ? { ok: false, status: 409, json: async () => ({}) }
          : { ok: true, status: 200, json: async () => customers },
    );

    await act(() => result.current.deleteItems({ items: customers }));

    expect(mockToast).toHaveBeenCalledWith({
      title: "Some deletions failed",
      description: "Please refresh and try again",
      variant: "destructive",
    });
  });

  it("rethrows the server's error when deleting a single row fails", async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Customer has jobs" }),
    });

    await expect(
      act(() => result.current.deleteItem({ item: customers[0] })),
    ).rejects.toThrow("Customer has jobs");
    expect(result.current.loadingRowId).toBeNull();
  });
});
