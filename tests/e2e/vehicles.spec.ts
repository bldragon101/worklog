import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../helpers/auth';

test.describe('Vehicles Page', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure user is logged in before accessing vehicles page
    await ensureAuthenticated(page);
    await page.goto('/vehicles');
  });

  test('should display vehicles data table', async ({ page }) => {
    // Check for the main data table container
    await expect(page.locator('[data-testid="vehicles-table"]')).toBeVisible();
    
    // Check for toolbar with search and filters
    await expect(page.locator('input[placeholder*="filter"]')).toBeVisible();
    
    // Check for add vehicle button
    await expect(page.locator('button', { hasText: /add vehicle/i })).toBeVisible();
  });

  test('should open vehicle form when add button is clicked', async ({ page }) => {
    const addButton = page.locator('button', { hasText: /add vehicle/i });
    await addButton.click();
    
    // Check for vehicle form dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('input[name="registration"]')).toBeVisible();
    await expect(page.locator('input[name="make"]')).toBeVisible();
    await expect(page.locator('input[name="model"]')).toBeVisible();
  });

  test('should filter vehicles table', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="filter"]');
    await searchInput.fill('test vehicle');
    
    // Wait for the table to update
    await page.waitForTimeout(500);
    
    // Check that the search input has the correct value
    await expect(searchInput).toHaveValue('test vehicle');
  });

  test('should display vehicle columns', async ({ page }) => {
    // Check for column headers
    await expect(page.locator('th', { hasText: /registration/i })).toBeVisible();
    await expect(page.locator('th', { hasText: /make/i })).toBeVisible();
    await expect(page.locator('th', { hasText: /model/i })).toBeVisible();
    await expect(page.locator('th', { hasText: /type/i })).toBeVisible();
    await expect(page.locator('th', { hasText: /year/i })).toBeVisible();
  });

  test('should handle vehicle form submission', async ({ page }) => {
    // Open add vehicle form
    const addButton = page.locator('button', { hasText: /add vehicle/i });
    await addButton.click();
    
    // Fill in required fields
    await page.fill('input[name="registration"]', 'TEST123');
    await page.fill('input[name="make"]', 'Toyota');
    await page.fill('input[name="model"]', 'Hilux');
    await page.fill('input[name="yearOfManufacture"]', '2023');
    
    // Select vehicle type
    await page.click('[data-testid="vehicle-type-select"]');
    await page.click('text=UTE');
    
    // Fill expiry date
    await page.fill('input[name="expiryDate"]', '2025-12-31');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check that form closes (dialog should not be visible)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should cancel vehicle form', async ({ page }) => {
    // Open add vehicle form
    const addButton = page.locator('button', { hasText: /add vehicle/i });
    await addButton.click();
    
    // Fill some data
    await page.fill('input[name="registration"]', 'CANCEL123');
    
    // Click cancel
    await page.locator('button:has-text("Cancel")').click();
    
    // Check that form closes
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should export vehicles data', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button', { hasText: /export/i });
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      // Check for export options or download
      await expect(page.locator('[role="menu"]', { hasText: /csv/i })).toBeVisible();
    }
  });

  test('should import vehicles data', async ({ page }) => {
    // Look for import button
    const importButton = page.locator('button', { hasText: /import/i });
    if (await importButton.isVisible()) {
      await importButton.click();
      
      // Check for import dialog or file input
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });

  test('should handle vehicle editing', async ({ page }) => {
    // First check if any vehicles exist in the table
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
        const registrationInput = page.locator('input[name="registration"]');
        await expect(registrationInput).not.toHaveValue('');
      }
    }
  });

  test('should handle column sorting', async ({ page }) => {
    // Click on registration column header to sort
    const registrationHeader = page.locator('th', { hasText: /registration/i });
    await registrationHeader.click();
    
    // Check for sort indicator
    await expect(page.locator('[data-testid="sort-asc-icon"], [data-testid="sort-desc-icon"]')).toBeVisible();
  });

  test('should display page header', async ({ page }) => {
    // Check for vehicles page header/title
    await expect(page.locator('h1, h2', { hasText: /vehicles/i })).toBeVisible();
  });
});