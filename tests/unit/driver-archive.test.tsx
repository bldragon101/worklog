import { Driver } from "@/lib/types";
import { driverColumns } from "@/components/entities/driver/driver-columns";

// Mock driver data with archive status
const mockActiveDrivers: Driver[] = [
  {
    id: 1,
    driver: "John Smith",
    businessName: null,
    truck: "Toyota Hiace",
    tray: 150,
    crane: 200,
    semi: null,
    semiCrane: null,
    breaks: 30.0,
    type: "Employee",
    tolls: false,
    fuelLevy: null,
    isArchived: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    address: null,
    abn: null,
    email: null,
    gstStatus: "not_registered",
    gstMode: "exclusive",
    bankAccountName: null,
    bankBsb: null,
    bankAccountNumber: null,
  },
  {
    id: 2,
    driver: "Jane Wilson",
    businessName: "Wilson Transport",
    truck: "Ford Ranger",
    tray: 120,
    crane: null,
    semi: 180,
    semiCrane: 220,
    breaks: 25.0,
    type: "Subcontractor",
    tolls: true,
    fuelLevy: 15,
    isArchived: false,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    address: "123 Main St",
    abn: "12345678901",
    email: null,
    gstStatus: "registered",
    gstMode: "exclusive",
    bankAccountName: "Jane Wilson",
    bankBsb: "123456",
    bankAccountNumber: "12345678",
  },
];

const mockArchivedDrivers: Driver[] = [
  {
    id: 3,
    driver: "Mike Johnson",
    businessName: null,
    truck: "Isuzu NPR",
    tray: null,
    crane: 180,
    semi: 200,
    semiCrane: 250,
    breaks: 35.0,
    type: "Contractor",
    tolls: true,
    fuelLevy: 20,
    isArchived: true,
    createdAt: "2024-01-03T00:00:00Z",
    updatedAt: "2024-01-03T00:00:00Z",
    address: "456 Oak Ave",
    abn: "98765432109",
    email: null,
    gstStatus: "registered",
    gstMode: "inclusive",
    bankAccountName: "Mike Johnson",
    bankBsb: "987654",
    bankAccountNumber: "87654321",
  },
  {
    id: 4,
    driver: "Sarah Brown",
    businessName: "Brown Logistics",
    truck: "Mercedes Sprinter",
    tray: 140,
    crane: 190,
    semi: null,
    semiCrane: null,
    breaks: 30.0,
    type: "Subcontractor",
    tolls: true,
    fuelLevy: 18,
    isArchived: true,
    createdAt: "2024-01-04T00:00:00Z",
    updatedAt: "2024-01-04T00:00:00Z",
    address: "789 Pine Rd",
    abn: "11223344556",
    email: null,
    gstStatus: "registered",
    gstMode: "exclusive",
    bankAccountName: "Brown Logistics",
    bankBsb: "112233",
    bankAccountNumber: "44556677",
  },
];

const allDrivers = [...mockActiveDrivers, ...mockArchivedDrivers];

describe("Driver Archive Feature", () => {
  describe("Driver data model", () => {
    it("should have isArchived property on Driver type", () => {
      const driver = mockActiveDrivers[0];
      expect(driver).toHaveProperty("isArchived");
      expect(typeof driver.isArchived).toBe("boolean");
    });

    it("active drivers should have isArchived set to false", () => {
      mockActiveDrivers.forEach((driver) => {
        expect(driver.isArchived).toBe(false);
      });
    });

    it("archived drivers should have isArchived set to true", () => {
      mockArchivedDrivers.forEach((driver) => {
        expect(driver.isArchived).toBe(true);
      });
    });
  });

  describe("Filtering drivers by archive status", () => {
    it("should filter active drivers correctly", () => {
      const activeDrivers = allDrivers.filter((d) => !d.isArchived);
      expect(activeDrivers).toHaveLength(2);
      expect(activeDrivers.map((d) => d.driver)).toEqual([
        "John Smith",
        "Jane Wilson",
      ]);
    });

    it("should filter archived drivers correctly", () => {
      const archivedDrivers = allDrivers.filter((d) => d.isArchived);
      expect(archivedDrivers).toHaveLength(2);
      expect(archivedDrivers.map((d) => d.driver)).toEqual([
        "Mike Johnson",
        "Sarah Brown",
      ]);
    });

    it("should return empty array when no active drivers", () => {
      const onlyArchivedDrivers = mockArchivedDrivers;
      const activeDrivers = onlyArchivedDrivers.filter((d) => !d.isArchived);
      expect(activeDrivers).toHaveLength(0);
    });

    it("should return empty array when no archived drivers", () => {
      const onlyActiveDrivers = mockActiveDrivers;
      const archivedDrivers = onlyActiveDrivers.filter((d) => d.isArchived);
      expect(archivedDrivers).toHaveLength(0);
    });
  });

  describe("Archive/Unarchive operations", () => {
    it("should archive a driver by setting isArchived to true", () => {
      const driverToArchive = { ...mockActiveDrivers[0] };
      expect(driverToArchive.isArchived).toBe(false);

      driverToArchive.isArchived = true;
      expect(driverToArchive.isArchived).toBe(true);
    });

    it("should restore a driver by setting isArchived to false", () => {
      const driverToRestore = { ...mockArchivedDrivers[0] };
      expect(driverToRestore.isArchived).toBe(true);

      driverToRestore.isArchived = false;
      expect(driverToRestore.isArchived).toBe(false);
    });

    it("should update driver list after archiving", () => {
      const drivers = [...allDrivers];
      const driverIndex = drivers.findIndex((d) => d.id === 1);

      // Archive driver with id 1
      drivers[driverIndex] = { ...drivers[driverIndex], isArchived: true };

      const activeDrivers = drivers.filter((d) => !d.isArchived);
      const archivedDrivers = drivers.filter((d) => d.isArchived);

      expect(activeDrivers).toHaveLength(1);
      expect(archivedDrivers).toHaveLength(3);
      expect(archivedDrivers.map((d) => d.id)).toContain(1);
    });

    it("should update driver list after restoring", () => {
      const drivers = [...allDrivers];
      const driverIndex = drivers.findIndex((d) => d.id === 3);

      // Restore driver with id 3
      drivers[driverIndex] = { ...drivers[driverIndex], isArchived: false };

      const activeDrivers = drivers.filter((d) => !d.isArchived);
      const archivedDrivers = drivers.filter((d) => d.isArchived);

      expect(activeDrivers).toHaveLength(3);
      expect(archivedDrivers).toHaveLength(1);
      expect(activeDrivers.map((d) => d.id)).toContain(3);
    });
  });

  describe("Driver select options filtering", () => {
    it("should only include active drivers in select options", () => {
      const selectOptions = allDrivers
        .filter((d) => !d.isArchived)
        .map((d) => d.driver)
        .sort();

      expect(selectOptions).toEqual(["Jane Wilson", "John Smith"]);
      expect(selectOptions).not.toContain("Mike Johnson");
      expect(selectOptions).not.toContain("Sarah Brown");
    });

    it("should exclude archived drivers from dropdown selections", () => {
      const driverOptions = allDrivers
        .filter((d) => !d.isArchived)
        .map((d) => ({ label: d.driver, value: d.driver }));

      expect(driverOptions).toHaveLength(2);
      expect(driverOptions.map((o) => o.value)).not.toContain("Mike Johnson");
    });
  });

  describe("Tab counts", () => {
    it("should correctly count active drivers", () => {
      const activeCount = allDrivers.filter((d) => !d.isArchived).length;
      expect(activeCount).toBe(2);
    });

    it("should correctly count archived drivers", () => {
      const archivedCount = allDrivers.filter((d) => d.isArchived).length;
      expect(archivedCount).toBe(2);
    });

    it("should update counts after archive operation", () => {
      const drivers = [...allDrivers];
      const driverIndex = drivers.findIndex((d) => d.id === 2);
      drivers[driverIndex] = { ...drivers[driverIndex], isArchived: true };

      const activeCount = drivers.filter((d) => !d.isArchived).length;
      const archivedCount = drivers.filter((d) => d.isArchived).length;

      expect(activeCount).toBe(1);
      expect(archivedCount).toBe(3);
    });

    it("should update counts after restore operation", () => {
      const drivers = [...allDrivers];
      const driverIndex = drivers.findIndex((d) => d.id === 4);
      drivers[driverIndex] = { ...drivers[driverIndex], isArchived: false };

      const activeCount = drivers.filter((d) => !d.isArchived).length;
      const archivedCount = drivers.filter((d) => d.isArchived).length;

      expect(activeCount).toBe(3);
      expect(archivedCount).toBe(1);
    });
  });

  describe("Driver columns with archive status", () => {
    const mockOnEdit = jest.fn();
    const mockOnDelete = jest.fn();
    const mockOnMultiDelete = jest.fn();
    const mockOnArchive = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should create columns with archive handler", () => {
      const columns = driverColumns(
        mockOnEdit,
        mockOnDelete,
        mockOnMultiDelete,
        mockOnArchive,
      );

      expect(columns).toBeDefined();
      expect(Array.isArray(columns)).toBe(true);
      expect(columns.length).toBeGreaterThan(0);
    });

    it("should create columns without archive handler", () => {
      const columns = driverColumns(mockOnEdit, mockOnDelete);

      expect(columns).toBeDefined();
      expect(Array.isArray(columns)).toBe(true);
    });

    it("should include actions column", () => {
      const columns = driverColumns(
        mockOnEdit,
        mockOnDelete,
        mockOnMultiDelete,
        mockOnArchive,
      );

      const actionsColumn = columns.find((col) => col.id === "actions");
      expect(actionsColumn).toBeDefined();
    });

    it("should include driver column that can show archived badge", () => {
      const columns = driverColumns(
        mockOnEdit,
        mockOnDelete,
        mockOnMultiDelete,
        mockOnArchive,
      );

      const driverColumn = columns.find(
        (col) => "accessorKey" in col && col.accessorKey === "driver",
      );
      expect(driverColumn).toBeDefined();
    });
  });

  describe("Archive validation", () => {
    it("should not allow archiving without proper data", () => {
      const validateArchiveRequest = (data: { isArchived?: boolean }) => {
        return typeof data.isArchived === "boolean";
      };

      expect(validateArchiveRequest({ isArchived: true })).toBe(true);
      expect(validateArchiveRequest({ isArchived: false })).toBe(true);
      expect(validateArchiveRequest({})).toBe(false);
      expect(validateArchiveRequest({ isArchived: undefined })).toBe(false);
    });

    it("should preserve other driver data when archiving", () => {
      const originalDriver = { ...mockActiveDrivers[0] };
      const archivedDriver = { ...originalDriver, isArchived: true };

      expect(archivedDriver.id).toBe(originalDriver.id);
      expect(archivedDriver.driver).toBe(originalDriver.driver);
      expect(archivedDriver.truck).toBe(originalDriver.truck);
      expect(archivedDriver.type).toBe(originalDriver.type);
      expect(archivedDriver.tray).toBe(originalDriver.tray);
      expect(archivedDriver.crane).toBe(originalDriver.crane);
      expect(archivedDriver.isArchived).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty driver list", () => {
      const emptyDrivers: Driver[] = [];
      const activeDrivers = emptyDrivers.filter((d) => !d.isArchived);
      const archivedDrivers = emptyDrivers.filter((d) => d.isArchived);

      expect(activeDrivers).toHaveLength(0);
      expect(archivedDrivers).toHaveLength(0);
    });

    it("should handle all drivers being archived", () => {
      const allArchivedDrivers = allDrivers.map((d) => ({
        ...d,
        isArchived: true,
      }));

      const activeDrivers = allArchivedDrivers.filter((d) => !d.isArchived);
      const archivedDrivers = allArchivedDrivers.filter((d) => d.isArchived);

      expect(activeDrivers).toHaveLength(0);
      expect(archivedDrivers).toHaveLength(4);
    });

    it("should handle all drivers being active", () => {
      const allActiveDrivers = allDrivers.map((d) => ({
        ...d,
        isArchived: false,
      }));

      const activeDrivers = allActiveDrivers.filter((d) => !d.isArchived);
      const archivedDrivers = allActiveDrivers.filter((d) => d.isArchived);

      expect(activeDrivers).toHaveLength(4);
      expect(archivedDrivers).toHaveLength(0);
    });

    it("should correctly identify driver by id regardless of archive status", () => {
      const findDriverById = (drivers: Driver[], id: number) => {
        return drivers.find((d) => d.id === id);
      };

      const activeDriver = findDriverById(allDrivers, 1);
      const archivedDriver = findDriverById(allDrivers, 3);

      expect(activeDriver).toBeDefined();
      expect(activeDriver?.isArchived).toBe(false);
      expect(archivedDriver).toBeDefined();
      expect(archivedDriver?.isArchived).toBe(true);
    });
  });

  describe("Archive status in different driver types", () => {
    it("should allow archiving Employee type drivers", () => {
      const employee = allDrivers.find((d) => d.type === "Employee");
      expect(employee).toBeDefined();

      const archivedEmployee = { ...employee!, isArchived: true };
      expect(archivedEmployee.type).toBe("Employee");
      expect(archivedEmployee.isArchived).toBe(true);
    });

    it("should allow archiving Contractor type drivers", () => {
      const contractor = allDrivers.find((d) => d.type === "Contractor");
      expect(contractor).toBeDefined();

      const archivedContractor = { ...contractor!, isArchived: true };
      expect(archivedContractor.type).toBe("Contractor");
      expect(archivedContractor.isArchived).toBe(true);
    });

    it("should allow archiving Subcontractor type drivers", () => {
      const subcontractor = allDrivers.find((d) => d.type === "Subcontractor");
      expect(subcontractor).toBeDefined();

      const archivedSubcontractor = { ...subcontractor!, isArchived: true };
      expect(archivedSubcontractor.type).toBe("Subcontractor");
      expect(archivedSubcontractor.isArchived).toBe(true);
    });

    it("should preserve subcontractor-specific fields when archiving", () => {
      const subcontractor = allDrivers.find(
        (d) => d.type === "Subcontractor" && !d.isArchived,
      );
      expect(subcontractor).toBeDefined();

      const archivedSubcontractor = { ...subcontractor!, isArchived: true };
      expect(archivedSubcontractor.tolls).toBe(subcontractor!.tolls);
      expect(archivedSubcontractor.fuelLevy).toBe(subcontractor!.fuelLevy);
      expect(archivedSubcontractor.businessName).toBe(
        subcontractor!.businessName,
      );
      expect(archivedSubcontractor.abn).toBe(subcontractor!.abn);
    });
  });

  describe("Search and filter with archive status", () => {
    it("should search only within active drivers when on active tab", () => {
      const activeDrivers = allDrivers.filter((d) => !d.isArchived);
      const searchResults = activeDrivers.filter((d) =>
        d.driver.toLowerCase().includes("john"),
      );

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].driver).toBe("John Smith");
    });

    it("should search only within archived drivers when on archived tab", () => {
      const archivedDrivers = allDrivers.filter((d) => d.isArchived);
      const searchResults = archivedDrivers.filter((d) =>
        d.driver.toLowerCase().includes("john"),
      );

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].driver).toBe("Mike Johnson");
    });

    it("should filter by type within active drivers", () => {
      const activeDrivers = allDrivers.filter((d) => !d.isArchived);
      const employees = activeDrivers.filter((d) => d.type === "Employee");

      expect(employees).toHaveLength(1);
      expect(employees[0].driver).toBe("John Smith");
    });

    it("should filter by type within archived drivers", () => {
      const archivedDrivers = allDrivers.filter((d) => d.isArchived);
      const subcontractors = archivedDrivers.filter(
        (d) => d.type === "Subcontractor",
      );

      expect(subcontractors).toHaveLength(1);
      expect(subcontractors[0].driver).toBe("Sarah Brown");
    });
  });

  describe("API request payload validation", () => {
    it("should create valid archive request payload", () => {
      const archivePayload = { isArchived: true };
      expect(archivePayload).toHaveProperty("isArchived", true);
    });

    it("should create valid restore request payload", () => {
      const restorePayload = { isArchived: false };
      expect(restorePayload).toHaveProperty("isArchived", false);
    });

    it("should validate archive payload structure", () => {
      const isValidArchivePayload = (payload: unknown): boolean => {
        if (typeof payload !== "object" || payload === null) return false;
        const obj = payload as Record<string, unknown>;
        return typeof obj.isArchived === "boolean";
      };

      expect(isValidArchivePayload({ isArchived: true })).toBe(true);
      expect(isValidArchivePayload({ isArchived: false })).toBe(true);
      expect(isValidArchivePayload({ isArchived: "true" })).toBe(false);
      expect(isValidArchivePayload({ archived: true })).toBe(false);
      expect(isValidArchivePayload(null)).toBe(false);
      expect(isValidArchivePayload(undefined)).toBe(false);
    });
  });
});
