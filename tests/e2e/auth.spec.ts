import { test, expect } from '@playwright/test';
import { login, logout } from '../helpers/auth';

test.describe('Authentication Flow', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    await login(page);
    
    // Verify user is on a protected page (not sign-in)
    await expect(page).not.toHaveURL(/\/sign-in/);
    
    // Verify we're on some kind of authenticated page
    await expect(page).toHaveURL(/\/(overview|dashboard|customers|vehicles|jobs|analytics|drivers|reports|settings)/);
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await login(page);
    
    // Then logout
    await logout(page);
    
    // Verify user is on landing page or sign-in page
    await expect(page).toHaveURL(/\/(|sign-in)$/);
  });

  test('should redirect unauthenticated users to sign-in', async ({ page }) => {
    // Try to access a protected route without logging in
    await page.goto('/customers');
    
    // Should be redirected to sign-in page
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Wait for the sign-in form to be visible
    await expect(page.locator('form, [data-testid="sign-in-form"]')).toBeVisible();
    
    // Fill in invalid credentials
    const usernameSelector = 'input[name="emailAddress"], input[type="email"], input[placeholder*="email"], input[id*="email"]';
    const passwordSelector = 'input[name="password"], input[type="password"], input[placeholder*="password"], input[id*="password"]';
    
    await page.fill(usernameSelector, 'invalid@example.com');
    await page.fill(passwordSelector, 'wrongpassword');
    
    // Click sign-in button
    const signInButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Continue")');
    await signInButton.click();
    
    // Should show error message (Clerk handles this)
    await expect(page.locator('[data-testid="error-message"], .cl-formFieldErrorText, .error, [role="alert"]')).toBeVisible();
  });

  test('should maintain session across page navigation', async ({ page }) => {
    // Login
    await login(page);
    
    // Navigate to different pages
    await page.goto('/customers');
    await expect(page.locator('[data-testid="user-button"], .cl-userButton')).toBeVisible();
    
    await page.goto('/vehicles');
    await expect(page.locator('[data-testid="user-button"], .cl-userButton')).toBeVisible();
    
    await page.goto('/jobs');
    await expect(page.locator('[data-testid="user-button"], .cl-userButton')).toBeVisible();
  });

  test('should handle sign-up flow', async ({ page }) => {
    await page.goto('/sign-up');
    
    // Check that sign-up page loads
    await expect(page.locator('form, [data-testid="sign-up-form"]')).toBeVisible();
    
    // Check for link to sign-in page
    const signInLink = page.locator('a[href="/sign-in"], a:has-text("Sign in"), a:has-text("Already have an account")');
    if (await signInLink.isVisible()) {
      await signInLink.click();
      await expect(page).toHaveURL(/\/sign-in/);
    }
  });

  test('should redirect to intended page after login', async ({ page }) => {
    // Try to access a specific protected route
    await page.goto('/vehicles');
    
    // Should be redirected to sign-in
    await expect(page).toHaveURL(/\/sign-in/);
    
    // Login
    const username = process.env.USERNAME || process.env.TEST_USERNAME;
    const password = process.env.PASSWORD || process.env.TEST_PASSWORD;
    
    if (username && password) {
      const usernameSelector = 'input[name="emailAddress"], input[type="email"], input[placeholder*="email"], input[id*="email"]';
      const passwordSelector = 'input[name="password"], input[type="password"], input[placeholder*="password"], input[id*="password"]';
      
      await page.fill(usernameSelector, username);
      await page.fill(passwordSelector, password);
      
      const signInButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Continue")');
      await signInButton.click();
      
      // Should be redirected back to vehicles page or dashboard
      await expect(page).toHaveURL(/\/(vehicles|overview|dashboard)/);
    }
  });
});