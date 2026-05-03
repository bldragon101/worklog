import { test, expect, Page } from "@playwright/test";
import { login } from "../helpers/auth";

test.describe.configure({ mode: "serial" });

function byId(id: string) {
  return `[id="${id}"]`;
}

let page: Page;

test.describe("Quick Edit Mode", () => {
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await login(page);

    // Ensure the quick edit minimum role allows the test user (admin) to use it.
    // The default is "admin" when no CompanySettings row exists, but we explicitly
    // set it via the API so the permission check resolves deterministically.
    const settingsResponse = await page.request.get(
      "/api/admin/quick-edit-settings",
    );
    expect(
      settingsResponse.ok(),
      `Failed to fetch quick-edit settings: ${settingsResponse.status()}`,
    ).toBe(true);

    const settingsData = await settingsResponse.json();
    if (settingsData.quickEditMinRole !== "admin") {
      const patchResponse = await page.request.patch(
        "/api/admin/quick-edit-settings",
        { data: { quickEditMinRole: "admin" } },
      );
      expect(
        patchResponse.ok(),
        `Failed to set quickEditMinRole (status ${patchResponse.status()}). Is TEST_USER an admin?`,
      ).toBe(true);
    }
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("should navigate to jobs page and see quick edit toggle", async () => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs/);
    await page.waitForLoadState("networkidle");

    // The quick edit button should be visible in the toolbar
    const quickEditBtn = page.locator("#toggle-quick-edit-btn");
    await quickEditBtn.waitFor({ state: "visible", timeout: 15000 });
    await expect(quickEditBtn).toBeVisible();
    await expect(
      page.locator('label[for="toggle-quick-edit-btn"]'),
    ).toContainText("Quick Edit");
  });

  test("should enter quick edit mode when toggle is clicked", async () => {
    const quickEditBtn = page.locator("#toggle-quick-edit-btn");
    await quickEditBtn.click();

    // Wait for the quick edit table to render
    // The standalone toggle bar appears when quick edit mode is active
    const standaloneToggle = page.locator("#toggle-quick-edit-standalone-btn");
    await standaloneToggle.waitFor({ state: "visible", timeout: 10000 });
    await expect(standaloneToggle).toBeVisible();

    // The inline editing mode text should be visible
    await expect(
      page.locator("text=Inline editing mode is active"),
    ).toBeVisible();

    // The "Add Row" button should be visible inside the quick edit table
    const addRowBtn = page.locator("#quick-edit-add-row-btn");
    await addRowBtn.waitFor({ state: "visible", timeout: 10000 });
    await expect(addRowBtn).toBeVisible();
  });

  test("should render existing jobs as editable rows", async () => {
    // The quick edit table should display date inputs for existing rows
    const dateInputs = page.locator('input[type="date"]');
    const dateCount = await dateInputs.count();

    // Golden data seeds multiple jobs, so we should have at least one date input
    expect(dateCount).toBeGreaterThan(0);

    // Verify pickup text inputs are present
    const pickupInputs = page.locator('input[placeholder="Pickup"]');
    const pickupCount = await pickupInputs.count();
    expect(pickupCount).toBeGreaterThan(0);
  });

  test("should add a new row when Add Row is clicked", async () => {
    // Count existing date inputs before adding
    const dateInputsBefore = page.locator('input[type="date"]');
    const countBefore = await dateInputsBefore.count();

    // Click Add Row
    const addRowBtn = page.locator("#quick-edit-add-row-btn");
    await addRowBtn.click();
    await page.waitForTimeout(500);

    // Count date inputs after adding — should be one more
    const dateInputsAfter = page.locator('input[type="date"]');
    const countAfter = await dateInputsAfter.count();
    expect(countAfter).toBe(countBefore + 1);

    // The floating save/discard bar should now be visible
    const saveBtn = page.locator("#quick-edit-save-btn");
    await saveBtn.waitFor({ state: "visible", timeout: 5000 });
    await expect(saveBtn).toBeVisible();

    const discardBtn = page.locator("#quick-edit-discard-btn");
    await expect(discardBtn).toBeVisible();

    // Should show "1 unsaved change"
    await expect(page.locator("text=1 unsaved change")).toBeVisible();
  });

  test("should show validation errors when saving an incomplete new row", async () => {
    // Attempt to save without filling required fields
    const saveBtn = page.locator("#quick-edit-save-btn");
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // A validation toast should appear
    const toastMessage = page.getByText(
      "Please fix the highlighted fields before saving",
      { exact: true },
    );
    await toastMessage.waitFor({ state: "visible", timeout: 5000 });
    await expect(toastMessage).toBeVisible();
  });

  test("should discard pending changes", async () => {
    // Click Discard to remove the empty new row
    const discardBtn = page.locator("#quick-edit-discard-btn");
    await discardBtn.click();
    await page.waitForTimeout(500);

    // The floating save/discard bar should disappear
    await expect(page.locator("#quick-edit-save-btn")).not.toBeVisible();
    await expect(page.locator("#quick-edit-discard-btn")).not.toBeVisible();
  });

  test("should add a new row, fill required fields, and batch save", async () => {
    // Click Add Row
    const addRowBtn = page.locator("#quick-edit-add-row-btn");
    await addRowBtn.click();
    await page.waitForTimeout(500);

    // The new row is the last data row. We'll target it by finding the last
    // date input (which belongs to the newly added row).
    const allDateInputs = page.locator('input[type="date"]');
    const dateInputCount = await allDateInputs.count();
    const newRowDateInput = allDateInputs.nth(dateInputCount - 1);

    // Fill date
    const today = new Date().toISOString().split("T")[0];
    await newRowDateInput.fill(today);

    // We need to find the new row's key to interact with its selects.
    // The new row key starts with "new:" — find the row's cells by looking at
    // the last table row that has an "Add Row" text sibling (i.e. the last data row).
    // Strategy: use the new row's date input ID which follows the pattern {rowKey}:date
    const dateInputId = await newRowDateInput.getAttribute("id");
    // dateInputId looks like "new:1234567890-abcde:date"
    const rowKey = dateInputId?.replace(":date", "") || "";

    // Fill Driver select
    const driverSelect = page.locator(`[data-testid="${rowKey}:driver"]`);
    if (await driverSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      // If mocked as <select> in test, use selectOption; otherwise, use the popover button
      await driverSelect.selectOption({ index: 1 });
    } else {
      // Use the inline cell select button
      const driverBtn = page.locator(byId(`${rowKey}:driver`));
      await driverBtn.click();
      await page.waitForTimeout(300);
      // Type in the search and pick the first option
      const searchInput = page.locator(
        ".border-b input[placeholder='Search...']",
      );
      if (await searchInput.isVisible({ timeout: 2000 })) {
        await searchInput.fill("Test");
        await page.waitForTimeout(500);
        // Click the first option in the dropdown
        const firstOption = page
          .locator('[class*="cursor-pointer"]')
          .filter({ hasText: "Test" })
          .first();
        if (await firstOption.isVisible({ timeout: 2000 })) {
          await firstOption.click();
        } else {
          await searchInput.press("ArrowDown");
          await searchInput.press("Enter");
        }
      }
    }
    await page.waitForTimeout(300);

    // Fill Customer select
    const customerBtn = page.locator(byId(`${rowKey}:customer`));
    await customerBtn.click();
    await page.waitForTimeout(300);
    const customerSearch = page.locator(
      ".border-b input[placeholder='Search...']",
    );
    if (await customerSearch.isVisible({ timeout: 2000 })) {
      await customerSearch.fill("Test");
      await page.waitForTimeout(500);
      const firstCustomerOption = page
        .locator('[class*="cursor-pointer"]')
        .filter({ hasText: "Test" })
        .first();
      if (await firstCustomerOption.isVisible({ timeout: 2000 })) {
        await firstCustomerOption.click();
      } else {
        await customerSearch.press("ArrowDown");
        await customerSearch.press("Enter");
      }
    }
    await page.waitForTimeout(300);

    // Bill To should auto-populate from customer. If not, fill it.
    const billToBtn = page.locator(byId(`${rowKey}:billTo`));
    const billToText = await billToBtn.textContent();
    if (!billToText || billToText.trim() === "") {
      await billToBtn.click();
      await page.waitForTimeout(300);
      const billToSearch = page.locator(
        ".border-b input[placeholder='Search...']",
      );
      if (await billToSearch.isVisible({ timeout: 2000 })) {
        await billToSearch.press("ArrowDown");
        await billToSearch.press("Enter");
      }
      await page.waitForTimeout(300);
    }

    // Registration should auto-populate from driver. If not, fill it.
    const regBtn = page.locator(byId(`${rowKey}:registration`));
    const regText = await regBtn.textContent();
    if (!regText || regText.trim() === "") {
      await regBtn.click();
      await page.waitForTimeout(300);
      const regSearch = page.locator(
        ".border-b input[placeholder='Search...']",
      );
      if (await regSearch.isVisible({ timeout: 2000 })) {
        await regSearch.press("ArrowDown");
        await regSearch.press("Enter");
      }
      await page.waitForTimeout(300);
    }

    // Truck Type should auto-populate from registration. If not, fill it.
    const truckBtn = page.locator(byId(`${rowKey}:truckType`));
    const truckText = await truckBtn.textContent();
    if (!truckText || truckText.trim() === "") {
      await truckBtn.click();
      await page.waitForTimeout(300);
      const truckSearch = page.locator(
        ".border-b input[placeholder='Search...']",
      );
      if (await truckSearch.isVisible({ timeout: 2000 })) {
        await truckSearch.press("ArrowDown");
        await truckSearch.press("Enter");
      }
      await page.waitForTimeout(300);
    }

    // Fill Pickup
    const pickupInputs = page.locator('input[placeholder="Pickup"]');
    const pickupCount = await pickupInputs.count();
    const newPickup = pickupInputs.nth(pickupCount - 1);
    await newPickup.fill("E2E Test Pickup");

    // Verify unsaved changes bar is visible
    await expect(page.locator("#quick-edit-save-btn")).toBeVisible();

    // Save all changes
    const saveBtn = page.locator("#quick-edit-save-btn");
    await saveBtn.click();

    // Wait for the save to complete — success toast should appear
    const successToast = page.getByText("Changes saved", { exact: true });
    await successToast.waitFor({ state: "visible", timeout: 15000 });
    await expect(successToast).toBeVisible();

    // The floating save/discard bar should disappear after successful save
    await expect(page.locator("#quick-edit-save-btn")).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("should edit an existing job inline and save", async () => {
    // Find the first dropoff input and change its value
    const dropoffInputs = page.locator('input[placeholder="Dropoff"]');
    const dropoffCount = await dropoffInputs.count();
    expect(dropoffCount).toBeGreaterThan(0);

    const firstDropoff = dropoffInputs.first();
    const firstDropoffId = await firstDropoff.getAttribute("id");
    if (!firstDropoffId) {
      throw new Error("Dropoff input is missing an id");
    }

    const targetDropoff = page.locator(byId(firstDropoffId));
    const originalValue = await targetDropoff.inputValue();
    const newValue = "E2E Edited Dropoff";
    await targetDropoff.fill(newValue);
    await page.waitForTimeout(300);

    // The save bar should appear
    const saveBtn = page.locator("#quick-edit-save-btn");
    await saveBtn.waitFor({ state: "visible", timeout: 5000 });
    await expect(page.locator("text=1 unsaved change")).toBeVisible();

    // Save changes
    await saveBtn.click();

    // Wait for success
    const successToast = page.getByText("Changes saved", { exact: true });
    await successToast.waitFor({ state: "visible", timeout: 15000 });

    // Wait for the save bar to disappear — confirms isBatchSaving has reset and
    // the component is back to a clean state before we attempt the restore fill
    await expect(page.locator("#quick-edit-save-btn")).not.toBeVisible({
      timeout: 10000,
    });

    // Verify the value persisted after save — wait for the async refetch to
    // deliver the updated value before asserting (pendingUpdates is cleared
    // immediately on save, so the input briefly reverts to the server value
    // until onBatchSaveComplete triggers a refetch and the new data arrives)
    await expect(targetDropoff).toHaveValue(newValue, {
      timeout: 10000,
    });

    // Restore the original value to avoid polluting other tests
    if (originalValue) {
      await targetDropoff.fill(originalValue);
      await page.waitForTimeout(300);
      const restoreSaveBtn = page.locator("#quick-edit-save-btn");
      await restoreSaveBtn.waitFor({ state: "visible", timeout: 5000 });
      await restoreSaveBtn.click();
      await page
        .getByText("Changes saved", { exact: true })
        .waitFor({ state: "visible", timeout: 15000 });
      // Wait for the save bar to clear — ensures React has flushed the
      // setPendingUpdates({}) re-render before the next test starts, so
      // subsequent tests don't inherit a stale pending-update count
      await expect(page.locator("#quick-edit-save-btn")).not.toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("should toggle delete on an existing row and discard", async () => {
    // Find the first delete button for an existing row
    const deleteButtons = page.locator('button[id^="quick-edit-delete-"]');
    const deleteCount = await deleteButtons.count();
    expect(deleteCount).toBeGreaterThan(0);

    const firstDeleteBtn = deleteButtons.first();
    await firstDeleteBtn.click();
    await page.waitForTimeout(500);

    // The save bar should appear
    await expect(page.locator("#quick-edit-save-btn")).toBeVisible();
    await expect(page.locator("text=1 unsaved change")).toBeVisible();

    // Discard instead of saving
    const discardBtn = page.locator("#quick-edit-discard-btn");
    await discardBtn.click();
    await page.waitForTimeout(500);

    // The save bar should disappear — row is no longer marked for deletion
    await expect(page.locator("#quick-edit-save-btn")).not.toBeVisible();
  });

  test("should show multiple unsaved changes count", async () => {
    // Add two new rows
    const addRowBtn = page.locator("#quick-edit-add-row-btn");
    await addRowBtn.click();
    await page.waitForTimeout(300);
    await addRowBtn.click();
    await page.waitForTimeout(300);

    // Also modify an existing row
    const dropoffInputs = page.locator('input[placeholder="Dropoff"]');
    const firstDropoff = dropoffInputs.first();
    await firstDropoff.fill("Multi-change test");
    await page.waitForTimeout(300);

    // Should show "3 unsaved changes"
    await expect(page.locator("text=3 unsaved changes")).toBeVisible();

    // Discard all
    const discardBtn = page.locator("#quick-edit-discard-btn");
    await discardBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator("#quick-edit-save-btn")).not.toBeVisible();
  });

  test("should warn about unsaved changes when exiting quick edit", async () => {
    // Add a new row to create unsaved changes
    const addRowBtn = page.locator("#quick-edit-add-row-btn");
    await addRowBtn.click();
    await page.waitForTimeout(300);

    // Now try to exit quick edit mode via the standalone toggle
    const standaloneToggle = page.locator("#toggle-quick-edit-standalone-btn");
    await standaloneToggle.click();
    await page.waitForTimeout(500);

    // The unsaved changes confirmation dialog should appear
    const dialogTitle = page.getByRole("heading", { name: "Unsaved Changes" });
    await dialogTitle.waitFor({ state: "visible", timeout: 5000 });
    await expect(dialogTitle).toBeVisible();
    await expect(
      page.locator("text=All pending changes will be lost"),
    ).toBeVisible();

    // Cancel to stay in quick edit mode
    const cancelBtn = page.locator('button:has-text("Cancel")');
    await cancelBtn.click();
    await page.waitForTimeout(500);

    // Quick edit mode should still be active
    await expect(standaloneToggle).toBeVisible();
    await expect(
      page.locator("text=Inline editing mode is active"),
    ).toBeVisible();
  });

  test("should discard changes and exit quick edit via confirmation dialog", async () => {
    // Quick edit mode should still be active with unsaved changes from the previous test
    await expect(page.locator("#quick-edit-save-btn")).toBeVisible();

    // Try to exit quick edit mode
    const standaloneToggle = page.locator("#toggle-quick-edit-standalone-btn");
    await standaloneToggle.click();
    await page.waitForTimeout(500);

    // The unsaved changes dialog should appear
    const dialogTitle = page.getByRole("heading", { name: "Unsaved Changes" });
    await dialogTitle.waitFor({ state: "visible", timeout: 5000 });

    // Click "Discard Changes" to confirm exit
    const discardChangesBtn = page.locator(
      'button:has-text("Discard Changes")',
    );
    await discardChangesBtn.click();
    await page.waitForTimeout(500);

    // Quick edit mode should be exited
    await expect(standaloneToggle).not.toBeVisible();
    await expect(
      page.locator("text=Inline editing mode is active"),
    ).not.toBeVisible();

    // The normal table view should be restored (Add Entry button visible)
    const addEntryBtn = page.locator("#add-job-btn");
    await addEntryBtn.waitFor({ state: "visible", timeout: 10000 });
    await expect(addEntryBtn).toBeVisible();
  });

  test("should re-enter quick edit and verify previously saved row exists", async () => {
    // Re-enter quick edit mode
    const quickEditBtn = page.locator("#toggle-quick-edit-btn");
    await quickEditBtn.click();

    const standaloneToggle = page.locator("#toggle-quick-edit-standalone-btn");
    await standaloneToggle.waitFor({ state: "visible", timeout: 10000 });

    // Look for the job we created earlier with "E2E Test Pickup"
    const pickupInputs = page.locator('input[placeholder="Pickup"]');
    const pickupCount = await pickupInputs.count();
    let foundOurJob = false;
    for (let i = 0; i < pickupCount; i++) {
      const val = await pickupInputs.nth(i).inputValue();
      if (val === "E2E Test Pickup") {
        foundOurJob = true;
        break;
      }
    }
    expect(foundOurJob).toBe(true);
  });

  test("should delete the E2E-created job to clean up", async () => {
    // Find the row with our test pickup and delete it
    const pickupInputs = page.locator('input[placeholder="Pickup"]');
    const pickupCount = await pickupInputs.count();

    for (let i = 0; i < pickupCount; i++) {
      const val = await pickupInputs.nth(i).inputValue();
      if (val === "E2E Test Pickup") {
        // Get the cell ID to extract the row key
        const cellId = await pickupInputs.nth(i).getAttribute("id");
        // cellId format: "{rowKey}:pickup"
        const rowKey = cellId?.replace(":pickup", "") || "";
        const deleteBtn = page.locator(`#quick-edit-delete-${rowKey}`);
        await deleteBtn.click();
        await page.waitForTimeout(300);
        break;
      }
    }

    // Save the deletion
    const saveBtn = page.locator("#quick-edit-save-btn");
    await saveBtn.waitFor({ state: "visible", timeout: 5000 });
    await saveBtn.click();

    // Wait for success
    const successToast = page.getByText("Changes saved", { exact: true });
    await successToast.waitFor({ state: "visible", timeout: 15000 });
  });

  test("should exit quick edit mode cleanly", async () => {
    // Exit quick edit mode
    const standaloneToggle = page.locator("#toggle-quick-edit-standalone-btn");
    await standaloneToggle.click();
    await page.waitForTimeout(500);

    // No unsaved changes — should exit directly without confirmation
    await expect(standaloneToggle).not.toBeVisible({ timeout: 5000 });

    // Normal table view should be restored
    const addEntryBtn = page.locator("#add-job-btn");
    await addEntryBtn.waitFor({ state: "visible", timeout: 10000 });
    await expect(addEntryBtn).toBeVisible();
  });
});
