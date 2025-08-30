// Global teardown for integration tests
const { PrismaClient } = require('@prisma/client');

module.exports = async () => {
  console.log('🧹 Cleaning up integration test database...');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
      }
    }
  });
  
  try {
    // Clean up all test data
    await prisma.jobs.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.user.deleteMany();
    await prisma.activityLog.deleteMany();
    
    console.log('✅ Integration test database cleanup complete');
  } catch (error) {
    console.error('❌ Failed to cleanup integration test database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
};