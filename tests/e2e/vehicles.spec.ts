import { test, expect, type Page } from "@playwright/test";
import { STORAGE_STATE } from "../helpers/storage-state";
import {
  buildE2eTag,
  cleanupE2eData,
  disconnectE2eDb,
  getE2eDb,
} from "../helpers/e2e-db";
import { buildE2eRegistration } from "../helpers/e2e-scenarios";
import { byId, RCTI_ACTION_TIMEOUT } from "../helpers/rcti-page";

test.describe.configure({ mode: "serial", timeout: 120_000 });

let page: Page;
let tag: string;
let registration: string;

function vehicleRow() {
  return page.locator("tr", { hasText: registration }).first();
}

async function getVehicle() {
  const { rows } = await getE2eDb().query(
    `SELECT registration, make, model, "yearOfManufacture", type, "carryingCapacity"
     FROM "Vehicle" WHERE registration = $1`,
    [registration],
  );
  return rows[0] ?? null;
}

async function showOnlyThisVehicle() {
  await page.locator(byId("global-search-input")).fill(registration);
  await expect(vehicleRow()).toBeVisible({ timeout: RCTI_ACTION_TIMEOUT });
}

test.describe("Vehicles", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    tag = buildE2eTag({ testInfo });
    registration = buildE2eRegistration({ tag, key: "TRUCK" });
    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    await cleanupE2eData({ db: getE2eDb(), tag });
    await disconnectE2eDb();
  });

  test("adds a vehicle", async () => {
    await page.goto("/vehicles");
    await page.waitForLoadState("networkidle");
    await page.locator(byId("add-vehicle-btn")).click();

    await page.locator(byId("registration")).fill(registration);
    await page.locator(byId("expiryDate")).fill("2027-06-30");
    await page.locator(byId("make")).fill("HINO");
    await page.locator(byId("model")).fill("500");
    await page.locator(byId("yearOfManufacture")).fill("2022");
    await page.locator(byId("type")).click();
    await page.getByRole("option", { name: "TRAY", exact: true }).click();
    await page.locator(byId("carryingCapacity")).fill("8T");
    await page.locator(byId("vehicle-form-submit-btn")).click();

    await expect.poll(getVehicle, { timeout: RCTI_ACTION_TIMEOUT }).toEqual({
      registration,
      make: "HINO",
      model: "500",
      yearOfManufacture: 2022,
      type: "TRAY",
      carryingCapacity: "8T",
    });
    await showOnlyThisVehicle();
    await expect(vehicleRow()).toContainText("HINO");
  });

  test("edits the vehicle", async () => {
    await vehicleRow().locator(byId("row-actions-trigger")).click();
    await page.locator(byId("row-action-edit")).click();

    await expect(page.locator(byId("registration"))).toHaveValue(registration);
    await page.locator(byId("model")).fill("500 Series");
    await page.locator(byId("carryingCapacity")).fill("9T");
    await page.locator(byId("vehicle-form-submit-btn")).click();

    await expect
      .poll(getVehicle, { timeout: RCTI_ACTION_TIMEOUT })
      .toMatchObject({ model: "500 Series", carryingCapacity: "9T" });
    await expect(vehicleRow()).toContainText("500 Series", {
      timeout: RCTI_ACTION_TIMEOUT,
    });
  });

  test("deletes the vehicle after one confirmation", async () => {
    await vehicleRow().locator(byId("row-actions-trigger")).click();
    await page.locator(byId("row-action-delete")).click();
    await expect(page.locator(byId("delete-confirmation-dialog"))).toBeVisible();
    await page.locator(byId("confirm-delete-btn")).click();

    await expect.poll(getVehicle, { timeout: RCTI_ACTION_TIMEOUT }).toBeNull();
    await expect(page.locator(byId("delete-confirmation-dialog"))).toHaveCount(0);
    await expect(page.locator("tr", { hasText: registration })).toHaveCount(0, {
      timeout: RCTI_ACTION_TIMEOUT,
    });
  });
});
