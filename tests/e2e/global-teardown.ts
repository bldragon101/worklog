/**
 * Playwright Global Teardown
 *
 * This file runs once after all E2E tests complete.
 * It cleans up the test database by removing golden data.
 */

import { execSync } from "child_process";
import path from "path";

/**
 * Global teardown function for Playwright
 */
async function globalTeardown(): Promise<void> {
  console.log("\n[Global Teardown] Starting E2E test database cleanup...");

  try {
    // Run the golden data cleanup script using tsx
    const scriptPath = path.resolve(
      __dirname,
      "../../scripts/seed-golden-data.ts",
    );

    console.log("[Global Teardown] Running golden data cleanup script...");

    execSync(`npx tsx "${scriptPath}" cleanup`, {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
      env: {
        ...process.env,
        // Ensure we're not in CI mode for verbose output
        CI: undefined,
      },
    });

    console.log("[Global Teardown] Database cleanup complete!\n");
  } catch (error) {
    console.error("[Global Teardown] Error cleaning up test database:", error);
    // Don't throw - teardown should not fail the test run
  }
}

export default globalTeardown;
