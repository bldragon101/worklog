/**
 * @vitest-environment node
 */
import { syncXeroItemsAndContacts } from "@/lib/xero/sync";

const mocks = vi.hoisted(() => ({
  fetchXeroItems: vi.fn(),
  fetchXeroContacts: vi.fn(),
  itemDeleteMany: vi.fn(),
  itemCreateMany: vi.fn(),
  contactDeleteMany: vi.fn(),
  contactCreateMany: vi.fn(),
  connectionUpdateMany: vi.fn(),
  transaction: vi.fn(),
  order: [] as string[],
}));

vi.mock("@/lib/xero/client", () => ({
  fetchXeroItems: mocks.fetchXeroItems,
  fetchXeroContacts: mocks.fetchXeroContacts,
}));
vi.mock("@/lib/prisma", () => {
  const record =
    ({ name, fn }: { name: string; fn: (args: unknown) => unknown }) =>
    async (args: unknown) => {
      mocks.order.push(name);
      return fn(args);
    };
  const tx = {
    xeroItem: {
      deleteMany: record({ name: "item.deleteMany", fn: mocks.itemDeleteMany }),
      createMany: record({ name: "item.createMany", fn: mocks.itemCreateMany }),
    },
    xeroContact: {
      deleteMany: record({ name: "contact.deleteMany", fn: mocks.contactDeleteMany }),
      createMany: record({ name: "contact.createMany", fn: mocks.contactCreateMany }),
    },
    xeroConnection: {
      updateMany: record({ name: "connection.updateMany", fn: mocks.connectionUpdateMany }),
    },
  };
  return {
    prisma: {
      $transaction: async (operation: (client: unknown) => Promise<unknown>, options: unknown) => {
        mocks.transaction(options);
        return operation(tx);
      },
    },
  };
});

describe("syncXeroItemsAndContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order.length = 0;
    vi.useFakeTimers({ now: new Date("2026-11-02T03:04:05.000Z"), toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces the items and contacts and stamps the active connection", async () => {
    mocks.fetchXeroItems.mockResolvedValue([
      {
        ItemID: "i-1",
        Code: " 14TT - 01 ",
        Name: " Tray truck ",
        IsSold: true,
        SalesDetails: { UnitPrice: 120.5, AccountCode: "200", TaxType: "OUTPUT" },
      },
      { ItemID: "i-2", Code: "EL" },
      { ItemID: "i-3", Code: "   ", Name: "No code" },
      { ItemID: "", Code: "NOID" },
      { ItemID: "i-5", Code: "BUY", IsSold: false, Name: "" },
    ]);
    mocks.fetchXeroContacts.mockResolvedValue([
      { ContactID: "c-1", Name: " Acme Pty Ltd ", EmailAddress: " a@acme.test ", IsCustomer: true },
      { ContactID: "c-2", Name: "Blue Hawk", EmailAddress: " " },
      { ContactID: "c-3", Name: "  " },
    ]);

    const result = await syncXeroItemsAndContacts();

    const syncedAt = new Date("2026-11-02T03:04:05.000Z");
    expect(result).toEqual({
      items: 3,
      contacts: 2,
      itemsSyncedAt: "2026-11-02T03:04:05.000Z",
      contactsSyncedAt: "2026-11-02T03:04:05.000Z",
    });
    expect(mocks.order).toEqual([
      "item.deleteMany",
      "item.createMany",
      "contact.deleteMany",
      "contact.createMany",
      "connection.updateMany",
    ]);
    expect(mocks.itemDeleteMany).toHaveBeenCalledWith({});
    expect(mocks.itemCreateMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        {
          itemId: "i-1",
          code: "14TT - 01",
          name: "Tray truck",
          salesUnitPrice: 120.5,
          salesAccountCode: "200",
          salesTaxType: "OUTPUT",
          isSold: true,
          syncedAt,
        },
        {
          itemId: "i-2",
          code: "EL",
          name: "EL",
          salesUnitPrice: null,
          salesAccountCode: null,
          salesTaxType: null,
          isSold: true,
          syncedAt,
        },
        {
          itemId: "i-5",
          code: "BUY",
          name: "BUY",
          salesUnitPrice: null,
          salesAccountCode: null,
          salesTaxType: null,
          isSold: false,
          syncedAt,
        },
      ],
    });
    expect(mocks.contactDeleteMany).toHaveBeenCalledWith({});
    expect(mocks.contactCreateMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        { contactId: "c-1", name: "Acme Pty Ltd", email: "a@acme.test", isCustomer: true, syncedAt },
        { contactId: "c-2", name: "Blue Hawk", email: null, isCustomer: false, syncedAt },
      ],
    });
    expect(mocks.connectionUpdateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { itemsSyncedAt: syncedAt, contactsSyncedAt: syncedAt },
    });
  });

  it("clears the tables without inserting when Xero has nothing", async () => {
    mocks.fetchXeroItems.mockResolvedValue([]);
    mocks.fetchXeroContacts.mockResolvedValue([]);

    const result = await syncXeroItemsAndContacts();

    expect(result.items).toBe(0);
    expect(result.contacts).toBe(0);
    expect(mocks.itemDeleteMany).toHaveBeenCalled();
    expect(mocks.contactDeleteMany).toHaveBeenCalled();
    expect(mocks.itemCreateMany).not.toHaveBeenCalled();
    expect(mocks.contactCreateMany).not.toHaveBeenCalled();
    expect(mocks.connectionUpdateMany).toHaveBeenCalled();
  });

  it("changes nothing when fetching from Xero fails", async () => {
    mocks.fetchXeroItems.mockResolvedValue([{ ItemID: "i-1", Code: "A" }]);
    mocks.fetchXeroContacts.mockRejectedValue(new Error("rate limited"));

    await expect(syncXeroItemsAndContacts()).rejects.toThrow("rate limited");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.order).toEqual([]);
  });
});
