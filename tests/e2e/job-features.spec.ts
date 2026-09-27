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
} from "../helpers/e2e-scenarios";
import { byId, openWeekPage, RCTI_ACTION_TIMEOUT } from "../helpers/rcti-page";

test.describe.configure({ mode: "serial", timeout: 120_000 });

const week = getE2eWeek({ weeksAgo: 0 });

let page: Page;
let tag: string;
let jobId: number;
let jobReference: string;

function jobRow() {
  return page.locator("tr", { hasText: jobReference }).first();
}

async function getJob() {
  const { rows } = await getE2eDb().query(
    `SELECT "travelTimeHours", "deductionHours", "countryRunValue", "countryRunUnit", comments FROM "Jobs" WHERE id = $1`,
    [jobId],
  );
  return rows[0];
}

test.describe("Job regional drop-offs, driver hours and country runs", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    const db = getE2eDb();
    tag = buildE2eTag({ testInfo });
    jobReference = `E2E-${tag}-JOB`;
    const driver = await createE2eDriver({
      db,
      tag,
      key: "EMP",
      overrides: { type: "Employee" },
    });
    const [job] = await createE2eJobs({
      db,
      tag,
      driver,
      jobs: [
        {
          date: getE2eJobDate({ week, day: 2 }),
          pickup: "Dandenong",
          dropoff: "Richmond, Belmont",
          chargedHours: 8,
          comments: "Gate code 1234",
          jobReference,
        },
      ],
    });
    jobId = job.id;
    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("badges the regional drop-off in the jobs table", async () => {
    await openWeekPage({ page, path: "/jobs", week });

    await expect(jobRow()).toBeVisible({ timeout: RCTI_ACTION_TIMEOUT });
    await expect(jobRow().getByTitle("Belmont (regional suburb)")).toBeVisible();
    await expect(jobRow().getByTitle("Richmond (regional suburb)")).toHaveCount(0);
  });

  test("flags the regional drop-off in the edit dialog", async () => {
    await page.locator(byId(`job-actions-${jobId}`)).click();
    await page.locator(byId(`edit-job-${jobId}`)).click();

    await expect(page.locator(byId("regional-dropoff-notice"))).toContainText(
      "Regional: Belmont",
    );
  });

  test("adds travel time and deducts hours from the driver's hours", async () => {
    await page.locator(byId("travel-time-hours")).fill("1");
    await page.locator(byId("deduction-hours")).fill("0.5");

    await expect(page.locator(byId("driver-hours"))).toHaveValue("8.50");
  });

  test("writes the country run charge into the comments", async () => {
    await page.locator(byId("country-run-value")).fill("1.5");
    await expect(page.locator(byId("comments"))).toHaveValue(
      "Gate code 1234\n*country run Belmont + 1.5 hours*",
    );

    await page.locator(byId("country-run-unit")).click();
    await page.getByRole("option", { name: "Percentage", exact: true }).click();
    await page.locator(byId("country-run-value")).fill("10");
    await expect(page.locator(byId("comments"))).toHaveValue(
      "Gate code 1234\n*country run Belmont + 10%*",
    );
  });

  test("saves the hours, country run and comments", async () => {
    await page.locator(byId("save-job-btn")).click();

    await expect
      .poll(getJob, { timeout: RCTI_ACTION_TIMEOUT })
      .toEqual({
        travelTimeHours: 1,
        deductionHours: 0.5,
        countryRunValue: 10,
        countryRunUnit: "percentage",
        comments: "Gate code 1234\n*country run Belmont + 10%*",
      });
  });

  test("clearing the charge removes the note", async () => {
    await page.locator(byId(`job-actions-${jobId}`)).click();
    await page.locator(byId(`edit-job-${jobId}`)).click();
    await expect(page.locator(byId("country-run-value"))).toHaveValue("10");

    await page.locator(byId("country-run-value")).fill("");
    await expect(page.locator(byId("comments"))).toHaveValue("Gate code 1234");
    await page.locator(byId("save-job-btn")).click();

    await expect
      .poll(getJob, { timeout: RCTI_ACTION_TIMEOUT })
      .toMatchObject({
        countryRunValue: null,
        countryRunUnit: null,
        comments: "Gate code 1234",
      });
  });
});
