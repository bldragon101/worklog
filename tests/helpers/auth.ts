import { Page, expect } from '@playwright/test'

export async function login(page: Page) {
  const username = process.env.USERNAME || process.env.TEST_USERNAME
  const password = process.env.PASSWORD || process.env.TEST_PASSWORD

  if (!username || !password) {
    throw new Error('USERNAME and PASSWORD environment variables must be set for E2E tests')
  }

  // Go to sign-in page
  await page.goto('/sign-in')

  // Wait for the page to load completely
  await page.waitForLoadState('networkidle')
  
  // Wait for either form or individual inputs to be visible
  await page.waitForSelector('input[type="email"], input[type="password"], form', { timeout: 10000 })

  // Find and fill email input
  const emailInput = page.locator('input[type="email"], input[name="emailAddress"], input[placeholder*="email"], input[id*="email"]').first()
  await emailInput.waitFor({ state: 'visible', timeout: 5000 })
  await emailInput.fill(username)

  // Find and fill password input  
  const passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password"], input[id*="password"]').first()
  await passwordInput.waitFor({ state: 'visible', timeout: 5000 })
  await passwordInput.fill(password)

  // Find and click submit button
  const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Continue")').first()
  await submitButton.waitFor({ state: 'visible', timeout: 5000 })
  await submitButton.click()

  // Wait for navigation to complete - give it more time for Docker
  await page.waitForLoadState('networkidle', { timeout: 30000 })
  
  // Wait for successful redirect - check we're not on sign-in anymore
  await page.waitForFunction(() => !window.location.pathname.includes('/sign-in'), { timeout: 30000 })
}

export async function logout(page: Page) {
  try {
    // Click on user button to open menu
    const userButton = page.locator('[data-testid="user-button"], .cl-userButton, button:has-text("Sign out")')
    
    if (await userButton.isVisible({ timeout: 2000 })) {
      await userButton.click()
      
      // Wait for menu to appear and click sign out option
      const signOutButton = page.locator('button:has-text("Sign out"), [data-testid="sign-out-button"], .cl-userButton__signOutButton')
      if (await signOutButton.isVisible({ timeout: 2000 })) {
        await signOutButton.click()
        
        // Wait for logout to complete
        await page.waitForLoadState('networkidle', { timeout: 10000 })
        
        // Wait for redirect to landing page or sign-in page (with longer timeout for CI)
        await expect(page).toHaveURL(/\/(|sign-in)$/, { timeout: 15000 })
      }
    }
  } catch (error) {
    // If logout UI is not found, the user might already be logged out
    // Try to navigate to home and see if we're redirected to sign-in
    await page.goto('/')
    await expect(page).toHaveURL(/\/(|sign-in)$/, { timeout: 10000 })
  }
}

export async function ensureAuthenticated(page: Page) {
  // Check if already logged in by checking the current URL
  const currentUrl = page.url()
  const isOnSignInPage = currentUrl.includes('/sign-in')
  
  // Also check for authentication UI elements
  const hasAuthElements = await page.locator('[data-testid="user-button"], .cl-userButton, [data-testid="app-sidebar"]').isVisible().catch(() => false)
  
  if (isOnSignInPage || !hasAuthElements) {
    await login(page)
  }
}