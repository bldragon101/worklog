import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { CustomerBulkUpdateDialog } from "@/components/entities/customer/customer-bulk-update-dialog";
import { useDefaultFuelLevy } from "@/hooks/use-default-fuel-levy";
import type { Customer } from "@/lib/types";

vi.mock("@/hooks/use-default-fuel-levy");

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const makeCustomer = ({ id }: { id: number }): Customer => ({
  id,
  customer: `Customer ${id}`,
  billTo: `Bill To ${id}`,
  contact: "",
  tray: 100,
  crane: 150,
  semi: 200,
  semiCrane: 250,
  fuelLevy: 10,
  tolls: false,
  breakDeduction: null,
  comments: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("CustomerBulkUpdateDialog", () => {
  const mockFetch = vi.fn();
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const customers = [makeCustomer({ id: 1 }), makeCustomer({ id: 2 })];

  const renderDialog = () =>
    render(
      <CustomerBulkUpdateDialog
        open
        onOpenChange={onOpenChange}
        customers={customers}
        onSuccess={onSuccess}
      />,
    );

  const sentBody = () => JSON.parse(mockFetch.mock.calls[0][1].body);

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    (useDefaultFuelLevy as vi.Mock).mockReturnValue({ data: 15.69 });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, updatedCount: 2 }),
    });
  });

  it("disables submit and inputs until a field is ticked", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: "Update 2 Customers" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Tray rate")).toBeDisabled();
  });

  it("sends only the ticked fields", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByLabelText("Tray"));
    await user.type(screen.getByLabelText("Tray rate"), "180");
    await user.click(screen.getByLabelText("Tolls"));
    await user.click(screen.getByRole("button", { name: "Update 2 Customers" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/customers/bulk",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(sentBody()).toEqual({
      customerIds: [1, 2],
      updates: { tray: 180, tolls: true },
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("prefills the fuel levy with the default when ticked", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByLabelText("Fuel Levy"));
    await user.click(screen.getByRole("button", { name: "Update 2 Customers" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(sentBody().updates).toEqual({ fuelLevy: 15.69 });
  });

  it("shows an error for an empty ticked rate without calling the API", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByLabelText("Semi"));
    await user.click(screen.getByRole("button", { name: "Update 2 Customers" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Semi rate must be a whole number above zero",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows the server error and keeps the dialog open on failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Forbidden - Admin privileges required" }),
    });
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByLabelText("Tolls"));
    await user.click(screen.getByRole("button", { name: "Update 2 Customers" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Forbidden - Admin privileges required",
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
