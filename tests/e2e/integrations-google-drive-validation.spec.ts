import { test, expect, Page } from "@playwright/test";
import { login } from "../helpers/auth";

test.describe.configure({ mode: "serial" });

let page: Page;

test.describe("Google Drive Integration Validation", () => {
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("should validate Google Drive service account with test_worklog folder", async () => {
    // Navigate to integrations page
    await page.goto("/settings/admin/integrations");
    await expect(page).toHaveURL(/\/settings\/admin\/integrations/);
    await page.waitForLoadState("networkidle");

    // Verify Google Drive tab is visible and active
    const googleDriveTab = page.getByRole("tab", {
      name: "Google Drive",
    });
    await expect(googleDriveTab).toBeVisible({ timeout: 10000 });
    await expect(googleDriveTab).toHaveAttribute("aria-selected", "true");

    // Verify connection status and active badge are present
    const connectedText = page.getByText("Connected to Google Drive");
    await expect(connectedText).toBeVisible({ timeout: 5000 });
    const activeBadge = page.getByText("Active", { exact: true });
    await expect(activeBadge).toBeVisible({ timeout: 5000 });

    // Click Load Drives button
    const loadDrivesBtn = page.getByRole("button", {
      name: "Load Drives",
    });
    await expect(loadDrivesBtn).toBeVisible({ timeout: 5000 });
    await loadDrivesBtn.click();

    // Wait for drives to load
    await page.waitForTimeout(2000);

    // Verify Google Drive Storage section appears
    const driveStorageHeading = page.getByRole("heading", {
      name: "Google Drive Storage",
    });
    await expect(driveStorageHeading).toBeVisible({ timeout: 10000 });

    // Select a shared drive (skip My Drive) since test_worklog is on a shared drive
    const driveSelect = page.locator("#shared-drive-select");
    await expect(driveSelect).toBeVisible({ timeout: 5000 });
    const options = driveSelect.locator("option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(2);

    let sharedDriveValue: string | null = null;
    for (let i = 1; i < optionCount; i++) {
      const optionValue = await options.nth(i).getAttribute("value");
      if (optionValue && optionValue !== "my-drive") {
        sharedDriveValue = optionValue;
        break;
      }
    }
    expect(sharedDriveValue).toBeTruthy();
    await driveSelect.selectOption(sharedDriveValue!);
    const selectedValue = await driveSelect.inputValue();
    expect(selectedValue).toBeTruthy();
    expect(selectedValue).not.toBe("my-drive");

    // Click Browse button to open directory browser
    const browseFolderBtn = page.getByRole("button", { name: "Browse" });
    await expect(browseFolderBtn).toBeVisible({ timeout: 5000 });
    await browseFolderBtn.click();

    // Wait for directory browser dialog to appear
    const dialog = page.getByRole("dialog", {
      name: "Select Google Drive Folder",
    });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Wait for folders to load - increased timeout for slower loads
    await page.waitForTimeout(3000);

    // Wait for "Loading files..." to disappear
    const loadingText = page.getByText("Loading files...");
    await expect(loadingText).not.toBeVisible({ timeout: 15000 });

    // Look for test_worklog folder within the dialog
    // Find the row containing test_worklog and click it
    const testWorklogRow = dialog.getByText("test_worklog", { exact: true });
    await expect(testWorklogRow).toBeVisible({ timeout: 10000 });

    // Click on test_worklog to select it
    await testWorklogRow.click({ force: true });
    await page.waitForTimeout(500);

    // Verify folder is selected by checking for "Selected:" text
    const selectedText = page.getByText("Selected:");
    await expect(selectedText).toBeVisible({ timeout: 5000 });

    // Click Select button in directory browser
    const selectButton = page
      .getByRole("button", { name: "Select", exact: true })
      .last();
    await expect(selectButton).toBeEnabled({ timeout: 5000 });
    await selectButton.click();
    await page.waitForTimeout(1000);

    // Verify directory browser closed
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify selected folder is displayed in the UI
    const folderLabel = page.getByText("Folder:");
    await expect(folderLabel).toBeVisible({ timeout: 5000 });

    // Verify test_worklog is shown next to Folder label
    const folderValue = page
      .locator('text="Folder:"')
      .locator("..")
      .getByText("test_worklog");
    await expect(folderValue).toBeVisible({ timeout: 5000 });

    // Verify Job Attachments badge is visible
    const jobAttachmentsBadge = page.getByText("Job Attachments");
    const badgeVisible = await jobAttachmentsBadge
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Wait for any saving operations to complete
    await page.waitForTimeout(2000);

    // Test upload functionality
    const testUploadBtn = page.getByRole("button", { name: "Test Upload" });
    await expect(testUploadBtn).toBeEnabled({ timeout: 5000 });
    await testUploadBtn.click();

    // Wait for upload to complete and check for success toast
    await page.waitForTimeout(3000);

    // Check for toast notification
    const successToast = page.getByText(/Upload Successful|successful/i);
    const toastVisible = await successToast
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Verify the Storage Location configuration section
    const storageLocationLabel = page.getByText("Storage Location:");
    await expect(storageLocationLabel).toBeVisible({ timeout: 5000 });

    // Verify test_worklog is shown as the storage location
    const storageLocationValue = page
      .locator('text="Storage Location:"')
      .locator("..")
      .getByText("test_worklog");
    await expect(storageLocationValue).toBeVisible({ timeout: 5000 });

    // Verify configuration is active
    const configActiveBadge = page.getByText("Configuration Active");
    await expect(configActiveBadge).toBeVisible({ timeout: 5000 });

    // Verify organisation structure is displayed
    const organisationStructure = page.getByText("Organisation Structure:");
    await expect(organisationStructure).toBeVisible({ timeout: 5000 });

    // Take a screenshot for verification
    await page.screenshot({
      path: "playwright-report/google-drive-validation-complete.png",
      fullPage: true,
    });
  });
});
