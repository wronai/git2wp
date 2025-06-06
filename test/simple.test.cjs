const assert = require('assert');

// Simple test to verify the test environment
console.log('Running simple test...');
console.log('NODE_ENV:', process.env.NODE_ENV);

describe('Simple Test Suite', () => {
  it('should pass a simple test', () => {
    assert.strictEqual(1 + 1, 2);
  });

  it('should have environment variables set', () => {
    // Just verify that we can access environment variables
    assert.ok(process.env.NODE_ENV, 'NODE_ENV should be set');
  });
});
