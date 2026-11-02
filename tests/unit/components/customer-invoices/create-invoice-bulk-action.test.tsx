import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateInvoiceBulkAction } from "@/components/customer-invoices/create-invoice-bulk-action";
import type { Job } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  toast: vi.fn(),
  checkPermission: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ fetchJson: mocks.fetchJson }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ checkPermission: mocks.checkPermission }),
}));

const jobs = [{ id: 11 }, { id: 12 }] as Job[];

function renderAction({ onCreated = vi.fn() }: { onCreated?: () => void } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CreateInvoiceBulkAction jobs={jobs} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return { onCreated };
}

describe("CreateInvoiceBulkAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkPermission.mockReturnValue(true);
  });

  it("is hidden without the manage_invoices permission", () => {
    mocks.checkPermission.mockReturnValue(false);
    renderAction();

    expect(screen.queryByRole("button", { name: "Create invoice" })).not.toBeInTheDocument();
    expect(mocks.checkPermission).toHaveBeenCalledWith("manage_invoices");
  });

  it("creates an invoice from the selected jobs and links to its week", async () => {
    mocks.fetchJson.mockResolvedValue({
      reference: "Acme-01/11/26",
      customerName: "Acme",
      weekEnding: "2026-11-01",
    });
    const { onCreated } = renderAction();

    await userEvent.setup().click(screen.getByRole("button", { name: "Create invoice" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const [{ url, init }] = mocks.fetchJson.mock.calls[0];
    expect(url).toBe("/api/customer-invoices");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ jobIds: [11, 12] });
    const toastArgs = mocks.toast.mock.calls[0][0];
    expect(toastArgs.title).toBe("Invoice created");
    expect(toastArgs.action.props.children.props.href).toBe("/invoices?weekEnding=2026-11-01");
  });

  it("shows the server's error and keeps the selection when the jobs cannot be invoiced together", async () => {
    mocks.fetchJson.mockRejectedValue(new Error("All jobs must be in the same week"));
    const { onCreated } = renderAction();

    await userEvent.setup().click(screen.getByRole("button", { name: "Create invoice" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Could not create invoice",
        description: "All jobs must be in the same week",
        variant: "destructive",
      }),
    );
    expect(onCreated).not.toHaveBeenCalled();
  });
});
