import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { XeroConnectionCard } from "@/components/xero/xero-connection-card";
import type { XeroConnectionStatus, XeroSyncResult } from "@/lib/xero/types";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({ fetchJson: mocks.fetchJson }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

const disconnectedStatus: XeroConnectionStatus = {
  configured: true,
  missingEnvVars: [],
  connected: false,
  tenantName: null,
  connectedAt: null,
  scopes: [],
  itemsSyncedAt: null,
  contactsSyncedAt: null,
};

const connectedStatus: XeroConnectionStatus = {
  ...disconnectedStatus,
  connected: true,
  tenantName: "Demo Transport Pty Ltd",
  connectedAt: "2026-11-01T23:00:00.000Z",
  scopes: ["accounting.settings"],
  itemsSyncedAt: "2026-11-01T23:05:00.000Z",
  contactsSyncedAt: "2026-11-01T23:05:00.000Z",
};

const syncResult: XeroSyncResult = {
  items: 42,
  contacts: 1,
  itemsSyncedAt: "2026-11-02T01:00:00.000Z",
  contactsSyncedAt: "2026-11-02T01:00:00.000Z",
};

let status: XeroConnectionStatus = disconnectedStatus;

function callsTo({ url }: { url: string }) {
  return mocks.fetchJson.mock.calls
    .map(([options]) => options as { url: string; init?: RequestInit })
    .filter((options) => options.url === url);
}

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <XeroConnectionCard />
    </QueryClientProvider>,
  );
}

function postCallback({ origin, data }: { origin: string; data: unknown }) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { origin, data }));
  });
}

describe("XeroConnectionCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    status = disconnectedStatus;
    mocks.fetchJson.mockImplementation(async ({ url }: { url: string }) => {
      if (url === "/api/xero/auth/status") return status;
      if (url === "/api/xero/auth/connect") return { authUrl: "https://login.xero.com/authorise" };
      if (url === "/api/xero/sync") return syncResult;
      if (url === "/api/xero/auth/disconnect") return { success: true };
      throw new Error(`Unexpected request ${url}`);
    });
  });

  it("lists the missing environment variables when Xero is not configured", async () => {
    status = {
      ...disconnectedStatus,
      configured: false,
      missingEnvVars: ["XERO_CLIENT_ID", "XERO_ENCRYPTION_KEY"],
    };
    renderCard();

    const list = await screen.findByRole("list", { name: "Missing environment variables" });
    expect(within(list).getByText("XERO_CLIENT_ID")).toBeInTheDocument();
    expect(within(list).getByText("XERO_ENCRYPTION_KEY")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect Xero" })).not.toBeInTheDocument();
  });

  it("connects in a popup and shows the sync counts from the callback", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue({ closed: false } as Window);
    renderCard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Connect Xero" }));

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        "https://login.xero.com/authorise",
        "xero-auth",
        expect.stringContaining("popup=yes"),
      ),
    );
    expect(screen.getByRole("button", { name: "Connecting..." })).toBeDisabled();

    // Messages from another origin or of another type are ignored
    postCallback({
      origin: "https://evil.example.com",
      data: { type: "xero-callback", payload: { success: true } },
    });
    postCallback({ origin: window.location.origin, data: { type: "google-drive-callback" } });
    expect(mocks.toast).not.toHaveBeenCalled();

    status = connectedStatus;
    postCallback({
      origin: window.location.origin,
      data: {
        type: "xero-callback",
        payload: {
          success: true,
          tenantName: "Demo Transport Pty Ltd",
          error: null,
          sync: syncResult,
          syncError: null,
        },
      },
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Xero connected",
        description: "Connected to Demo Transport Pty Ltd. Synced 42 items and 1 contact.",
      }),
    );
    expect(screen.getByTestId("xero-sync-summary")).toHaveTextContent("Synced 42 items and 1 contact");
    // The status is refetched, so the card now shows the connection
    expect(await screen.findByText("Demo Transport Pty Ltd")).toBeInTheDocument();
  });

  it("shows the sync error and connection error from the callback", async () => {
    vi.spyOn(window, "open").mockReturnValue({ closed: false } as Window);
    renderCard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Connect Xero" }));
    await waitFor(() => expect(callsTo({ url: "/api/xero/auth/connect" })).toHaveLength(1));

    postCallback({
      origin: window.location.origin,
      data: {
        type: "xero-callback",
        payload: { success: false, tenantName: null, error: "Access denied", sync: null, syncError: null },
      },
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Could not connect Xero",
      description: "Access denied",
      variant: "destructive",
    });
    expect(screen.getByRole("button", { name: "Connect Xero" })).toBeEnabled();

    postCallback({
      origin: window.location.origin,
      data: {
        type: "xero-callback",
        payload: { success: true, tenantName: "Demo", error: null, sync: null, syncError: "Rate limited" },
      },
    });
    expect(screen.getByTestId("xero-sync-summary")).toHaveTextContent("Sync failed: Rate limited");
  });

  it("toasts the error when Xero cannot be connected", async () => {
    mocks.fetchJson.mockImplementation(async ({ url }: { url: string }) => {
      if (url === "/api/xero/auth/status") return status;
      throw new Error("Xero is not configured");
    });
    const openSpy = vi.spyOn(window, "open");
    renderCard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Connect Xero" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Could not connect Xero",
        description: "Xero is not configured",
        variant: "destructive",
      }),
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("shows the connection and syncs from Xero", async () => {
    status = connectedStatus;
    renderCard();
    const user = userEvent.setup();

    expect(await screen.findByText("Demo Transport Pty Ltd")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open mapping" })).toHaveAttribute("href", "/settings/admin/xero");

    await user.click(screen.getByRole("button", { name: "Sync from Xero" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({ title: "Xero synced", description: "Synced 42 items and 1 contact" }),
    );
    expect(callsTo({ url: "/api/xero/sync" })[0].init).toEqual({ method: "POST" });
    expect(screen.getByTestId("xero-sync-summary")).toHaveTextContent("Synced 42 items and 1 contact");
  });

  it("shows a failed sync", async () => {
    status = connectedStatus;
    mocks.fetchJson.mockImplementation(async ({ url }: { url: string }) => {
      if (url === "/api/xero/auth/status") return status;
      throw new Error("Xero needs to be reconnected");
    });
    renderCard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Sync from Xero" }));

    expect(await screen.findByText("Sync failed: Xero needs to be reconnected")).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Could not sync from Xero", variant: "destructive" }),
    );
  });

  it("disconnects after confirming", async () => {
    status = connectedStatus;
    renderCard();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Demo Transport Pty Ltd will be disconnected");
    expect(callsTo({ url: "/api/xero/auth/disconnect" })).toHaveLength(0);

    status = disconnectedStatus;
    await user.click(within(dialog).getByRole("button", { name: "Disconnect" }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Xero disconnected" })),
    );
    expect(callsTo({ url: "/api/xero/auth/disconnect" })[0].init).toEqual({ method: "POST" });
    expect(await screen.findByRole("button", { name: "Connect Xero" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
