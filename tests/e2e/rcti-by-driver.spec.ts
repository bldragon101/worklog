import { test, expect, type Page } from "@playwright/test";
import { getYear } from "date-fns";
import { STORAGE_STATE } from "../helpers/storage-state";
import {
  buildE2eTag,
  cleanupE2eData,
  disconnectE2eDb,
  getE2eDb,
} from "../helpers/e2e-db";
import {
  createE2eDriver,
  createE2eJobs,
  getE2eJobDate,
  getE2eWeek,
  type E2eDriver,
  type E2eWeek,
} from "../helpers/e2e-scenarios";
import { byId, RCTI_ACTION_TIMEOUT } from "../helpers/rcti-page";

test.describe.configure({ mode: "serial", timeout: 120_000 });

// Tray at $70 an hour on exclusive GST: 8 h = $616.00, 4 h = $308.00 and
// 2 h = $154.00 including GST.
const paidWeek = getE2eWeek({ weeksAgo: 3 });
const finalisedWeek = getE2eWeek({ weeksAgo: 2 });
const draftWeek = getE2eWeek({ weeksAgo: 1 });

let page: Page;
let tag: string;
let driver: E2eDriver;
const rctiIds: Record<"paid" | "finalised" | "draft", number> = {
  paid: 0,
  finalised: 0,
  draft: 0,
};

async function createRcti({ week }: { week: E2eWeek }): Promise<number> {
  const response = await page.request.post("/api/rcti", {
    data: {
      driverId: driver.id,
      weekEnding: week.weekEnding.toISOString(),
      gstStatus: "registered",
      gstMode: "exclusive",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).id;
}

async function post({ path }: { path: string }) {
  const response = await page.request.post(path, { data: {} });
  expect(response.ok(), await response.text()).toBe(true);
}

test.describe("RCTI by driver", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const db = getE2eDb();
    tag = buildE2eTag({ testInfo });
    driver = await createE2eDriver({ db, tag, key: "SUB" });
    await createE2eJobs({
      db,
      tag,
      driver,
      jobs: [
        { date: getE2eJobDate({ week: paidWeek, day: 1 }), chargedHours: 8 },
        { date: getE2eJobDate({ week: finalisedWeek, day: 1 }), chargedHours: 4 },
        { date: getE2eJobDate({ week: draftWeek, day: 1 }), chargedHours: 2 },
      ],
    });

    page = await browser.newPage({ storageState: STORAGE_STATE });
    await page.goto("/rcti");

    rctiIds.paid = await createRcti({ week: paidWeek });
    await post({ path: `/api/rcti/${rctiIds.paid}/finalize` });
    await post({ path: `/api/rcti/${rctiIds.paid}/pay` });
    rctiIds.finalised = await createRcti({ week: finalisedWeek });
    await post({ path: `/api/rcti/${rctiIds.finalised}/finalize` });
    rctiIds.draft = await createRcti({ week: draftWeek });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("records who finalised and paid the RCTI", async () => {
    const { rows } = await getE2eDb().query(
      `SELECT "fromStatus", "toStatus", "changedBy" FROM "RctiStatusChange"
       WHERE "rctiId" = $1 ORDER BY "changedAt", id`,
      [rctiIds.paid],
    );

    expect(rows.map((row) => [row.fromStatus, row.toStatus])).toEqual([
      ["draft", "finalised"],
      ["finalised", "paid"],
    ]);
    for (const row of rows) {
      expect(row.changedBy).toMatch(/^user_/);
    }
  });

  test("keeps the pay fields of a job on a paid RCTI locked", async () => {
    const { rows } = await getE2eDb().query(
      `SELECT "jobId" FROM "RctiLine" WHERE "rctiId" = $1 AND "jobId" IS NOT NULL`,
      [rctiIds.paid],
    );
    const jobId = rows[0].jobId;

    const hoursChange = await page.request.put(`/api/jobs/${jobId}`, {
      data: { chargedHours: 9 },
    });
    expect(hoursChange.status()).toBe(409);
    expect((await hoursChange.json()).error).toContain(
      "Revert the RCTI to draft",
    );

    const invoicedChange = await page.request.put(`/api/jobs/${jobId}`, {
      data: { invoiced: true },
    });
    expect(invoicedChange.status()).toBe(200);

    const { rows: jobs } = await getE2eDb().query(
      `SELECT "chargedHours", invoiced FROM "Jobs" WHERE id = $1`,
      [jobId],
    );
    expect(jobs[0]).toEqual({ chargedHours: 8, invoiced: true });
  });

  test("summarises a driver's paid, outstanding and draft RCTIs", async () => {
    await page.locator(byId("view-by-driver-tab")).click();
    await page.locator(byId("driver-select")).click();
    await page.locator(byId(`driver-${driver.id}`)).click();

    const main = page.locator("main");
    await expect(main).toContainText("$616.00", { timeout: RCTI_ACTION_TIMEOUT });
    await expect(main).toContainText("1 RCTIs");
    await expect(main).toContainText("$308.00");
    await expect(main).toContainText("1 finalised");
    await expect(main).toContainText("$1078.00");
    await expect(main).toContainText("1 draft");
  });

  test("groups the RCTIs by year", async () => {
    const years = [paidWeek, finalisedWeek, draftWeek].map((week) =>
      getYear(week.weekEnding),
    );
    const draftYear = getYear(draftWeek.weekEnding);
    const inDraftYear = years.filter((year) => year === draftYear).length;

    const yearRow = page.locator(byId(`year-${draftYear}`));
    await expect(yearRow).toContainText(`${inDraftYear} RCTIs`);
    if (inDraftYear === 3) {
      await expect(yearRow).toContainText("$1078.00");
    }
    await expect(page.locator(byId(`view-rcti-${rctiIds.draft}`))).toBeVisible();
  });

  test("opens an RCTI in the week view", async () => {
    const { rows } = await getE2eDb().query(
      `SELECT "invoiceNumber" FROM "Rcti" WHERE id = $1`,
      [rctiIds.draft],
    );

    await page.locator(byId(`view-rcti-${rctiIds.draft}`)).click();

    await expect(page.locator(byId("view-by-week-tab"))).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(page.locator("main")).toContainText(rows[0].invoiceNumber, {
      timeout: RCTI_ACTION_TIMEOUT,
    });
  });
});
