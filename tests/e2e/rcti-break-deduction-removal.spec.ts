import { test, expect, type Page } from "@playwright/test";
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
} from "../helpers/e2e-scenarios";
import {
  byId,
  expectRctiLineTotals,
  getRctiIdFromRow,
  openRctiWeek,
  RCTI_ACTION_TIMEOUT,
  rctiRow,
  selectRctiDrivers,
} from "../helpers/rcti-page";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const week = getE2eWeek({ weeksAgo: 4 });

let page: Page;
let tag: string;
let driver: E2eDriver;
let rctiId: number;

async function findLineId({ customer }: { customer: string }): Promise<number> {
  const { rows } = await getE2eDb().query(
    `SELECT id FROM "RctiLine" WHERE "rctiId" = $1 AND customer = $2 ORDER BY id LIMIT 1`,
    [rctiId, customer],
  );
  return rows[0].id;
}

async function removeLine({
  lineId,
  expectedLineCount,
}: {
  lineId: number;
  expectedLineCount: number;
}): Promise<void> {
  await page.locator(byId(`remove-rcti-line-${lineId}`)).click();
  await expect(rctiRow({ page, driverName: driver.driver })).toContainText(
    `${expectedLineCount} line`,
    { timeout: RCTI_ACTION_TIMEOUT },
  );
}

test.describe("Removing an RCTI break deduction", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const db = getE2eDb();
    tag = buildE2eTag({ testInfo });
    driver = await createE2eDriver({
      db,
      tag,
      key: "BRK",
      overrides: { breaks: 0.5 },
    });
    await createE2eJobs({
      db,
      tag,
      driver,
      jobs: [
        { date: getE2eJobDate({ week, day: 1 }), chargedHours: 8 },
        { date: getE2eJobDate({ week, day: 2 }), chargedHours: 8 },
      ],
    });
    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("creates a draft RCTI with a break deduction", async () => {
    await openRctiWeek({ page, week });
    await selectRctiDrivers({ page, driverIds: [driver.id] });
    await page.locator(byId("create-rcti-btn")).click();

    // 2 x 8 h tray at $70 = $1120.00, less 2 x 0.5 h breaks ($70.00).
    const row = rctiRow({ page, driverName: driver.driver });
    await expect(row).toContainText("3 lines", { timeout: RCTI_ACTION_TIMEOUT });
    rctiId = await getRctiIdFromRow({ row });
    await expectRctiLineTotals({
      page,
      subtotal: "$1050.00",
      gst: "$105.00",
      total: "$1155.00",
    });
  });

  test("keeps the break deduction removed", async () => {
    await removeLine({
      lineId: await findLineId({ customer: "Break Deduction" }),
      expectedLineCount: 2,
    });

    await expectRctiLineTotals({
      page,
      subtotal: "$1120.00",
      gst: "$112.00",
      total: "$1232.00",
    });
  });

  test("still has no break deduction when the RCTI is reopened", async () => {
    await openRctiWeek({ page, week });
    const row = rctiRow({ page, driverName: driver.driver });
    await row.click();

    await expect(row).toContainText("2 lines", { timeout: RCTI_ACTION_TIMEOUT });
    await expectRctiLineTotals({
      page,
      subtotal: "$1120.00",
      gst: "$112.00",
      total: "$1232.00",
    });
  });

  test("does not bring the break back when a job line is removed", async () => {
    const { rows } = await getE2eDb().query(
      `SELECT id FROM "RctiLine" WHERE "rctiId" = $1 AND "jobId" IS NOT NULL ORDER BY id LIMIT 1`,
      [rctiId],
    );
    await removeLine({ lineId: rows[0].id, expectedLineCount: 1 });

    await expectRctiLineTotals({
      page,
      subtotal: "$560.00",
      gst: "$56.00",
      total: "$616.00",
    });
  });

  test("restores the break deduction when the RCTI is refreshed", async () => {
    page.once("dialog", (dialog) => dialog.accept());
    const refreshed = page.waitForResponse((response) =>
      response.url().endsWith(`/api/rcti/${rctiId}/refresh`),
    );
    await page.locator(byId("refresh-rcti-btn")).click();
    expect((await refreshed).ok()).toBe(true);

    const row = rctiRow({ page, driverName: driver.driver });
    await expect(row).toContainText("3 lines", { timeout: RCTI_ACTION_TIMEOUT });
    await expectRctiLineTotals({
      page,
      subtotal: "$1050.00",
      gst: "$105.00",
      total: "$1155.00",
    });
  });
});
