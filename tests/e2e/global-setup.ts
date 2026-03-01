/**
 * Playwright Global Setup
 *
 * This file runs once before all E2E tests.
 * It seeds the test database with golden data by running the seed script.
 */

import { execSync } from "child_process";
import path from "path";

/**
 * Global setup function for Playwright
 */
async function globalSetup(): Promise<void> {
  console.log("\n[Global Setup] Starting E2E test database setup...");

  try {
    // Run the golden data reset script using tsx
    const scriptPath = path.resolve(
      __dirname,
      "../../scripts/seed-golden-data.ts",
    );

    console.log("[Global Setup] Running golden data seed script...");

    execSync(`pnpx tsx "${scriptPath}" reset`, {
      cwd: path.resolve(__dirname, "../.."),
      stdio: "inherit",
      env: {
        ...process.env,
        TZ: "Australia/Melbourne",
        // Ensure we're not in CI mode for verbose output
        CI: undefined,
      },
    });

    console.log("[Global Setup] Database setup complete!\n");
  } catch (error) {
    console.error("[Global Setup] Error setting up test database:", error);
    throw error;
  }
}

export default globalSetup;
