import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { SearchableSelect } from "@/components/shared/searchable-select";

describe("SearchableSelect Enter key", () => {
  const options = ["Acme Freight", "Acme Freight North", "Bolt Logistics"];

  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  const typeAndEnter = async ({
    query,
    allowCustomValue,
  }: {
    query: string;
    allowCustomValue: boolean;
  }) => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SearchableSelect
        id="customer-select"
        options={options}
        onChange={onChange}
        placeholder="Select customer"
        allowCustomValue={allowCustomValue}
      />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.type(
      screen.getByPlaceholderText("Search select customer..."),
      `${query}{Enter}`,
    );
    return onChange;
  };

  it("selects an exact case-insensitive match when custom values are disabled", async () => {
    const onChange = await typeAndEnter({
      query: "acme freight",
      allowCustomValue: false,
    });
    expect(onChange).toHaveBeenCalledWith("Acme Freight");
  });

  it("ignores unmatched text and hides the custom hint when disabled", async () => {
    const onChange = await typeAndEnter({
      query: "Unknown Co",
      allowCustomValue: false,
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/as custom/)).not.toBeInTheDocument();
  });

  it("accepts unmatched text when custom values are allowed", async () => {
    const onChange = await typeAndEnter({
      query: "Unknown Co",
      allowCustomValue: true,
    });
    expect(onChange).toHaveBeenCalledWith("Unknown Co");
  });
});
