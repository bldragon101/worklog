import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { XeroMappingPage } from "@/components/xero/xero-mapping-page";
import type { XeroMappingTab } from "@/components/xero/xero-options";
import type {
  XeroConnectionStatus,
  XeroMappingsResponse,
  XeroSettingsView,
} from "@/lib/xero/types";

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

const connection: XeroConnectionStatus = {
  configured: true,
  missingEnvVars: [],
  connected: true,
  tenantName: "Demo Transport Pty Ltd",
  connectedAt: "2026-11-01T23:00:00.000Z",
  scopes: [],
  itemsSyncedAt: "2026-11-01T23:05:00.000Z",
  contactsSyncedAt: "2026-11-01T23:05:00.000Z",
};

const settings: XeroSettingsView = {
  salesAccountCode: "200",
  taxType: "OUTPUT",
  breakItemCode: "Break",
  eastlinkItemCode: "EL",
  citylinkItemCode: "CL",
  fuelLevyItemCode: "Fuel Levy",
};

const noClassCodes = { tray: null, crane: null, semi: null, semiCrane: null };

function buildMappings(): XeroMappingsResponse {
  return {
    connection,
    items: [
      { code: "14TT - 01", name: "BNT040 Isuzu tray", truckClass: "tray", isSubcontractor: false, salesUnitPrice: 120 },
      { code: "14TT - 02", name: "XYZ123 Hino tray", truckClass: "tray", isSubcontractor: false, salesUnitPrice: 120 },
      { code: "14TT - 05SUB", name: "Bluehawk tray", truckClass: "tray", isSubcontractor: true, salesUnitPrice: 110 },
      { code: "12TC - 03SUB", name: "Bluehawk crane", truckClass: "crane", isSubcontractor: true, salesUnitPrice: 150 },
      { code: "Break", name: "Break deduction", truckClass: null, isSubcontractor: false, salesUnitPrice: null },
      { code: "EL", name: "Eastlink", truckClass: null, isSubcontractor: false, salesUnitPrice: null },
      { code: "CL", name: "CityLink", truckClass: null, isSubcontractor: false, salesUnitPrice: null },
      { code: "Fuel Levy", name: "Fuel levy", truckClass: null, isSubcontractor: false, salesUnitPrice: null },
    ],
    contacts: [
      { contactId: "c-acme", name: "Acme Freight Pty Ltd", isCustomer: true },
      { contactId: "c-xperia", name: "Xperia Group", isCustomer: true },
      { contactId: "c-supplier", name: "Fuel Supplier", isCustomer: false },
    ],
    vehicles: [
      {
        key: "BNT040",
        registration: "BNT040",
        description: "Isuzu tray",
        itemCode: null,
        suggestedItemCode: "14TT - 01",
        isItemMissing: false,
      },
      {
        key: "XYZ123",
        registration: "XYZ123",
        description: "Hino tray",
        itemCode: null,
        suggestedItemCode: "14TT - 02",
        isItemMissing: false,
      },
      {
        key: "MAP001",
        registration: "MAP001",
        description: "Mapped crane",
        itemCode: "14TT - 01",
        suggestedItemCode: null,
        isItemMissing: false,
      },
      {
        key: "OLD999",
        registration: "OLD999",
        description: "Old truck",
        itemCode: "GONE - 01",
        suggestedItemCode: null,
        isItemMissing: true,
      },
    ],
    companies: [
      {
        key: "bluehawk",
        name: "Bluehawk",
        drivers: [
          { id: 1, name: "Sam Smith", type: "Subcontractor", hasBusinessName: false },
          { id: 2, name: "Jo Brown", type: "Subcontractor", hasBusinessName: true },
        ],
        itemCodes: { ...noClassCodes },
        suggestedItemCodes: { ...noClassCodes, tray: "14TT - 05SUB", crane: "12TC - 03SUB" },
        missingItemClasses: [],
      },
      {
        key: "mapped contractor",
        name: "Mapped Contractor",
        drivers: [{ id: 3, name: "Lee Chan", type: "Contractor", hasBusinessName: true }],
        itemCodes: { ...noClassCodes, tray: "14TT - 02" },
        suggestedItemCodes: { ...noClassCodes },
        missingItemClasses: [],
      },
    ],
    contactMappings: [
      {
        key: "acme pty ltd",
        billTo: "Acme Pty Ltd",
        customers: ["Acme Freight", "Acme Interstate"],
        contactId: null,
        contactName: null,
        suggestedContactId: "c-acme",
      },
      {
        key: "xperia group pty ltd",
        billTo: "Xperia Group Pty Ltd",
        customers: ["Xperia Group"],
        contactId: "c-xperia",
        contactName: "Xperia Group",
        suggestedContactId: null,
      },
    ],
    settings,
  };
}

let mappings: XeroMappingsResponse = buildMappings();

function callsTo({ url, method }: { url: string; method: string }) {
  return mocks.fetchJson.mock.calls
    .map(([options]) => options as { url: string; init?: RequestInit })
    .filter((options) => options.url === url && (options.init?.method ?? "GET") === method);
}

function lastBody({ url, method }: { url: string; method: string }): unknown {
  const calls = callsTo({ url, method });
  const body = calls[calls.length - 1]?.init?.body;
  return typeof body === "string" ? JSON.parse(body) : undefined;
}

function renderPage({ initialTab = "trucks" }: { initialTab?: XeroMappingTab } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <XeroMappingPage initialTab={initialTab} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe("XeroMappingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mappings = buildMappings();
    mocks.fetchJson.mockImplementation(async ({ url, init }: { url: string; init?: RequestInit }) => {
      if (url === "/api/xero/mappings") return mappings;
      if (url === "/api/xero/settings") {
        return init?.method === "PATCH" ? JSON.parse(String(init.body)) : settings;
      }
      if (url.startsWith("/api/xero/mappings/")) return mappings;
      if (url === "/api/xero/sync") {
        return { items: 8, contacts: 3, itemsSyncedAt: "x", contactsSyncedAt: "x" };
      }
      return undefined;
    });
  });

  describe("company trucks", () => {
    it("lists the trucks with their unmapped count, suggestions and missing items", async () => {
      renderPage();

      expect(await screen.findByText("Connected to Demo Transport Pty Ltd")).toBeInTheDocument();
      expect(screen.getByTestId("xero-trucks-unmapped-count")).toHaveTextContent("3 of 4 trucks unmapped");
      const list = screen.getByRole("list", { name: "Company truck mappings" });
      expect(within(list).getByText("BNT040")).toBeInTheDocument();
      expect(within(list).getByText("GONE - 01 is not in Xero")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Xero item for MAP001" })).toHaveTextContent(
        "14TT - 01 - BNT040 Isuzu tray",
      );
      expect(screen.getByRole("button", { name: "Accept all suggestions (2)" })).toBeEnabled();
    });

    it("accepts one suggestion with a one-element PUT", async () => {
      const user = renderPage();

      await user.click(await screen.findByRole("button", { name: "Accept suggestion 14TT - 01 for BNT040" }));

      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toHaveLength(1));
      expect(lastBody({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toEqual({
        mappings: [{ registration: "BNT040", itemCode: "14TT - 01" }],
      });
    });

    it("accepts every visible suggestion in one PUT", async () => {
      const user = renderPage();

      await user.click(await screen.findByRole("button", { name: "Accept all suggestions (2)" }));

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Mappings saved" })),
      );
      expect(callsTo({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toHaveLength(1);
      expect(lastBody({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toEqual({
        mappings: [
          { registration: "BNT040", itemCode: "14TT - 01" },
          { registration: "XYZ123", itemCode: "14TT - 02" },
        ],
      });
    });

    it("only accepts the suggestions of rows matching the search", async () => {
      const user = renderPage();

      await user.type(await screen.findByRole("searchbox", { name: "Search trucks" }), "xyz");
      expect(screen.queryByText("BNT040")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Accept all suggestions (1)" }));

      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toHaveLength(1));
      expect(lastBody({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toEqual({
        mappings: [{ registration: "XYZ123", itemCode: "14TT - 02" }],
      });
    });

    it("picks an item from the searchable list", async () => {
      const user = renderPage();

      await user.click(await screen.findByRole("combobox", { name: "Xero item for XYZ123" }));
      await user.type(screen.getByRole("combobox", { name: "Search items by code or name" }), "hino");
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(1);
      await user.click(options[0]);

      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toHaveLength(1));
      expect(lastBody({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toEqual({
        mappings: [{ registration: "XYZ123", itemCode: "14TT - 02" }],
      });
    });

    it("lists company truck items before other items", async () => {
      const user = renderPage();

      await user.click(await screen.findByRole("combobox", { name: "Xero item for XYZ123" }));

      const groups = screen.getAllByRole("group");
      expect(groups[0]).toHaveAccessibleName("Company truck items");
      expect(within(groups[0]).getAllByRole("option")).toHaveLength(2);
      expect(groups[1]).toHaveAccessibleName("Other items");
      expect(within(groups[1]).getByRole("option", { name: /14TT - 05SUB/ })).toBeInTheDocument();
    });

    it("clears a mapping", async () => {
      const user = renderPage();

      await user.click(await screen.findByRole("button", { name: "Clear mapping for MAP001" }));

      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toHaveLength(1));
      expect(lastBody({ url: "/api/xero/mappings/vehicles", method: "PUT" })).toEqual({
        mappings: [{ registration: "MAP001", itemCode: null }],
      });
      expect(screen.getByRole("button", { name: "Clear mapping for BNT040" })).toBeDisabled();
    });

    it("shows only unmapped trucks when filtered", async () => {
      const user = renderPage();

      await user.click(await screen.findByRole("switch", { name: "Show unmapped only" }));

      const list = screen.getByRole("list", { name: "Company truck mappings" });
      expect(within(list).queryByText("MAP001")).not.toBeInTheDocument();
      expect(within(list).getByText("BNT040")).toBeInTheDocument();
      expect(within(list).getByText("OLD999")).toBeInTheDocument();
    });

    it("toasts a failed save", async () => {
      mocks.fetchJson.mockImplementation(async ({ url }: { url: string }) => {
        if (url === "/api/xero/mappings") return mappings;
        throw new Error("Too many requests");
      });
      const user = renderPage();

      await user.click(await screen.findByRole("button", { name: "Accept suggestion 14TT - 01 for BNT040" }));

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({
          title: "Could not save the truck mapping",
          description: "Too many requests",
          variant: "destructive",
        }),
      );
    });
  });

  describe("contractors and subcontractors", () => {
    it("lists companies with their drivers and flags drivers without a business name", async () => {
      renderPage({ initialTab: "companies" });

      const row = await screen.findByTestId("xero-company-row-bluehawk");
      expect(row).toHaveTextContent("Sam Smith (Subcontractor)");
      expect(within(row).getAllByText("No business name")).toHaveLength(1);
      expect(screen.getByText(/grouped by their truck field/)).toBeInTheDocument();
      expect(screen.getByTestId("xero-companies-unmapped-count")).toHaveTextContent("1 of 2 companies unmapped");
    });

    it("accepts a suggestion for one truck class", async () => {
      const user = renderPage({ initialTab: "companies" });

      await user.click(
        await screen.findByRole("button", { name: "Accept suggestion 12TC - 03SUB for Bluehawk Crane" }),
      );

      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/companies", method: "PUT" })).toHaveLength(1));
      expect(lastBody({ url: "/api/xero/mappings/companies", method: "PUT" })).toEqual({
        mappings: [{ companyName: "Bluehawk", truckClass: "crane", itemCode: "12TC - 03SUB" }],
      });
    });

    it("accepts every company suggestion in one PUT", async () => {
      const user = renderPage({ initialTab: "companies" });

      await user.click(await screen.findByRole("button", { name: "Accept all suggestions (2)" }));

      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/companies", method: "PUT" })).toHaveLength(1));
      expect(lastBody({ url: "/api/xero/mappings/companies", method: "PUT" })).toEqual({
        mappings: [
          { companyName: "Bluehawk", truckClass: "tray", itemCode: "14TT - 05SUB" },
          { companyName: "Bluehawk", truckClass: "crane", itemCode: "12TC - 03SUB" },
        ],
      });
    });

    it("offers the truck class's items, subcontractor items first, with an option to show all", async () => {
      const user = renderPage({ initialTab: "companies" });

      await user.click(await screen.findByRole("combobox", { name: "Xero Tray item for Mapped Contractor" }));

      const groups = screen.getAllByRole("group");
      expect(groups[0]).toHaveAccessibleName("Subcontractor items");
      expect(within(groups[0]).getByRole("option", { name: /14TT - 05SUB/ })).toBeInTheDocument();
      expect(groups[1]).toHaveAccessibleName("Company items");
      expect(screen.getAllByRole("option")).toHaveLength(3);
      expect(screen.queryByRole("option", { name: /12TC - 03SUB/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Show all items" }));
      await user.click(screen.getByRole("option", { name: /12TC - 03SUB/ }));

      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/companies", method: "PUT" })).toHaveLength(1));
      expect(lastBody({ url: "/api/xero/mappings/companies", method: "PUT" })).toEqual({
        mappings: [{ companyName: "Mapped Contractor", truckClass: "tray", itemCode: "12TC - 03SUB" }],
      });
    });
  });

  describe("customers", () => {
    it("lists bill to names and accepts a suggested contact", async () => {
      const user = renderPage({ initialTab: "customers" });

      const row = await screen.findByTestId("xero-customer-row-acme-pty-ltd");
      expect(row).toHaveTextContent("Customers: Acme Freight, Acme Interstate");
      expect(screen.getByRole("combobox", { name: "Xero contact for Xperia Group Pty Ltd" })).toHaveTextContent(
        "Xperia Group",
      );
      expect(screen.getByTestId("xero-customers-unmapped-count")).toHaveTextContent("1 of 2 bill to names unmapped");

      await user.click(
        within(row).getByRole("button", { name: "Accept suggestion Acme Freight Pty Ltd for Acme Pty Ltd" }),
      );

      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/contacts", method: "PUT" })).toHaveLength(1));
      expect(lastBody({ url: "/api/xero/mappings/contacts", method: "PUT" })).toEqual({
        mappings: [{ billTo: "Acme Pty Ltd", contactId: "c-acme" }],
      });
    });

    it("searches contacts, customers first, and clears a contact", async () => {
      const user = renderPage({ initialTab: "customers" });

      await user.click(await screen.findByRole("combobox", { name: "Xero contact for Acme Pty Ltd" }));
      const groups = screen.getAllByRole("group");
      expect(groups[0]).toHaveAccessibleName("Customers");
      expect(groups[1]).toHaveAccessibleName("Other contacts");
      await user.type(screen.getByRole("combobox", { name: "Search contacts" }), "fuel");
      await user.click(screen.getByRole("option", { name: "Fuel Supplier" }));

      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/contacts", method: "PUT" })).toHaveLength(1));
      expect(lastBody({ url: "/api/xero/mappings/contacts", method: "PUT" })).toEqual({
        mappings: [{ billTo: "Acme Pty Ltd", contactId: "c-supplier" }],
      });

      await user.click(screen.getByRole("button", { name: "Clear mapping for Xperia Group Pty Ltd" }));
      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings/contacts", method: "PUT" })).toHaveLength(2));
      expect(lastBody({ url: "/api/xero/mappings/contacts", method: "PUT" })).toEqual({
        mappings: [{ billTo: "Xperia Group Pty Ltd", contactId: null }],
      });
    });
  });

  describe("invoice settings", () => {
    it("saves the full settings with a PATCH", async () => {
      const user = renderPage({ initialTab: "settings" });

      const accountInput = await screen.findByLabelText("Sales account code");
      expect(accountInput).toHaveValue("200");
      expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();

      await user.clear(accountInput);
      await user.type(accountInput, "210");
      await user.click(screen.getByRole("combobox", { name: "Break item" }));
      await user.click(screen.getByRole("option", { name: "None" }));
      await user.click(screen.getByRole("combobox", { name: "Fallback fuel levy item" }));
      await user.click(screen.getByRole("option", { name: /^EL/ }));
      expect(screen.getByText(/Fuel Levy N%/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save settings" }));

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invoice settings saved" })),
      );
      expect(lastBody({ url: "/api/xero/settings", method: "PATCH" })).toEqual({
        ...settings,
        salesAccountCode: "210",
        breakItemCode: null,
        fuelLevyItemCode: "EL",
      });
    });

    it("requires a sales account code and tax type", async () => {
      const user = renderPage({ initialTab: "settings" });

      await user.clear(await screen.findByLabelText("Tax type"));

      expect(screen.getByText("Enter a sales account code and a tax type.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();
    });
  });

  describe("connection", () => {
    it("prompts to connect on the Integrations page when Xero is not connected", async () => {
      mappings = { ...buildMappings(), connection: { ...connection, connected: false, tenantName: null } };
      renderPage();

      expect(await screen.findByText("Xero is not connected")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Integrations page" })).toHaveAttribute(
        "href",
        "/settings/admin/integrations",
      );
      expect(screen.queryByRole("button", { name: "Sync from Xero" })).not.toBeInTheDocument();
    });

    it("prompts a first sync and syncs from Xero", async () => {
      mappings = { ...buildMappings(), connection: { ...connection, itemsSyncedAt: null, contactsSyncedAt: null } };
      const user = renderPage();

      expect(await screen.findByText(/Items have never been synced/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Sync from Xero" }));

      await waitFor(() =>
        expect(mocks.toast).toHaveBeenCalledWith({ title: "Xero synced", description: "Synced 8 items and 3 contacts" }),
      );
      expect(callsTo({ url: "/api/xero/sync", method: "POST" })).toHaveLength(1);
      // The mappings are refetched after the sync
      await waitFor(() => expect(callsTo({ url: "/api/xero/mappings", method: "GET" }).length).toBeGreaterThanOrEqual(2));
    });
  });
});
