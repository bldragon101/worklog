import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env files
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env.development.local') });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Use single worker for Docker MCP server
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Increased timeouts for Docker environment
    actionTimeout: 30000,
    navigationTimeout: 60000,
    // Docker-specific settings
    headless: true,
  },
  // Increased global test timeout for Docker
  timeout: 120000,
  projects: [
    {
      name: 'chromium-docker',
      use: { 
        ...devices['Desktop Chrome'],
        // Docker-specific browser settings
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
          ]
        }
      },
    },
  ],
  // No webServer config since your app server is already running
});