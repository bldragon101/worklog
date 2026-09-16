import { test as setup } from "@playwright/test";
import { login } from "../helpers/auth";
import { STORAGE_STATE } from "../helpers/storage-state";

setup("authenticate", async ({ page }) => {
  await login(page);
  await page.context().storageState({ path: STORAGE_STATE });
});
