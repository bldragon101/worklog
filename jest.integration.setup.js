// Integration test setup - runs before each test file
import { beforeAll, afterAll } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// Mock console methods to reduce test output noise
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console.log in tests but keep errors
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  // Keep console.error for debugging
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});