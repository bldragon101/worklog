import { test, expect, type Page } from "@playwright/test";
import { getNonAdminCredentials, waitForSession } from "../helpers/auth";
import { NON_ADMIN_STORAGE_STATE } from "../helpers/storage-state";

// Runs as TEST_NON_ADMIN_USER, a signed-in user without admin rights. The
// RCTI and jobs report pages and every RCTI API route are admin only.
test.skip(
  !getNonAdminCredentials(),
  "TEST_NON_ADMIN_USER and TEST_NON_ADMIN_PASS are not set",
);
test.use({ storageState: NON_ADMIN_STORAGE_STATE });

const adminOnlyPages = [
  "/rcti",
  "/jobs-report",
  "/settings/users",
  "/settings/history",
  "/settings/admin/integrations",
];

const rctiApiCalls: Array<{ method: "GET" | "POST"; path: string; data?: unknown }> = [
  { method: "GET", path: "/api/rcti" },
  { method: "POST", path: "/api/rcti", data: {} },
  { method: "POST", path: "/api/rcti/pay-batch", data: { ids: [1] } },
  { method: "POST", path: "/api/rcti/1/finalize", data: {} },
  { method: "POST", path: "/api/rcti/1/pay" },
  { method: "POST", path: "/api/rcti/1/unfinalize" },
  { method: "POST", path: "/api/rcti/1/revert", data: { reason: "Testing access" } },
  { method: "POST", path: "/api/rcti/1/refresh" },
  { method: "POST", path: "/api/rcti/1/lines", data: { jobIds: [1] } },
  { method: "GET", path: "/api/rcti/1/available-jobs" },
  { method: "GET", path: "/api/rcti/1/pdf" },
  { method: "GET", path: "/api/rcti-deductions" },
  { method: "POST", path: "/api/rcti-deductions", data: {} },
  { method: "GET", path: "/api/rcti-deductions/pending?driverId=1&weekEnding=2026-09-20" },
  { method: "GET", path: "/api/rcti-settings" },
  { method: "POST", path: "/api/rcti-settings", data: {} },
  { method: "GET", path: "/api/jobs-report" },
];

async function openOverview({ page }: { page: Page }) {
  await waitForSession({ page });
  await expect(page).toHaveURL(/\/overview/);
}

test.describe("Non-admin user", () => {
  test("is signed in and can use the jobs API", async ({ page }) => {
    await openOverview({ page });

    const response = await page.request.get("/api/jobs");
    expect(response.status()).toBe(200);
  });

  test("does not see the Financial menu", async ({ page }) => {
    await openOverview({ page });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("link", { name: "RCTI", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Jobs Report", exact: true })).toHaveCount(0);
  });

  for (const path of adminOnlyPages) {
    test(`is sent back to the overview from ${path}`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/overview\?access=denied/);
    });
  }

  for (const { method, path, data } of rctiApiCalls) {
    test(`is refused ${method} ${path}`, async ({ page }) => {
      await openOverview({ page });

      const response = await page.request.fetch(path, { method, data });

      expect(response.status()).toBe(403);
    });
  }
});
