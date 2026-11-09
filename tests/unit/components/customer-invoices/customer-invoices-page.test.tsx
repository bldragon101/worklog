import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseISO } from "date-fns";
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
vi.mock("@/components/layout/page-controls", () => ({
  PageControls: ({
    selectedYear,
    selectedMonth,
    weekEnding,
    weekEndings,
    allowWholeMonth,
    onYearChange,
    onMonthChange,
    onWeekEndingChange,
  }: {
    selectedYear: number;
    selectedMonth: number;
    weekEnding: string;
    weekEndings: string[];
    allowWholeMonth: boolean;
    onYearChange: (year: number) => void;
    onMonthChange: (month: number) => void;
    onWeekEndingChange: (weekEnding: Date | string) => void;
  }) => (
    <div>
      <p data-testid="period-selected">{`${selectedYear}/${selectedMonth + 1} week ${weekEnding}`}</p>
      <p data-testid="period-weeks">{weekEndings.join(",")}</p>
      <p data-testid="period-whole-month">{String(allowWholeMonth)}</p>
      <button id="pick-week-btn" type="button" onClick={() => onWeekEndingChange(parseISO("2026-11-08"))}>
        Pick week ending 8 November
      </button>
      <button id="pick-month-btn" type="button" onClick={() => onMonthChange(9)}>
        Pick October
      </button>
      <button id="pick-year-btn" type="button" onClick={() => onYearChange(2025)}>
        Pick 2025
      </button>
    </div>
  ),
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
    itemCode: null,
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
  xeroConnected: false,
  xeroContact: null,
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
  xeroConnected: false,
  xeroContact: null,
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
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    // Monday 2 November 2026 in Melbourne, so the default week ends 1 November
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T01:00:00.000Z"));
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

    expect(screen.getByTestId("period-selected")).toHaveTextContent("2026/11 week 2026-11-01");
    expect(screen.getByTestId("period-weeks")).toHaveTextContent(
      "2026-11-01,2026-11-08,2026-11-15,2026-11-22,2026-11-29",
    );
    expect(screen.getByTestId("period-whole-month")).toHaveTextContent("false");
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

  it("hides the Xero item column and contact when Xero is not connected", async () => {
    renderPage();
    await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    const linesTable = screen.getByRole("table", { name: "Invoice lines" });
    expect(within(linesTable).queryByRole("columnheader", { name: "Item" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("invoice-xero-contact")).not.toBeInTheDocument();
  });

  it("shows Xero item codes, the Xero contact and links mapping warnings when connected", async () => {
    weekInvoices = [
      {
        ...savedInvoice,
        xeroConnected: true,
        xeroContact: { contactId: "contact-1", contactName: "Xperia Group (Xero)" },
        lines: [
          { ...savedInvoice.lines[0], itemCode: "14TT - 01" },
          savedInvoice.lines[1],
          { ...savedInvoice.lines[2], itemCode: "Break" },
        ],
        warnings: [
          ...savedInvoice.warnings,
          { code: "unmapped_item", jobId: 102, message: "No Xero item is mapped for truck REG102" },
          { code: "unmapped_item", jobId: null, message: "No Xero item is set for breaks" },
        ],
      },
    ];
    renderPage();
    await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    const linesTable = screen.getByRole("table", { name: "Invoice lines" });
    expect(within(linesTable).getByRole("columnheader", { name: "Item" })).toBeInTheDocument();
    expect(within(linesTable).getByTestId("invoice-line-0-item")).toHaveTextContent("14TT - 01");
    expect(within(linesTable).getByTestId("invoice-line-1-item")).toHaveTextContent("Not mapped");
    expect(within(linesTable).getByTestId("invoice-line-2-item")).toHaveTextContent("Break");
    expect(screen.getByTestId("invoice-xero-contact")).toHaveTextContent("Xero contact Xperia Group (Xero)");

    expect(
      screen.getByRole("link", { name: "Fix in Xero mapping: No Xero item is mapped for truck REG102" }),
    ).toHaveAttribute("href", "/settings/admin/xero");
    expect(
      screen.getByRole("link", { name: "Fix in Xero mapping: No Xero item is set for breaks" }),
    ).toHaveAttribute("href", "/settings/admin/xero?tab=settings");
    expect(screen.getByRole("link", { name: "No Xero item is mapped for truck REG102" })).toHaveAttribute(
      "href",
      "#invoice-job-102",
    );
  });

  it("flags an invoice whose bill to is not linked to a Xero contact", async () => {
    weekInvoices = [
      {
        ...savedInvoice,
        xeroConnected: true,
        xeroContact: null,
        warnings: [
          {
            code: "unmapped_contact",
            jobId: null,
            message: 'Bill to "Xperia Group Pty Ltd" is not linked to a Xero contact',
          },
        ],
      },
    ];
    renderPage();
    await openInvoice({ name: "Xperia Group BowensDC-01/11/26" });

    expect(screen.getByTestId("invoice-xero-contact")).toHaveTextContent("Not linked to a Xero contact");
    expect(
      screen.getByRole("link", { name: /^Fix in Xero mapping: Bill to/ }),
    ).toHaveAttribute("href", "/settings/admin/xero?tab=customers");
  });

  it("shows an empty state when the week has no invoices", async () => {
    weekInvoices = [];
    renderPage();

    expect(await screen.findByText("No invoices for this week")).toBeInTheDocument();
  });

  it("loads the week picked in the week ending select", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "Xperia Group BowensDC-01/11/26" });

    await user.click(screen.getByRole("button", { name: "Pick week ending 8 November" }));

    expect(screen.getByTestId("period-selected")).toHaveTextContent("2026/11 week 2026-11-08");
    expect(mocks.fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/api/customer-invoices?weekEnding=2026-11-08" }),
    );
  });

  it("opens the latest week of a picked month or year", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "Xperia Group BowensDC-01/11/26" });

    await user.click(screen.getByRole("button", { name: "Pick October" }));
    expect(screen.getByTestId("period-selected")).toHaveTextContent("2026/10 week 2026-10-25");
    expect(mocks.fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/api/customer-invoices?weekEnding=2026-10-25" }),
    );

    await user.click(screen.getByRole("button", { name: "Pick 2025" }));
    expect(screen.getByTestId("period-selected")).toHaveTextContent("2025/10 week 2025-10-26");
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
