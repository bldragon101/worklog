/**
 * @vitest-environment node
 */
import { NextRequest } from "next/server";
import { DELETE, GET, PATCH } from "@/app/api/customer-invoices/[id]/route";
import { POST as removeJobs } from "@/app/api/customer-invoices/[id]/remove-jobs/route";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  queryRaw: vi.fn(),
  lockedInvoices: vi.fn(),
  jobsFindMany: vi.fn(),
  jobsUpdateMany: vi.fn(),
  jobsCount: vi.fn(),
  invoiceFindUnique: vi.fn(),
  invoiceFindUniqueOrThrow: vi.fn(),
  invoiceUpdate: vi.fn(),
  invoiceDelete: vi.fn(),
  logActivity: vi.fn(),
  getSavedCustomerInvoiceView: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_admin" }),
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
    jobs: {
      findMany: mocks.jobsFindMany,
      updateMany: mocks.jobsUpdateMany,
      count: mocks.jobsCount,
    },
    customerInvoice: {
      findUnique: mocks.invoiceFindUnique,
      findUniqueOrThrow: mocks.invoiceFindUniqueOrThrow,
      update: mocks.invoiceUpdate,
      delete: mocks.invoiceDelete,
    },
    $queryRaw: mocks.queryRaw,
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation(client),
  };
  return { prisma: client };
});
vi.mock("@/lib/customer-invoices/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/customer-invoices/service")>()),
  getSavedCustomerInvoiceView: mocks.getSavedCustomerInvoiceView,
}));

const baseUrl = "http://localhost:3000/api/customer-invoices";

function context({ id }: { id: string }) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest({ path, method, body }: { path: string; method: string; body: unknown }) {
  return new NextRequest(`${baseUrl}/${path}`, {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function sqlOf({ call }: { call: unknown[] }): string {
  return (call[0] as TemplateStringsArray).join("?");
}

const savedView = { key: "saved:7", id: 7, isSaved: true, reference: "AcmeHaulage-01/11/26" };

const existingInvoice = {
  id: 7,
  reference: "AcmeHaulage-01/11/26",
  notes: "Old note",
  waivedBreakDeductions: [],
};

describe("/api/customer-invoices/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkPermission.mockResolvedValue(true);
    mocks.lockedInvoices.mockReturnValue([{ id: 7, status: "draft" }]);
    mocks.queryRaw.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join("?").includes('FROM "CustomerInvoice"') ? mocks.lockedInvoices() : [],
    );
    mocks.getSavedCustomerInvoiceView.mockResolvedValue(savedView);
    mocks.invoiceFindUnique.mockResolvedValue(existingInvoice);
    mocks.invoiceUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...existingInvoice,
      ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
    }));
    mocks.invoiceFindUniqueOrThrow.mockResolvedValue({ reference: existingInvoice.reference });
    mocks.invoiceDelete.mockResolvedValue({
      id: 7,
      customerId: 3,
      weekEnding: new Date("2026-11-01T00:00:00.000Z"),
      jobReference: null,
      reference: existingInvoice.reference,
      notes: null,
      waivedBreakDeductions: [],
      jobs: [{ id: 1 }, { id: 2 }],
    });
  });

  describe("GET", () => {
    it("returns the saved invoice", async () => {
      const response = await GET(new NextRequest(`${baseUrl}/7`), context({ id: "7" }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(savedView);
      expect(mocks.getSavedCustomerInvoiceView).toHaveBeenCalledWith({ id: 7 });
    });

    it("returns 404 for a missing invoice", async () => {
      mocks.getSavedCustomerInvoiceView.mockResolvedValue(null);

      const response = await GET(new NextRequest(`${baseUrl}/7`), context({ id: "7" }));

      expect(response.status).toBe(404);
      expect((await response.json()).error).toBe("Invoice not found");
    });

    it("rejects an invalid ID", async () => {
      const response = await GET(new NextRequest(`${baseUrl}/abc`), context({ id: "abc" }));

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Invalid invoice ID");
      expect(mocks.getSavedCustomerInvoiceView).not.toHaveBeenCalled();
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await GET(new NextRequest(`${baseUrl}/7`), context({ id: "7" }));

      expect(response.status).toBe(403);
      expect(mocks.getSavedCustomerInvoiceView).not.toHaveBeenCalled();
    });
  });

  describe("PATCH", () => {
    it("updates the invoice, logs the change and returns its view", async () => {
      const response = await PATCH(
        jsonRequest({
          path: "7",
          method: "PATCH",
          body: {
            reference: "  INV-77 ",
            notes: "",
            waivedBreakDeductions: ["2026-10-27:Sam", "2026-10-27:Sam", "2026-10-28:Sam"],
          },
        }),
        context({ id: "7" }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(savedView);
      expect(mocks.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7 },
          data: {
            reference: "INV-77",
            notes: null,
            waivedBreakDeductions: ["2026-10-27:Sam", "2026-10-28:Sam"],
          },
        }),
      );
      expect(mocks.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE",
          tableName: "CustomerInvoice",
          recordId: "7",
          oldData: existingInvoice,
          newData: expect.objectContaining({ reference: "INV-77", notes: null }),
        }),
      );
    });

    it("leaves fields that are not given unchanged", async () => {
      const response = await PATCH(
        jsonRequest({ path: "7", method: "PATCH", body: { notes: "Call before delivery" } }),
        context({ id: "7" }),
      );

      expect(response.status).toBe(200);
      expect(mocks.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reference: undefined, notes: "Call before delivery", waivedBreakDeductions: undefined },
        }),
      );
    });

    it("clears the notes when given null", async () => {
      const response = await PATCH(
        jsonRequest({ path: "7", method: "PATCH", body: { notes: null } }),
        context({ id: "7" }),
      );

      expect(response.status).toBe(200);
      expect(mocks.invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ notes: null }) }),
      );
    });

    it("returns 404 for a missing invoice", async () => {
      mocks.invoiceFindUnique.mockResolvedValue(null);

      const response = await PATCH(
        jsonRequest({ path: "7", method: "PATCH", body: { reference: "INV-77" } }),
        context({ id: "7" }),
      );

      expect(response.status).toBe(404);
      expect(mocks.invoiceUpdate).not.toHaveBeenCalled();
    });

    it.each([
      { name: "an empty body", body: {} },
      { name: "only unknown fields", body: { status: "sent" } },
      { name: "an empty reference", body: { reference: " " } },
      { name: "a reference over 100 characters", body: { reference: "R".repeat(101) } },
      { name: "notes over 1000 characters", body: { notes: "n".repeat(1001) } },
      {
        name: "more than 50 waived break deductions",
        body: { waivedBreakDeductions: Array.from({ length: 51 }, (_, index) => `key-${index}`) },
      },
      { name: "a break deduction key over 100 characters", body: { waivedBreakDeductions: ["k".repeat(101)] } },
      { name: "waived break deductions that are not a list", body: { waivedBreakDeductions: "key" } },
      { name: "malformed JSON", body: "{reference:" },
    ])("rejects $name", async ({ body }) => {
      const response = await PATCH(jsonRequest({ path: "7", method: "PATCH", body }), context({ id: "7" }));

      expect(response.status).toBe(400);
      expect(mocks.invoiceUpdate).not.toHaveBeenCalled();
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await PATCH(
        jsonRequest({ path: "7", method: "PATCH", body: { reference: "INV-77" } }),
        context({ id: "7" }),
      );

      expect(response.status).toBe(403);
      expect(mocks.invoiceUpdate).not.toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("deletes the invoice and logs it", async () => {
      const response = await DELETE(
        new NextRequest(`${baseUrl}/7`, { method: "DELETE" }),
        context({ id: "7" }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });

      expect(sqlOf({ call: mocks.queryRaw.mock.calls[0] })).toContain(
        'FROM "Jobs" WHERE "customerInvoiceId" =',
      );
      expect(sqlOf({ call: mocks.queryRaw.mock.calls[1] })).toContain('FROM "CustomerInvoice"');
      expect(mocks.invoiceDelete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7 } }));
      expect(mocks.logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DELETE",
          tableName: "CustomerInvoice",
          recordId: "7",
          oldData: expect.objectContaining({ weekEnding: "2026-11-01", jobIds: [1, 2] }),
        }),
      );
    });

    it("returns 404 for a missing invoice", async () => {
      mocks.lockedInvoices.mockReturnValue([]);

      const response = await DELETE(
        new NextRequest(`${baseUrl}/7`, { method: "DELETE" }),
        context({ id: "7" }),
      );

      expect(response.status).toBe(404);
      expect(mocks.invoiceDelete).not.toHaveBeenCalled();
      expect(mocks.logActivity).not.toHaveBeenCalled();
    });

    it("forbids users without the manage_invoices permission", async () => {
      mocks.checkPermission.mockResolvedValue(false);

      const response = await DELETE(
        new NextRequest(`${baseUrl}/7`, { method: "DELETE" }),
        context({ id: "7" }),
      );

      expect(response.status).toBe(403);
      expect(mocks.invoiceDelete).not.toHaveBeenCalled();
    });
  });
});

describe("/api/customer-invoices/[id]/remove-jobs", () => {
  function removeRequest({ body }: { body: unknown }) {
    return jsonRequest({ path: "7/remove-jobs", method: "POST", body });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkPermission.mockResolvedValue(true);
    mocks.lockedInvoices.mockReturnValue([{ id: 7, status: "draft" }]);
    mocks.queryRaw.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join("?").includes('FROM "CustomerInvoice"') ? mocks.lockedInvoices() : [],
    );
    mocks.getSavedCustomerInvoiceView.mockResolvedValue(savedView);
    mocks.jobsFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mocks.jobsCount.mockResolvedValue(1);
    mocks.invoiceFindUniqueOrThrow.mockResolvedValue({ reference: existingInvoice.reference });
    mocks.invoiceDelete.mockResolvedValue({ reference: existingInvoice.reference });
  });

  it("takes the jobs off the invoice and returns its view", async () => {
    const response = await removeJobs(removeRequest({ body: { jobIds: [2, 1, 1] } }), context({ id: "7" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: false, invoice: savedView });

    expect(sqlOf({ call: mocks.queryRaw.mock.calls[0] })).toContain('FROM "Jobs" WHERE id IN');
    expect(sqlOf({ call: mocks.queryRaw.mock.calls[1] })).toContain(
      'FROM "CustomerInvoice" WHERE id IN',
    );
    expect(sqlOf({ call: mocks.queryRaw.mock.calls[1] })).toContain("FOR UPDATE");
    expect(mocks.jobsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [2, 1] }, customerInvoiceId: 7 } }),
    );
    expect(mocks.jobsUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [2, 1] }, customerInvoiceId: 7 },
      data: { customerInvoiceId: null },
    });
    expect(mocks.invoiceDelete).not.toHaveBeenCalled();
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", tableName: "CustomerInvoice", recordId: "7" }),
    );
  });

  it("deletes the invoice when no jobs are left", async () => {
    mocks.jobsCount.mockResolvedValue(0);

    const response = await removeJobs(removeRequest({ body: { jobIds: [1, 2] } }), context({ id: "7" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, invoice: null });
    expect(mocks.invoiceDelete).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7 } }));
    expect(mocks.getSavedCustomerInvoiceView).not.toHaveBeenCalled();
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", tableName: "CustomerInvoice", recordId: "7" }),
    );
  });

  it("rejects jobs that are not on the invoice", async () => {
    mocks.jobsFindMany.mockResolvedValue([{ id: 1 }]);

    const response = await removeJobs(removeRequest({ body: { jobIds: [1, 5] } }), context({ id: "7" }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Job 5 is not on this invoice");
    expect(mocks.jobsUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing invoice", async () => {
    mocks.lockedInvoices.mockReturnValue([]);

    const response = await removeJobs(removeRequest({ body: { jobIds: [1] } }), context({ id: "7" }));

    expect(response.status).toBe(404);
    expect(mocks.jobsUpdateMany).not.toHaveBeenCalled();
  });

  it("does not change an invoice that is not a draft", async () => {
    mocks.lockedInvoices.mockReturnValue([{ id: 7, status: "sent" }]);

    const response = await removeJobs(removeRequest({ body: { jobIds: [1] } }), context({ id: "7" }));

    expect(response.status).toBe(400);
    expect(mocks.jobsUpdateMany).not.toHaveBeenCalled();
  });

  it.each([
    { name: "no jobs", body: { jobIds: [] } },
    { name: "more than 500 jobs", body: { jobIds: Array.from({ length: 501 }, (_, index) => index + 1) } },
    { name: "a negative job ID", body: { jobIds: [-1] } },
    { name: "malformed JSON", body: "{jobIds:" },
  ])("rejects $name", async ({ body }) => {
    const response = await removeJobs(removeRequest({ body }), context({ id: "7" }));

    expect(response.status).toBe(400);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("rejects an invalid invoice ID", async () => {
    const response = await removeJobs(removeRequest({ body: { jobIds: [1] } }), context({ id: "0" }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid invoice ID");
  });

  it("forbids users without the manage_invoices permission", async () => {
    mocks.checkPermission.mockResolvedValue(false);

    const response = await removeJobs(removeRequest({ body: { jobIds: [1] } }), context({ id: "7" }));

    expect(response.status).toBe(403);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });
});
