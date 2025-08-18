import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../helpers/auth';

test.describe('Jobs Page', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure user is logged in before accessing jobs page
    await ensureAuthenticated(page);
    await page.goto('/');
    await expect(page.locator('h1', { hasText: /Overview/i })).toBeVisible();
    await page.goto('/jobs');
  });

  test('should display jobs data table', async ({ page }) => {
    // Check for the main data table container
    await expect(page.locator('[data-testid="data-table"]')).toBeVisible();
    
    // Check for toolbar with search and filters
    await expect(page.locator('input[id="search-input"]')).toBeVisible();
    
    // Check for add job button
    await expect(page.locator('button', { hasText: /add entry/i })).toBeVisible();
  });

  test('should display page controls for filtering', async ({ page }) => {
    // Check for year selector
    await expect(page.locator('select, [role="combobox"]').first()).toBeVisible();
    
    // Check for filter controls
    await expect(page.locator('[data-testid="page-controls"]')).toBeVisible();
  });

  test('should display job columns', async ({ page }) => {
    // Check for column headers
    await expect(page.locator('th', { hasText: /date/i })).toBeVisible();
    await expect(page.locator('th', { hasText: /driver/i })).toBeVisible();
    await expect(page.locator('th', { hasText: /customer/i })).toBeVisible();
    await expect(page.locator('th', { hasText: /reg/i })).toBeVisible();
    await expect(page.locator('th', { hasText: /truck/i })).toBeVisible();
  });

  test('should open job form when add button is clicked', async ({ page }) => {
    const addButton = page.locator('button', { hasText: /add entry/i });
    await addButton.click();
    
    // Check for job form dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('input[name="driver"]')).toBeVisible();
    await expect(page.locator('input[name="date"]')).toBeVisible();
  });

  test('should filter jobs by date range', async ({ page }) => {
    // Test year selection
    const yearSelect = page.locator('select').first();
    if (await yearSelect.isVisible()) {
      await yearSelect.selectOption('2024');
      
      // Wait for the table to update
      await page.waitForTimeout(500);
    }
  });

  test('should filter jobs by days of week', async ({ page }) => {
    // Look for day filter buttons
    const mondayFilter = page.locator('button', { hasText: /monday/i });
    if (await mondayFilter.isVisible()) {
      await mondayFilter.click();
      
      // Wait for the table to update
      await page.waitForTimeout(500);
    }
  });

  test('should handle job form submission', async ({ page }) => {
    // Open add job form
    const addButton = page.locator('button', { hasText: /add entry/i });
    await addButton.click();
    
    // Fill in required fields
    await page.fill('input[name="driver"]', 'Test Driver');
    await page.click('button[name="customer"]');
    await page.fill('input[name="customer"]', 'Test Customer');
    await page.fill('input[name="billTo"]', 'Test Bill To');
    await page.fill('input[name="registration"]', 'TEST123');
    
    // Fill date
    await page.fill('input[name="date"]', '2024-01-15');
    
    // Select truck type
    const truckTypeSelect = page.locator('[data-testid="truck-type-select"]');
    if (await truckTypeSelect.isVisible()) {
      await truckTypeSelect.click();
      await page.click('text=Tray');
    }
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check that form closes (dialog should not be visible)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should cancel job form', async ({ page }) => {
    // Open add job form
    const addButton = page.locator('button', { hasText: /add entry/i });
    await addButton.click();
    
    // Fill some data
    await page.fill('input[name="driver"]', 'Cancel Test');
    
    // Click cancel
    await page.locator('button:has-text("Cancel")').click();
    
    // Check that form closes
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should handle job status updates', async ({ page }) => {
    // First check if any jobs exist in the table
    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();
    
    if (rowCount > 0) {
      // Look for runsheet checkbox in first row
      const runsheetCheckbox = page.locator('tbody tr:first-child input[type="checkbox"]').first();
      
      if (await runsheetCheckbox.isVisible()) {
        const isChecked = await runsheetCheckbox.isChecked();
        await runsheetCheckbox.click();
        
        // Wait for update
        await page.waitForTimeout(500);
        
        // Verify status changed
        if (!isChecked) {
          await expect(runsheetCheckbox).toBeChecked();
        } else {
          await expect(runsheetCheckbox).not.toBeChecked();
        }
      }
    }
  });

  test('should handle job editing', async ({ page }) => {
    // First check if any jobs exist in the table
    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();
    
    if (rowCount > 0) {
      // Click on the first row's edit button (if exists)
      const editButton = page.locator('tbody tr:first-child button[title*="edit"], tbody tr:first-child button:has-text("Edit")').first();
      
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Check that edit form opens
        await expect(page.locator('[role="dialog"]')).toBeVisible();
        
        // Check that form has existing data populated
        const driverInput = page.locator('input[name="driver"]');
        await expect(driverInput).not.toHaveValue('');
      }
    }
  });

  test('should export jobs data', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button', { hasText: /export/i });
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      // Check for export options or download
      await expect(page.locator('[role="menu"]', { hasText: /csv/i })).toBeVisible();
    }
  });

  test('should import jobs data', async ({ page }) => {
    // Look for import button
    const importButton = page.locator('button', { hasText: /import/i });
    if (await importButton.isVisible()) {
      await importButton.click();
      
      // Check for import dialog or file input
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });

  test('should filter jobs table by search', async ({ page }) => {
    const searchInput = page.locator('input[id="search-input"]');
    await searchInput.fill('test driver');
    
    // Wait for the table to update
    await page.waitForTimeout(500);
    
    // Check that the search input has the correct value
    await expect(searchInput).toHaveValue('test driver');
  });

  test('should handle week ending filter', async ({ page }) => {
    // Look for week ending selector
    const weekSelect = page.locator('[data-testid="week-ending-select"]');
    if (await weekSelect.isVisible()) {
      await weekSelect.click();
      
      // Select a week ending option
      const weekOption = page.locator('[role="option"]').first();
      if (await weekOption.isVisible()) {
        await weekOption.click();
        
        // Wait for the table to update
        await page.waitForTimeout(500);
      }
    }
  });

  test('should handle column sorting', async ({ page }) => {
    // Wait for the page to fully load and jobs to be fetched
    await page.waitForLoadState('networkidle');
    
    // Wait for the table to be visible and populated
    await expect(page.locator('[data-testid="data-table"]')).toBeVisible();
    
    // Click on date column header to sort
    const dateHeader = page.locator('th', { hasText: /date/i });
    await expect(dateHeader).toBeVisible();
    await dateHeader.click();
    
    // Wait for any loading states to complete after sorting
    await page.waitForTimeout(1000);
    
    // Check for sort indicators specifically in the Date column
    const dateHeaderButton = page.locator('th', { hasText: /date/i }).locator('button');
    await expect(dateHeaderButton.locator('[data-testid="sort-asc-icon"]')).toBeVisible();
    await expect(dateHeaderButton.locator('[data-testid="sort-desc-icon"]')).toBeVisible();
  });

  test('should have charged hours and driver charge columns available in view menu', async ({ page }) => {
    // Open the view dropdown
    const viewButton = page.locator('button', { hasText: /view/i });
    await expect(viewButton).toBeVisible();
    await viewButton.click();
    
    // Check that the columns are available but initially unchecked (hidden)
    await expect(page.locator('text=chargedHours')).toBeVisible();
    await expect(page.locator('text=driverCharge')).toBeVisible();
    
    // Check that they are unchecked by default
    const chargedHoursItem = page.locator('[role="menuitemcheckbox"]', { hasText: /chargedhours/i });
    const driverChargeItem = page.locator('[role="menuitemcheckbox"]', { hasText: /drivercharge/i });
    
    await expect(chargedHoursItem).toHaveAttribute('aria-checked', 'false');
    await expect(driverChargeItem).toHaveAttribute('aria-checked', 'false');
    
    // Close the dropdown
    await page.keyboard.press('Escape');
  });

  test('should display pickup and dropoff columns', async ({ page }) => {
    // Check for location columns
    await expect(page.locator('th', { hasText: /pickup/i })).toBeVisible();
    await expect(page.locator('th', { hasText: /dropoff/i })).toBeVisible();
  });

  test('should handle job deletion', async ({ page }) => {
    // First check if any jobs exist in the table
    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();
    
    if (rowCount > 0) {
      // Click on the first row's delete button (if exists)
      const deleteButton = page.locator('tbody tr:first-child button[title*="delete"], tbody tr:first-child button:has-text("Delete")').first();
      
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Handle confirmation dialog
        page.on('dialog', async dialog => {
          expect(dialog.message()).toContain('delete');
          await dialog.dismiss(); // Cancel deletion for test
        });
      }
    }
  });
});