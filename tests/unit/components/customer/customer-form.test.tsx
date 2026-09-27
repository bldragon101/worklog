import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { CustomerForm } from "@/components/entities/customer/customer-form";
import { useDefaultFuelLevy } from "@/hooks/use-default-fuel-levy";

vi.mock("@/hooks/use-default-fuel-levy");

const mockDefault = ({ data }: { data: number | null | undefined }) => {
  (useDefaultFuelLevy as vi.Mock).mockReturnValue({ data });
};

describe("CustomerForm default fuel levy", () => {
  const renderForm = ({ onSubmit = vi.fn() } = {}) => {
    const props = { isOpen: true, onClose: vi.fn(), onSubmit };
    const view = render(<CustomerForm {...props} />);
    return { ...view, props };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps typed values when the default fuel levy arrives late", async () => {
    const user = userEvent.setup();
    mockDefault({ data: undefined });
    const { rerender, props } = renderForm();

    await user.type(screen.getByLabelText("Customer *"), "Acme Freight");

    mockDefault({ data: 15.69 });
    rerender(<CustomerForm {...props} />);

    expect(screen.getByLabelText("Customer *")).toHaveValue("Acme Freight");
    expect(screen.getByLabelText("Custom fuel levy percentage")).toHaveValue(
      "15.69",
    );
  });

  it("submits the default fuel levy and includes tolls for a new customer", async () => {
    const user = userEvent.setup();
    mockDefault({ data: 15.69 });
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await user.type(screen.getByLabelText("Customer *"), "Acme Freight");
    await user.type(screen.getByLabelText("Bill To *"), "Acme Pty Ltd");
    await user.type(screen.getByLabelText("Contact *"), "Jo");
    await user.type(screen.getByLabelText("Tray *"), "100");
    await user.type(screen.getByLabelText("Crane *"), "150");
    await user.type(screen.getByLabelText("Semi *"), "200");
    await user.type(screen.getByLabelText("Semi Crane *"), "250");
    await user.click(screen.getByRole("button", { name: "Add Customer" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "Acme Freight",
        tray: 100,
        semiCrane: 250,
        fuelLevy: 15.69,
        tolls: true,
      }),
    );
  });

  it("requires a fuel levy for a new customer when no default is set", async () => {
    const user = userEvent.setup();
    mockDefault({ data: null });
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await user.type(screen.getByLabelText("Customer *"), "Acme Freight");
    await user.type(screen.getByLabelText("Bill To *"), "Acme Pty Ltd");
    await user.type(screen.getByLabelText("Contact *"), "Jo");
    await user.type(screen.getByLabelText("Tray *"), "100");
    await user.type(screen.getByLabelText("Crane *"), "150");
    await user.type(screen.getByLabelText("Semi *"), "200");
    await user.type(screen.getByLabelText("Semi Crane *"), "250");
    await user.click(screen.getByRole("button", { name: "Add Customer" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Fuel levy is required");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes without a confirmation when nothing was changed", async () => {
    const user = userEvent.setup();
    mockDefault({ data: 15.69 });
    const { props } = renderForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onClose).toHaveBeenCalled();
    expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
  });
});
