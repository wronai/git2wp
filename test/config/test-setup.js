// Load environment variables from .env file
require('dotenv').config({ path: '../../.env.test' });

// Set default test timeout
jest.setTimeout(process.env.TEST_TIMEOUT || 30000);

// Global test setup
beforeAll(async () => {
  // Add any global test setup here
  console.log('Global test setup');
});

// Global test teardown
afterAll(async () => {
  // Add any global test teardown here
  console.log('Global test teardown');
});

// Global test timeout for all tests
jest.retryTimes(process.env.RETRIES || 2);
