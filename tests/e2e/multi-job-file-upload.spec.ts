import { test, expect, Page } from "@playwright/test";
import { login } from "../helpers/auth";
import path from "path";

test.describe.configure({ mode: "serial" });

let page: Page;

test.describe("Multi-Job File Upload", () => {
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("should navigate to jobs page and verify jobs are loaded", async () => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs/);
    await page.waitForLoadState("networkidle");

    // Wait for the table to load with job rows
    const tableRows = page.locator("tr").filter({ hasText: "Test Driver" });
    await tableRows.first().waitFor({ state: "visible", timeout: 10000 });

    await page.screenshot({
      path: "playwright-report/multi-job-upload-01-jobs-loaded.png",
      fullPage: true,
    });
  });

  test("should select multiple jobs using row checkboxes", async () => {
    // Find all checkbox elements that match the row selection pattern
    const rowCheckboxes = page.locator('[id^="select-row-"][id$="-checkbox"]');
    const checkboxCount = await rowCheckboxes.count();
    expect(checkboxCount).toBeGreaterThanOrEqual(2);

    // Select the first two job rows
    await rowCheckboxes.nth(0).click();
    await expect(rowCheckboxes.nth(0)).toBeChecked();
    await rowCheckboxes.nth(1).click();

    // Verify both checkboxes are now checked
    await expect(rowCheckboxes.nth(0)).toBeChecked();
    await expect(rowCheckboxes.nth(1)).toBeChecked();

    await page.screenshot({
      path: "playwright-report/multi-job-upload-02-rows-selected.png",
      fullPage: true,
    });
  });

  test("should show bulk action toolbar with Attach Files button", async () => {
    // The bulk action toolbar should appear after selecting rows
    const bulkAttachBtn = page.locator("#bulk-attach-files-btn");
    await bulkAttachBtn.waitFor({ state: "visible", timeout: 5000 });
    await expect(bulkAttachBtn).toBeVisible();

    // Verify the button text
    await expect(bulkAttachBtn).toContainText("Attach Files");

    await page.screenshot({
      path: "playwright-report/multi-job-upload-03-bulk-toolbar.png",
      fullPage: true,
    });
  });

  test("should open multi-job upload dialog when clicking Attach Files", async () => {
    const bulkAttachBtn = page.locator("#bulk-attach-files-btn");
    await bulkAttachBtn.click();

    const dialog = page.locator("#multi-job-attachment-upload-dialog");
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    await expect(dialog).toBeVisible();

    // Verify the dialog title mentions the number of selected jobs
    await expect(dialog).toContainText("Upload Attachments");
    await expect(dialog).toContainText("2 Jobs Selected");

    await page.screenshot({
      path: "playwright-report/multi-job-upload-04-dialog-open.png",
      fullPage: true,
    });
  });

  test("should display per-job drop zones for each selected job", async () => {
    // Each selected job should have its own drop zone
    const dropZones = page.locator('[id^="job-drop-zone-"]');
    const dropZoneCount = await dropZones.count();
    expect(dropZoneCount).toBe(2);

    // Verify both drop zones are visible
    await expect(dropZones.nth(0)).toBeVisible();
    await expect(dropZones.nth(1)).toBeVisible();

    // Verify drop zones have the expected instruction text
    await expect(dropZones.nth(0)).toContainText(
      "Drop files or click to select",
    );
    await expect(dropZones.nth(1)).toContainText(
      "Drop files or click to select",
    );

    await page.screenshot({
      path: "playwright-report/multi-job-upload-05-drop-zones.png",
      fullPage: true,
    });
  });

  test("should upload a file to the first job drop zone", async () => {
    const testFilePath = path.resolve(
      __dirname,
      "../resources/example-runsheet.pdf",
    );

    // Get the first job drop zone ID to extract the job ID
    const firstDropZone = page.locator('[id^="job-drop-zone-"]').first();
    const firstDropZoneId = await firstDropZone.getAttribute("id");
    const firstJobId = firstDropZoneId?.replace("job-drop-zone-", "");
    expect(firstJobId).toBeTruthy();

    // Use the hidden file input for the first job
    const firstFileInput = page.locator(
      `#multi-hidden-file-input-${firstJobId}`,
    );
    await firstFileInput.setInputFiles(testFilePath);

    const dialog = page.locator("#multi-job-attachment-upload-dialog");
    await expect(dialog.getByText("example-runsheet")).toBeVisible({
      timeout: 5000,
    });

    // Verify the file count badge shows "1 file" for the first job
    const firstJobSection = page
      .locator('[id^="job-drop-zone-"]')
      .first()
      .locator("../..");
    await expect(firstJobSection).toContainText("1 file");

    await page.screenshot({
      path: "playwright-report/multi-job-upload-06-first-file-added.png",
      fullPage: true,
    });
  });

  test("should default the attachment type to Runsheet", async () => {
    // Find the attachment type selector for the uploaded file
    const typeSelectors = page.locator('[id^="multi-type-"]');
    const selectorCount = await typeSelectors.count();
    expect(selectorCount).toBeGreaterThanOrEqual(1);

    // Verify the default type is "Runsheet"
    const firstTypeSelector = typeSelectors.first();
    await expect(firstTypeSelector).toContainText("Runsheet");

    await page.screenshot({
      path: "playwright-report/multi-job-upload-07-default-type.png",
      fullPage: true,
    });
  });

  test("should upload a file to the second job drop zone", async () => {
    const testFilePath = path.resolve(
      __dirname,
      "../resources/example-runsheet.pdf",
    );

    // Get the second job drop zone ID to extract the job ID
    const secondDropZone = page.locator('[id^="job-drop-zone-"]').nth(1);
    const secondDropZoneId = await secondDropZone.getAttribute("id");
    const secondJobId = secondDropZoneId?.replace("job-drop-zone-", "");
    expect(secondJobId).toBeTruthy();

    // Use the hidden file input for the second job
    const secondFileInput = page.locator(
      `#multi-hidden-file-input-${secondJobId}`,
    );
    await secondFileInput.setInputFiles(testFilePath);

    const uploadBtn = page.locator("#multi-upload-files-btn");
    await expect(uploadBtn).toContainText("Upload 2 Files", { timeout: 5000 });

    // Verify the dialog footer shows files across both jobs
    const dialog = page.locator("#multi-job-attachment-upload-dialog");
    await expect(dialog).toContainText("2 files across 2 jobs");

    await page.screenshot({
      path: "playwright-report/multi-job-upload-08-both-files-added.png",
      fullPage: true,
    });
  });

  test("should allow removing a file from a job", async () => {
    // Find a remove button for any file
    const removeButtons = page.locator('[id^="multi-remove-"]');
    const removeCount = await removeButtons.count();
    expect(removeCount).toBeGreaterThanOrEqual(2);

    // Remove the first file
    await removeButtons.first().click();

    const uploadBtn = page.locator("#multi-upload-files-btn");
    await expect(uploadBtn).toContainText("Upload 1 File", { timeout: 5000 });

    await page.screenshot({
      path: "playwright-report/multi-job-upload-09-file-removed.png",
      fullPage: true,
    });
  });

  test("should close the dialog when clicking Cancel", async () => {
    const cancelBtn = page.locator("#multi-cancel-upload-btn");
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    const dialog = page.locator("#multi-job-attachment-upload-dialog");
    await expect(dialog).not.toBeVisible();

    await page.screenshot({
      path: "playwright-report/multi-job-upload-10-dialog-closed.png",
      fullPage: true,
    });
  });

  test("should clear row selection after closing dialog", async () => {
    // Use the "Clear selection" button in the bulk toolbar to deselect all rows
    // (The select-all checkbox may be in indeterminate state, making isChecked() unreliable)
    const clearSelectionBtn = page.locator("#clear-selection-btn");
    await clearSelectionBtn.waitFor({ state: "visible", timeout: 5000 });
    await clearSelectionBtn.click();

    const bulkAttachBtn = page.locator("#bulk-attach-files-btn");
    await expect(bulkAttachBtn).not.toBeVisible();

    await page.screenshot({
      path: "playwright-report/multi-job-upload-11-cleaned-up.png",
      fullPage: true,
    });
  });

  test("should re-open dialog and verify select-all selects multiple jobs", async () => {
    // Use select-all to select all visible rows
    const selectAllCheckbox = page.locator("#select-all-checkbox");
    await selectAllCheckbox.click();

    const bulkAttachBtn = page.locator("#bulk-attach-files-btn");
    await bulkAttachBtn.waitFor({ state: "visible", timeout: 5000 });

    // Open the dialog
    await bulkAttachBtn.click();

    const dialog = page.locator("#multi-job-attachment-upload-dialog");
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    await expect(dialog).toContainText("Jobs Selected");

    // Verify there are multiple drop zones
    const dropZones = page.locator('[id^="job-drop-zone-"]');
    const dropZoneCount = await dropZones.count();
    expect(dropZoneCount).toBeGreaterThanOrEqual(2);

    // Verify "No files added yet" text when no files staged
    await expect(dialog).toContainText("No files added yet");

    // Verify the upload button is disabled when no files are added
    const uploadBtn = page.locator("#multi-upload-files-btn");
    await expect(uploadBtn).toBeDisabled();

    await page.screenshot({
      path: "playwright-report/multi-job-upload-12-select-all-dialog.png",
      fullPage: true,
    });

    // Close the dialog to clean up
    const cancelBtn = page.locator("#multi-cancel-upload-btn");
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();

    await selectAllCheckbox.click();
    await expect(selectAllCheckbox).not.toBeChecked();
  });
});
