import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerInvoicesPage } from "@/components/customer-invoices/customer-invoices-page";
import type {
  CustomerInvoiceLine,
  CustomerInvoicesWeekResponse,
  CustomerInvoiceView,
} from "@/lib/customer-invoices/types";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ fetchJson: mocks.fetchJson }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/layout/protected-layout", () => ({
  ProtectedLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/auth/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const WEEK_ENDING = "2026-11-01";

function line(overrides: Partial<CustomerInvoiceLine>): CustomerInvoiceLine {
  return {
    kind: "job",
    jobId: null,
    jobDate: null,
    truckType: null,
    truckClass: null,
    registration: null,
    driver: null,
    description: "",
    quantity: 1,
    unitAmount: 0,
    amountExGst: 0,
    gstAmount: 0,
    amountIncGst: 0,
    breakKey: null,
    tollRoad: null,
    fuelLevyPercent: null,
    ...overrides,
  };
}

function job({ id, jobReference }: { id: number; jobReference: string | null }) {
  return {
    id,
    date: "2026-10-28",
    driver: `Driver ${id}`,
    registration: `REG${id}`,
    truckType: "Tray",
    jobReference,
    pickup: "Dandenong",
    dropoff: "Cheltenham",
    chargedHours: 8,
    hasRunsheet: true,
  };
}

const savedInvoice: CustomerInvoiceView = {
  key: "saved:7",
  id: 7,
  isSaved: true,
  customerId: 3,
  customerName: "Xperia Group",
  billTo: "Xperia Group Pty Ltd",
  weekEnding: WEEK_ENDING,
  jobReference: "Bowens DC",
  reference: "BowensDC-01/11/26",
  notes: null,
  waivedBreakDeductions: [],
  jobs: [job({ id: 101, jobReference: "Bowens DC" }), job({ id: 102, jobReference: "Bowens DC" })],
  lines: [
    line({ kind: "job", jobId: 101, description: "28/10 Tray REG101", quantity: 8, unitAmount: 120, amountExGst: 960 }),
    line({ kind: "job", jobId: 102, description: "28/10 Tray REG102", quantity: 8, unitAmount: 120, amountExGst: 960 }),
    line({
      kind: "break",
      breakKey: "Tray|120",
      description: "Breaks - Tray (2 × 0.5h)",
      quantity: -1,
      unitAmount: 120,
      amountExGst: -120,
    }),
  ],
  totals: { subtotal: 1800, gst: 180, total: 1980 },
  warnings: [{ code: "missing_runsheet", jobId: 102, message: "Job 102 has no runsheet" }],
};

const draftInvoice: CustomerInvoiceView = {
  key: `auto:acme:${WEEK_ENDING}:`,
  id: null,
  isSaved: false,
  customerId: 4,
  customerName: "Acme Freight",
  billTo: "Acme Pty Ltd",
  weekEnding: WEEK_ENDING,
  jobReference: null,
  reference: "AcmeFreight-01/11/26",
  notes: null,
  waivedBreakDeductions: [],
  jobs: [job({ id: 201, jobReference: null }), job({ id: 202, jobReference: null })],
  lines: [
    line({ kind: "job", jobId: 201, description: "28/10 Tray REG201", quantity: 5, unitAmount: 100, amountExGst: 500 }),
    line({
      kind: "break",
      breakKey: "Tray|100",
      description: "Breaks - Tray (1 × 0.5h)",
      quantity: -0.5,
      unitAmount: 100,
      amountExGst: -50,
    }),
  ],
  totals: { subtotal: 450, gst: 45, total: 495 },
  warnings: [],
};

let weekInvoices: CustomerInvoiceView[] = [];

function weekResponse(): CustomerInvoicesWeekResponse {
  return { weekEnding: WEEK_ENDING, invoices: weekInvoices };
}

function getCalls({ method }: { method: string }) {
  return mocks.fetchJson.mock.calls
    .map(([options]) => options as { url: string; init?: RequestInit })
    .filter((options) => (options.init?.method ?? "GET") === method);
}

function getBody({ method }: { method: string }): unknown {
  const calls = getCalls({ method });
  const body = calls[calls.length - 1]?.init?.body;
  return typeof body === "string" ? JSON.parse(body) : undefined;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CustomerInvoicesPage initialWeekEnding={WEEK_ENDING} />
    </QueryClientProvider>,
  );
}

async function openInvoice({ name }: { name: string }) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name }));
  return user;
}

describe("CustomerInvoicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    weekInvoices = [savedInvoice, draftInvoice];
    mocks.fetchJson.mockImplementation(async ({ url, init }: { url: string; init?: RequestInit }) => {
      if (!init) return weekResponse();
      if (init.method === "POST" && url === "/api/customer-invoices") {
        return { ...savedInvoice, key: "saved:9", id: 9, reference: "BowensDC-Adhoc" };
      }
      return savedInvoice;
    });
  });

  it("lists the week's invoices with their totals, status and warnings", async () => {
    renderPage();

    const savedRow = await screen.findByRole("button", { name: "Xperia Group BowensDC-01/11/26" });
    expect(within(savedRow).getByText("Saved")).toBeInTheDocument();
    expect(within(savedRow).getByText("1 warning")).toBeInTheDocument();
    expect(savedRow).toHaveTextContent("Bill to Xperia Group Pty Ltd");
    expect(savedRow).toHaveTextContent("Ref BowensDC-01/11/26");
    expect(savedRow).toHaveTextContent("2 jobs");
    expect(savedRow).toHaveTextContent("$1800.00");
    expect(savedRow).toHaveTextContent("$180.00");
    expect(savedRow).toHaveTextContent("$1980.00");

    const draftRow = screen.getByRole("button", { name: "Acme Freight AcmeFreight-01/11/26" });
    expect(within(draftRow).getByText("Draft")).toBeInTheDocument();
    expect(draftRow).toHaveTextContent("$495.00");

    expect(screen.getByText("Week ending 01/11/2026")).toBeInTheDocument();
    expect(mocks.fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/api/customer-invoices?weekEnding=2026-11-01" }),
    );
  });

  it("shows the lines with totals and links job warnings to the job", async () => {
    renderPage();
    await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    const linesTable = screen.getByRole("table", { name: "Invoice lines" });
    expect(within(linesTable).getByText("Breaks - Tray (2 × 0.5h)")).toBeInTheDocument();
    expect(within(linesTable).getByTestId("invoice-subtotal")).toHaveTextContent("$1800.00");
    expect(within(linesTable).getByTestId("invoice-gst")).toHaveTextContent("$180.00");
    expect(within(linesTable).getByTestId("invoice-total")).toHaveTextContent("$1980.00");
    expect(screen.getByRole("link", { name: "Job 102 has no runsheet" })).toHaveAttribute(
      "href",
      "#invoice-job-102",
    );
  });

  it("shows an empty state when the week has no invoices", async () => {
    weekInvoices = [];
    renderPage();

    expect(await screen.findByText("No invoices for this week")).toBeInTheDocument();
  });

  it("loads the next week", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "Xperia Group BowensDC-01/11/26" });

    await user.click(screen.getByRole("button", { name: "Next week" }));

    expect(await screen.findByText("Week ending 08/11/2026")).toBeInTheDocument();
    expect(mocks.fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/api/customer-invoices?weekEnding=2026-11-08" }),
    );
  });

  it("splits the selected jobs into a new invoice with an editable reference", async () => {
    renderPage();
    const user = await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    await user.click(screen.getByRole("checkbox", { name: "Select job 101" }));
    const referenceInput = screen.getByLabelText("New invoice reference");
    expect(referenceInput).toHaveValue("BowensDC-01/11/26-Adhoc");

    await user.clear(referenceInput);
    await user.type(referenceInput, "BowensDC-Adhoc");
    await user.click(screen.getByRole("button", { name: "Split selected jobs into new invoice" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invoice created" })),
    );
    expect(getCalls({ method: "POST" })[0].url).toBe("/api/customer-invoices");
    expect(getBody({ method: "POST" })).toEqual({ jobIds: [101], reference: "BowensDC-Adhoc" });
    // The week is refetched after the split
    expect(getCalls({ method: "GET" }).length).toBeGreaterThanOrEqual(2);
  });

  it("does not split every job off an invoice", async () => {
    renderPage();
    const user = await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    await user.click(screen.getByRole("checkbox", { name: "Select all jobs" }));

    expect(screen.getByRole("button", { name: "Split selected jobs into new invoice" })).toBeDisabled();
  });

  it("removes selected jobs from a saved invoice", async () => {
    mocks.fetchJson.mockImplementation(async ({ url, init }: { url: string; init?: RequestInit }) => {
      if (!init) return weekResponse();
      if (url === "/api/customer-invoices/7/remove-jobs") return { deleted: false, invoice: savedInvoice };
      return savedInvoice;
    });
    renderPage();
    const user = await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    await user.click(screen.getByRole("checkbox", { name: "Select job 102" }));
    await user.click(screen.getByRole("button", { name: "Remove selected jobs" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Jobs removed" })),
    );
    expect(getCalls({ method: "POST" })[0].url).toBe("/api/customer-invoices/7/remove-jobs");
    expect(getBody({ method: "POST" })).toEqual({ jobIds: [102] });
  });

  it("waives a break deduction line on a saved invoice", async () => {
    renderPage();
    const user = await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    await user.click(
      screen.getByRole("button", { name: "Remove break deduction Breaks - Tray (2 × 0.5h)" }),
    );

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Break deduction removed" }),
      ),
    );
    expect(getCalls({ method: "PATCH" })[0].url).toBe("/api/customer-invoices/7");
    expect(getBody({ method: "PATCH" })).toEqual({ waivedBreakDeductions: ["Tray|120"] });
  });

  it("restores a waived break deduction", async () => {
    weekInvoices = [{ ...savedInvoice, waivedBreakDeductions: ["Tray|120", "Crane|150"] }];
    renderPage();
    const user = await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    expect(screen.getByText("Breaks - Tray at $120.00/h")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore break deduction Tray at $120.00/h" }));

    await waitFor(() => expect(getCalls({ method: "PATCH" })).toHaveLength(1));
    expect(getBody({ method: "PATCH" })).toEqual({ waivedBreakDeductions: ["Crane|150"] });
  });

  it("saves the reference and notes of a saved invoice", async () => {
    renderPage();
    const user = await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    const referenceInput = screen.getByLabelText("Reference");
    await user.clear(referenceInput);
    await user.type(referenceInput, "BowensDC-Perm");
    await user.type(screen.getByLabelText("Notes"), "Perm runs only");
    await user.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(getCalls({ method: "PATCH" })).toHaveLength(1));
    expect(getBody({ method: "PATCH" })).toEqual({ reference: "BowensDC-Perm", notes: "Perm runs only" });
  });

  it("saves an automatic draft before its breaks or reference can be edited", async () => {
    const savedDraft: CustomerInvoiceView = {
      ...draftInvoice,
      key: "saved:9",
      id: 9,
      isSaved: true,
    };
    mocks.fetchJson.mockImplementation(async ({ init }: { url: string; init?: RequestInit }) => {
      if (!init) return weekResponse();
      weekInvoices = [savedInvoice, savedDraft];
      return savedDraft;
    });
    renderPage();
    const user = await openInvoice({ name: "Acme Freight AcmeFreight-01/11/26" });

    expect(screen.queryByRole("button", { name: /Remove break deduction/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reference")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save invoice" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invoice saved" })),
    );
    expect(getCalls({ method: "POST" })[0].url).toBe("/api/customer-invoices");
    expect(getBody({ method: "POST" })).toEqual({ jobIds: [201, 202] });

    // The saved invoice stays open and can now be edited
    expect(await screen.findByRole("button", { name: "Delete invoice" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reference")).toHaveValue("AcmeFreight-01/11/26");
    expect(
      screen.getByRole("button", { name: "Remove break deduction Breaks - Tray (1 × 0.5h)" }),
    ).toBeInTheDocument();
  });

  it("deletes a saved invoice after confirming", async () => {
    mocks.fetchJson.mockImplementation(async ({ init }: { url: string; init?: RequestInit }) => {
      if (!init) return weekResponse();
      return { success: true };
    });
    renderPage();
    const user = await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    await user.click(screen.getByRole("button", { name: "Delete invoice" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("jobs return to the automatic draft");

    await user.click(within(dialog).getByRole("button", { name: "Delete invoice" }));

    await waitFor(() => expect(getCalls({ method: "DELETE" })).toHaveLength(1));
    expect(getCalls({ method: "DELETE" })[0].url).toBe("/api/customer-invoices/7");
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invoice deleted" })),
    );
  });

  it("shows an error toast when a split fails", async () => {
    mocks.fetchJson.mockImplementation(async ({ init }: { url: string; init?: RequestInit }) => {
      if (!init) return weekResponse();
      throw new Error("All jobs must belong to the same customer");
    });
    renderPage();
    const user = await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    await user.click(screen.getByRole("checkbox", { name: "Select job 101" }));
    await user.click(screen.getByRole("button", { name: "Split selected jobs into new invoice" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Could not split invoice",
        description: "All jobs must belong to the same customer",
        variant: "destructive",
      }),
    );
  });
});
