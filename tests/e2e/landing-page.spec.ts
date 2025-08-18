import { test, expect } from '@playwright/test';
import { logout } from '../helpers/auth';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure user is logged out before testing landing page
    await page.goto('/');
    await logout(page);
  });

  test('should display landing page content for unauthenticated users', async ({ page }) => {
    await page.goto('/');

    // Check for sign-in link
    await expect(page.locator('a[href="/sign-in"]')).toBeVisible();
    
    // Check for sign-up link
    await expect(page.locator('a[href="/sign-up"]')).toBeVisible();
    
    // Check page title
    await expect(page).toHaveTitle(/worklog/i);
  });

  test('should navigate to sign-in page', async ({ page }) => {
    await page.goto('/');
    
    await page.click('a[href="/sign-in"]');
    
    await expect(page).toHaveURL(/.*sign-in/);
  });

  test('should navigate to sign-up page', async ({ page }) => {
    await page.goto('/');
    
    await page.click('a[href="/sign-up"]');
    
    await expect(page).toHaveURL(/.*sign-up/);
  });
});