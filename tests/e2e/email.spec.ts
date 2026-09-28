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
  openRctiWeek,
  openWeekPage,
  RCTI_ACTION_TIMEOUT,
  rctiRow,
  selectRctiDrivers,
} from "../helpers/rcti-page";

// Emails are only sent from this spec when the app runs with
// EMAIL_DELIVERY=disabled, which reports each send as successful without
// calling Resend. The drivers also use Resend's sandbox address, so even a
// misconfigured run cannot reach a real person.
test.skip(
  process.env.EMAIL_DELIVERY !== "disabled",
  "Set EMAIL_DELIVERY=disabled for the app and the tests to run email specs",
);
test.describe.configure({ mode: "serial", timeout: 120_000 });

const SANDBOX_EMAIL = "delivered@resend.dev";
const week = getE2eWeek({ weeksAgo: 5 });

let page: Page;
let tag: string;
let subcontractor: E2eDriver;
let employee: E2eDriver;

async function getSentAt({ table, driverId }: { table: string; driverId: number }) {
  const { rows } = await getE2eDb().query(
    `SELECT "sentAt" FROM "${table}" WHERE "driverId" = $1`,
    [driverId],
  );
  return rows[0]?.sentAt ?? null;
}

test.describe("Emailing documents to drivers", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const db = getE2eDb();
    tag = buildE2eTag({ testInfo });
    subcontractor = await createE2eDriver({
      db,
      tag,
      key: "SUB",
      overrides: { email: SANDBOX_EMAIL },
    });
    employee = await createE2eDriver({
      db,
      tag,
      key: "EMP",
      overrides: { type: "Employee", email: SANDBOX_EMAIL },
    });
    for (const driver of [subcontractor, employee]) {
      await createE2eJobs({
        db,
        tag,
        driver,
        jobs: [{ date: getE2eJobDate({ week, day: 1 }), chargedHours: 8 }],
      });
    }
    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("emails a finalised RCTI and marks it as sent", async () => {
    await openRctiWeek({ page, week });
    await selectRctiDrivers({ page, driverIds: [subcontractor.id] });
    await page.locator(byId("create-rcti-btn")).click();
    const row = rctiRow({ page, driverName: subcontractor.driver });
    await expect(row).toContainText("$616.00", { timeout: RCTI_ACTION_TIMEOUT });
    await page.locator(byId("finalize-rcti-btn")).click();
    await expect(row.getByText("Finalised", { exact: true })).toBeVisible({
      timeout: RCTI_ACTION_TIMEOUT,
    });

    await page.locator(byId("email-rcti-btn")).click();
    await page.locator(byId("confirm-send-email-rcti-btn")).click();

    await expect(
      page.getByText(`RCTI emailed successfully to ${SANDBOX_EMAIL}`).first(),
    ).toBeVisible({ timeout: RCTI_ACTION_TIMEOUT });
    await expect
      .poll(() => getSentAt({ table: "Rcti", driverId: subcontractor.id }), {
        timeout: RCTI_ACTION_TIMEOUT,
      })
      .not.toBeNull();
  });

  test("emails a finalised jobs report and marks it as sent", async () => {
    await openWeekPage({ page, path: "/jobs-report", week });
    await selectRctiDrivers({ page, driverIds: [employee.id], idPrefix: "jr" });
    await page.locator(byId("jr-create-report-btn")).click();
    const report = page.locator('[id^="jr-report-item-"]', {
      hasText: employee.driver,
    });
    await expect(report).toContainText("1 job", { timeout: RCTI_ACTION_TIMEOUT });
    await page.locator(byId("jr-finalise-btn")).click();
    await expect(report.getByText("Finalised", { exact: true })).toBeVisible({
      timeout: RCTI_ACTION_TIMEOUT,
    });

    await page.locator(byId("jr-email-btn")).click();
    await page.locator(byId("confirm-send-email-jobs-report-btn")).click();

    await expect
      .poll(() => getSentAt({ table: "JobsReport", driverId: employee.id }), {
        timeout: RCTI_ACTION_TIMEOUT,
      })
      .not.toBeNull();
  });
});
