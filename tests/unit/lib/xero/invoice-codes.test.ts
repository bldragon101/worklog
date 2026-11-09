import type { CustomerInvoiceLine } from "@/lib/customer-invoices/types";
import {
  applyXeroCodes,
  DEFAULT_XERO_SETTINGS,
  getXeroCompanyName,
  type XeroInvoiceContext,
} from "@/lib/xero/invoice-codes";

function line({ overrides = {} }: { overrides?: Partial<CustomerInvoiceLine> } = {}): CustomerInvoiceLine {
  return {
    kind: "job",
    jobId: 1,
    jobDate: "2026-10-27",
    truckType: "Crane",
    truckClass: "crane",
    registration: "BNT 040",
    driver: "Harjit",
    description: "27/10/26",
    quantity: 8,
    unitAmount: 120,
    amountExGst: 960,
    gstAmount: 96,
    amountIncGst: 1056,
    breakKey: null,
    tollRoad: null,
    fuelLevyPercent: null,
    itemCode: null,
    ...overrides,
  };
}

function context({ overrides = {} }: { overrides?: Partial<XeroInvoiceContext> } = {}): XeroInvoiceContext {
  return {
    settings: DEFAULT_XERO_SETTINGS,
    itemCodes: new Set([
      "12TC - 02",
      "12TC - 11SUB",
      "Break",
      "EL",
      "CL",
      "Fuel Levy",
      "Fuel Levy 10%",
    ]),
    vehicleItems: new Map([["BNT040", "12TC - 02"]]),
    companyItems: new Map([["akita transport|crane", "12TC - 11SUB"]]),
    contacts: new Map([["xperia group", { contactId: "c1", contactName: "Xperia Group Pty Ltd" }]]),
    drivers: new Map([
      ["harjit", { type: "Employee", companyName: "Harjit Singh" }],
      ["kestrel", { type: "Subcontractor", companyName: "Akita Transport" }],
      ["noel", { type: "Contractor", companyName: "Noel Contracting" }],
    ]),
    ...overrides,
  };
}

describe("getXeroCompanyName", () => {
  const base = { driver: "Sam", lastName: "Jones", truck: "AKITA", businessName: null };

  it("uses the business name when there is one", () => {
    expect(
      getXeroCompanyName({ ...base, type: "Subcontractor", businessName: " Akita Transport " }),
    ).toBe("Akita Transport");
  });

  it("falls back to the truck field for subcontractors and the full name for contractors", () => {
    expect(getXeroCompanyName({ ...base, type: "Subcontractor" })).toBe("AKITA");
    expect(getXeroCompanyName({ ...base, type: "Contractor" })).toBe("Sam Jones");
  });
});

describe("applyXeroCodes", () => {
  it("maps an employee's job by the truck registration", () => {
    const { lines, warnings } = applyXeroCodes({
      lines: [line()],
      billTo: "Xperia Group",
      context: context(),
    });

    expect(lines[0].itemCode).toBe("12TC - 02");
    expect(warnings).toEqual([]);
  });

  it("maps a subcontractor's job by company and truck class", () => {
    const { lines, warnings } = applyXeroCodes({
      lines: [line({ overrides: { driver: "Kestrel", registration: "KES101" } })],
      billTo: "Xperia Group",
      context: context(),
    });

    expect(lines[0].itemCode).toBe("12TC - 11SUB");
    expect(warnings).toEqual([]);
  });

  it("flags a company with no item for the job's truck class", () => {
    const { lines, warnings } = applyXeroCodes({
      lines: [line({ overrides: { driver: "Kestrel", truckClass: "tray", truckType: "Tray" } })],
      billTo: "Xperia Group",
      context: context(),
    });

    expect(lines[0].itemCode).toBeNull();
    expect(warnings).toEqual([
      {
        code: "unmapped_item",
        jobId: 1,
        message: "No Xero Tray item is mapped for Akita Transport",
      },
    ]);
  });

  it("flags an unmapped truck, noting a driver with no record", () => {
    const { warnings } = applyXeroCodes({
      lines: [
        line({ overrides: { registration: "XYZ123" } }),
        line({ overrides: { jobId: 2, driver: "Casual Carl", registration: "XYZ123" } }),
      ],
      billTo: "Xperia Group",
      context: context(),
    });

    expect(warnings.map((warning) => warning.message)).toEqual([
      "No Xero item is mapped for truck XYZ123",
      'No Xero item is mapped for truck XYZ123, and "Casual Carl" has no driver record',
    ]);
  });

  it("does not add an item warning for a truck type with no class", () => {
    const { warnings } = applyXeroCodes({
      lines: [line({ overrides: { truckClass: null, truckType: "UTE" } })],
      billTo: "Xperia Group",
      context: context(),
    });

    expect(warnings).toEqual([]);
  });

  it("uses the settings for breaks and tolls, and the matching fuel levy item", () => {
    const { lines, warnings } = applyXeroCodes({
      lines: [
        line({ overrides: { kind: "break", jobId: null, breakKey: "Crane|120" } }),
        line({ overrides: { kind: "toll", jobId: null, tollRoad: "eastlink" } }),
        line({ overrides: { kind: "toll", jobId: null, tollRoad: "citylink" } }),
        line({ overrides: { kind: "fuelLevy", jobId: null, fuelLevyPercent: 10 } }),
        line({ overrides: { kind: "fuelLevy", jobId: null, fuelLevyPercent: 7 } }),
      ],
      billTo: "Xperia Group",
      context: context(),
    });

    expect(lines.map((codedLine) => codedLine.itemCode)).toEqual([
      "Break",
      "EL",
      "CL",
      "Fuel Levy 10%",
      "Fuel Levy",
    ]);
    expect(warnings).toEqual([]);
  });

  it("flags extra lines whose item is not set", () => {
    const { warnings } = applyXeroCodes({
      lines: [line({ overrides: { kind: "break", jobId: null } })],
      billTo: "Xperia Group",
      context: context({
        overrides: { settings: { ...DEFAULT_XERO_SETTINGS, breakItemCode: null } },
      }),
    });

    expect(warnings).toEqual([
      { code: "unmapped_item", jobId: null, message: "No Xero item is set for breaks" },
    ]);
  });

  it("flags a mapped item code that is no longer in Xero once", () => {
    const { warnings } = applyXeroCodes({
      lines: [line(), line({ overrides: { jobId: 2 } })],
      billTo: "Xperia Group",
      context: context({ overrides: { itemCodes: new Set(["Break"]) } }),
    });

    expect(warnings).toEqual([
      {
        code: "unmapped_item",
        jobId: 1,
        message: 'Item code "12TC - 02" is not in Xero. Sync from Xero or change the mapping.',
      },
    ]);
  });

  it("does not check item codes before the first sync", () => {
    const { warnings } = applyXeroCodes({
      lines: [line()],
      billTo: "Xperia Group",
      context: context({ overrides: { itemCodes: new Set() } }),
    });

    expect(warnings).toEqual([]);
  });

  it("finds the contact by bill to, ignoring case and spacing", () => {
    expect(
      applyXeroCodes({ lines: [], billTo: "  XPERIA   group ", context: context() }).contact,
    ).toEqual({ contactId: "c1", contactName: "Xperia Group Pty Ltd" });

    const unmapped = applyXeroCodes({ lines: [], billTo: "Metro Crane Hire", context: context() });
    expect(unmapped.contact).toBeNull();
    expect(unmapped.warnings).toEqual([
      {
        code: "unmapped_contact",
        jobId: null,
        message: 'Bill to "Metro Crane Hire" is not linked to a Xero contact',
      },
    ]);
  });
});
