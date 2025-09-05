// Environment configuration
const path = require("path");
const dotenv = require("dotenv");

function loadEnvironment() {
  const isProduction = process.env.NODE_ENV === "production";
  const isDevelopment = process.env.NODE_ENV === "development";
  const isTest = process.env.NODE_ENV === "test";

  // Only log environment in non-test environments
  if (!isTest) {
    console.log(`Environment: ${process.env.NODE_ENV}`);
  }

  // Clear any existing dotenv configuration
  delete require.cache[require.resolve("dotenv")];

  if (isProduction) {
    // Production: Load .env only
    const envPath = path.resolve(process.cwd(), ".env");
    console.log(`Loading production environment from: ${envPath}`);
    dotenv.config({ path: envPath });
  } else if (isDevelopment) {
    // Development: Load .env.development.local with fallback to .env.local then .env
    const envPaths = [
      path.resolve(process.cwd(), ".env.development.local"),
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".env"),
    ];

    for (const envPath of envPaths) {
      try {
        console.log(`Attempting to load: ${envPath}`);
        const result = dotenv.config({ path: envPath });
        if (!result.error) {
          console.log(`Successfully loaded environment from: ${envPath}`);
          break;
        }
      } catch (error) {
        console.log(`Could not load ${envPath}:`, error.message);
      }
    }
  } else if (isTest) {
    // Test: Load .env.test.local with fallback to .env.local then .env
    const envPaths = [
      path.resolve(process.cwd(), ".env.test.local"),
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".env"),
    ];

    for (const envPath of envPaths) {
      try {
        const result = dotenv.config({ path: envPath, quiet: true });
        if (!result.error) {
          // Don't log in test environment
          break;
        }
      } catch (error) {
        // Silently continue to next file
      }
    }
  }
}

module.exports = { loadEnvironment };
