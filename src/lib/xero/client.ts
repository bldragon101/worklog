import { ApiError } from "@/lib/api-error";
import { getXeroAccessToken, XeroReauthRequiredError } from "@/lib/xero/auth";
import { XERO_API_URL } from "@/lib/xero/config";

/** Contacts per page; Xero accepts up to 1000 */
export const XERO_CONTACTS_PAGE_SIZE = 1000;
/** Stops a runaway contact sync; 50 pages is 50,000 contacts */
const MAX_CONTACT_PAGES = 50;

/** Raised when Xero's rate limit is hit (60 calls a minute, 5,000 a day) */
export class XeroRateLimitError extends ApiError {
  constructor({ retryAfterSeconds }: { retryAfterSeconds: number | null }) {
    super({
      status: 429,
      message: retryAfterSeconds
        ? `Xero's rate limit was reached. Try again in ${retryAfterSeconds} seconds.`
        : "Xero's rate limit was reached. Try again shortly.",
      body: { success: false, code: "XERO_RATE_LIMITED", retryAfterSeconds },
    });
    this.name = "XeroRateLimitError";
  }
}

async function describeFailure({ response }: { response: Response }): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const data = JSON.parse(text) as { Message?: string; Detail?: string; Title?: string };
    return data.Message ?? data.Detail ?? data.Title ?? text.slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}

/**
 * A request to the Xero Accounting API for the connected organisation. A
 * rejected access token is refreshed and the request retried once.
 */
export async function xeroRequest<T>({
  path,
  method = "GET",
  query,
  body,
  idempotencyKey,
}: {
  path: string;
  method?: "GET" | "PUT" | "POST" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
  idempotencyKey?: string;
}): Promise<T> {
  const url = `${XERO_API_URL}${path}${query ? `?${new URLSearchParams(query).toString()}` : ""}`;

  const send = async ({ staleExpiry }: { staleExpiry?: Date }) => {
    const token = await getXeroAccessToken({ staleExpiry });
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "xero-tenant-id": token.tenantId,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { response, tokenExpiry: token.tokenExpiry };
  };

  const first = await send({});
  const response =
    first.response.status === 401
      ? (await send({ staleExpiry: first.tokenExpiry })).response
      : first.response;

  if (response.status === 401) {
    throw new XeroReauthRequiredError(
      "Xero rejected the connection even after refreshing it. An administrator must reconnect Xero from the Integrations page.",
    );
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new XeroRateLimitError({
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    });
  }

  if (response.status === 403) {
    throw new ApiError({
      status: 403,
      message:
        "Xero refused the request. Reconnect Xero so the app is granted the scopes it needs.",
      body: { success: false, code: "XERO_FORBIDDEN" },
    });
  }

  if (!response.ok) {
    const detail = await describeFailure({ response });
    throw new ApiError({
      status: 502,
      message: `Xero request failed (${response.status})${detail ? `: ${detail}` : ""}`,
      body: { success: false, code: "XERO_REQUEST_FAILED" },
    });
  }

  return (await response.json()) as T;
}

export interface XeroApiItem {
  ItemID: string;
  Code: string;
  Name?: string;
  IsSold?: boolean;
  SalesDetails?: { UnitPrice?: number; AccountCode?: string; TaxType?: string };
}

export interface XeroApiContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  IsCustomer?: boolean;
  ContactStatus?: string;
}

export async function fetchXeroItems(): Promise<XeroApiItem[]> {
  const data = await xeroRequest<{ Items?: XeroApiItem[] }>({ path: "/Items" });
  return data.Items ?? [];
}

async function fetchContactPages({
  page,
  collected,
}: {
  page: number;
  collected: XeroApiContact[];
}): Promise<XeroApiContact[]> {
  const data = await xeroRequest<{ Contacts?: XeroApiContact[] }>({
    path: "/Contacts",
    query: {
      page: String(page),
      pageSize: String(XERO_CONTACTS_PAGE_SIZE),
      summaryOnly: "true",
      where: 'ContactStatus=="ACTIVE"',
    },
  });
  const contacts = data.Contacts ?? [];
  const all = [...collected, ...contacts];
  if (contacts.length < XERO_CONTACTS_PAGE_SIZE || page >= MAX_CONTACT_PAGES) return all;
  return fetchContactPages({ page: page + 1, collected: all });
}

/** Every active contact, one page at a time */
export function fetchXeroContacts(): Promise<XeroApiContact[]> {
  return fetchContactPages({ page: 1, collected: [] });
}
