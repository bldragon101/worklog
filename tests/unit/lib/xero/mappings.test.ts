/**
 * @vitest-environment node
 */
import { ApiError } from "@/lib/api-error";
import {
  getXeroMappings,
  saveCompanyItemMappings,
  saveContactMappings,
  saveVehicleItemMappings,
  saveXeroSettings,
} from "@/lib/xero/mappings";

const mocks = vi.hoisted(() => ({
  getXeroConnectionStatus: vi.fn(),
  getXeroSettings: vi.fn(),
  itemFindMany: vi.fn(),
  itemCount: vi.fn(),
  contactFindMany: vi.fn(),
  vehicleFindMany: vi.fn(),
  driverFindMany: vi.fn(),
  customerFindMany: vi.fn(),
  vehicleMappingFindMany: vi.fn(),
  vehicleMappingUpsert: vi.fn(),
  vehicleMappingDeleteMany: vi.fn(),
  companyMappingFindMany: vi.fn(),
  companyMappingUpsert: vi.fn(),
  companyMappingDeleteMany: vi.fn(),
  contactMappingFindMany: vi.fn(),
  contactMappingUpsert: vi.fn(),
  contactMappingDeleteMany: vi.fn(),
  settingsFindFirst: vi.fn(),
  settingsUpdate: vi.fn(),
  settingsCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/xero/auth", () => ({ getXeroConnectionStatus: mocks.getXeroConnectionStatus }));
vi.mock("@/lib/xero/invoice-context", () => ({ getXeroSettings: mocks.getXeroSettings }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    xeroItem: { findMany: mocks.itemFindMany, count: mocks.itemCount },
    xeroContact: { findMany: mocks.contactFindMany },
    vehicle: { findMany: mocks.vehicleFindMany },
    driver: { findMany: mocks.driverFindMany },
    customer: { findMany: mocks.customerFindMany },
    xeroVehicleItemMapping: {
      findMany: mocks.vehicleMappingFindMany,
      upsert: mocks.vehicleMappingUpsert,
      deleteMany: mocks.vehicleMappingDeleteMany,
    },
    xeroCompanyItemMapping: {
      findMany: mocks.companyMappingFindMany,
      upsert: mocks.companyMappingUpsert,
      deleteMany: mocks.companyMappingDeleteMany,
    },
    xeroContactMapping: {
      findMany: mocks.contactMappingFindMany,
      upsert: mocks.contactMappingUpsert,
      deleteMany: mocks.contactMappingDeleteMany,
    },
    xeroSettings: {
      findFirst: mocks.settingsFindFirst,
      update: mocks.settingsUpdate,
      create: mocks.settingsCreate,
    },
    $transaction: mocks.transaction,
  },
}));

const connection = {
  configured: true,
  missingEnvVars: [],
  connected: true,
  tenantName: "Acme Transport",
  connectedAt: "2026-11-01T00:00:00.000Z",
  scopes: [],
  itemsSyncedAt: "2026-11-02T00:00:00.000Z",
  contactsSyncedAt: "2026-11-02T00:00:00.000Z",
};

const settings = {
  salesAccountCode: "200",
  taxType: "OUTPUT",
  breakItemCode: "Break",
  eastlinkItemCode: "EL",
  citylinkItemCode: "CL",
  fuelLevyItemCode: "Fuel Levy",
};

const xeroItems = [
  { code: "Break", name: "Break", salesUnitPrice: null },
  { code: "14TT - 10", name: "Tray ten", salesUnitPrice: "99" },
  { code: "14TT - 01", name: "BNT040 - Isuzu tray", salesUnitPrice: "120.5" },
  { code: "14TT - 02SUB", name: "Blue Hawk tray", salesUnitPrice: null },
  { code: "12TC - 01SUB", name: "Blue Hawk crane", salesUnitPrice: null },
];

function emptyCodes() {
  return { tray: null, crane: null, semi: null, semiCrane: null };
}

function itemCodeError({ promise }: { promise: Promise<unknown> }) {
  return promise.then(
    () => {
      throw new Error("Expected the save to be rejected");
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      return (error as ApiError).message;
    },
  );
}

describe("Xero mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getXeroConnectionStatus.mockResolvedValue(connection);
    mocks.getXeroSettings.mockResolvedValue(settings);
    mocks.transaction.mockImplementation(async (operations: unknown[]) => Promise.all(operations));
    for (const fn of [
      mocks.itemFindMany,
      mocks.contactFindMany,
      mocks.vehicleFindMany,
      mocks.driverFindMany,
      mocks.customerFindMany,
      mocks.vehicleMappingFindMany,
      mocks.companyMappingFindMany,
      mocks.contactMappingFindMany,
    ]) {
      fn.mockResolvedValue([]);
    }
    mocks.itemCount.mockResolvedValue(xeroItems.length);
    mocks.vehicleMappingUpsert.mockImplementation(async () => ({ kind: "upsert" }));
    mocks.vehicleMappingDeleteMany.mockImplementation(async () => ({ count: 1 }));
    mocks.companyMappingUpsert.mockImplementation(async () => ({ kind: "upsert" }));
    mocks.companyMappingDeleteMany.mockImplementation(async () => ({ count: 1 }));
    mocks.contactMappingUpsert.mockImplementation(async () => ({ kind: "upsert" }));
    mocks.contactMappingDeleteMany.mockImplementation(async () => ({ count: 1 }));
  });

  describe("getXeroMappings", () => {
    beforeEach(() => {
      mocks.itemFindMany.mockResolvedValue(xeroItems);
      mocks.contactFindMany.mockResolvedValue([
        { contactId: "c-1", name: "ACME PTY LTD", isCustomer: true },
        { contactId: "c-2", name: "Zed Holdings Group", isCustomer: false },
      ]);
      mocks.vehicleFindMany.mockResolvedValue([
        { registration: "XYZ999", make: "", model: "", type: "Crane" },
        { registration: "BNT 040", make: "Isuzu", model: "NPR", type: "Tray" },
        { registration: "bnt040", make: "Isuzu", model: "NPR", type: "Tray" },
      ]);
      mocks.vehicleMappingFindMany.mockResolvedValue([
        { registration: "XYZ999", itemCode: "14TT - 10" },
        { registration: "OLD111", itemCode: "GONE" },
      ]);
      mocks.driverFindMany.mockResolvedValue([
        {
          id: 1,
          driver: "Sam",
          lastName: "Hawk",
          type: "Subcontractor",
          businessName: "Blue Hawk Pty Ltd",
          truck: "BH",
        },
        { id: 2, driver: "Lee", lastName: null, type: "Contractor", businessName: null, truck: "" },
        { id: 3, driver: "Max", lastName: null, type: "Employee", businessName: null, truck: "" },
        { id: 4, driver: "Tom", lastName: null, type: "Subcontractor", businessName: " ", truck: "TPT" },
        {
          id: 5,
          driver: "Ann",
          lastName: "Hawk",
          type: "Subcontractor",
          businessName: "blue hawk  pty ltd",
          truck: "BH",
        },
      ]);
      mocks.companyMappingFindMany.mockResolvedValue([
        { companyKey: "lee", companyName: "Lee", truckClass: "tray", itemCode: "GONE" },
        { companyKey: "old co", companyName: "Old Co", truckClass: "crane", itemCode: "12TC - 01SUB" },
      ]);
      mocks.customerFindMany.mockResolvedValue([
        { customer: "Acme", billTo: "Acme Pty Ltd" },
        { customer: "Acme North", billTo: " acme  pty ltd " },
        { customer: "Acme", billTo: "Acme Pty Ltd" },
        { customer: "No Bill", billTo: "  " },
        { customer: "Zed", billTo: "Zed Holdings" },
      ]);
      mocks.contactMappingFindMany.mockResolvedValue([
        { billToKey: "zed holdings", billTo: "Zed Holdings", contactId: "c-2", contactName: "Zed Holdings Group" },
        { billToKey: "gone co", billTo: "Gone Co", contactId: "c-9", contactName: "Gone" },
      ]);
    });

    it("returns the items, contacts, connection and settings", async () => {
      const result = await getXeroMappings();

      expect(result.connection).toEqual(connection);
      expect(result.settings).toEqual(settings);
      expect(result.items).toEqual([
        { code: "12TC - 01SUB", name: "Blue Hawk crane", truckClass: "crane", isSubcontractor: true, salesUnitPrice: null },
        { code: "14TT - 01", name: "BNT040 - Isuzu tray", truckClass: "tray", isSubcontractor: false, salesUnitPrice: 120.5 },
        { code: "14TT - 02SUB", name: "Blue Hawk tray", truckClass: "tray", isSubcontractor: true, salesUnitPrice: null },
        { code: "14TT - 10", name: "Tray ten", truckClass: "tray", isSubcontractor: false, salesUnitPrice: 99 },
        { code: "Break", name: "Break", truckClass: null, isSubcontractor: false, salesUnitPrice: null },
      ]);
      expect(result.contacts).toEqual([
        { contactId: "c-1", name: "ACME PTY LTD", isCustomer: true },
        { contactId: "c-2", name: "Zed Holdings Group", isCustomer: false },
      ]);
      expect(mocks.driverFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isArchived: false } }),
      );
    });

    it("builds vehicle rows with suggestions, orphans and missing items", async () => {
      const { vehicles } = await getXeroMappings();

      expect(vehicles).toEqual([
        {
          key: "BNT040",
          registration: "BNT 040",
          description: "Isuzu · NPR · Tray",
          itemCode: null,
          suggestedItemCode: "14TT - 01",
          isItemMissing: false,
        },
        {
          key: "OLD111",
          registration: "OLD111",
          description: "Not in the vehicle list",
          itemCode: "GONE",
          suggestedItemCode: null,
          isItemMissing: true,
        },
        {
          key: "XYZ999",
          registration: "XYZ999",
          description: "Crane",
          itemCode: "14TT - 10",
          suggestedItemCode: null,
          isItemMissing: false,
        },
      ]);
    });

    it("builds a row per contractor or subcontractor company", async () => {
      const { companies } = await getXeroMappings();

      expect(companies).toEqual([
        {
          key: "blue hawk pty ltd",
          name: "Blue Hawk Pty Ltd",
          drivers: [
            { id: 1, name: "Sam Hawk", type: "Subcontractor", hasBusinessName: true },
            { id: 5, name: "Ann Hawk", type: "Subcontractor", hasBusinessName: true },
          ],
          itemCodes: emptyCodes(),
          suggestedItemCodes: { ...emptyCodes(), tray: "14TT - 02SUB", crane: "12TC - 01SUB" },
          missingItemClasses: [],
        },
        {
          key: "lee",
          name: "Lee",
          drivers: [{ id: 2, name: "Lee", type: "Contractor", hasBusinessName: false }],
          itemCodes: { ...emptyCodes(), tray: "GONE" },
          suggestedItemCodes: emptyCodes(),
          missingItemClasses: ["tray"],
        },
        {
          key: "old co",
          name: "Old Co",
          drivers: [],
          itemCodes: { ...emptyCodes(), crane: "12TC - 01SUB" },
          suggestedItemCodes: emptyCodes(),
          missingItemClasses: [],
        },
        {
          key: "tpt",
          name: "TPT",
          drivers: [{ id: 4, name: "Tom", type: "Subcontractor", hasBusinessName: false }],
          itemCodes: emptyCodes(),
          suggestedItemCodes: emptyCodes(),
          missingItemClasses: [],
        },
      ]);
    });

    it("groups customers by bill to and suggests a contact for unmapped ones", async () => {
      const { contactMappings } = await getXeroMappings();

      expect(contactMappings).toEqual([
        {
          key: "acme pty ltd",
          billTo: "Acme Pty Ltd",
          customers: ["Acme", "Acme North"],
          contactId: null,
          contactName: null,
          suggestedContactId: "c-1",
        },
        {
          key: "gone co",
          billTo: "Gone Co",
          customers: [],
          contactId: "c-9",
          contactName: "Gone",
          suggestedContactId: null,
        },
        {
          key: "zed holdings",
          billTo: "Zed Holdings",
          customers: ["Zed"],
          contactId: "c-2",
          contactName: "Zed Holdings Group",
          suggestedContactId: null,
        },
      ]);
    });

    it("does not flag missing items before the first sync", async () => {
      mocks.itemFindMany.mockResolvedValue([]);

      const { vehicles, companies, items } = await getXeroMappings();

      expect(items).toEqual([]);
      expect(vehicles.every((row) => !row.isItemMissing)).toBe(true);
      expect(vehicles.every((row) => row.suggestedItemCode === null)).toBe(true);
      expect(companies.every((row) => row.missingItemClasses.length === 0)).toBe(true);
    });
  });

  describe("saveVehicleItemMappings", () => {
    beforeEach(() => {
      mocks.itemFindMany.mockImplementation(async ({ where }: { where: { code: { in: string[] } } }) =>
        xeroItems.filter((item) => where.code.in.includes(item.code)).map(({ code }) => ({ code })),
      );
    });

    it("upserts by normalised registration and deletes cleared mappings", async () => {
      await saveVehicleItemMappings({
        mappings: [
          { registration: "bnt 040", itemCode: " 14TT - 01 " },
          { registration: "xyz-999", itemCode: null },
          { registration: "ABC123", itemCode: "  " },
        ],
        userId: "user_admin",
      });

      expect(mocks.itemFindMany).toHaveBeenCalledWith({
        where: { code: { in: ["14TT - 01"] } },
        select: { code: true },
      });
      expect(mocks.vehicleMappingUpsert).toHaveBeenCalledWith({
        where: { registration: "BNT040" },
        create: { registration: "BNT040", itemCode: "14TT - 01", updatedBy: "user_admin" },
        update: { itemCode: "14TT - 01", updatedBy: "user_admin" },
      });
      expect(mocks.vehicleMappingDeleteMany).toHaveBeenCalledWith({
        where: { registration: "XYZ999" },
      });
      expect(mocks.vehicleMappingDeleteMany).toHaveBeenCalledWith({
        where: { registration: "ABC123" },
      });
      expect(mocks.transaction).toHaveBeenCalledTimes(1);
      expect(mocks.transaction.mock.calls[0][0]).toHaveLength(3);
    });

    it("skips the item check when only removing mappings", async () => {
      await saveVehicleItemMappings({
        mappings: [{ registration: "ABC123", itemCode: null }],
        userId: "user_admin",
      });

      expect(mocks.itemFindMany).not.toHaveBeenCalled();
      expect(mocks.vehicleMappingDeleteMany).toHaveBeenCalled();
    });

    it("rejects item codes that are not in Xero", async () => {
      const message = await itemCodeError({
        promise: saveVehicleItemMappings({
          mappings: [
            { registration: "ABC123", itemCode: "NOPE" },
            { registration: "DEF456", itemCode: "14TT - 01" },
            { registration: "GHI789", itemCode: "ALSO" },
          ],
          userId: "user_admin",
        }),
      });

      expect(message).toBe("Item codes not in Xero: NOPE, ALSO");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("names a single unknown item code", async () => {
      const message = await itemCodeError({
        promise: saveVehicleItemMappings({
          mappings: [{ registration: "ABC123", itemCode: "NOPE" }],
          userId: "user_admin",
        }),
      });

      expect(message).toBe("Item code not in Xero: NOPE");
    });

    it("asks for a sync when no items have been synced", async () => {
      mocks.itemCount.mockResolvedValue(0);

      const message = await itemCodeError({
        promise: saveVehicleItemMappings({
          mappings: [{ registration: "ABC123", itemCode: "14TT - 01" }],
          userId: "user_admin",
        }),
      });

      expect(message).toBe("Sync items from Xero before mapping item codes");
    });

    it("rejects a registration with no letters or digits", async () => {
      const message = await itemCodeError({
        promise: saveVehicleItemMappings({
          mappings: [{ registration: "--", itemCode: "14TT - 01" }],
          userId: "user_admin",
        }),
      });

      expect(message).toBe("Each mapping needs a registration");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });

  describe("saveCompanyItemMappings", () => {
    beforeEach(() => {
      mocks.itemFindMany.mockImplementation(async ({ where }: { where: { code: { in: string[] } } }) =>
        xeroItems.filter((item) => where.code.in.includes(item.code)).map(({ code }) => ({ code })),
      );
    });

    it("upserts by normalised company and truck class and deletes cleared mappings", async () => {
      await saveCompanyItemMappings({
        mappings: [
          { companyName: "  Blue   Hawk Pty Ltd ", truckClass: "crane", itemCode: "12TC - 01SUB" },
          { companyName: "Lee", truckClass: "tray", itemCode: null },
        ],
        userId: "user_admin",
      });

      expect(mocks.companyMappingUpsert).toHaveBeenCalledWith({
        where: { companyKey_truckClass: { companyKey: "blue hawk pty ltd", truckClass: "crane" } },
        create: {
          companyKey: "blue hawk pty ltd",
          companyName: "Blue Hawk Pty Ltd",
          truckClass: "crane",
          itemCode: "12TC - 01SUB",
          updatedBy: "user_admin",
        },
        update: { companyName: "Blue Hawk Pty Ltd", itemCode: "12TC - 01SUB", updatedBy: "user_admin" },
      });
      expect(mocks.companyMappingDeleteMany).toHaveBeenCalledWith({
        where: { companyKey: "lee", truckClass: "tray" },
      });
    });

    it("rejects item codes that are not in Xero", async () => {
      const message = await itemCodeError({
        promise: saveCompanyItemMappings({
          mappings: [{ companyName: "Lee", truckClass: "semi", itemCode: "PRIME - 99" }],
          userId: "user_admin",
        }),
      });

      expect(message).toBe("Item code not in Xero: PRIME - 99");
      expect(mocks.companyMappingUpsert).not.toHaveBeenCalled();
    });

    it("rejects a blank company name", async () => {
      const message = await itemCodeError({
        promise: saveCompanyItemMappings({
          mappings: [{ companyName: "   ", truckClass: "tray", itemCode: null }],
          userId: "user_admin",
        }),
      });

      expect(message).toBe("Each mapping needs a company name");
    });
  });

  describe("saveContactMappings", () => {
    beforeEach(() => {
      mocks.contactFindMany.mockImplementation(
        async ({ where }: { where: { contactId: { in: string[] } } }) =>
          [
            { contactId: "c-1", name: "ACME PTY LTD" },
            { contactId: "c-2", name: "Zed Holdings Group" },
          ].filter((contact) => where.contactId.in.includes(contact.contactId)),
      );
    });

    it("upserts by normalised bill to with the synced contact name", async () => {
      await saveContactMappings({
        mappings: [
          { billTo: " Acme   Pty Ltd ", contactId: " c-1 " },
          { billTo: "Zed Holdings", contactId: null },
        ],
        userId: "user_admin",
      });

      expect(mocks.contactFindMany).toHaveBeenCalledWith({
        where: { contactId: { in: ["c-1"] } },
        select: { contactId: true, name: true },
      });
      expect(mocks.contactMappingUpsert).toHaveBeenCalledWith({
        where: { billToKey: "acme pty ltd" },
        create: {
          billToKey: "acme pty ltd",
          billTo: "Acme Pty Ltd",
          contactId: "c-1",
          contactName: "ACME PTY LTD",
          updatedBy: "user_admin",
        },
        update: {
          billTo: "Acme Pty Ltd",
          contactId: "c-1",
          contactName: "ACME PTY LTD",
          updatedBy: "user_admin",
        },
      });
      expect(mocks.contactMappingDeleteMany).toHaveBeenCalledWith({
        where: { billToKey: "zed holdings" },
      });
    });

    it("rejects a contact that is not in Xero", async () => {
      const message = await itemCodeError({
        promise: saveContactMappings({
          mappings: [{ billTo: "Acme Pty Ltd", contactId: "c-9" }],
          userId: "user_admin",
        }),
      });

      expect(message).toBe("A selected contact is not in Xero. Sync from Xero and try again.");
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rejects a blank bill to", async () => {
      const message = await itemCodeError({
        promise: saveContactMappings({
          mappings: [{ billTo: "  ", contactId: "c-1" }],
          userId: "user_admin",
        }),
      });

      expect(message).toBe("Each mapping needs a bill to name");
    });
  });

  describe("saveXeroSettings", () => {
    beforeEach(() => {
      mocks.itemFindMany.mockImplementation(async ({ where }: { where: { code: { in: string[] } } }) =>
        [{ code: "Break" }, { code: "EL" }, { code: "CL" }, { code: "Fuel Levy" }].filter((item) =>
          where.code.in.includes(item.code),
        ),
      );
    });

    it("updates the existing settings row and returns the saved settings", async () => {
      mocks.settingsFindFirst.mockResolvedValue({ id: 4 });

      const result = await saveXeroSettings({ settings, userId: "user_admin" });

      expect(result).toEqual(settings);
      expect(mocks.itemFindMany).toHaveBeenCalledWith({
        where: { code: { in: ["Break", "EL", "CL", "Fuel Levy"] } },
        select: { code: true },
      });
      expect(mocks.settingsUpdate).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { ...settings, updatedBy: "user_admin" },
      });
      expect(mocks.settingsCreate).not.toHaveBeenCalled();
    });

    it("creates the settings row the first time", async () => {
      mocks.settingsFindFirst.mockResolvedValue(null);
      const saved = {
        ...settings,
        breakItemCode: null,
        eastlinkItemCode: null,
        citylinkItemCode: null,
        fuelLevyItemCode: null,
      };

      await saveXeroSettings({ settings: saved, userId: "user_admin" });

      expect(mocks.itemFindMany).not.toHaveBeenCalled();
      expect(mocks.settingsCreate).toHaveBeenCalledWith({
        data: { ...saved, updatedBy: "user_admin" },
      });
    });

    it("saves settings before the first sync", async () => {
      mocks.itemCount.mockResolvedValue(0);
      mocks.itemFindMany.mockResolvedValue([]);
      mocks.settingsFindFirst.mockResolvedValue(null);

      await saveXeroSettings({ settings, userId: "user_admin" });

      expect(mocks.settingsCreate).toHaveBeenCalledWith({
        data: { ...settings, updatedBy: "user_admin" },
      });
    });

    it("rejects an item code that is not in Xero", async () => {
      const message = await itemCodeError({
        promise: saveXeroSettings({
          settings: { ...settings, breakItemCode: "BRK" },
          userId: "user_admin",
        }),
      });

      expect(message).toBe("Item code not in Xero: BRK");
      expect(mocks.settingsUpdate).not.toHaveBeenCalled();
      expect(mocks.settingsCreate).not.toHaveBeenCalled();
    });
  });
});
