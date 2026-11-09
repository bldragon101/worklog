/**
 * @vitest-environment node
 */

const mocks = vi.hoisted(() => ({
  customerFindMany: vi.fn(),
  customerInvoiceFindMany: vi.fn(),
  jobsFindMany: vi.fn(),
  getTollRates: vi.fn(),
  loadXeroInvoiceContext: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: { findMany: mocks.customerFindMany },
    customerInvoice: { findMany: mocks.customerInvoiceFindMany },
    jobs: { findMany: mocks.jobsFindMany },
  },
}));
vi.mock("@/lib/toll-rates", () => ({ getTollRates: mocks.getTollRates }));
vi.mock("@/lib/xero/invoice-context", () => ({
  loadXeroInvoiceContext: mocks.loadXeroInvoiceContext,
}));

import { getCustomerInvoicesForWeek } from "@/lib/customer-invoices/service";
import { DEFAULT_XERO_SETTINGS } from "@/lib/xero/invoice-codes";

const xperia = {
  id: 1,
  customer: "Xperia Group",
  billTo: "Xperia Group Pty Ltd",
  tray: 100,
  crane: 120,
  semi: 130,
  semiCrane: 150,
  fuelLevy: null,
  tolls: false,
  breakDeduction: null,
  separateInvoicesByReference: true,
};

function jobRow({
  id,
  date = "2026-10-27",
  customer = "Xperia Group",
  jobReference = null,
}: {
  id: number;
  date?: string;
  customer?: string;
  jobReference?: string | null;
}) {
  return {
    id,
    date: new Date(`${date}T00:00:00.000Z`),
    customer,
    billTo: "Job Bill To",
    driver: "Sam Driver",
    registration: "CTJ450",
    truckType: "Tray",
    chargedHours: 5,
    startTime: null,
    finishTime: null,
    eastlink: null,
    citylink: null,
    countryRunValue: null,
    countryRunUnit: null,
    jobReference,
    pickup: "Depot",
    dropoff: null,
    attachmentRunsheet: ["https://drive.example/runsheet.pdf"],
  };
}

describe("getCustomerInvoicesForWeek", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customerFindMany.mockResolvedValue([xperia]);
    mocks.getTollRates.mockResolvedValue({ eastlink: 19.45, citylink: 34.9 });
    mocks.customerInvoiceFindMany.mockResolvedValue([]);
    mocks.jobsFindMany.mockResolvedValue([]);
    mocks.loadXeroInvoiceContext.mockResolvedValue(null);
  });

  it("only drafts the week's uninvoiced, chargeable jobs that are not on a saved invoice", async () => {
    await getCustomerInvoicesForWeek({ weekEnding: "2026-11-01" });

    expect(mocks.jobsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { OR: [{ invoiced: false }, { invoiced: null }] },
            { OR: [{ driverOnly: false }, { driverOnly: null }] },
          ],
          date: {
            gte: new Date("2026-10-25T12:00:00.000Z"),
            lt: new Date("2026-11-01T12:00:00.000Z"),
          },
          customerInvoiceId: null,
        },
      }),
    );
    expect(mocks.customerInvoiceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { weekEnding: new Date("2026-11-01T00:00:00.000Z") } }),
    );
  });

  it("drafts one invoice per run for a customer separated by reference", async () => {
    mocks.jobsFindMany.mockResolvedValue([
      jobRow({ id: 1, jobReference: "Bowens Cheltenham" }),
      jobRow({ id: 2, jobReference: "Bowens Bentleigh" }),
    ]);

    const invoices = await getCustomerInvoicesForWeek({ weekEnding: "2026-11-01" });

    expect(
      invoices.map(({ reference, isSaved, customerId, billTo, totals }) => ({
        reference,
        isSaved,
        customerId,
        billTo,
        total: totals.total,
      })),
    ).toEqual([
      {
        reference: "BowensBentleigh-01/11/26",
        isSaved: false,
        customerId: 1,
        billTo: "Xperia Group Pty Ltd",
        total: 550,
      },
      {
        reference: "BowensCheltenham-01/11/26",
        isSaved: false,
        customerId: 1,
        billTo: "Xperia Group Pty Ltd",
        total: 550,
      },
    ]);
  });

  it("flags jobs entered for a customer with no record", async () => {
    mocks.jobsFindMany.mockResolvedValue([jobRow({ id: 1, customer: "New Customer" })]);

    const [invoice] = await getCustomerInvoicesForWeek({ weekEnding: "2026-11-01" });

    expect(invoice).toMatchObject({
      customerId: null,
      customerName: "New Customer",
      billTo: "Job Bill To",
      reference: "NewCustomer-01/11/26",
      totals: { subtotal: 0, gst: 0, total: 0 },
    });
    expect(invoice.warnings.map((warning) => warning.code)).toContain("unknown_customer");
  });

  it("lists saved invoices with their stored reference and flags jobs that have moved", async () => {
    mocks.customerInvoiceFindMany.mockResolvedValue([
      {
        id: 7,
        customerId: 1,
        weekEnding: new Date("2026-11-01T00:00:00.000Z"),
        jobReference: "Bowens DC",
        reference: "BowensDC-01/11/26-Adhoc",
        notes: "Adhoc jobs",
        status: "draft",
        waivedBreakDeductions: [],
        createdBy: "user_1",
        createdAt: new Date(),
        updatedAt: new Date(),
        customer: xperia,
        jobs: [
          jobRow({ id: 3, jobReference: "Bowens DC" }),
          jobRow({ id: 4, date: "2026-11-03", jobReference: "Bowens DC" }),
          jobRow({ id: 5, customer: "Acme", jobReference: "Bowens DC" }),
        ],
      },
    ]);

    const [invoice] = await getCustomerInvoicesForWeek({ weekEnding: "2026-11-01" });

    expect(invoice).toMatchObject({
      key: "saved:7",
      id: 7,
      isSaved: true,
      reference: "BowensDC-01/11/26-Adhoc",
      notes: "Adhoc jobs",
    });
    expect(
      invoice.warnings
        .filter((warning) => warning.code === "job_moved")
        .map((warning) => warning.jobId),
    ).toEqual([4, 5]);
  });

  it("leaves out Xero item codes and warnings when Xero is not connected", async () => {
    mocks.jobsFindMany.mockResolvedValue([jobRow({ id: 1, jobReference: "Bowens Cheltenham" })]);

    const [invoice] = await getCustomerInvoicesForWeek({ weekEnding: "2026-11-01" });

    expect(invoice).toMatchObject({ xeroConnected: false, xeroContact: null });
    expect(invoice.lines[0].itemCode).toBeNull();
    expect(invoice.warnings.some((warning) => warning.code.startsWith("unmapped"))).toBe(false);
  });

  it("adds Xero item codes and the contact when Xero is connected", async () => {
    mocks.jobsFindMany.mockResolvedValue([jobRow({ id: 1, jobReference: "Bowens Cheltenham" })]);
    mocks.loadXeroInvoiceContext.mockResolvedValue({
      settings: DEFAULT_XERO_SETTINGS,
      itemCodes: new Set(["12TC - 09"]),
      vehicleItems: new Map([["CTJ450", "12TC - 09"]]),
      companyItems: new Map(),
      contacts: new Map([
        ["xperia group pty ltd", { contactId: "c1", contactName: "Xperia Group Pty Ltd" }],
      ]),
      drivers: new Map([["sam driver", { type: "Employee", companyName: "Sam Driver" }]]),
    });

    const [invoice] = await getCustomerInvoicesForWeek({ weekEnding: "2026-11-01" });

    expect(invoice).toMatchObject({
      xeroConnected: true,
      xeroContact: { contactId: "c1", contactName: "Xperia Group Pty Ltd" },
    });
    expect(invoice.lines[0].itemCode).toBe("12TC - 09");
    expect(invoice.warnings).toEqual([]);
  });
});
