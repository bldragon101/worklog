import { test as setup } from "@playwright/test";
import { getNonAdminCredentials, login } from "../helpers/auth";
import {
  NON_ADMIN_STORAGE_STATE,
  STORAGE_STATE,
} from "../helpers/storage-state";

setup("authenticate", async ({ page }) => {
  await login({ page });
  await page.context().storageState({ path: STORAGE_STATE });
});

setup("authenticate non-admin user", async ({ page }) => {
  const credentials = getNonAdminCredentials();
  setup.skip(
    !credentials,
    "TEST_NON_ADMIN_USER and TEST_NON_ADMIN_PASS are not set",
  );
  if (!credentials) return;

  await login({ page, credentials });
  await page.context().storageState({ path: NON_ADMIN_STORAGE_STATE });
});
