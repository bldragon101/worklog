import { Page, expect } from "@playwright/test";

export async function login(page: Page) {
  const username = process.env.TEST_USER;
  const password = process.env.TEST_PASS;

  if (!username || !password) {
    throw new Error(
      "TEST_USER and TEST_PASS environment variables must be set for E2E tests",
    );
  }

  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");

  // Wait for the login form to be visible
  await page.waitForSelector('button:has-text("Login")', { timeout: 10000 });

  // Fill in email - use the placeholder to identify the field
  const emailInput = page.getByPlaceholder("user@example.com");
  await emailInput.waitFor({ state: "visible", timeout: 5000 });
  await emailInput.fill(username);

  // Fill in password - use the label text to identify the field
  const passwordInput = page.getByRole("textbox", { name: "Password" });
  await passwordInput.waitFor({ state: "visible", timeout: 5000 });
  await passwordInput.fill(password);

  // Click login button (use exact match to avoid Google login button)
  const loginButton = page.getByRole("button", { name: "Login", exact: true });
  await loginButton.waitFor({ state: "visible", timeout: 5000 });
  await loginButton.click();

  // Wait for navigation away from sign-in page
  await page.waitForURL((url) => !url.pathname.includes("/sign-in"), {
    timeout: 30000,
  });

  await page.waitForLoadState("networkidle", { timeout: 30000 });
}

export async function logout(page: Page) {
  try {
    const userButton = page.locator(
      '[data-testid="user-button"], .cl-userButton, button:has-text("Sign out")',
    );

    if (await userButton.isVisible({ timeout: 2000 })) {
      await userButton.click();

      const signOutButton = page.locator(
        'button:has-text("Sign out"), [data-testid="sign-out-button"], .cl-userButton__signOutButton',
      );
      if (await signOutButton.isVisible({ timeout: 2000 })) {
        await signOutButton.click();

        await page.waitForLoadState("networkidle", { timeout: 10000 });

        await expect(page).toHaveURL(/\/(|sign-in)$/, { timeout: 15000 });
      }
    }
  } catch {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(|sign-in)$/, { timeout: 10000 });
  }
}

export async function ensureAuthenticated(page: Page) {
  const currentUrl = page.url();
  const isOnSignInPage = currentUrl.includes("/sign-in");

  const hasAuthElements = await page
    .locator(
      '[data-testid="user-button"], .cl-userButton, [data-testid="app-sidebar"]',
    )
    .isVisible()
    .catch(() => false);

  if (isOnSignInPage || !hasAuthElements) {
    await login(page);
  }
}
