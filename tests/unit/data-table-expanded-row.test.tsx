import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable } from "@/components/data-table/core/data-table";
import type { DataTableColumnDef } from "@/components/data-table/core/table-features";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = [
  { id: 1, name: "First job" },
  { id: 2, name: "Second job" },
];

const columns: DataTableColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => row.original.name },
];

const renderExpandedRow = ({ row }: { row: Row }) => (
  <div>Expanded {row.name}</div>
);

describe("DataTable inline row expansion", () => {
  it("expands a row inline on click and collapses it on a second click", () => {
    render(
      <DataTable
        data={rows}
        columns={columns}
        renderExpandedRow={renderExpandedRow}
      />,
    );

    expect(screen.queryByText("Expanded First job")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("First job"));
    expect(screen.getByText("Expanded First job")).toBeInTheDocument();
    expect(screen.getByText("First job").closest("tr")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.click(screen.getByText("First job"));
    expect(screen.queryByText("Expanded First job")).not.toBeInTheDocument();
  });

  it("keeps only one row expanded at a time", () => {
    render(
      <DataTable
        data={rows}
        columns={columns}
        renderExpandedRow={renderExpandedRow}
      />,
    );

    fireEvent.click(screen.getByText("First job"));
    fireEvent.click(screen.getByText("Second job"));

    expect(screen.queryByText("Expanded First job")).not.toBeInTheDocument();
    expect(screen.getByText("Expanded Second job")).toBeInTheDocument();
  });

  it("spans the expanded content across every visible column", () => {
    render(
      <DataTable
        data={rows}
        columns={columns}
        renderExpandedRow={renderExpandedRow}
        onMultiDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("First job"));

    expect(
      screen.getByText("Expanded First job").closest("td"),
    ).toHaveAttribute("colspan", "2");
  });

  it("does not expand rows when no expanded content is provided", () => {
    render(<DataTable data={rows} columns={columns} />);

    fireEvent.click(screen.getByText("First job"));

    expect(screen.queryByTestId("expanded-row-1")).not.toBeInTheDocument();
    expect(screen.getByText("First job").closest("tr")).not.toHaveAttribute(
      "aria-expanded",
    );
  });
});
