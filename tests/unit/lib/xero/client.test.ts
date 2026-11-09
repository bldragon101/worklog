/**
 * @vitest-environment node
 */
import { ApiError } from "@/lib/api-error";
import { XeroReauthRequiredError } from "@/lib/xero/auth";
import {
  fetchXeroContacts,
  fetchXeroItems,
  XERO_CONTACTS_PAGE_SIZE,
  XeroRateLimitError,
  xeroRequest,
} from "@/lib/xero/client";

const mocks = vi.hoisted(() => ({
  getXeroAccessToken: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/xero/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/xero/auth")>()),
  getXeroAccessToken: mocks.getXeroAccessToken,
}));

const firstExpiry = new Date("2026-11-02T01:00:00.000Z");
const secondExpiry = new Date("2026-11-02T01:30:00.000Z");

function jsonResponse({
  body,
  status = 200,
  headers = {},
}: {
  body: unknown;
  status?: number;
  headers?: Record<string, string>;
}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function fetchCall({ index }: { index: number }) {
  const [url, init] = mocks.fetch.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

describe("Xero client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetch.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.getXeroAccessToken.mockImplementation(async ({ staleExpiry }: { staleExpiry?: Date }) =>
      staleExpiry
        ? { accessToken: "token-2", tenantId: "tenant-1", tokenExpiry: secondExpiry }
        : { accessToken: "token-1", tenantId: "tenant-1", tokenExpiry: firstExpiry },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("xeroRequest", () => {
    it("sends the token, tenant and query for a GET", async () => {
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body: { Items: [] } }));

      const data = await xeroRequest({ path: "/Items", query: { where: 'Code=="A B"' } });

      expect(data).toEqual({ Items: [] });
      const { url, init, headers } = fetchCall({ index: 0 });
      expect(url).toBe("https://api.xero.com/api.xro/2.0/Items?where=Code%3D%3D%22A+B%22");
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
      expect(headers).toEqual({
        Authorization: "Bearer token-1",
        "xero-tenant-id": "tenant-1",
        Accept: "application/json",
      });
    });

    it("sends a JSON body and the idempotency key", async () => {
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body: { Invoices: [] } }));

      await xeroRequest({
        path: "/Invoices",
        method: "PUT",
        body: { Invoices: [{ Reference: "INV-1" }] },
        idempotencyKey: "invoice-50-v1",
      });

      const { init, headers } = fetchCall({ index: 0 });
      expect(init.method).toBe("PUT");
      expect(init.body).toBe(JSON.stringify({ Invoices: [{ Reference: "INV-1" }] }));
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Idempotency-Key"]).toBe("invoice-50-v1");
      expect(headers["xero-tenant-id"]).toBe("tenant-1");
    });

    it("refreshes the token and retries once when Xero rejects it", async () => {
      mocks.fetch
        .mockResolvedValueOnce(jsonResponse({ body: { Title: "Unauthorized" }, status: 401 }))
        .mockResolvedValueOnce(jsonResponse({ body: { Items: [{ Code: "A" }] } }));

      const data = await xeroRequest({ path: "/Items" });

      expect(data).toEqual({ Items: [{ Code: "A" }] });
      expect(mocks.getXeroAccessToken).toHaveBeenNthCalledWith(1, { staleExpiry: undefined });
      expect(mocks.getXeroAccessToken).toHaveBeenNthCalledWith(2, { staleExpiry: firstExpiry });
      expect(fetchCall({ index: 1 }).headers.Authorization).toBe("Bearer token-2");
    });

    it("asks for a reconnect when the refreshed token is also rejected", async () => {
      mocks.fetch.mockResolvedValue(jsonResponse({ body: { Title: "Unauthorized" }, status: 401 }));

      const error = await xeroRequest({ path: "/Items" }).catch((thrown: unknown) => thrown);

      expect(mocks.fetch).toHaveBeenCalledTimes(2);
      expect(error).toBeInstanceOf(XeroReauthRequiredError);
      expect((error as ApiError).status).toBe(401);
    });

    it("raises a rate limit error with Retry-After", async () => {
      mocks.fetch.mockResolvedValueOnce(
        jsonResponse({ body: {}, status: 429, headers: { "Retry-After": "42" } }),
      );

      const error = await xeroRequest({ path: "/Items" }).catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(XeroRateLimitError);
      expect((error as XeroRateLimitError).status).toBe(429);
      expect((error as XeroRateLimitError).message).toBe(
        "Xero's rate limit was reached. Try again in 42 seconds.",
      );
      expect((error as XeroRateLimitError).body).toEqual({
        success: false,
        code: "XERO_RATE_LIMITED",
        retryAfterSeconds: 42,
      });
    });

    it("raises a rate limit error without a usable Retry-After", async () => {
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body: {}, status: 429 }));

      const error = (await xeroRequest({ path: "/Items" }).catch(
        (thrown: unknown) => thrown,
      )) as XeroRateLimitError;

      expect(error.body.retryAfterSeconds).toBeNull();
      expect(error.message).toBe("Xero's rate limit was reached. Try again shortly.");
    });

    it("asks for a reconnect when Xero forbids the request", async () => {
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body: {}, status: 403 }));

      const error = (await xeroRequest({ path: "/Items" }).catch(
        (thrown: unknown) => thrown,
      )) as ApiError;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(403);
      expect(error.body.code).toBe("XERO_FORBIDDEN");
      expect(error.message).toMatch(/Reconnect Xero/);
    });

    it.each([
      {
        name: "Xero's Message",
        body: { Message: "A validation exception occurred", Title: "Bad" },
        message: "Xero request failed (400): A validation exception occurred",
        status: 400,
      },
      {
        name: "the Detail when there is no Message",
        body: { Detail: "Item not found" },
        message: "Xero request failed (404): Item not found",
        status: 404,
      },
      {
        name: "the start of a text body",
        body: "Service Unavailable",
        message: "Xero request failed (503): Service Unavailable",
        status: 503,
      },
    ])("responds 502 with $name on other failures", async ({ body, message, status }) => {
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body, status }));

      const error = (await xeroRequest({ path: "/Items" }).catch(
        (thrown: unknown) => thrown,
      )) as ApiError;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(502);
      expect(error.message).toBe(message);
      expect(error.body.code).toBe("XERO_REQUEST_FAILED");
    });

    it("passes on a reconnect error from the token", async () => {
      const reauth = new ApiError({ status: 401, message: "Reconnect" });
      mocks.getXeroAccessToken.mockRejectedValue(reauth);

      await expect(xeroRequest({ path: "/Items" })).rejects.toBe(reauth);
      expect(mocks.fetch).not.toHaveBeenCalled();
    });
  });

  describe("fetchXeroItems", () => {
    it("returns the items", async () => {
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body: { Items: [{ ItemID: "1", Code: "A" }] } }));

      expect(await fetchXeroItems()).toEqual([{ ItemID: "1", Code: "A" }]);
      expect(fetchCall({ index: 0 }).url).toBe("https://api.xero.com/api.xro/2.0/Items");
    });

    it("returns no items when Xero omits the list", async () => {
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body: {} }));

      expect(await fetchXeroItems()).toEqual([]);
    });
  });

  describe("fetchXeroContacts", () => {
    const page = ({ count, offset }: { count: number; offset: number }) =>
      Array.from({ length: count }, (_, index) => ({
        ContactID: `c-${offset + index}`,
        Name: `Contact ${offset + index}`,
      }));

    it("requests active contacts a page at a time and stops on a short page", async () => {
      mocks.fetch
        .mockResolvedValueOnce(
          jsonResponse({ body: { Contacts: page({ count: XERO_CONTACTS_PAGE_SIZE, offset: 0 }) } }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            body: { Contacts: page({ count: 3, offset: XERO_CONTACTS_PAGE_SIZE }) },
          }),
        );

      const contacts = await fetchXeroContacts();

      expect(contacts).toHaveLength(XERO_CONTACTS_PAGE_SIZE + 3);
      expect(contacts.at(-1)?.ContactID).toBe(`c-${XERO_CONTACTS_PAGE_SIZE + 2}`);
      expect(mocks.fetch).toHaveBeenCalledTimes(2);

      const [first, second] = [0, 1].map((index) => new URL(fetchCall({ index }).url));
      expect(first.pathname).toBe("/api.xro/2.0/Contacts");
      expect(Object.fromEntries(first.searchParams)).toEqual({
        page: "1",
        pageSize: String(XERO_CONTACTS_PAGE_SIZE),
        summaryOnly: "true",
        where: 'ContactStatus=="ACTIVE"',
      });
      expect(second.searchParams.get("page")).toBe("2");
    });

    it("stops after an empty first page", async () => {
      mocks.fetch.mockResolvedValueOnce(jsonResponse({ body: {} }));

      expect(await fetchXeroContacts()).toEqual([]);
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });

    it("stops after 50 full pages", async () => {
      mocks.fetch.mockImplementation(async () =>
        jsonResponse({ body: { Contacts: page({ count: XERO_CONTACTS_PAGE_SIZE, offset: 0 }) } }),
      );

      const contacts = await fetchXeroContacts();

      expect(mocks.fetch).toHaveBeenCalledTimes(50);
      expect(contacts).toHaveLength(50 * XERO_CONTACTS_PAGE_SIZE);
    });
  });
});
