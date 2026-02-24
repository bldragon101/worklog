import { test, expect, Page } from "@playwright/test";
import { login } from "../helpers/auth";

test.describe.configure({ mode: "serial" });

let page: Page;

test.describe("Job Creation", () => {
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("should create a job and manually check runsheet checkbox", async () => {
    // Navigate to jobs page
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs/);
    await page.waitForLoadState("networkidle");

    // Click the "Add" button to open job creation dialog
    const addButton = page.getByRole("button", { name: "Add", exact: true });
    await addButton.waitFor({ state: "visible", timeout: 10000 });
    await addButton.click();

    // Wait for the dialog to appear
    await page.waitForSelector('text="Add Job"', { timeout: 10000 });

    // Wait for form fields to load (they start as "Loading...")
    await page.waitForSelector('text="Select driver"', { timeout: 10000 });

    // Fill in Driver field using keyboard navigation
    await page.click("#driver-select");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Fill in Truck Type using keyboard navigation
    await page.click("#trucktype-select");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown"); // Select Semi Trailer
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Fill in Customer using keyboard navigation
    await page.click("#customer-select");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Bill To should auto-populate, Registration should auto-populate

    // Fill in Pickup location - use keyboard to fill and select
    await page.click('button:has-text("Search pickup")');
    await page.waitForTimeout(500);
    await page.keyboard.type("Melbourne");
    await page.waitForTimeout(2000); // Wait for API call
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Scroll down in the dialog to find the runsheet checkbox
    await page.evaluate(() => {
      const content = document.querySelector(".overflow-y-auto");
      if (content) {
        content.scrollTop = content.scrollHeight;
      }
    });
    await page.waitForTimeout(300);

    // Manually check the runsheet checkbox
    const runsheetCheckbox = page.locator('input[name="runsheet"]');
    await runsheetCheckbox.waitFor({ state: "visible", timeout: 5000 });
    await runsheetCheckbox.check();
    await page.waitForTimeout(300);

    // Verify the checkbox is checked
    await expect(runsheetCheckbox).toBeChecked();

    // Click Save button to create the job
    await page.click('button:has-text("Save")');

    // Wait for the job to be created and dialog to close
    await page.waitForTimeout(2000);

    // Wait for success toast or dialog to close
    const dialogGone = page.waitForSelector('text="Add Job"', {
      state: "hidden",
      timeout: 10000,
    });
    await dialogGone.catch(() => {
      // Dialog might already be closed
    });

    await page.waitForLoadState("networkidle");

    // Find the newly created job row
    // Look for a row with the first driver and first customer
    const jobRow = page
      .locator("tr")
      .filter({ hasText: "Test Driver Alpha" })
      .filter({ hasText: "Test Customer Acme" })
      .first();

    await jobRow.waitFor({ state: "visible", timeout: 10000 });

    // Verify the job row shows runsheet indicator
    const runsheetInRow = jobRow.locator('text="Runsheet"');
    await expect(runsheetInRow).toBeVisible({ timeout: 5000 });

    // Open the job to verify runsheet checkbox is still checked
    const openMenuButton = jobRow.locator('button:has-text("Open menu")');
    await openMenuButton.click();
    await page.waitForTimeout(500);

    const editOption = page.locator('text="Edit"').first();
    await editOption.click();
    await page.waitForTimeout(1000);

    // Wait for the edit dialog to appear
    await page.waitForSelector('text="Edit Job"', { timeout: 10000 });

    // Scroll down to find the runsheet checkbox
    await page.evaluate(() => {
      const content = document.querySelector(".overflow-y-auto");
      if (content) {
        content.scrollTop = content.scrollHeight;
      }
    });
    await page.waitForTimeout(500);

    // Verify runsheet checkbox is still checked
    const runsheetCheckboxInEdit = page.locator('input[name="runsheet"]');
    await expect(runsheetCheckboxInEdit).toBeChecked();

    // Close the dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Verify we're back on the jobs list
    await expect(page).toHaveURL(/\/jobs/);

    // Take a screenshot for verification
    await page.screenshot({
      path: "playwright-report/job-with-runsheet-checkbox.png",
      fullPage: true,
    });
  });
});
