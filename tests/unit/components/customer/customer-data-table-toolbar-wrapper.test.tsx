import type { DataTableInstance } from "@/components/data-table/core/table-features";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { CustomerDataTableToolbarWrapper } from "@/components/entities/customer/customer-data-table-toolbar-wrapper";
import { usePermissions } from "@/hooks/use-permissions";
import type { Customer } from "@/lib/types";

vi.mock("@/hooks/use-permissions");
vi.mock("@/contexts/search-context", () => ({
  useSearch: () => ({ globalSearchValue: "" }),
}));
vi.mock("@/components/shared/csv-import-export-dropdown", () => ({
  CsvImportExportDropdown: () => null,
}));
vi.mock("@/components/data-table/components/data-table-view-options", () => ({
  DataTableViewOptions: () => null,
}));
vi.mock("@/components/entities/customer/customer-bulk-update-dialog", () => ({
  CustomerBulkUpdateDialog: () => null,
}));

const makeTable = ({ selectedCount }: { selectedCount: number }) =>
  ({
    setGlobalFilter: vi.fn(),
    atoms: { columnFilters: { get: () => [] } },
    resetColumnFilters: vi.fn(),
    toggleAllRowsSelected: vi.fn(),
    getSelectedRowModel: () => ({
      rows: Array.from({ length: selectedCount }, (_, i) => ({
        original: { id: i + 1 },
      })),
    }),
  }) as unknown as DataTableInstance<Customer>;

describe("CustomerDataTableToolbarWrapper bulk update", () => {
  const mockPermissions = ({ isAdmin }: { isAdmin: boolean }) => {
    (usePermissions as vi.Mock).mockReturnValue({ isAdmin });
  };

  it("shows Bulk Update to admins when rows are selected", () => {
    mockPermissions({ isAdmin: true });
    render(<CustomerDataTableToolbarWrapper table={makeTable({ selectedCount: 2 })} />);

    expect(
      screen.getByRole("button", { name: "Bulk Update" }),
    ).toBeInTheDocument();
  });

  it("hides Bulk Update from non-admins", () => {
    mockPermissions({ isAdmin: false });
    render(<CustomerDataTableToolbarWrapper table={makeTable({ selectedCount: 2 })} />);

    expect(
      screen.queryByRole("button", { name: "Bulk Update" }),
    ).not.toBeInTheDocument();
  });

  it("hides Bulk Update when nothing is selected", () => {
    mockPermissions({ isAdmin: true });
    render(<CustomerDataTableToolbarWrapper table={makeTable({ selectedCount: 0 })} />);

    expect(
      screen.queryByRole("button", { name: "Bulk Update" }),
    ).not.toBeInTheDocument();
  });
});
