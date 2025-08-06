#!/usr/bin/env node

const { spawn } = require('child_process');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env files
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env.development.local') });

// Check if credentials are available
const username = process.env.USERNAME;
const password = process.env.PASSWORD;

console.log('🔍 Checking test credentials:');
console.log(`USERNAME: ${username ? '✅ Set' : '❌ Missing'}`);
console.log(`PASSWORD: ${password ? '✅ Set' : '❌ Missing'}`);

if (!username || !password) {
  console.error('\n❌ Missing test credentials!');
  console.error('Please set USERNAME and PASSWORD in your .env.development.local file:');
  console.error('\nUSERNAME=your-test-user@example.com');
  console.error('PASSWORD=your-test-password');
  process.exit(1);
}

console.log('\n🚀 Running E2E tests with authentication...\n');

// Run Playwright tests with environment variables
const playwrightProcess = spawn('npx', ['playwright', 'test'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    USERNAME: username,
    PASSWORD: password,
  }
});

playwrightProcess.on('close', (code) => {
  process.exit(code);
});