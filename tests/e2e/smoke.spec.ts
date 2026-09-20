import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("should load overview page", async ({ page }) => {
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/overview/);
    await page.waitForLoadState("networkidle");
  });

  test("should load jobs page", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs/);
    await page.waitForLoadState("networkidle");
  });

  test("should load customers page", async ({ page }) => {
    await page.goto("/customers");
    await expect(page).toHaveURL(/\/customers/);
    await page.waitForLoadState("networkidle");
  });

  test("should load vehicles page", async ({ page }) => {
    await page.goto("/vehicles");
    await expect(page).toHaveURL(/\/vehicles/);
    await page.waitForLoadState("networkidle");
  });

  test("should load drivers page", async ({ page }) => {
    await page.goto("/drivers");
    await expect(page).toHaveURL(/\/drivers/);
    await page.waitForLoadState("networkidle");
  });

  test("should load history page", async ({ page }) => {
    await page.goto("/settings/history");
    await expect(page).toHaveURL(/\/settings\/history/);
    await page.waitForLoadState("networkidle");
  });

  test("should load integrations page", async ({ page }) => {
    await page.goto("/settings/admin/integrations");
    await expect(page).toHaveURL(/\/settings\/admin\/integrations/);
    await page.waitForLoadState("networkidle");
  });
});

test.describe("Public Pages", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

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
