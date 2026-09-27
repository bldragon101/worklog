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
  openWeekPage,
  RCTI_ACTION_TIMEOUT,
  selectRctiDrivers,
} from "../helpers/rcti-page";
import { readPdfText } from "../helpers/pdf-text";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const week = getE2eWeek({ weeksAgo: 2 });

let page: Page;
let tag: string;
let employee: E2eDriver;
let reportNumber: string;

function reportItem() {
  return page.locator('[id^="jr-report-item-"]', { hasText: employee.driver });
}

async function expectStatus({ status }: { status: "Draft" | "Finalised" }) {
  await expect(reportItem().getByText(status, { exact: true })).toBeVisible({
    timeout: RCTI_ACTION_TIMEOUT,
  });
}

test.describe("Jobs report lifecycle", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const db = getE2eDb();
    tag = buildE2eTag({ testInfo });
    employee = await createE2eDriver({
      db,
      tag,
      key: "EMP",
      overrides: { type: "Employee", lastName: "SMITH" },
    });
    await createE2eJobs({
      db,
      tag,
      driver: employee,
      jobs: [
        {
          date: getE2eJobDate({ week, day: 1 }),
          chargedHours: 8,
          travelTimeHours: 1,
        },
        {
          date: getE2eJobDate({ week, day: 2 }),
          chargedHours: 6,
          deductionHours: 0.5,
        },
        {
          date: getE2eJobDate({ week, day: 3 }),
          chargedHours: 8,
          driverCharge: 10,
        },
      ],
    });
    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("creates a report for an employee with job and driver hours", async () => {
    await openWeekPage({ page, path: "/jobs-report", week });
    await selectRctiDrivers({ page, driverIds: [employee.id], idPrefix: "jr" });
    await page.locator(byId("jr-create-report-btn")).click();

    await expect(reportItem()).toContainText("3 jobs", {
      timeout: RCTI_ACTION_TIMEOUT,
    });
    await expectStatus({ status: "Draft" });
    // Job hours 8 + 6 + 8; driver hours 9 (travel) + 5.5 (deduction) + 10 (override).
    await expect(page.locator(byId("jr-total-hours"))).toHaveText("22.00");
    await expect(page.locator(byId("jr-total-driver-hours"))).toHaveText("24.50");

    const { rows } = await getE2eDb().query(
      `SELECT "reportNumber" FROM "JobsReport" WHERE "driverId" = $1`,
      [employee.id],
    );
    reportNumber = rows[0].reportNumber;
  });

  test("refuses a second report for the same driver and week", async () => {
    await page.locator(byId("jr-create-report-btn")).click();

    await expect(
      page
        .getByText("A Jobs Report already exists for this driver and week")
        .first(),
    ).toBeVisible({ timeout: RCTI_ACTION_TIMEOUT });
    const { rows } = await getE2eDb().query(
      `SELECT COUNT(*) FROM "JobsReport" WHERE "driverId" = $1`,
      [employee.id],
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  test("finalises and locks the report", async () => {
    await page.locator(byId("jr-finalise-btn")).click();

    await expectStatus({ status: "Finalised" });
    await expect(page.locator(byId("jr-add-manual-line-btn"))).toHaveCount(0);
    await expect(page.locator(byId("jr-delete-btn"))).toHaveCount(0);
  });

  test("downloads a PDF with the report number, driver and hours", async () => {
    const downloadPromise = page.waitForEvent("download");
    await page.locator(byId("jr-download-pdf-btn")).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`${reportNumber}.pdf`);
    const text = await readPdfText({ path: await download.path() });
    for (const expected of [
      reportNumber,
      employee.driver,
      "+1 travel 9",
      "-0.50 deduction 5.50",
      "Job Hours 22",
      "Driver Hours 24.50",
    ]) {
      expect(text, `PDF should include ${expected}`).toContain(expected);
    }
  });

  test("unfinalises back to an editable draft", async () => {
    await page.locator(byId("jr-unfinalise-btn")).click();

    await expectStatus({ status: "Draft" });
    await expect(page.locator(byId("jr-add-manual-line-btn"))).toBeVisible();
    const { rows } = await getE2eDb().query(
      `SELECT status FROM "JobsReport" WHERE "driverId" = $1`,
      [employee.id],
    );
    expect(rows[0].status).toBe("draft");
  });
});
