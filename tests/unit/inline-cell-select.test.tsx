import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { InlineCellSelect } from "@/components/entities/job/inline-cell-select";

// Variable prefixed with "mock" so Jest's hoisting allows it inside the factory
let mockPopoverOpen = false;

jest.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (v: boolean) => void;
  }) => {
    mockPopoverOpen = open;
    return (
      <div data-testid="popover" data-open={open}>
        {children}
      </div>
    );
  },
  PopoverTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({
    children,
  }: {
    children: React.ReactNode;
    className?: string;
    align?: string;
    onOpenAutoFocus?: (e: Event) => void;
  }) =>
    mockPopoverOpen ? (
      <div data-testid="popover-content">{children}</div>
    ) : null,
}));

jest.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

jest.mock("lucide-react", () => ({
  Check: ({ className }: { className?: string }) => (
    <svg data-testid="check-icon" className={className} />
  ),
  ChevronDown: ({ className }: { className?: string }) => (
    <svg data-testid="chevron-down-icon" className={className} />
  ),
}));

jest.mock("@/lib/utils/utils", () => ({
  cn: (...args: (string | boolean | undefined | null)[]) =>
    args.filter(Boolean).join(" "),
}));

const defaultProps = {
  id: "test-select",
  value: "Apple",
  options: ["Apple", "Banana", "Cherry"],
  onChange: jest.fn(),
};

describe("InlineCellSelect", () => {
  beforeEach(() => {
    mockPopoverOpen = false;
    defaultProps.onChange.mockClear();
  });

  it("renders a button with the correct id", () => {
    render(<InlineCellSelect {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("id", "test-select");
  });

  it("displays the current value in the button", () => {
    render(<InlineCellSelect {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Apple");
  });

  it("displays placeholder when value is empty", () => {
    render(
      <InlineCellSelect
        {...defaultProps}
        value=""
        placeholder="Select an option"
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Select an option");
  });

  it("renders the ChevronDown icon inside the button", () => {
    render(<InlineCellSelect {...defaultProps} />);

    expect(screen.getByTestId("chevron-down-icon")).toBeInTheDocument();
  });

  it("calls onFocus when the button is clicked", () => {
    const mockOnFocus = jest.fn();
    render(<InlineCellSelect {...defaultProps} onFocus={mockOnFocus} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it('renders the button with type="button"', () => {
    render(<InlineCellSelect {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "button");
  });

  it("filters options via the search input using case-insensitive substring matching", () => {
    const options = ["Apple", "Banana", "Cherry", "Mango", "Avocado"];
    render(<InlineCellSelect {...defaultProps} options={options} />);

    // Open the popover
    fireEvent.click(screen.getByRole("button"));

    const input = screen.getByPlaceholderText("Search...");

    // All options visible with empty query
    expect(screen.getAllByRole("option")).toHaveLength(5);

    // Filter by "an" — substring match
    fireEvent.change(input, { target: { value: "an" } });
    let items = screen.getAllByRole("option");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Banana");
    expect(items[1]).toHaveTextContent("Mango");

    // Case-insensitive "A"
    fireEvent.change(input, { target: { value: "A" } });
    items = screen.getAllByRole("option");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Apple");
    expect(items[1]).toHaveTextContent("Banana");
    expect(items[2]).toHaveTextContent("Mango");
    expect(items[3]).toHaveTextContent("Avocado");

    // Exact lowercase match
    fireEvent.change(input, { target: { value: "cherry" } });
    items = screen.getAllByRole("option");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Cherry");

    // No matches
    fireEvent.change(input, { target: { value: "xyz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);

    // Clear filter shows all again
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });

  it("renders all options in the popover content after opening", () => {
    render(<InlineCellSelect {...defaultProps} />);

    // PopoverContent is not rendered while closed
    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();

    // Open the popover
    fireEvent.click(screen.getByRole("button"));

    const popoverContent = screen.getByTestId("popover-content");
    expect(popoverContent).toHaveTextContent("Apple");
    expect(popoverContent).toHaveTextContent("Banana");
    expect(popoverContent).toHaveTextContent("Cherry");
  });

  it("renders a check icon for each option", () => {
    render(<InlineCellSelect {...defaultProps} />);

    fireEvent.click(screen.getByRole("button"));

    const checkIcons = screen.getAllByTestId("check-icon");
    expect(checkIcons).toHaveLength(3);
  });

  it("shows loading text when loading is true", () => {
    render(<InlineCellSelect {...defaultProps} loading={true} />);

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it('shows "No options." when options array is empty', () => {
    render(<InlineCellSelect {...defaultProps} options={[]} />);

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("No options.")).toBeInTheDocument();
  });

  it("sets popover open data attribute to false initially", () => {
    render(<InlineCellSelect {...defaultProps} />);

    const popover = screen.getByTestId("popover");
    expect(popover).toHaveAttribute("data-open", "false");
    expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument();
  });

  it("does not call onFocus on render without interaction", () => {
    const mockOnFocus = jest.fn();
    render(<InlineCellSelect {...defaultProps} onFocus={mockOnFocus} />);

    expect(mockOnFocus).not.toHaveBeenCalled();
  });
});
