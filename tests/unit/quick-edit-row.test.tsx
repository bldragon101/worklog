import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QuickEditRow } from "@/components/entities/job/quick-edit-row";
import type { Job } from "@/lib/types";

jest.mock("@/components/entities/job/inline-cell-select", () => ({
  InlineCellSelect: ({
    id,
    value,
    onChange,
    options,
  }: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
  }) => (
    <select
      data-testid={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select...</option>
      {options.map((opt: string) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  ),
}));

jest.mock("@/components/custom/table", () => {
  const { forwardRef } = require("react");
  const MockTableRow = forwardRef(function TableRow(
    {
      children,
      className,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
    },
    ref: React.Ref<HTMLTableRowElement>,
  ) {
    return (
      <tr ref={ref} className={className} {...props}>
        {children}
      </tr>
    );
  });
  MockTableRow.displayName = "TableRow";
  return {
    Table: ({ children, ...props }: { children: React.ReactNode }) => (
      <table {...props}>{children}</table>
    ),
    TableBody: ({ children, ...props }: { children: React.ReactNode }) => (
      <tbody {...props}>{children}</tbody>
    ),
    TableCell: ({
      children,
      className,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
      colSpan?: number;
    }) => (
      <td className={className} {...props}>
        {children}
      </td>
    ),
    TableHead: ({ children, ...props }: { children: React.ReactNode }) => (
      <th {...props}>{children}</th>
    ),
    TableHeader: ({ children, ...props }: { children: React.ReactNode }) => (
      <thead {...props}>{children}</thead>
    ),
    TableRow: MockTableRow,
  };
});

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
    className,
  }: {
    id: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    className?: string;
  }) => (
    <input
      type="checkbox"
      id={id}
      data-testid={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className={className}
    />
  ),
}));

jest.mock("@/lib/utils/time-utils", () => {
  const actual = jest.requireActual("@/lib/utils/time-utils");
  return {
    ...actual,
    extractTimeFromISO: (isoString: string | null) => {
      if (!isoString) return "";
      if (isoString.length >= 16) return isoString.substring(11, 16);
      return "";
    },
  };
});

const defaultOptions = {
  customerOptions: ["ABC Company", "XYZ Corp"],
  billToOptions: ["ABC Company", "XYZ Corp"],
  registrationOptions: ["ABC123", "XYZ789"],
  truckTypeOptions: ["Tray", "Van"],
  driverOptions: ["John Doe", "Jane Smith"],
  selectsLoading: false,
  customerToBillTo: { "ABC Company": "ABC Company" } as Record<string, string>,
  registrationToType: { ABC123: "Tray" } as Record<string, string>,
  driverToTruck: { "John Doe": "ABC123" } as Record<string, string>,
};

const sampleRow: Partial<Job> = {
  date: "2025-01-15",
  driver: "John Doe",
  customer: "ABC Company",
  billTo: "ABC Company",
  registration: "ABC123",
  truckType: "Tray",
  pickup: "Melbourne",
  dropoff: "Sydney",
  runsheet: false,
  invoiced: false,
  chargedHours: 8,
  startTime: "2025-01-15T06:00:00.000Z",
  finishTime: "2025-01-15T14:00:00.000Z",
  eastlink: 0,
  citylink: 0,
  comments: "Test comment",
};

type PropsOverrides = Partial<{
  row: Partial<Job>;
  rowKey: string;
  isNew: boolean;
  isDeleted: boolean;
  cellErrors: Record<string, string>;
  onCellChange: jest.Mock;
  onDeleteRow: jest.Mock;
  activeCell: string | null;
  onCellFocus: jest.Mock;
  options: typeof defaultOptions;
}>;

function buildProps({
  overrides,
}: {
  overrides?: PropsOverrides;
} = {}) {
  return {
    row: overrides?.row ?? sampleRow,
    rowKey: overrides?.rowKey ?? "row-1",
    isNew: overrides?.isNew ?? false,
    isDeleted: overrides?.isDeleted ?? false,
    cellErrors: overrides?.cellErrors ?? {},
    onCellChange: overrides?.onCellChange ?? jest.fn(),
    onDeleteRow: overrides?.onDeleteRow ?? jest.fn(),
    activeCell: overrides?.activeCell ?? null,
    onCellFocus: overrides?.onCellFocus ?? jest.fn(),
    options: overrides?.options ?? defaultOptions,
  };
}

function renderComponent({
  overrides,
}: {
  overrides?: PropsOverrides;
} = {}) {
  const props = buildProps({ overrides });
  const result = render(
    <table>
      <tbody>
        <QuickEditRow {...props} />
      </tbody>
    </table>,
  );
  return { ...result, props };
}

describe("QuickEditRow", () => {
  describe("rendering", () => {
    it("renders date input with correct value", () => {
      renderComponent();
      const dateInput = document.getElementById(
        "row-1:date",
      ) as HTMLInputElement;
      expect(dateInput).toBeInTheDocument();
      expect(dateInput.value).toBe("2025-01-15");
    });

    it("renders pickup input with correct value", () => {
      renderComponent();
      const pickupInput = document.getElementById(
        "row-1:pickup",
      ) as HTMLInputElement;
      expect(pickupInput).toBeInTheDocument();
      expect(pickupInput.value).toBe("Melbourne");
    });

    it("renders dropoff input with correct value", () => {
      renderComponent();
      const dropoffInput = document.getElementById(
        "row-1:dropoff",
      ) as HTMLInputElement;
      expect(dropoffInput).toBeInTheDocument();
      expect(dropoffInput.value).toBe("Sydney");
    });

    it("renders comments input with correct value", () => {
      renderComponent();
      const commentsInput = document.getElementById(
        "row-1:comments",
      ) as HTMLInputElement;
      expect(commentsInput).toBeInTheDocument();
      expect(commentsInput.value).toBe("Test comment");
    });

    it("renders startTime input with extracted time", () => {
      renderComponent();
      const startInput = document.getElementById(
        "row-1:startTime",
      ) as HTMLInputElement;
      expect(startInput).toBeInTheDocument();
      expect(startInput.value).toBe("06:00");
    });

    it("renders finishTime input with extracted time", () => {
      renderComponent();
      const finishInput = document.getElementById(
        "row-1:finishTime",
      ) as HTMLInputElement;
      expect(finishInput).toBeInTheDocument();
      expect(finishInput.value).toBe("14:00");
    });

    it("renders chargedHours input with correct value", () => {
      renderComponent();
      const hoursInput = document.getElementById(
        "row-1:chargedHours",
      ) as HTMLInputElement;
      expect(hoursInput).toBeInTheDocument();
      expect(hoursInput.value).toBe("8");
    });

    it("renders eastlink input with correct value", () => {
      renderComponent();
      const eastlinkInput = document.getElementById(
        "row-1:eastlink",
      ) as HTMLInputElement;
      expect(eastlinkInput).toBeInTheDocument();
      expect(eastlinkInput.value).toBe("0");
    });

    it("renders citylink input with correct value", () => {
      renderComponent();
      const citylinkInput = document.getElementById(
        "row-1:citylink",
      ) as HTMLInputElement;
      expect(citylinkInput).toBeInTheDocument();
      expect(citylinkInput.value).toBe("0");
    });

    it("renders driver select with correct value", () => {
      renderComponent();
      const driverSelect = screen.getByTestId(
        "row-1:driver",
      ) as HTMLSelectElement;
      expect(driverSelect).toBeInTheDocument();
      expect(driverSelect.value).toBe("John Doe");
    });

    it("renders customer select with correct value", () => {
      renderComponent();
      const customerSelect = screen.getByTestId(
        "row-1:customer",
      ) as HTMLSelectElement;
      expect(customerSelect).toBeInTheDocument();
      expect(customerSelect.value).toBe("ABC Company");
    });

    it("renders billTo select with correct value", () => {
      renderComponent();
      const billToSelect = screen.getByTestId(
        "row-1:billTo",
      ) as HTMLSelectElement;
      expect(billToSelect).toBeInTheDocument();
      expect(billToSelect.value).toBe("ABC Company");
    });

    it("renders registration select with correct value", () => {
      renderComponent();
      const registrationSelect = screen.getByTestId(
        "row-1:registration",
      ) as HTMLSelectElement;
      expect(registrationSelect).toBeInTheDocument();
      expect(registrationSelect.value).toBe("ABC123");
    });

    it("renders truckType select with correct value", () => {
      renderComponent();
      const truckTypeSelect = screen.getByTestId(
        "row-1:truckType",
      ) as HTMLSelectElement;
      expect(truckTypeSelect).toBeInTheDocument();
      expect(truckTypeSelect.value).toBe("Tray");
    });

    it("renders runsheet checkbox", () => {
      renderComponent();
      const runsheetCheckbox = screen.getByTestId(
        "row-1:runsheet",
      ) as HTMLInputElement;
      expect(runsheetCheckbox).toBeInTheDocument();
      expect(runsheetCheckbox.checked).toBe(false);
    });

    it("renders invoiced checkbox", () => {
      renderComponent();
      const invoicedCheckbox = screen.getByTestId(
        "row-1:invoiced",
      ) as HTMLInputElement;
      expect(invoicedCheckbox).toBeInTheDocument();
      expect(invoicedCheckbox.checked).toBe(false);
    });

    it("renders delete button", () => {
      renderComponent();
      const deleteButton = document.getElementById("quick-edit-delete-row-1");
      expect(deleteButton).toBeInTheDocument();
    });
  });

  describe("new row styling", () => {
    it("applies bg-primary/5 class when isNew is true", () => {
      renderComponent({ overrides: { isNew: true } });
      const row = document.querySelector("tr");
      expect(row?.className).toContain("bg-primary/5");
    });

    it("does not apply bg-primary/5 class when isNew is false", () => {
      renderComponent({ overrides: { isNew: false } });
      const row = document.querySelector("tr");
      expect(row?.className).not.toContain("bg-primary/5");
    });
  });

  describe("deleted row styling", () => {
    it("applies bg-destructive/5 class when isDeleted is true", () => {
      renderComponent({ overrides: { isDeleted: true } });
      const row = document.querySelector("tr");
      expect(row?.className).toContain("bg-destructive/5");
    });

    it("applies opacity and line-through classes to cells when isDeleted is true", () => {
      renderComponent({ overrides: { isDeleted: true } });
      const cells = document.querySelectorAll("td");
      const cellWithDriver = Array.from(cells).find((cell) =>
        cell.querySelector('[data-testid="row-1:driver"]'),
      );
      expect(cellWithDriver?.className).toContain("opacity-40");
      expect(cellWithDriver?.className).toContain("line-through");
      expect(cellWithDriver?.className).toContain("pointer-events-none");
    });

    it("does not apply deleted classes when isDeleted is false", () => {
      renderComponent({ overrides: { isDeleted: false } });
      const cells = document.querySelectorAll("td");
      const cellWithDriver = Array.from(cells).find((cell) =>
        cell.querySelector('[data-testid="row-1:driver"]'),
      );
      expect(cellWithDriver?.className).not.toContain("opacity-40");
      expect(cellWithDriver?.className).not.toContain("line-through");
    });
  });

  describe("cell error highlighting", () => {
    it("applies ring-destructive class to cells with errors", () => {
      renderComponent({
        overrides: {
          cellErrors: { "row-1:pickup": "Required field" },
        },
      });
      const pickupInput = document.getElementById("row-1:pickup");
      const cell = pickupInput?.closest("td");
      expect(cell?.className).toContain("ring-destructive");
    });

    it("does not apply ring-destructive class to cells without errors", () => {
      renderComponent({
        overrides: {
          cellErrors: { "row-1:pickup": "Required field" },
        },
      });
      const dropoffInput = document.getElementById("row-1:dropoff");
      const cell = dropoffInput?.closest("td");
      expect(cell?.className).not.toContain("ring-destructive");
    });

    it("applies ring-destructive to multiple cells with errors", () => {
      renderComponent({
        overrides: {
          cellErrors: {
            "row-1:pickup": "Required",
            "row-1:dropoff": "Required",
          },
        },
      });
      const pickupCell = document.getElementById("row-1:pickup")?.closest("td");
      const dropoffCell = document
        .getElementById("row-1:dropoff")
        ?.closest("td");
      expect(pickupCell?.className).toContain("ring-destructive");
      expect(dropoffCell?.className).toContain("ring-destructive");
    });
  });

  describe("customer auto-fill", () => {
    it("sets billTo when customer changes and mapping exists", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const customerSelect = screen.getByTestId("row-1:customer");
      fireEvent.change(customerSelect, { target: { value: "ABC Company" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "customer",
        value: "ABC Company",
      });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "billTo",
        value: "ABC Company",
      });
    });

    it("does not set billTo when customer mapping does not exist", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const customerSelect = screen.getByTestId("row-1:customer");
      fireEvent.change(customerSelect, { target: { value: "XYZ Corp" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "customer",
        value: "XYZ Corp",
      });
      expect(onCellChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ field: "billTo" }),
      );
    });
  });

  describe("driver auto-fill", () => {
    it("sets registration and truckType when driver changes and mappings exist", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const driverSelect = screen.getByTestId("row-1:driver");
      fireEvent.change(driverSelect, { target: { value: "John Doe" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "driver",
        value: "John Doe",
      });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "registration",
        value: "ABC123",
      });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "truckType",
        value: "Tray",
      });
    });

    it("does not set registration or truckType when driver mapping does not exist", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const driverSelect = screen.getByTestId("row-1:driver");
      fireEvent.change(driverSelect, { target: { value: "Jane Smith" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "driver",
        value: "Jane Smith",
      });
      expect(onCellChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ field: "registration" }),
      );
      expect(onCellChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ field: "truckType" }),
      );
    });
  });

  describe("registration auto-fill", () => {
    it("sets truckType when registration changes and mapping exists", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const registrationSelect = screen.getByTestId("row-1:registration");
      fireEvent.change(registrationSelect, { target: { value: "ABC123" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "registration",
        value: "ABC123",
      });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "truckType",
        value: "Tray",
      });
    });

    it("does not set truckType when registration mapping does not exist", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const registrationSelect = screen.getByTestId("row-1:registration");
      fireEvent.change(registrationSelect, { target: { value: "XYZ789" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "registration",
        value: "XYZ789",
      });
      expect(onCellChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ field: "truckType" }),
      );
    });
  });

  describe("time change handling", () => {
    it("calls onCellChange with ISO value when startTime changes", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const startInput = document.getElementById(
        "row-1:startTime",
      ) as HTMLInputElement;
      fireEvent.change(startInput, { target: { value: "07:00" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "startTime",
        value: "2025-01-15T07:00:00.000Z",
      });
    });

    it("calls onCellChange with ISO value when finishTime changes", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const finishInput = document.getElementById(
        "row-1:finishTime",
      ) as HTMLInputElement;
      fireEvent.change(finishInput, { target: { value: "15:00" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "finishTime",
        value: "2025-01-15T15:00:00.000Z",
      });
    });

    it("auto-calculates chargedHours when both start and finish times are present", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const finishInput = document.getElementById(
        "row-1:finishTime",
      ) as HTMLInputElement;
      fireEvent.change(finishInput, { target: { value: "16:00" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "chargedHours",
        value: 10,
      });
    });

    it("handles overnight shift calculation correctly", () => {
      const onCellChange = jest.fn();
      renderComponent({
        overrides: {
          onCellChange,
          row: {
            ...sampleRow,
            startTime: "2025-01-15T22:00:00.000Z",
            finishTime: null,
          },
        },
      });
      const finishInput = document.getElementById(
        "row-1:finishTime",
      ) as HTMLInputElement;
      fireEvent.change(finishInput, { target: { value: "06:00" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "chargedHours",
        value: 8,
      });
    });

    it("sets value to null when time input is cleared", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const startInput = document.getElementById(
        "row-1:startTime",
      ) as HTMLInputElement;
      fireEvent.change(startInput, { target: { value: "" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "startTime",
        value: null,
      });
    });
  });

  describe("delete button", () => {
    it("calls onDeleteRow with rowKey when delete button is clicked", () => {
      const onDeleteRow = jest.fn();
      renderComponent({ overrides: { onDeleteRow } });
      const deleteButton = document.getElementById(
        "quick-edit-delete-row-1",
      ) as HTMLButtonElement;
      fireEvent.click(deleteButton);
      expect(onDeleteRow).toHaveBeenCalledTimes(1);
      expect(onDeleteRow).toHaveBeenCalledWith({ rowKey: "row-1" });
    });
  });

  describe("cell focus", () => {
    it("calls onCellFocus with correct cellId when date input is focused", () => {
      const onCellFocus = jest.fn();
      renderComponent({ overrides: { onCellFocus } });
      const dateInput = document.getElementById(
        "row-1:date",
      ) as HTMLInputElement;
      fireEvent.focus(dateInput);
      expect(onCellFocus).toHaveBeenCalledWith({ cellId: "row-1:date" });
    });

    it("calls onCellFocus with correct cellId when pickup input is focused", () => {
      const onCellFocus = jest.fn();
      renderComponent({ overrides: { onCellFocus } });
      const pickupInput = document.getElementById(
        "row-1:pickup",
      ) as HTMLInputElement;
      fireEvent.focus(pickupInput);
      expect(onCellFocus).toHaveBeenCalledWith({ cellId: "row-1:pickup" });
    });

    it("calls onCellFocus with correct cellId when dropoff input is focused", () => {
      const onCellFocus = jest.fn();
      renderComponent({ overrides: { onCellFocus } });
      const dropoffInput = document.getElementById(
        "row-1:dropoff",
      ) as HTMLInputElement;
      fireEvent.focus(dropoffInput);
      expect(onCellFocus).toHaveBeenCalledWith({ cellId: "row-1:dropoff" });
    });

    it("calls onCellFocus with correct cellId when startTime input is focused", () => {
      const onCellFocus = jest.fn();
      renderComponent({ overrides: { onCellFocus } });
      const startInput = document.getElementById(
        "row-1:startTime",
      ) as HTMLInputElement;
      fireEvent.focus(startInput);
      expect(onCellFocus).toHaveBeenCalledWith({ cellId: "row-1:startTime" });
    });

    it("calls onCellFocus with correct cellId when finishTime input is focused", () => {
      const onCellFocus = jest.fn();
      renderComponent({ overrides: { onCellFocus } });
      const finishInput = document.getElementById(
        "row-1:finishTime",
      ) as HTMLInputElement;
      fireEvent.focus(finishInput);
      expect(onCellFocus).toHaveBeenCalledWith({ cellId: "row-1:finishTime" });
    });

    it("calls onCellFocus with correct cellId when chargedHours input is focused", () => {
      const onCellFocus = jest.fn();
      renderComponent({ overrides: { onCellFocus } });
      const hoursInput = document.getElementById(
        "row-1:chargedHours",
      ) as HTMLInputElement;
      fireEvent.focus(hoursInput);
      expect(onCellFocus).toHaveBeenCalledWith({
        cellId: "row-1:chargedHours",
      });
    });

    it("calls onCellFocus with correct cellId when comments input is focused", () => {
      const onCellFocus = jest.fn();
      renderComponent({ overrides: { onCellFocus } });
      const commentsInput = document.getElementById(
        "row-1:comments",
      ) as HTMLInputElement;
      fireEvent.focus(commentsInput);
      expect(onCellFocus).toHaveBeenCalledWith({ cellId: "row-1:comments" });
    });

    it("calls onCellFocus with correct cellId when eastlink input is focused", () => {
      const onCellFocus = jest.fn();
      renderComponent({ overrides: { onCellFocus } });
      const eastlinkInput = document.getElementById(
        "row-1:eastlink",
      ) as HTMLInputElement;
      fireEvent.focus(eastlinkInput);
      expect(onCellFocus).toHaveBeenCalledWith({ cellId: "row-1:eastlink" });
    });

    it("calls onCellFocus with correct cellId when citylink input is focused", () => {
      const onCellFocus = jest.fn();
      renderComponent({ overrides: { onCellFocus } });
      const citylinkInput = document.getElementById(
        "row-1:citylink",
      ) as HTMLInputElement;
      fireEvent.focus(citylinkInput);
      expect(onCellFocus).toHaveBeenCalledWith({ cellId: "row-1:citylink" });
    });
  });

  describe("cell change callbacks", () => {
    it("calls onCellChange when pickup input changes", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const pickupInput = document.getElementById(
        "row-1:pickup",
      ) as HTMLInputElement;
      fireEvent.change(pickupInput, { target: { value: "Brisbane" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "pickup",
        value: "Brisbane",
      });
    });

    it("calls onCellChange when dropoff input changes", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const dropoffInput = document.getElementById(
        "row-1:dropoff",
      ) as HTMLInputElement;
      fireEvent.change(dropoffInput, { target: { value: "Adelaide" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "dropoff",
        value: "Adelaide",
      });
    });

    it("calls onCellChange when date input changes", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const dateInput = document.getElementById(
        "row-1:date",
      ) as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: "2025-02-01" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "date",
        value: "2025-02-01",
      });
    });

    it("calls onCellChange when comments input changes", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const commentsInput = document.getElementById(
        "row-1:comments",
      ) as HTMLInputElement;
      fireEvent.change(commentsInput, { target: { value: "Updated comment" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "comments",
        value: "Updated comment",
      });
    });

    it("calls onCellChange when runsheet checkbox changes", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const runsheetCheckbox = screen.getByTestId(
        "row-1:runsheet",
      ) as HTMLInputElement;
      fireEvent.click(runsheetCheckbox);
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "runsheet",
        value: true,
      });
    });

    it("calls onCellChange when invoiced checkbox changes", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const invoicedCheckbox = screen.getByTestId(
        "row-1:invoiced",
      ) as HTMLInputElement;
      fireEvent.click(invoicedCheckbox);
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "invoiced",
        value: true,
      });
    });

    it("calls onCellChange with null for empty chargedHours", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const hoursInput = document.getElementById(
        "row-1:chargedHours",
      ) as HTMLInputElement;
      fireEvent.change(hoursInput, { target: { value: "" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "chargedHours",
        value: null,
      });
    });

    it("calls onCellChange with parsed number for chargedHours", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const hoursInput = document.getElementById(
        "row-1:chargedHours",
      ) as HTMLInputElement;
      fireEvent.change(hoursInput, { target: { value: "10.5" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "chargedHours",
        value: 10.5,
      });
    });

    it("calls onCellChange with null for empty eastlink", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const eastlinkInput = document.getElementById(
        "row-1:eastlink",
      ) as HTMLInputElement;
      fireEvent.change(eastlinkInput, { target: { value: "" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "eastlink",
        value: null,
      });
    });

    it("calls onCellChange with parsed integer for eastlink", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const eastlinkInput = document.getElementById(
        "row-1:eastlink",
      ) as HTMLInputElement;
      fireEvent.change(eastlinkInput, { target: { value: "3" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "eastlink",
        value: 3,
      });
    });

    it("calls onCellChange when billTo select changes directly", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const billToSelect = screen.getByTestId("row-1:billTo");
      fireEvent.change(billToSelect, { target: { value: "XYZ Corp" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "billTo",
        value: "XYZ Corp",
      });
    });

    it("calls onCellChange when truckType select changes directly", () => {
      const onCellChange = jest.fn();
      renderComponent({ overrides: { onCellChange } });
      const truckTypeSelect = screen.getByTestId("row-1:truckType");
      fireEvent.change(truckTypeSelect, { target: { value: "Van" } });
      expect(onCellChange).toHaveBeenCalledWith({
        rowKey: "row-1",
        field: "truckType",
        value: "Van",
      });
    });
  });

  describe("active cell highlighting", () => {
    it("applies ring-primary class to the active cell", () => {
      renderComponent({ overrides: { activeCell: "row-1:pickup" } });
      const pickupInput = document.getElementById("row-1:pickup");
      const cell = pickupInput?.closest("td");
      expect(cell?.className).toContain("ring-primary");
    });

    it("does not apply ring-primary class to non-active cells", () => {
      renderComponent({ overrides: { activeCell: "row-1:pickup" } });
      const dropoffInput = document.getElementById("row-1:dropoff");
      const cell = dropoffInput?.closest("td");
      expect(cell?.className).not.toContain("ring-primary");
    });
  });

  describe("empty row values", () => {
    it("renders empty inputs when row fields are undefined", () => {
      renderComponent({
        overrides: {
          row: { date: "2025-01-15" },
        },
      });
      const pickupInput = document.getElementById(
        "row-1:pickup",
      ) as HTMLInputElement;
      const dropoffInput = document.getElementById(
        "row-1:dropoff",
      ) as HTMLInputElement;
      const commentsInput = document.getElementById(
        "row-1:comments",
      ) as HTMLInputElement;
      expect(pickupInput.value).toBe("");
      expect(dropoffInput.value).toBe("");
      expect(commentsInput.value).toBe("");
    });

    it("renders empty time inputs when startTime and finishTime are null", () => {
      renderComponent({
        overrides: {
          row: { ...sampleRow, startTime: null, finishTime: null },
        },
      });
      const startInput = document.getElementById(
        "row-1:startTime",
      ) as HTMLInputElement;
      const finishInput = document.getElementById(
        "row-1:finishTime",
      ) as HTMLInputElement;
      expect(startInput.value).toBe("");
      expect(finishInput.value).toBe("");
    });
  });
});
