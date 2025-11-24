import { test, expect } from "@playwright/test";
import { login } from "../helpers/auth";

test.describe.configure({ mode: "serial" });

let page;

test.describe("Smoke Tests", () => {
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("should load overview page", async () => {
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/overview/);
    await page.waitForLoadState("networkidle");
  });

  test("should load jobs page", async () => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs/);
    await page.waitForLoadState("networkidle");
  });

  test("should load customers page", async () => {
    await page.goto("/customers");
    await expect(page).toHaveURL(/\/customers/);
    await page.waitForLoadState("networkidle");
  });

  test("should load vehicles page", async () => {
    await page.goto("/vehicles");
    await expect(page).toHaveURL(/\/vehicles/);
    await page.waitForLoadState("networkidle");
  });

  test("should load drivers page", async () => {
    await page.goto("/drivers");
    await expect(page).toHaveURL(/\/drivers/);
    await page.waitForLoadState("networkidle");
  });

  test("should load history page", async () => {
    await page.goto("/settings/history");
    await expect(page).toHaveURL(/\/settings\/history/);
    await page.waitForLoadState("networkidle");
  });

  test("should load integrations page", async () => {
    await page.goto("/settings/integrations");
    await expect(page).toHaveURL(/\/settings\/integrations/);
    await page.waitForLoadState("networkidle");
  });
});

test.describe("Public Pages", () => {
  test("should load landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await page.waitForLoadState("networkidle");
  });

  test("should load sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/sign-in/);
    await page.waitForLoadState("networkidle");
  });
});
