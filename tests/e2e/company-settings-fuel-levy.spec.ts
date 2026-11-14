import { test, expect, type Page } from "@playwright/test";
import { STORAGE_STATE } from "../helpers/storage-state";
import { disconnectE2eDb, getE2eDb } from "../helpers/e2e-db";
import { byId, RCTI_ACTION_TIMEOUT } from "../helpers/rcti-page";

// The default fuel levy is one shared company settings row. Only the main
// Chromium project changes it, so parallel browser projects never race each
// other, and the original value is put back afterwards.
test.describe.configure({ mode: "serial", timeout: 120_000 });

const FUEL_LEVY_CANDIDATES = ["17.25", "18.75"];

let page: Page;
let testFuelLevy = FUEL_LEVY_CANDIDATES[0];
let originalFuelLevy: number | null = null;
let hasCompanySettings = false;

async function getDefaultFuelLevy() {
  const { rows } = await getE2eDb().query(
    `SELECT "defaultFuelLevy" FROM "CompanySettings" ORDER BY id LIMIT 1`,
  );
  return rows[0]?.defaultFuelLevy ?? null;
}

test.describe("Company settings default fuel levy", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Changes a shared settings row, so it runs in one browser project only",
    );
    const { rows } = await getE2eDb().query(
      `SELECT "defaultFuelLevy" FROM "CompanySettings" ORDER BY id LIMIT 1`,
    );
    hasCompanySettings = rows.length > 0;
    test.skip(
      !hasCompanySettings,
      "Company details must be saved before a default fuel levy can be set",
    );
    originalFuelLevy = rows[0].defaultFuelLevy;
    testFuelLevy =
      FUEL_LEVY_CANDIDATES.find(
        (candidate) => Number(candidate) !== Number(originalFuelLevy),
      ) ?? FUEL_LEVY_CANDIDATES[0];
    page = await browser.newPage({ storageState: STORAGE_STATE });
  });

  test.afterAll(async () => {
    await page?.close();
    if (hasCompanySettings) {
      await getE2eDb().query(
        `UPDATE "CompanySettings" SET "defaultFuelLevy" = $1, "updatedAt" = NOW()
         WHERE id = (SELECT id FROM "CompanySettings" ORDER BY id LIMIT 1)`,
        [originalFuelLevy],
      );
    }
    await disconnectE2eDb();
  });

  test("saves a custom default fuel levy", async () => {
    await page.goto("/settings/admin");
    await page.locator(byId("default-fuel-levy-select")).click();
    await page.getByRole("option", { name: "Custom", exact: true }).click();
    await page.locator(byId("default-fuel-levy-select-custom")).fill(testFuelLevy);
    await page.locator(byId("save-default-fuel-levy-btn")).click();

    await expect
      .poll(getDefaultFuelLevy, { timeout: RCTI_ACTION_TIMEOUT })
      .toBe(Number(testFuelLevy));
    await expect(page.locator(byId("sidebar-fuel-levy-notice"))).toContainText(
      `${testFuelLevy}%`,
      { timeout: RCTI_ACTION_TIMEOUT },
    );
  });

  test("prefills the default on a new customer", async () => {
    await page.goto("/customers");
    await page.waitForLoadState("networkidle");
    await page.locator(byId("add-customer-btn")).click();

    await expect(page.locator(byId("fuel-levy-select-custom"))).toHaveValue(
      testFuelLevy,
    );
    await expect(
      page.getByText(`Default fuel levy is ${testFuelLevy}%`),
    ).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("clears the default fuel levy", async () => {
    await page.goto("/settings/admin");
    await page.locator(byId("clear-default-fuel-levy-btn")).click();

    await expect
      .poll(getDefaultFuelLevy, { timeout: RCTI_ACTION_TIMEOUT })
      .toBeNull();
    await expect(page.locator(byId("sidebar-fuel-levy-notice"))).toContainText(
      "Not set",
      { timeout: RCTI_ACTION_TIMEOUT },
    );
  });
});
