import { test, expect, Page } from "@playwright/test";
import { login } from "../helpers/auth";
import path from "path";

test.describe.configure({ mode: "serial" });

let page: Page;

test.describe("Job Creation with Staged Files", () => {
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("should navigate to jobs page and open new job form", async () => {
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

    await page.screenshot({
      path: "playwright-report/staged-files-01-add-job-dialog.png",
      fullPage: true,
    });
  });

  test("should fill in required job fields", async () => {
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
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Fill in Customer using keyboard navigation
    await page.click("#customer-select");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Fill in Pickup location
    await page.click('button:has-text("Search pickup")');
    await page.waitForTimeout(500);
    await page.keyboard.type("Melbourne");
    await page.waitForTimeout(2000);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "playwright-report/staged-files-02-fields-filled.png",
      fullPage: true,
    });
  });

  test("should switch to Attachments tab and verify staging drop zone is visible", async () => {
    // Switch to the Attachments tab
    const attachmentsTab = page.getByRole("tab", { name: "Attachments" });
    await attachmentsTab.waitFor({ state: "visible", timeout: 5000 });
    await attachmentsTab.click();
    await page.waitForTimeout(500);

    // Verify the staging drop zone is visible (this is the new job path, not "Save Job First")
    const dropZone = page.locator("#staged-file-drop-zone");
    await expect(dropZone).toBeVisible({ timeout: 5000 });

    // Verify "Save Job First" text is NOT shown — new jobs should show the staging UI
    const saveFirstMessage = page.locator('text="Save Job First"');
    await expect(saveFirstMessage).not.toBeVisible();

    // Verify the drop zone has the expected instructional text
    await expect(
      page.locator("text=Drag and drop files here, or click to select"),
    ).toBeVisible();

    // Verify the "Files will be uploaded when you save the job" message is visible
    await expect(
      page.locator("text=Files will be uploaded when you save the job"),
    ).toBeVisible();

    await page.screenshot({
      path: "playwright-report/staged-files-03-attachments-tab-drop-zone.png",
      fullPage: true,
    });
  });

  test("should stage a file via the hidden file input", async () => {
    const attachmentPath = path.resolve(
      __dirname,
      "../resources/example-runsheet.pdf",
    );

    // Use the hidden file input for staging
    const fileInput = page.locator("#staged-hidden-file-input");
    await fileInput.setInputFiles(attachmentPath);
    await page.waitForTimeout(1000);

    // Verify the file appears in the staged list
    await page.waitForSelector("text=/example-runsheet/i", { timeout: 5000 });
    await expect(page.locator("text=example-runsheet.pdf")).toBeVisible();

    // Verify the "Staged Files" heading is visible with the count
    await expect(page.locator("text=Staged Files (1)")).toBeVisible();

    await page.screenshot({
      path: "playwright-report/staged-files-04-file-staged.png",
      fullPage: true,
    });
  });

  test("should have Runsheet as default attachment type for staged file", async () => {
    // The first staged file's type selector should default to "runsheet"
    const typeSelector = page.locator('[id^="staged-attachment-type-"]').first();
    await expect(typeSelector).toBeVisible({ timeout: 5000 });

    // Verify the type selector displays "Runsheet" as the default value
    await expect(typeSelector).toHaveText(/Runsheet/);

    await page.screenshot({
      path: "playwright-report/staged-files-05-default-type-runsheet.png",
      fullPage: true,
    });
  });

  test("should show the informational message about upload on save", async () => {
    // Verify the message explaining files upload on save
    const uploadMessage = page.locator(
      "text=Files will be uploaded when you save the job",
    );
    await expect(uploadMessage).toBeVisible();
  });

  test("should verify staged file has a remove button", async () => {
    // Verify the remove button exists for the staged file
    const removeButton = page.locator('[id^="remove-staged-file-"]').first();
    await expect(removeButton).toBeVisible({ timeout: 5000 });
  });

  test("should switch back to Job Details tab and save", async () => {
    // Switch back to Job Details tab
    const detailsTab = page.getByRole("tab", { name: "Job Details" });
    await detailsTab.waitFor({ state: "visible", timeout: 5000 });
    await detailsTab.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: "playwright-report/staged-files-06-back-to-details.png",
      fullPage: true,
    });

    // Click Save
    await page.click('button:has-text("Save")');

    // Wait for save + potential upload to complete
    await page.waitForTimeout(3000);

    // Handle validation errors if they appear
    const validationDialog = page.locator('text="Required Fields Missing"');
    const hasValidation = await validationDialog
      .isVisible()
      .catch(() => false);

    if (hasValidation) {
      const missingFieldsList = await page
        .locator('[role="alertdialog"] ul li')
        .allTextContents();

      await page.screenshot({
        path: "playwright-report/staged-files-07-validation-error.png",
        fullPage: true,
      });

      await page.click('button:has-text("OK")');
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
      throw new Error(
        `Validation error - required fields missing: ${missingFieldsList.join(", ")}`,
      );
    }

    await page.screenshot({
      path: "playwright-report/staged-files-07-after-save.png",
      fullPage: true,
    });
  });

  test("should confirm job was created after save", async () => {
    // The dialog should close after saving — wait for it to disappear
    // The save might trigger a toast about attachments (success or failure)
    // Either outcome is acceptable in test environments where Drive may not be configured

    // Wait for dialog to close (job saved successfully)
    const dialogGone = page
      .waitForSelector('text="Add Job"', {
        state: "hidden",
        timeout: 15000,
      })
      .catch(() => null);

    // Also check for toast messages that indicate save outcome
    const successToast = page
      .waitForSelector(
        'text=/Job saved|saved with attachments|saved, attachments failed/i',
        { timeout: 15000 },
      )
      .catch(() => null);

    await Promise.race([dialogGone, successToast]);
    await page.waitForTimeout(1000);

    await page.waitForLoadState("networkidle");

    await page.screenshot({
      path: "playwright-report/staged-files-08-job-created.png",
      fullPage: true,
    });

    // Verify we can see a job row with the expected driver and customer
    const jobRow = page
      .locator("tr")
      .filter({ hasText: "Test Driver Alpha" })
      .filter({ hasText: "Test Customer Acme" })
      .first();

    await jobRow.waitFor({ state: "visible", timeout: 10000 });
    await expect(jobRow).toBeVisible();

    await page.screenshot({
      path: "playwright-report/staged-files-09-job-in-table.png",
      fullPage: true,
    });
  });
});
