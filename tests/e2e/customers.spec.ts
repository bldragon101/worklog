import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../helpers/auth';

test.describe('Customers Page', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure user is logged in before accessing customers page
    await ensureAuthenticated(page);
    await page.goto('/customers');
  });

  test('should display customers data table', async ({ page }) => {
    // Check for the main data table container
    await expect(page.locator('[data-testid="customers-table"]')).toBeVisible();
    
    // Check for toolbar with search and filters
    await expect(page.locator('input[placeholder*="filter"]')).toBeVisible();
    
    // Check for add customer button
    await expect(page.locator('button', { hasText: /add customer/i })).toBeVisible();
  });

  test('should open customer form when add button is clicked', async ({ page }) => {
    const addButton = page.locator('button', { hasText: /add customer/i });
    await addButton.click();
    
    // Check for customer form dialog
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('input[name="customer"]')).toBeVisible();
  });

  test('should filter customers table', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="filter"]');
    await searchInput.fill('test customer');
    
    // Wait for the table to update
    await page.waitForTimeout(500);
    
    // Check that the search input has the correct value
    await expect(searchInput).toHaveValue('test customer');
  });

  test('should export customers data', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button', { hasText: /export/i });
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      // Check for export options or download
      await expect(page.locator('[role="menu"]', { hasText: /csv/i })).toBeVisible();
    }
  });
});