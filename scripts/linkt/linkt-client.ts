/**
 * Downloads trip history from the Linkt customer portal.
 *
 * Linkt has no public API and its site sits behind bot protection, so this
 * signs in with a real Chrome browser, picks up the bearer token the portal
 * uses for its own API, then asks that API for the same CSV the portal's
 * "Export as CSV" button produces.
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { addDaysToIsoDate } from "../../src/lib/utils/jobs-report-dates";

const LOGIN_URL = "https://www.linkt.com.au/login";
const WEB_API = "https://web-api.linkt.com.au/tuscany/linkt/web/v1";
/** The export returns at most this many trips per request */
const EXPORT_LIMIT = 1000;
const WINDOW_DAYS = 7;
const LOGIN_ATTEMPTS = 3;
/** Linkt sometimes rejects quick repeat sign-ins, so wait between attempts */
const LOGIN_RETRY_DELAY_MS = 30_000;

export interface LinktSession {
  context: BrowserContext;
  bearer: string;
  accountNumber: string;
  retailer: string;
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
  await page.getByRole("button", { name: "Next" }).click();

  const passwordInput = page.locator("input[type=password]");
  await passwordInput.waitFor({ timeout: 45_000 });
  await passwordInput.click();
  await page.keyboard.type(password, { delay: 50 });
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
    let accountNumber = process.env.LINKT_ACCOUNT_NUMBER ?? "";
    page.on("request", (request) => {
      if (!request.url().startsWith(WEB_API)) return;
      const authorization = request.headers()["authorization"];
      if (authorization) bearer = authorization;
      const accountMatch = request.url().match(/\/accounts\/(\d+)/);
      if (accountMatch && !accountNumber) accountNumber = accountMatch[1];
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

    if (!bearer || !accountNumber) {
      throw new Error("Signed in to Linkt but could not find the account's API token");
    }

    return {
      context,
      bearer,
      accountNumber,
      retailer: process.env.LINKT_RETAILER ?? "LinktMelbourne",
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

async function exportTripsWindow({
  session,
  from,
  to,
}: {
  session: LinktSession;
  from: string;
  to: string;
}): Promise<string> {
  const params = new URLSearchParams({
    exportFormat: "CSV",
    type: "trips",
    limit: String(EXPORT_LIMIT),
    trip_start_time: `${from}T00:00:00`,
    trip_end_time: `${to}T23:59:59`,
    retailer: session.retailer,
  });
  const response = await session.context.request.get(
    `${WEB_API}/accounts/${session.accountNumber}/history?${params.toString()}`,
    { headers: { authorization: session.bearer, accept: "text/csv" } },
  );
  if (!response.ok()) {
    throw new Error(`Linkt export for ${from} to ${to} failed with status ${response.status()}`);
  }

  const csv = await response.text();
  const exported = csv.match(/Total of (\d+) results? exported/i);
  if (exported && Number(exported[1]) >= EXPORT_LIMIT) {
    throw new Error(
      `Linkt export for ${from} to ${to} hit the ${EXPORT_LIMIT} trip limit; use a smaller window`,
    );
  }
  return csv;
}

/**
 * Download the trips CSV for an inclusive date range (YYYY-MM-DD, Melbourne
 * dates), one export per window.
 */
export async function downloadLinktTrips({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<LinktTripsExport[]> {
  const session = await openLinktSession();
  try {
    return await Promise.all(
      splitDateRange({ from, to }).map(async (window) => ({
        ...window,
        csv: await exportTripsWindow({ session, ...window }),
      })),
    );
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
