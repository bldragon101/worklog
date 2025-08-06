#!/usr/bin/env node

const { spawn } = require('child_process');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env.development.local') });

console.log('🧪 Testing Docker MCP Playwright Setup\n');

// Test landing page with Docker config (no auth needed)
console.log('📄 Running landing page tests with Docker configuration...');

const isWindows = process.platform === 'win32';
const command = isWindows ? 'npm.cmd' : 'npm';
const args = [
  'exec', '--', 'playwright', 'test', 
  'tests/e2e/landing-page.spec.ts', 
  '--config', 'playwright-docker.config.ts',
  '--project', 'chromium-docker',
  '--reporter=line'
];

const testProcess = spawn(command, args, {
  stdio: 'inherit',
  shell: isWindows,
  env: {
    ...process.env,
    USERNAME: process.env.USERNAME || process.env.TEST_USERNAME,
    PASSWORD: process.env.PASSWORD || process.env.TEST_PASSWORD,
  }
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Docker MCP Playwright setup is working correctly!');
    console.log('\n📋 Available commands:');
    console.log('   npm run test:e2e:docker  - Run all E2E tests with Docker config');
    console.log('   npm run test:e2e         - Run all E2E tests with standard config');
    console.log('   npm exec playwright test tests/e2e/landing-page.spec.ts --config playwright-docker.config.ts --project chromium-docker');
  } else {
    console.log('\n❌ Tests failed with exit code:', code);
  }
  process.exit(code);
});