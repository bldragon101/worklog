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
  expectRctiStatus,
  getRctiIdFromRow,
  openRctiWeek,
  RCTI_ACTION_TIMEOUT,
  rctiRow,
  selectRctiDrivers,
} from "../helpers/rcti-page";
import { readPdfText } from "../helpers/pdf-text";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const week = getE2eWeek({ weeksAgo: 3 });

let page: Page;
let tag: string;
let driver: E2eDriver;
let rctiId: number;

async function addManualLine({
  customer,
  description,
  hours,
  rate,
  expectedLineCount,
}: {
  customer: string;
  description: string;
  hours: string;
  rate: string;
  expectedLineCount: number;
}): Promise<void> {
  await page.locator(byId("add-manual-line-btn")).click();
  await page
    .locator(byId("manual-line-date"))
    .fill(getE2eJobDate({ week, day: 4 }).toISOString().slice(0, 10));
  await page.locator(byId("manual-line-customer")).fill(customer);
  await page.locator(byId("manual-line-truck-type")).fill("TRAY");
  await page.locator(byId("manual-line-description")).fill(description);
  await page.locator(byId("manual-line-hours")).fill(hours);
  await page.locator(byId("manual-line-rate")).fill(rate);
  await page.locator(byId("save-manual-line-btn")).click();
  await expect(rctiRow({ page, driverName: driver.driver })).toContainText(
    `${expectedLineCount} lines`,
    { timeout: RCTI_ACTION_TIMEOUT },
  );
}

test.describe("RCTI manual lines, sent status and PDF", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const db = getE2eDb();
    tag = buildE2eTag({ testInfo });
    driver = await createE2eDriver({ db, tag, key: "SUB" });
    await createE2eJobs({
      db,
      tag,
      driver,
      jobs: [{ date: getE2eJobDate({ week, day: 1 }), chargedHours: 8 }],
    });
    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("creates a draft RCTI from one job", async () => {
    await openRctiWeek({ page, week });
    await selectRctiDrivers({ page, driverIds: [driver.id] });
    await page.locator(byId("create-rcti-btn")).click();

    const row = rctiRow({ page, driverName: driver.driver });
    await expect(row).toContainText("$616.00", { timeout: RCTI_ACTION_TIMEOUT });
    rctiId = await getRctiIdFromRow({ row });
  });

  test("adds a manual charge to the totals", async () => {
    await addManualLine({
      customer: `E2E ${tag} Yard work`,
      description: "Loading at the yard",
      hours: "2",
      rate: "50",
      expectedLineCount: 2,
    });

    await expectRctiLineTotals({
      page,
      subtotal: "$660.00",
      gst: "$66.00",
      total: "$726.00",
    });
  });

  test("turns a manual line into a credit by editing its hours below zero", async () => {
    // New manual lines need zero or more hours; credits are made by editing.
    await addManualLine({
      customer: `E2E ${tag} Credit`,
      description: "Overpayment last week",
      hours: "1",
      rate: "70",
      expectedLineCount: 3,
    });
    await expect(page.locator(byId("rcti-lines-total"))).toHaveText("$803.00", {
      timeout: RCTI_ACTION_TIMEOUT,
    });

    const { rows } = await getE2eDb().query(
      `SELECT id FROM "RctiLine" WHERE "rctiId" = $1 AND customer = $2`,
      [rctiId, `E2E ${tag} Credit`],
    );
    await page.locator(byId(`rcti-line-${rows[0].id}-hours`)).fill("-1");
    await page.locator(byId("save-rcti-btn")).click();

    await expectRctiStatus({
      row: rctiRow({ page, driverName: driver.driver }),
      status: "Draft",
    });
    await expectRctiLineTotals({
      page,
      subtotal: "$590.00",
      gst: "$59.00",
      total: "$649.00",
    });
    await expect
      .poll(
        async () => {
          const { rows: totals } = await getE2eDb().query(
            `SELECT subtotal, gst, total FROM "Rcti" WHERE id = $1`,
            [rctiId],
          );
          return totals[0];
        },
        { timeout: RCTI_ACTION_TIMEOUT },
      )
      .toEqual({ subtotal: "590.00", gst: "59.00", total: "649.00" });
  });

  test("keeps manual lines when the RCTI is refreshed", async () => {
    page.once("dialog", (dialog) => dialog.accept());
    const refreshed = page.waitForResponse((response) =>
      response.url().endsWith(`/api/rcti/${rctiId}/refresh`),
    );
    await page.locator(byId("refresh-rcti-btn")).click();
    expect((await refreshed).ok()).toBe(true);

    const row = rctiRow({ page, driverName: driver.driver });
    await expect(row).toContainText("3 lines", { timeout: RCTI_ACTION_TIMEOUT });
    await expect(page.locator(byId("rcti-lines-total"))).toHaveText("$649.00", {
      timeout: RCTI_ACTION_TIMEOUT,
    });
  });

  test("removes a manual line and recalculates", async () => {
    const { rows } = await getE2eDb().query(
      `SELECT id FROM "RctiLine" WHERE "rctiId" = $1 AND customer = $2`,
      [rctiId, `E2E ${tag} Credit`],
    );
    const removed = page.waitForResponse(
      (response) =>
        response.url().includes(`/lines/${rows[0].id}`) &&
        response.request().method() === "DELETE",
    );
    await page.locator(byId(`remove-rcti-line-${rows[0].id}`)).click();
    expect((await removed).ok()).toBe(true);

    await expectRctiLineTotals({
      page,
      subtotal: "$660.00",
      gst: "$66.00",
      total: "$726.00",
    });
    await expect
      .poll(
        async () => {
          const { rows: totals } = await getE2eDb().query(
            `SELECT subtotal, gst, total FROM "Rcti" WHERE id = $1`,
            [rctiId],
          );
          return totals[0];
        },
        { timeout: RCTI_ACTION_TIMEOUT },
      )
      .toEqual({ subtotal: "660.00", gst: "66.00", total: "726.00" });
  });

  test("marks the RCTI as sent", async () => {
    await page.locator(byId("toggle-sent-btn")).click();

    const row = rctiRow({ page, driverName: driver.driver });
    await expect(row.getByText("Sent", { exact: true })).toBeVisible({
      timeout: RCTI_ACTION_TIMEOUT,
    });
    await expect
      .poll(
        async () => {
          const { rows } = await getE2eDb().query(
            `SELECT "sentAt" FROM "Rcti" WHERE id = $1`,
            [rctiId],
          );
          return rows[0].sentAt;
        },
        { timeout: RCTI_ACTION_TIMEOUT },
      )
      .not.toBeNull();
  });

  test("downloads a PDF with the payee, bank details, lines and totals", async () => {
    const downloadPromise = page.waitForEvent("download");
    await page.locator(byId("download-rcti-pdf-btn")).click();
    const download = await downloadPromise;

    const { rows } = await getE2eDb().query(
      `SELECT "invoiceNumber" FROM "Rcti" WHERE id = $1`,
      [rctiId],
    );
    expect(download.suggestedFilename()).toBe(`${rows[0].invoiceNumber}.pdf`);

    const text = await readPdfText({ path: await download.path() });
    for (const expected of [
      rows[0].invoiceNumber,
      `E2E ${tag} SUB Pty Ltd`,
      "51824753556",
      "BSB: 063000",
      "12345678",
      `E2E ${tag} Yard work`,
      "$560.00",
      "$100.00",
      "$660.00",
      "$66.00",
      "$726.00",
    ]) {
      expect(text, `PDF should include ${expected}`).toContain(expected);
    }
    expect(text).not.toContain(`E2E ${tag} Credit`);
  });
});
