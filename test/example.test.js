const { test, expect } = require('@jest/globals');
const { testConfig, testData } = require('./helpers/test-utils');

describe('Example Test Suite', () => {
  test('should pass a simple test', () => {
    expect(true).toBe(true);
  });

  test('should have test configuration', () => {
    expect(testConfig).toBeDefined();
    expect(testConfig.timeout).toBe(30000);
  });

  test('should have test data', () => {
    expect(testData).toBeDefined();
    expect(testData.git.testRepo).toBeDefined();
    expect(testData.wordpress.testPost).toBeDefined();
  });
});
