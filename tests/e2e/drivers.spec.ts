import { test, expect, type Page } from "@playwright/test";
import { STORAGE_STATE } from "../helpers/storage-state";
import {
  buildE2eTag,
  cleanupE2eData,
  disconnectE2eDb,
  getE2eDb,
} from "../helpers/e2e-db";
import { byId, RCTI_ACTION_TIMEOUT } from "../helpers/rcti-page";

test.describe.configure({ mode: "serial", timeout: 120_000 });

let page: Page;
let tag: string;
let firstName: string;

function driverRow() {
  return page.locator("tr", { hasText: firstName }).first();
}

async function getDriver() {
  const { rows } = await getE2eDb().query(
    `SELECT driver, "lastName", "isArchived" FROM "Driver" WHERE driver = $1`,
    [firstName],
  );
  return rows[0];
}

test.describe("Drivers", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    tag = buildE2eTag({ testInfo });
    firstName = `E2E ${tag} NEW`;
    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("adds a driver with a first and last name", async () => {
    await page.goto("/drivers");
    await page.waitForLoadState("networkidle");
    await page.locator(byId("add-driver-btn")).click();

    await page.locator(byId("driver-name-input")).fill(firstName.toLowerCase());
    await page.locator(byId("driver-last-name-input")).fill("Nguyen");
    await page.locator(byId("truck-select")).click();
    await page.keyboard.type("TEST-TRAY01");
    await page.getByText("TEST-TRAY01", { exact: true }).last().click();
    await page.locator(byId("save-driver-btn")).click();

    await expect.poll(getDriver, { timeout: RCTI_ACTION_TIMEOUT }).toEqual({
      driver: firstName,
      lastName: "NGUYEN",
      isArchived: false,
    });
    await expect(driverRow()).toContainText(`${firstName} NGUYEN`, {
      timeout: RCTI_ACTION_TIMEOUT,
    });
  });

  test("finds the driver by last name", async () => {
    await page.locator(byId("global-search-input")).fill("nguyen");

    await expect(driverRow()).toBeVisible();
    await page.locator(byId("global-search-input")).fill("");
  });

  test("archives and restores the driver", async () => {
    await driverRow().locator(byId("row-actions-trigger")).click();
    await page.locator(byId("row-action-archive")).click();

    await expect.poll(getDriver, { timeout: RCTI_ACTION_TIMEOUT }).toMatchObject({
      isArchived: true,
    });
    await page.locator(byId("archived-drivers-tab")).click();
    await expect(driverRow()).toContainText("Archived", {
      timeout: RCTI_ACTION_TIMEOUT,
    });

    await driverRow().locator(byId("row-actions-trigger")).click();
    await page.locator(byId("row-action-restore")).click();

    await expect.poll(getDriver, { timeout: RCTI_ACTION_TIMEOUT }).toMatchObject({
      isArchived: false,
    });
  });
});
