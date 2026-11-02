/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/customer-invoices/route";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  clerkUserId: { value: "user_admin" as string | null },
  queryRaw: vi.fn(),
  lockedInvoices: vi.fn(),
  jobsFindMany: vi.fn(),
  jobsUpdateMany: vi.fn(),
  customerFindMany: vi.fn(),
  invoiceCreate: vi.fn(),
  invoiceFindMany: vi.fn(),
  invoiceDeleteMany: vi.fn(),
  logActivity: vi.fn(),
  getCustomerInvoicesForWeek: vi.fn(),
  getSavedCustomerInvoiceView: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.clerkUserId.value }),
  clerkClient: vi.fn(),
}));
vi.mock("@/lib/permissions", () => ({
  checkPermission: mocks.checkPermission,
  getUserRole: async () => "admin",
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ headers: {} }),
  rateLimitConfigs: { general: {} },
}));
vi.mock("@/lib/activity-logger", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/prisma", () => {
  const client = {
    user: { findUnique: async () => ({ isActive: true }) },
    jobs: { findMany: mocks.jobsFindMany, updateMany: mocks.jobsUpdateMany },
    customer: { findMany: mocks.customerFindMany },
    customerInvoice: {
      create: mocks.invoiceCreate,
      findMany: mocks.invoiceFindMany,
      deleteMany: mocks.invoiceDeleteMany,
    },
    $queryRaw: mocks.queryRaw,
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation(client),
  };
  return { prisma: client };
});
vi.mock("@/lib/customer-invoices/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/customer-invoices/service")>()),
  getCustomerInvoicesForWeek: mocks.getCustomerInvoicesForWeek,
  getSavedCustomerInvoiceView: mocks.getSavedCustomerInvoiceView,
}));

const url = "http://localhost:3000/api/customer-invoices";

function sqlOf({ call }: { call: unknown[] }): string {
  return (call[0] as TemplateStringsArray).join("?");
}

function sqlValues({ call }: { call: unknown[] }): unknown[] {
  return (call[1] as { values: unknown[] }).values;
}

function postRequest({ body }: { body: unknown }) {
  return new NextRequest(url, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function buildCustomer({
  id = 3,
  customer = "Acme Haulage",
  separateInvoicesByReference = false,
}: {
  id?: number;
  customer?: string;
  separateInvoicesByReference?: boolean;
}) {
  return {
    id,
    customer,
    billTo: `${customer} Pty Ltd`,
    tray: 100,
    crane: 120,
    semi: 140,
    semiCrane: 160,
    fuelLevy: 10,
    tolls: true,
    breakDeduction: 0.5,
    separateInvoicesByReference,
  };
}

function buildJob({
  id,
  date = "2026-10-27",
  customer = "Acme Haulage",
  jobReference = null,
  customerInvoiceId = null,
  invoiced = false,
  driverOnly = false,
}: {
  id: number;
  date?: string;
  customer?: string;
  jobReference?: string | null;
  customerInvoiceId?: number | null;
  invoiced?: boolean | null;
  driverOnly?: boolean | null;
}) {
  return {
    id,
    date: new Date(`${date}T00:00:00.000Z`),
    customer,
    billTo: "Acme Haulage Pty Ltd",
    driver: "Sam",
    registration: "ABC123",
    truckType: "Tray",
    chargedHours: 8,
    startTime: null,
    finishTime: null,
    eastlink: 0,
    citylink: 0,
    countryRunValue: null,
    countryRunUnit: null,
    jobReference,
    pickup: "Dandenong",
    dropoff: "Clayton",
    attachmentRunsheet: [],
    customerInvoiceId,
    invoiced,
    driverOnly,
  };
}

const savedView = { key: "saved:50", id: 50, isSaved: true, reference: "AcmeHaulage-01/11/26" };

describe("/api/customer-invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clerkUserId.value = "user_admin";
    mocks.checkPermission.mockResolvedValue(true);
    mocks.lockedInvoices.mockReturnValue([]);
    mocks.queryRaw.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join("?").includes('FROM "CustomerInvoice"') ? mocks.lockedInvoices() : [],
    );
    mocks.customerFindMany.mockResolvedValue([buildCustomer({})]);
    mocks.invoiceCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 50,
      reference: data.reference,
      jobReference: data.jobReference,
    }));
    mocks.invoiceFindMany.mockResolvedValue([]);
    mocks.getSavedCustomerInvoiceView.mockResolvedValue(savedView);
  });

  describe("GET", () => {
    it("returns the week's invoices", async () => {
      const invoices = [{ key: "auto:acme haulage:2026-11-01:" }];
      mocks.getCustomerInvoicesForWeek.mockResolvedValue(invoices);

      const response = await GET(new NextRequest(`${url}?weekEnding=2026-11-01`));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ weekEnding: "2026-11-01", invoices });
      expect(mocks.getCustomerInvoicesForWeek).toHaveBeenCalledWith({ weekEnding: "2026-11-01" });
    });

    it.each([
      { name: "a missing week ending", query: "" },
      { name: "a malformed date", query: "?weekEnding=01/11/2026" },
      { name: "a date that does not exist", query: "?weekEnding=2026-02-30" },
      { name: "a date that is not a Sunday", query: "?weekEnding=2026-10-31" },
    ])("rejects $name", async ({ query }) => {
      const response = await GET(new NextRequest(`${url}${query}`));

      expect(response.status).toBe(400);
      expect(mocks.getCustomerInvoicesForWeek).not.toHaveBeenCalled();
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await GET(new NextRequest(`${url}?weekEnding=2026-11-01`));

      expect(response.status).toBe(403);
      expect(mocks.checkPermission).toHaveBeenCalledWith("manage_invoices");
      expect(mocks.getCustomerInvoicesForWeek).not.toHaveBeenCalled();
    });

    it("requires sign-in", async () => {
      mocks.clerkUserId.value = null;

      const response = await GET(new NextRequest(`${url}?weekEnding=2026-11-01`));

      expect(response.status).toBe(401);
    });
  });

  describe("POST", () => {
    it("saves an invoice from the jobs and returns its view", async () => {
      mocks.jobsFindMany.mockResolvedValue([
        buildJob({ id: 1 }),
        buildJob({ id: 2, date: "2026-11-01", customer: " acme  HAULAGE" }),
      ]);

      const response = await POST(postRequest({ body: { jobIds: [2, 1, 2] } }));

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(savedView);

      const jobLock = mocks.queryRaw.mock.calls[0];
      expect(sqlOf({ call: jobLock })).toContain('FROM "Jobs" WHERE id IN');
      expect(sqlOf({ call: jobLock })).toContain("ORDER BY id FOR UPDATE");
      expect(sqlValues({ call: jobLock })).toEqual([2, 1]);

      expect(mocks.jobsFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [2, 1] } },
          select: expect.objectContaining({ customerInvoiceId: true, invoiced: true, driverOnly: true }),
        }),
      );
      expect(mocks.invoiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            customerId: 3,
            weekEnding: new Date("2026-11-01T00:00:00.000Z"),
            jobReference: null,
            reference: "AcmeHaulage-01/11/26",
            createdBy: "user_admin",
          },
        }),
      );
      expect(mocks.jobsUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: [2, 1] } },
        data: { customerInvoiceId: 50 },
      });
      expect(mocks.invoiceDeleteMany).not.toHaveBeenCalled();
      expect(mocks.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE", tableName: "CustomerInvoice", recordId: "50" }),
      );
      expect(mocks.getSavedCustomerInvoiceView).toHaveBeenCalledWith({ id: 50 });
    });

    it("uses the given reference, trimmed", async () => {
      mocks.jobsFindMany.mockResolvedValue([buildJob({ id: 1 })]);

      const response = await POST(postRequest({ body: { jobIds: [1], reference: "  INV-77  " } }));

      expect(response.status).toBe(201);
      expect(mocks.invoiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reference: "INV-77" }) }),
      );
    });

    it("returns 404 when a job does not exist", async () => {
      mocks.jobsFindMany.mockResolvedValue([buildJob({ id: 1 })]);

      const response = await POST(postRequest({ body: { jobIds: [1, 8, 9] } }));

      expect(response.status).toBe(404);
      expect((await response.json()).error).toBe("Jobs 8, 9 not found");
      expect(mocks.invoiceCreate).not.toHaveBeenCalled();
    });

    it("rejects jobs already marked as invoiced", async () => {
      mocks.jobsFindMany.mockResolvedValue([buildJob({ id: 1 }), buildJob({ id: 2, invoiced: true })]);

      const response = await POST(postRequest({ body: { jobIds: [1, 2] } }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Job 2 is already marked as invoiced");
      expect(mocks.invoiceCreate).not.toHaveBeenCalled();
    });

    it("rejects driver-only jobs", async () => {
      mocks.jobsFindMany.mockResolvedValue([
        buildJob({ id: 1, driverOnly: true }),
        buildJob({ id: 2, driverOnly: true }),
      ]);

      const response = await POST(postRequest({ body: { jobIds: [1, 2] } }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Jobs 1, 2 are driver only and cannot be invoiced");
    });

    it("accepts jobs whose invoiced and driver-only flags are null", async () => {
      mocks.jobsFindMany.mockResolvedValue([buildJob({ id: 1, invoiced: null, driverOnly: null })]);

      const response = await POST(postRequest({ body: { jobIds: [1] } }));

      expect(response.status).toBe(201);
    });

    it("rejects jobs for different customers", async () => {
      mocks.jobsFindMany.mockResolvedValue([buildJob({ id: 1 }), buildJob({ id: 2, customer: "Bowens" })]);

      const response = await POST(postRequest({ body: { jobIds: [1, 2] } }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Jobs must all be for the same customer");
      expect(mocks.invoiceCreate).not.toHaveBeenCalled();
    });

    it("rejects jobs with no customer record", async () => {
      mocks.jobsFindMany.mockResolvedValue([buildJob({ id: 1, customer: " Unknown Co " })]);

      const response = await POST(postRequest({ body: { jobIds: [1] } }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('No customer record named "Unknown Co"');
    });

    it("rejects jobs from different weeks", async () => {
      mocks.jobsFindMany.mockResolvedValue([buildJob({ id: 1 }), buildJob({ id: 2, date: "2026-11-02" })]);

      const response = await POST(postRequest({ body: { jobIds: [1, 2] } }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Jobs must all be in the same week");
      expect(mocks.invoiceCreate).not.toHaveBeenCalled();
    });

    it("keeps the job reference when the customer is split by reference and every job shares it", async () => {
      mocks.customerFindMany.mockResolvedValue([buildCustomer({ separateInvoicesByReference: true })]);
      mocks.jobsFindMany.mockResolvedValue([
        buildJob({ id: 1, jobReference: " Run 5 " }),
        buildJob({ id: 2, jobReference: "run  5" }),
      ]);

      const response = await POST(postRequest({ body: { jobIds: [1, 2] } }));

      expect(response.status).toBe(201);
      expect(mocks.invoiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ jobReference: "Run 5", reference: "Run5-01/11/26" }),
        }),
      );
    });

    it.each([
      {
        name: "the jobs have different references",
        separateInvoicesByReference: true,
        references: ["Run 5", "Run 6"],
      },
      {
        name: "a job has no reference",
        separateInvoicesByReference: true,
        references: ["Run 5", null],
      },
      {
        name: "the customer is not split by reference",
        separateInvoicesByReference: false,
        references: ["Run 5", "Run 5"],
      },
    ])("stores no job reference when $name", async ({ separateInvoicesByReference, references }) => {
      mocks.customerFindMany.mockResolvedValue([buildCustomer({ separateInvoicesByReference })]);
      mocks.jobsFindMany.mockResolvedValue(
        references.map((jobReference, index) => buildJob({ id: index + 1, jobReference })),
      );

      const response = await POST(postRequest({ body: { jobIds: [1, 2] } }));

      expect(response.status).toBe(201);
      expect(mocks.invoiceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ jobReference: null, reference: "AcmeHaulage-01/11/26" }),
        }),
      );
    });

    it("moves jobs off saved invoices and deletes the ones left empty", async () => {
      mocks.jobsFindMany.mockResolvedValue([
        buildJob({ id: 1, customerInvoiceId: 9 }),
        buildJob({ id: 2, customerInvoiceId: 12 }),
        buildJob({ id: 3 }),
      ]);
      mocks.lockedInvoices.mockReturnValue([
        { id: 9, status: "draft" },
        { id: 12, status: "draft" },
      ]);
      mocks.invoiceFindMany.mockResolvedValue([
        { id: 9, reference: "Old-01/11/26", customerId: 3, weekEnding: new Date("2026-11-01T00:00:00.000Z") },
      ]);

      const response = await POST(postRequest({ body: { jobIds: [1, 2, 3] } }));

      expect(response.status).toBe(201);
      const invoiceLock = mocks.queryRaw.mock.calls[1];
      expect(sqlOf({ call: invoiceLock })).toContain('FROM "CustomerInvoice" WHERE id IN');
      expect(sqlOf({ call: invoiceLock })).toContain("ORDER BY id FOR UPDATE");
      expect(sqlValues({ call: invoiceLock })).toEqual([9, 12]);
      expect(mocks.jobsUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3] } },
        data: { customerInvoiceId: 50 },
      });
      expect(mocks.invoiceFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [9, 12] }, jobs: { none: {} } } }),
      );
      expect(mocks.invoiceDeleteMany).toHaveBeenCalledWith({ where: { id: { in: [9] } } });
      expect(mocks.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: "DELETE", tableName: "CustomerInvoice", recordId: "9" }),
      );
    });

    it("does not move jobs off an invoice that is not a draft", async () => {
      mocks.jobsFindMany.mockResolvedValue([buildJob({ id: 1, customerInvoiceId: 9 })]);
      mocks.lockedInvoices.mockReturnValue([{ id: 9, status: "sent" }]);

      const response = await POST(postRequest({ body: { jobIds: [1] } }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Invoice 9 is not a draft");
      expect(mocks.invoiceCreate).not.toHaveBeenCalled();
      expect(mocks.jobsUpdateMany).not.toHaveBeenCalled();
    });

    it.each([
      { name: "no jobs", body: { jobIds: [] } },
      { name: "missing job IDs", body: {} },
      { name: "more than 500 jobs", body: { jobIds: Array.from({ length: 501 }, (_, index) => index + 1) } },
      { name: "a zero job ID", body: { jobIds: [0] } },
      { name: "a fractional job ID", body: { jobIds: [1.5] } },
      { name: "a job ID given as text", body: { jobIds: ["1"] } },
      { name: "an empty reference", body: { jobIds: [1], reference: "   " } },
      { name: "a reference over 100 characters", body: { jobIds: [1], reference: "R".repeat(101) } },
      { name: "malformed JSON", body: "{jobIds:" },
    ])("rejects $name", async ({ body }) => {
      const response = await POST(postRequest({ body }));

      expect(response.status).toBe(400);
      expect(mocks.jobsFindMany).not.toHaveBeenCalled();
      expect(mocks.invoiceCreate).not.toHaveBeenCalled();
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await POST(postRequest({ body: { jobIds: [1] } }));

      expect(response.status).toBe(403);
      expect(mocks.queryRaw).not.toHaveBeenCalled();
      expect(mocks.invoiceCreate).not.toHaveBeenCalled();
    });
  });
});
