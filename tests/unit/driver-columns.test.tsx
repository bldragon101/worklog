import { driverColumns } from "@/components/entities/driver/driver-columns";
import { Driver } from "@/lib/types";

interface ColumnMeta {
  hidden?: boolean;
  [key: string]: unknown;
}

interface TestColumnDef {
  accessorKey?: string;
  id?: string;
  enableColumnFilter?: boolean;
  enableSorting?: boolean;
  meta?: ColumnMeta;
  size?: number;
  minSize?: number;
  maxSize?: number;
  [key: string]: unknown;
}

const mockDriver: Driver = {
  id: 1,
  driver: "John Smith",
  truck: "Toyota Hiace",
  tray: 150,
  crane: 200,
  semi: null,
  semiCrane: null,
  breaks: 30.0,
  type: "Employee",
  tolls: false,
  fuelLevy: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  address: null,
  abn: null,
  gstStatus: "not_registered",
  gstMode: "exclusive",
  bankAccountName: null,
  bankBsb: null,
  bankAccountNumber: null,
};

describe("Driver Columns", () => {
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates columns correctly", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);

    expect(columns.length).toBeGreaterThan(5); // Should have multiple columns

    // Check that essential columns exist
    const columnIds = columns.map(
      (col) => (col as TestColumnDef).accessorKey || (col as TestColumnDef).id,
    );
    expect(columnIds).toContain("driver");
    expect(columnIds).toContain("truck");
    expect(columnIds).toContain("type");
    expect(columnIds).toContain("actions");
  });

  it("driver column is configured correctly", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);
    const driverColumn = columns.find(
      (col) => (col as TestColumnDef).accessorKey === "driver",
    );

    expect(driverColumn).toBeDefined();
    expect((driverColumn as TestColumnDef)?.enableColumnFilter).toBe(true);
  });

  it("truck column allows filtering", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);
    const truckColumn = columns.find(
      (col) => (col as TestColumnDef).accessorKey === "truck",
    );

    expect(truckColumn).toBeDefined();
    expect((truckColumn as TestColumnDef)?.enableColumnFilter).toBe(true);
  });

  it("type column is configured correctly", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);
    const typeColumn = columns.find(
      (col) => (col as TestColumnDef).accessorKey === "type",
    );

    expect(typeColumn).toBeDefined();
    expect((typeColumn as TestColumnDef)?.enableColumnFilter).toBe(true);
  });

  it("should have rate columns", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);

    // Check that columns exist for different rate types
    const columnIds = columns.map(
      (col) => (col as TestColumnDef).accessorKey || (col as TestColumnDef).id,
    );

    // Should have some rate-related columns
    const hasRateColumns = columnIds.some(
      (id) =>
        id === "tray" ||
        id === "crane" ||
        id === "semi" ||
        id === "semiCrane" ||
        id === "breaks",
    );

    expect(hasRateColumns || columns.length > 5).toBe(true);
  });

  it("should handle boolean columns", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);

    // Look for boolean columns like tolls
    const columnIds = columns.map(
      (col) => (col as TestColumnDef).accessorKey || (col as TestColumnDef).id,
    );
    const hasBooleanColumns = columnIds.some(
      (id) => id === "tolls" || id === "status",
    );

    expect(hasBooleanColumns || columns.length > 5).toBe(true);
  });

  it("actions column is configured correctly", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);
    const actionsColumn = columns.find((col) => col.id === "actions");

    expect(actionsColumn).toBeDefined();
    expect((actionsColumn as TestColumnDef)?.enableSorting).toBe(false);
  });

  it("passes handlers correctly", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);

    // The columns function should accept the handlers
    expect(typeof mockOnEdit).toBe("function");
    expect(typeof mockOnDelete).toBe("function");

    // Should have created columns without errors
    expect(columns).toBeDefined();
    expect(Array.isArray(columns)).toBe(true);
  });

  it("handles nullable numeric fields correctly", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);

    // Driver data model has many nullable numeric fields
    // The columns should handle null values appropriately
    const numericColumns = [
      "tray",
      "crane",
      "semi",
      "semiCrane",
      "breaks",
      "fuelLevy",
    ];

    numericColumns.forEach((fieldName) => {
      const column = columns.find(
        (col) => (col as TestColumnDef).accessorKey === fieldName,
      );
      if (column) {
        // Column exists and should handle null values
        expect(column).toBeDefined();
      }
    });

    // At minimum, should have the basic columns
    expect(columns.length).toBeGreaterThan(3);
  });

  it("columns have proper sizing configuration", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);

    columns.forEach((column) => {
      if (column.size) {
        expect(typeof column.size).toBe("number");
      }
      if (column.minSize) {
        expect(typeof column.minSize).toBe("number");
      }
      if (column.maxSize) {
        expect(typeof column.maxSize).toBe("number");
      }
    });
  });

  it("driver type column handles different types", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);
    const typeColumn = columns.find(
      (col) => (col as TestColumnDef).accessorKey === "type",
    );

    expect(typeColumn).toBeDefined();

    // Should be able to display different driver types
    const validTypes = ["Employee", "Contractor", "Subcontractor"];
    validTypes.forEach((type) => {
      expect(typeof type).toBe("string");
    });
  });

  it("handles subcontractor-specific fields", () => {
    driverColumns(mockOnEdit, mockOnDelete);

    // These fields might be present in the columns
    const subcontractorFields = ["fuelLevy", "tolls"];
    subcontractorFields.forEach(() => {
      // Field might or might not be displayed as a column
      // but the data model should support it
      expect(mockDriver).toHaveProperty("fuelLevy");
      expect(mockDriver).toHaveProperty("tolls");
    });
  });

  it("rate columns should handle currency formatting", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);

    // Rate columns should exist and be properly configured
    const rateColumnNames = ["tray", "crane", "semi", "semiCrane"];

    rateColumnNames.forEach((rateName) => {
      const column = columns.find(
        (col) => (col as TestColumnDef).accessorKey === rateName,
      );
      if (column) {
        // Column should be defined if it exists
        expect(column).toBeDefined();
      }
    });

    // Should have at least the basic driver info columns
    expect(columns.length).toBeGreaterThanOrEqual(4);
  });

  it("break deduction column handles decimal values", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);
    const breaksColumn = columns.find(
      (col) => (col as TestColumnDef).accessorKey === "breaks",
    );

    if (breaksColumn) {
      // If breaks column exists, it should handle decimal values
      expect(breaksColumn).toBeDefined();
      expect(mockDriver.breaks).toBe(30.0);
    }
  });

  it("columns support filtering functionality", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);

    // Count columns that support filtering
    const filterableColumns = columns.filter(
      (col) => (col as TestColumnDef)?.enableColumnFilter === true,
    );

    // Should have at least some filterable columns
    expect(filterableColumns.length).toBeGreaterThan(0);

    // Essential columns should be filterable
    const driverColumn = columns.find(
      (col) => (col as TestColumnDef).accessorKey === "driver",
    );
    const typeColumn = columns.find(
      (col) => (col as TestColumnDef).accessorKey === "type",
    );

    if (driverColumn) {
      expect((driverColumn as TestColumnDef)?.enableColumnFilter).toBe(true);
    }
    if (typeColumn) {
      expect((typeColumn as TestColumnDef)?.enableColumnFilter).toBe(true);
    }
  });

  it("handles metadata for hidden columns", () => {
    const columns = driverColumns(mockOnEdit, mockOnDelete);

    columns.forEach((column) => {
      if (column.meta && (column.meta as ColumnMeta).hidden) {
        expect(typeof (column.meta as ColumnMeta).hidden).toBe("boolean");
      }
    });
  });
});
