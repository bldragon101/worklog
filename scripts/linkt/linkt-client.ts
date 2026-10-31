/**
 * Downloads trip history from the Linkt customer portal.
 *
 * Linkt has no public API and its site sits behind bot protection, so this
 * signs in with a real Chrome browser, picks up the bearer token the portal
 * uses for its own API, then asks that API for the same CSV the trips and
 * financial history page's "Export as CSV" button produces.
 */
import { randomUUID } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";
import { addDaysToIsoDate } from "../../src/lib/utils/jobs-report-dates";

const LOGIN_URL = "https://www.linkt.com.au/login";
const DX_API = "https://dxapi.linkt.com.au/v1";
/** The export returns at most this many trips per request */
const EXPORT_LIMIT = 1000;
/** The export is built in the background; check on it this often */
const EXPORT_POLL_MS = 2000;
const EXPORT_TIMEOUT_MS = 120_000;
const WINDOW_DAYS = 7;
const LOGIN_ATTEMPTS = 3;
/** Linkt sometimes rejects quick repeat sign-ins, so wait between attempts */
const LOGIN_RETRY_DELAY_MS = 30_000;

export interface LinktSession {
  context: BrowserContext;
  bearer: string;
  accountNumber: string;
  agreementNumber: string;
  close: () => Promise<void>;
}

export interface LinktTripsExport {
  from: string;
  to: string;
  csv: string;
}

function readCredentials() {
  const username = process.env.LINKT_USERNAME;
  const password = process.env.LINKT_PASSWORD;
  if (!username || !password) {
    throw new Error("LINKT_USERNAME and LINKT_PASSWORD must be set");
  }
  return { username, password };
}

async function signIn({
  page,
  username,
  password,
}: {
  page: Page;
  username: string;
  password: string;
}) {
  await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2000);

  await page.click("#loginForm-username-field");
  await page.keyboard.type(username, { delay: 50 });

  const passwordInput = page.locator("input[type=password]");
  const nextButton = page.getByRole("button", { name: "Next", exact: true });
  await passwordInput.or(nextButton).first().waitFor({ timeout: 45_000 });
  if (!(await passwordInput.isVisible())) {
    await nextButton.click();
    await passwordInput.waitFor({ timeout: 45_000 });
  }

  await passwordInput.click();
  await page.keyboard.type(password, { delay: 50 });
  if ((await passwordInput.inputValue()) !== password) {
    await passwordInput.fill(password);
  }
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  await page.waitForURL((url) => url.pathname.startsWith("/my"), {
    timeout: 60_000,
  });
}

/**
 * Sign in to Linkt and capture what is needed to call its API. Retries the
 * sign-in, as the portal sometimes rejects the first attempt.
 */
export async function openLinktSession(): Promise<LinktSession> {
  const { username, password } = readCredentials();
  const browser = await chromium.launch({
    channel: "chrome",
    headless: process.env.LINKT_HEADLESS === "true",
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 1000 },
      locale: "en-AU",
      timezoneId: "Australia/Melbourne",
    });
    const page = await context.newPage();

    let bearer = "";
    let accountNumber = "";
    let agreementNumber = "";
    page.on("request", (request) => {
      if (!request.url().startsWith(DX_API)) return;
      const authorization = request.headers()["authorization"];
      if (authorization?.startsWith("Bearer ")) bearer = authorization;
      const agreementMatch = request.url().match(/\/accounts\/(\d+)\/agreements\/(\d+)/);
      if (agreementMatch && !agreementNumber) {
        accountNumber = agreementMatch[1];
        agreementNumber = agreementMatch[2];
      }
    });

    const attemptSignIn = async ({ attempt }: { attempt: number }): Promise<void> => {
      try {
        await signIn({ page, username, password });
        await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => {});
      } catch (error) {
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        const screenshotDir = process.env.LINKT_DEBUG_DIR;
        if (screenshotDir) {
          await page
            .screenshot({ path: `${screenshotDir}/linkt-sign-in-attempt-${attempt}.png` })
            .catch(() => {});
        }
        if (attempt >= LOGIN_ATTEMPTS) {
          throw new Error(`Could not sign in to Linkt: ${message}`);
        }
        console.warn(`Linkt sign-in attempt ${attempt} failed: ${message}`);
        await page.waitForTimeout(LOGIN_RETRY_DELAY_MS);
        return attemptSignIn({ attempt: attempt + 1 });
      }
    };
    await attemptSignIn({ attempt: 1 });

    if (!bearer || !accountNumber || !agreementNumber) {
      throw new Error(
        `Signed in to Linkt but could not find the account's API ${bearer ? "account number" : "token"}`,
      );
    }

    return {
      context,
      bearer,
      accountNumber,
      agreementNumber,
      close: () => browser.close(),
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/**
 * Split an inclusive date range into windows small enough that no single
 * export hits the row limit.
 */
export function splitDateRange({
  from,
  to,
  windowDays = WINDOW_DAYS,
}: {
  from: string;
  to: string;
  windowDays?: number;
}): { from: string; to: string }[] {
  const windows: { from: string; to: string }[] = [];
  let start = from;
  while (start <= to) {
    const windowEnd = addDaysToIsoDate({ isoDate: start, days: windowDays - 1 });
    const end = windowEnd < to ? windowEnd : to;
    windows.push({ from: start, to: end });
    start = addDaysToIsoDate({ isoDate: end, days: 1 });
  }
  return windows;
}

/** The portal asks for JSON on every call, the CSV download included, and Linkt refuses anything else */
function apiHeaders({ session }: { session: LinktSession }) {
  return {
    authorization: session.bearer,
    accept: "application/json",
    "x-correlation-id": randomUUID(),
  };
}

async function getJson<T>({ session, url }: { session: LinktSession; url: string }): Promise<T> {
  const response = await session.context.request.get(url, {
    headers: apiHeaders({ session }),
  });
  if (!response.ok()) {
    throw new Error(`Linkt request ${new URL(url).pathname} failed with status ${response.status()}`);
  }
  return (await response.json()) as T;
}

/**
 * Wait for a background export to finish. Linkt reports IN_PROGRESS until it
 * is ready, then EXPORT_COMPLETED.
 */
async function waitForExport({
  session,
  exportKey,
  deadline,
  pollMs,
}: {
  session: LinktSession;
  exportKey: string;
  deadline: number;
  pollMs: number;
}): Promise<void> {
  const { status } = await getJson<{ status?: { mnemonic?: string; description?: string } }>({
    session,
    url: `${DX_API}/accounts/${session.accountNumber}/export/${exportKey}/checkStatus`,
  });
  if (status?.mnemonic === "EXPORT_COMPLETED") return;
  if (status?.mnemonic !== "IN_PROGRESS") {
    throw new Error(`Linkt export ended with status ${status?.mnemonic ?? "unknown"}`);
  }
  if (Date.now() > deadline) throw new Error("Linkt export did not finish in time");
  await new Promise((resolve) => setTimeout(resolve, pollMs));
  return waitForExport({ session, exportKey, deadline, pollMs });
}

async function exportTripsWindow({
  session,
  from,
  to,
  pollMs,
  timeoutMs,
}: {
  session: LinktSession;
  from: string;
  to: string;
  pollMs: number;
  timeoutMs: number;
}): Promise<string> {
  const params = new URLSearchParams({
    data: "trips",
    limit: String(EXPORT_LIMIT),
    startDate: from,
    endDate: to,
    format: "csv",
  });
  const { exportKey } = await getJson<{ exportKey?: string }>({
    session,
    url: `${DX_API}/accounts/${session.accountNumber}/agreements/${session.agreementNumber}/history/export?${params.toString()}`,
  });
  if (!exportKey) throw new Error(`Linkt did not start an export for ${from} to ${to}`);

  await waitForExport({ session, exportKey, deadline: Date.now() + timeoutMs, pollMs });

  const response = await session.context.request.get(
    `${DX_API}/accounts/${session.accountNumber}/export/${exportKey}/download`,
    { headers: apiHeaders({ session }) },
  );
  if (!response.ok()) {
    throw new Error(`Linkt export for ${from} to ${to} failed with status ${response.status()}`);
  }

  const csv = await response.text();
  const tripCount = csv.split(/\r?\n/).filter((line) => line.trim() !== "").length - 1;
  if (tripCount >= EXPORT_LIMIT) {
    throw new Error(
      `Linkt export for ${from} to ${to} reached the ${EXPORT_LIMIT} trip limit, so it may be incomplete; use a smaller window`,
    );
  }
  return csv;
}

/**
 * Export the trips CSV for an inclusive date range (YYYY-MM-DD, Melbourne
 * dates) through a signed-in session, one export per window. The windows run
 * one after another: Linkt keeps one export per account, so exports started
 * together all return the first one's trips.
 */
export function exportLinktTrips({
  session,
  from,
  to,
  pollMs = EXPORT_POLL_MS,
  timeoutMs = EXPORT_TIMEOUT_MS,
}: {
  session: LinktSession;
  from: string;
  to: string;
  pollMs?: number;
  timeoutMs?: number;
}): Promise<LinktTripsExport[]> {
  return splitDateRange({ from, to }).reduce<Promise<LinktTripsExport[]>>(
    async (previous, window) => {
      const exports = await previous;
      const csv = await exportTripsWindow({ session, ...window, pollMs, timeoutMs });
      return [...exports, { ...window, csv }];
    },
    Promise.resolve([]),
  );
}

/** Sign in to Linkt and download the trips CSV for an inclusive date range */
export async function downloadLinktTrips({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<LinktTripsExport[]> {
  const session = await openLinktSession();
  try {
    return await exportLinktTrips({ session, from, to });
  } finally {
    await session.close();
  }
}

/**
 * Join several Linkt CSV exports into one file with a single header row,
 * dropping each export's "Total of N results exported" footer.
 */
export function combineLinktCsvExports({ csvs }: { csvs: string[] }): string {
  const rowsByExport = csvs.map((csv) =>
    csv
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "" && !/^Total of \d+ results? exported/i.test(line)),
  );
  const header = rowsByExport.find((rows) => rows.length > 0)?.[0];
  if (!header) return "";

  const rows = rowsByExport.flatMap((exportRows) => exportRows.slice(1));
  return [header, ...rows].join("\n") + "\n";
}
