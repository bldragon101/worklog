const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.integration.setup.js'],
  testEnvironment: 'node', // Use node environment for integration tests
  testMatch: ['<rootDir>/tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/tests/e2e/', '<rootDir>/tests/unit/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Longer timeout for database operations
  testTimeout: 30000,
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  // Use different database for tests
  globalSetup: '<rootDir>/tests/integration/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/integration/setup/global-teardown.js',
}

module.exports = createJestConfig(customJestConfig)