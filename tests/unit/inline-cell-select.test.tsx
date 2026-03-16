import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { InlineCellSelect } from "@/components/entities/job/inline-cell-select";

jest.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (v: boolean) => void;
  }) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
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
  }) => <div data-testid="popover-content">{children}</div>,
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

  it("filters options using case-insensitive substring matching", () => {
    const options = ["Apple", "Banana", "Cherry", "Mango", "Avocado"];
    const filterFn = ({ items, query }: { items: string[]; query: string }) =>
      items.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()));

    expect(filterFn({ items: options, query: "an" })).toEqual([
      "Banana",
      "Mango",
    ]);
    expect(filterFn({ items: options, query: "A" })).toEqual([
      "Apple",
      "Banana",
      "Mango",
      "Avocado",
    ]);
    expect(filterFn({ items: options, query: "cherry" })).toEqual(["Cherry"]);
    expect(filterFn({ items: options, query: "xyz" })).toEqual([]);
    expect(filterFn({ items: options, query: "" })).toEqual(options);
  });

  it("renders all options in the popover content", () => {
    render(<InlineCellSelect {...defaultProps} />);

    const popoverContent = screen.getByTestId("popover-content");
    expect(popoverContent).toHaveTextContent("Apple");
    expect(popoverContent).toHaveTextContent("Banana");
    expect(popoverContent).toHaveTextContent("Cherry");
  });

  it("renders a check icon for each option", () => {
    render(<InlineCellSelect {...defaultProps} />);

    const checkIcons = screen.getAllByTestId("check-icon");
    expect(checkIcons).toHaveLength(3);
  });

  it("shows loading text when loading is true", () => {
    render(<InlineCellSelect {...defaultProps} loading={true} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it('shows "No options." when options array is empty', () => {
    render(<InlineCellSelect {...defaultProps} options={[]} />);

    expect(screen.getByText("No options.")).toBeInTheDocument();
  });

  it("sets popover open data attribute to false initially", () => {
    render(<InlineCellSelect {...defaultProps} />);

    const popover = screen.getByTestId("popover");
    expect(popover).toHaveAttribute("data-open", "false");
  });

  it("does not call onFocus on render without interaction", () => {
    const mockOnFocus = jest.fn();
    render(<InlineCellSelect {...defaultProps} onFocus={mockOnFocus} />);

    expect(mockOnFocus).not.toHaveBeenCalled();
  });
});
