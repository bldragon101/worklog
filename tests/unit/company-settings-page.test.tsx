import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CompanySettingsPage from "@/app/settings/company/page";
import { DEFAULT_FUEL_LEVY_QUERY_KEY } from "@/hooks/use-default-fuel-levy";

vi.mock("@/components/layout/protected-layout", () => ({
  ProtectedLayout: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/auth/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/brand/icon-logo", () => ({
  PageHeader: () => null,
}));
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("CompanySettingsPage", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockImplementation(
      async (_url: string, init?: { method?: string }) => ({
        ok: true,
        json: async () =>
          init?.method === "POST"
            ? { id: 1, companyName: "Acme Freight" }
            : { companyName: "" },
      }),
    );
  });

  it("refreshes the fuel levy settings after saving company details", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    render(
      <QueryClientProvider client={queryClient}>
        <CompanySettingsPage />
      </QueryClientProvider>,
    );

    const nameInput = await screen.findByLabelText(/Company Name/);
    await user.type(nameInput, "Acme Freight");
    await user.click(screen.getByRole("button", { name: /Save Settings/ }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: DEFAULT_FUEL_LEVY_QUERY_KEY,
      }),
    );
  });
  it("confirms the save without waiting for the fuel levy refresh", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockReturnValue(
      new Promise<void>(() => {}),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <CompanySettingsPage />
      </QueryClientProvider>,
    );

    const nameInput = await screen.findByLabelText(/Company Name/);
    await user.type(nameInput, "Acme Freight");
    await user.click(screen.getByRole("button", { name: /Save Settings/ }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Settings Saved" }),
      ),
    );
    expect(screen.getByRole("button", { name: /Save Settings/ })).toBeEnabled();
  });
});
