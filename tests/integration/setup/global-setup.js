// Global setup for integration tests
const { execSync } = require('child_process');

module.exports = async () => {
  // Use existing DATABASE_URL if TEST_DATABASE_URL is not set
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for integration tests');
  }
  process.env.DATABASE_URL = testDatabaseUrl;
  
  console.log('🔧 Setting up integration test database...');
  
  try {
    // Generate Prisma client for test environment
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: testDatabaseUrl }
    });
    
    // Push schema to test database (creates tables if needed)
    execSync('npx prisma db push', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: testDatabaseUrl }
    });
    
    console.log('✅ Integration test database setup complete');
  } catch (error) {
    console.error('❌ Failed to setup integration test database:', error.message);
    throw error;
  }
};