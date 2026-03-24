import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { QuickEditTable } from "@/components/entities/job/quick-edit-table";
import type { Job } from "@/lib/types";

global.fetch = jest.fn();

const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("@/hooks/use-job-form-options", () => ({
  useJobFormOptions: () => ({
    customerOptions: ["ABC Company", "XYZ Corp"],
    billToOptions: ["ABC Company", "XYZ Corp"],
    registrationOptions: ["ABC123", "XYZ789"],
    truckTypeOptions: ["Tray", "Van"],
    driverOptions: ["John Doe", "Jane Smith"],
    selectsLoading: false,
    customerToBillTo: { "ABC Company": "ABC Company" },
    registrationToType: { ABC123: "Tray" },
    driverToTruck: { "John Doe": "ABC123" },
  }),
}));

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

jest.mock("@/components/custom/table", () => ({
  Table: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    const { className: _c, ...rest } = props;
    return <table {...rest}>{children}</table>;
  },
  TableBody: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    const { className: _c, ...rest } = props;
    return <tbody {...rest}>{children}</tbody>;
  },
  TableCell: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    const { className: _c, ...rest } = props;
    return <td {...rest}>{children}</td>;
  },
  TableHead: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    const { className: _c, ...rest } = props;
    return <th {...rest}>{children}</th>;
  },
  TableHeader: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    const { className: _c, ...rest } = props;
    return <thead {...rest}>{children}</thead>;
  },
  TableRow: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => {
    const { ref: _r, className: _c, ...rest } = props;
    return <tr {...rest}>{children}</tr>;
  },
}));

jest.mock("@/lib/utils/utils", () => ({
  cn: (...args: unknown[]) =>
    args
      .flat()
      .filter((x) => typeof x === "string")
      .join(" "),
}));

const sampleJob: Job = {
  id: 1,
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
  driverCharge: null,
  startTime: "2025-01-15T06:00:00.000Z",
  finishTime: "2025-01-15T14:00:00.000Z",
  comments: null,
  jobReference: null,
  eastlink: 0,
  citylink: 0,
  attachmentRunsheet: [],
  attachmentDocket: [],
  attachmentDeliveryPhotos: [],
};

const secondJob: Job = {
  id: 2,
  date: "2025-01-16",
  driver: "Jane Smith",
  customer: "XYZ Corp",
  billTo: "XYZ Corp",
  registration: "XYZ789",
  truckType: "Van",
  pickup: "Brisbane",
  dropoff: "Perth",
  runsheet: true,
  invoiced: false,
  chargedHours: 10,
  driverCharge: null,
  startTime: "2025-01-16T05:00:00.000Z",
  finishTime: "2025-01-16T15:00:00.000Z",
  comments: "Fragile cargo",
  jobReference: null,
  eastlink: 1,
  citylink: 2,
  attachmentRunsheet: [],
  attachmentDocket: [],
  attachmentDeliveryPhotos: [],
};

describe("QuickEditTable", () => {
  const defaultProps = {
    jobs: [sampleJob],
    onBatchSaveComplete: jest.fn(),
    onHasChanges: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockToast.mockClear();
    (global.fetch as jest.Mock).mockReset();
  });

  describe("Rendering", () => {
    it("renders the table with correct column headers", () => {
      render(<QuickEditTable {...defaultProps} />);

      const expectedHeaders = [
        "Date",
        "Driver",
        "Customer",
        "Bill To",
        "Reg",
        "Truck",
        "Pickup",
        "Dropoff",
        "Status",
        "Start",
        "Finish",
        "Hours",
        "Eastlink",
        "Citylink",
        "Comments",
      ];

      for (const header of expectedHeaders) {
        expect(screen.getByText(header)).toBeInTheDocument();
      }
    });

    it("renders existing jobs as rows", () => {
      render(
        <QuickEditTable {...defaultProps} jobs={[sampleJob, secondJob]} />,
      );

      expect(screen.getByDisplayValue("2025-01-15")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2025-01-16")).toBeInTheDocument();

      expect(screen.getByDisplayValue("Melbourne")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Brisbane")).toBeInTheDocument();

      expect(screen.getByDisplayValue("Sydney")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Perth")).toBeInTheDocument();
    });

    it("renders the Add Row button", () => {
      render(<QuickEditTable {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /add row/i }),
      ).toBeInTheDocument();
    });

    it("does not show the save/discard bar initially", () => {
      render(<QuickEditTable {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: /save all/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /discard/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Add Row", () => {
    it("adds a new empty row when clicking Add Row", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const tableBodyBefore = screen.getAllByRole("row");
      const initialRowCount = tableBodyBefore.length;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      const tableBodyAfter = screen.getAllByRole("row");
      expect(tableBodyAfter.length).toBe(initialRowCount + 1);
    });

    it("adds multiple new rows when clicking Add Row repeatedly", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const initialRowCount = screen.getAllByRole("row").length;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      const afterRows = screen.getAllByRole("row");
      expect(afterRows.length).toBe(initialRowCount + 3);
    });
  });

  describe("Unsaved changes detection", () => {
    it("calls onHasChanges(true) when a row is added", async () => {
      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      expect(defaultProps.onHasChanges).toHaveBeenCalledWith(true);
    });

    it("calls onHasChanges(false) after discard", async () => {
      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      defaultProps.onHasChanges.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /discard/i }));
      });

      expect(defaultProps.onHasChanges).toHaveBeenCalledWith(false);
    });

    it("calls onHasChanges(true) when an existing job field is modified", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      expect(defaultProps.onHasChanges).toHaveBeenCalledWith(true);
    });
  });

  describe("Change count", () => {
    it("shows singular '1 unsaved change' when one change exists", async () => {
      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    });

    it("shows plural '2 unsaved changes' when two changes exist", async () => {
      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();
    });

    it("shows correct count combining creates and updates", async () => {
      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      const pickupInput = screen.getByDisplayValue("Melbourne");
      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();
    });

    it("shows correct count combining creates, updates, and deletes", async () => {
      render(
        <QuickEditTable {...defaultProps} jobs={[sampleJob, secondJob]} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      const existingDeleteBtn = document.getElementById("quick-edit-delete-1");
      expect(existingDeleteBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(existingDeleteBtn!);
      });

      await waitFor(() => {
        expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();
      });
    });
  });

  describe("Discard", () => {
    it("clears pending creates on discard", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const initialRowCount = screen.getAllByRole("row").length;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      expect(screen.getAllByRole("row").length).toBe(initialRowCount + 2);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /discard/i }));
      });

      expect(screen.getAllByRole("row").length).toBe(initialRowCount);
    });

    it("clears pending updates on discard", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      expect(screen.getByDisplayValue("Geelong")).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /discard/i }));
      });

      expect(screen.getByDisplayValue("Melbourne")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Geelong")).not.toBeInTheDocument();
    });

    it("clears pending deletes on discard", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const existingDeleteBtn = document.getElementById("quick-edit-delete-1");
      expect(existingDeleteBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(existingDeleteBtn!);
      });

      expect(screen.getByText(/unsaved change/)).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /discard/i }));
      });

      expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
    });

    it("hides the save/discard bar after discard", async () => {
      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      expect(
        screen.getByRole("button", { name: /discard/i }),
      ).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /discard/i }));
      });

      expect(
        screen.queryByRole("button", { name: /discard/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /save all/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("shows validation error toast when saving a new row without required fields", async () => {
      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Validation required",
          description: "Please fix the highlighted fields before saving",
          variant: "destructive",
        }),
      );
    });

    it("does not call fetch when validation fails", async () => {
      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("does not show validation error for a fully filled new row", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            createdCount: 1,
            updatedCount: 0,
            deletedCount: 0,
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      const allSelects = screen
        .getAllByRole("combobox")
        .filter((el) => el.dataset.testid?.startsWith("new:"));

      const dateInputs = screen.getAllByDisplayValue("");
      const newDateInput = dateInputs.find(
        (input) =>
          (input as HTMLInputElement).type === "date" &&
          input.id?.startsWith("new:"),
      );

      if (newDateInput) {
        await act(async () => {
          fireEvent.change(newDateInput, { target: { value: "2025-01-20" } });
        });
      }

      const getNewSelect = ({ field }: { field: string }) => {
        const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
        return selects.find(
          (el) =>
            el.dataset.testid?.startsWith("new:") &&
            el.dataset.testid?.endsWith(`:${field}`),
        );
      };

      const driverSelect = getNewSelect({ field: "driver" });
      if (driverSelect) {
        await act(async () => {
          fireEvent.change(driverSelect, { target: { value: "John Doe" } });
        });
      }

      const customerSelect = getNewSelect({ field: "customer" });
      if (customerSelect) {
        await act(async () => {
          fireEvent.change(customerSelect, {
            target: { value: "ABC Company" },
          });
        });
      }

      const billToSelect = getNewSelect({ field: "billTo" });
      if (billToSelect) {
        await act(async () => {
          fireEvent.change(billToSelect, {
            target: { value: "ABC Company" },
          });
        });
      }

      const regSelect = getNewSelect({ field: "registration" });
      if (regSelect) {
        await act(async () => {
          fireEvent.change(regSelect, { target: { value: "ABC123" } });
        });
      }

      const truckSelect = getNewSelect({ field: "truckType" });
      if (truckSelect) {
        await act(async () => {
          fireEvent.change(truckSelect, { target: { value: "Tray" } });
        });
      }

      const pickupInputs = screen.getAllByPlaceholderText("Pickup");
      const newPickup = pickupInputs.find((el) => el.id?.startsWith("new:"));
      if (newPickup) {
        await act(async () => {
          fireEvent.change(newPickup, { target: { value: "Melbourne" } });
        });
      }

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe("Batch save", () => {
    it("calls fetch with correct payload on successful save", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            createdCount: 0,
            updatedCount: 1,
            deletedCount: 0,
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/jobs/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.any(String),
        });
      });

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody.creates).toEqual([]);
      expect(callBody.updates).toEqual([
        { id: 1, data: { pickup: "Geelong" } },
      ]);
      expect(callBody.deletes).toEqual([]);
    });

    it("shows success toast after successful save", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            createdCount: 0,
            updatedCount: 1,
            deletedCount: 0,
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Changes saved",
            description: "Created: 0, Updated: 1, Deleted: 0",
          }),
        );
      });
    });

    it("calls onBatchSaveComplete after successful save", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            createdCount: 0,
            updatedCount: 1,
            deletedCount: 0,
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(defaultProps.onBatchSaveComplete).toHaveBeenCalled();
      });
    });

    it("clears pending changes after successful save", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            createdCount: 0,
            updatedCount: 1,
            deletedCount: 0,
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      expect(screen.getByText(/unsaved change/)).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
      });
    });

    it("sends deletes in the payload when jobs are marked for deletion", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            createdCount: 0,
            updatedCount: 0,
            deletedCount: 1,
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      const existingDeleteBtn = document.getElementById("quick-edit-delete-1");
      expect(existingDeleteBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(existingDeleteBtn!);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(callBody.deletes).toEqual([1]);
    });
  });

  describe("Batch save error handling", () => {
    it("shows error toast when server returns an error response", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            error: "Internal server error",
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Save failed",
            description: "Internal server error",
            variant: "destructive",
          }),
        );
      });
    });

    it("shows error toast when fetch throws a network error", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Save failed",
            description: "Network error",
            variant: "destructive",
          }),
        );
      });
    });

    it("does not call onBatchSaveComplete on failed save", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            error: "Server error",
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Save failed" }),
        );
      });

      expect(defaultProps.onBatchSaveComplete).not.toHaveBeenCalled();
    });

    it("retains pending changes after a failed save", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
            error: "Server error",
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      expect(screen.getByText(/unsaved change/)).toBeInTheDocument();
      expect(screen.getByDisplayValue("Geelong")).toBeInTheDocument();
    });

    it("shows generic error message when server returns success:false without error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            success: false,
          }),
      });

      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Geelong" } });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save all/i }));
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Save failed",
            description: "Batch save failed",
            variant: "destructive",
          }),
        );
      });
    });
  });

  describe("Delete row toggle", () => {
    it("removes a new row entirely when clicking delete on it", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const initialRowCount = screen.getAllByRole("row").length;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      expect(screen.getAllByRole("row").length).toBe(initialRowCount + 1);

      const deleteBtns = screen
        .getAllByRole("button")
        .filter((btn) => btn.id.startsWith("quick-edit-delete-new:"));

      expect(deleteBtns.length).toBe(1);

      await act(async () => {
        fireEvent.click(deleteBtns[0]);
      });

      expect(screen.getAllByRole("row").length).toBe(initialRowCount);
    });

    it("toggles deleted state on an existing row (marks then unmarks)", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const existingDeleteBtn = screen
        .getAllByRole("button")
        .find((btn) => btn.id === "quick-edit-delete-1");

      expect(existingDeleteBtn).toBeTruthy();

      await act(async () => {
        fireEvent.click(existingDeleteBtn!);
      });

      expect(screen.getByText(/unsaved change/)).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(existingDeleteBtn!);
      });

      expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
    });

    it("does not remove the existing row from the DOM when toggling delete", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const rowCountBefore = screen.getAllByRole("row").length;

      const existingDeleteBtn = screen
        .getAllByRole("button")
        .find((btn) => btn.id === "quick-edit-delete-1");

      await act(async () => {
        fireEvent.click(existingDeleteBtn!);
      });

      expect(screen.getAllByRole("row").length).toBe(rowCountBefore);
    });
  });

  describe("Floating save/discard bar", () => {
    it("appears when there are unsaved changes", async () => {
      render(<QuickEditTable {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: /save all/i }),
      ).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      expect(
        screen.getByRole("button", { name: /save all/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /discard/i }),
      ).toBeInTheDocument();
    });

    it("contains both Save All and Discard buttons", async () => {
      render(<QuickEditTable {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add row/i }));
      });

      const saveBtn = screen.getByRole("button", { name: /save all/i });
      const discardBtn = screen.getByRole("button", { name: /discard/i });

      expect(saveBtn).toBeInTheDocument();
      expect(discardBtn).toBeInTheDocument();
      expect(saveBtn.id).toBe("quick-edit-save-btn");
      expect(discardBtn.id).toBe("quick-edit-discard-btn");
    });
  });

  describe("Field editing", () => {
    it("updates pickup field value on change", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const pickupInput = screen.getByDisplayValue("Melbourne");

      await act(async () => {
        fireEvent.change(pickupInput, { target: { value: "Adelaide" } });
      });

      expect(screen.getByDisplayValue("Adelaide")).toBeInTheDocument();
    });

    it("updates dropoff field value on change", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const dropoffInput = screen.getByDisplayValue("Sydney");

      await act(async () => {
        fireEvent.change(dropoffInput, { target: { value: "Darwin" } });
      });

      expect(screen.getByDisplayValue("Darwin")).toBeInTheDocument();
    });

    it("updates select field values through mocked InlineCellSelect", async () => {
      render(<QuickEditTable {...defaultProps} />);

      const driverSelect = screen.getByTestId("1:driver") as HTMLSelectElement;
      expect(driverSelect.value).toBe("John Doe");

      await act(async () => {
        fireEvent.change(driverSelect, { target: { value: "Jane Smith" } });
      });

      expect((screen.getByTestId("1:driver") as HTMLSelectElement).value).toBe(
        "Jane Smith",
      );
    });
  });
});
