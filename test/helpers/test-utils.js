// Test helper utilities

const setupTestEnvironment = async () => {
  // Setup test environment if needed
};

const teardownTestEnvironment = async () => {
  // Cleanup after tests if needed
};

const withTimeout = (promise, ms = 10000, message = 'Operation timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(message)), ms)
    )
  ]);
};

// Common test configurations
const testConfig = {
  timeout: 30000, // 30 seconds
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  api: {
    basePath: '/api',
    endpoints: {
      git: {
        repos: '/git/repos',
        commits: '/git/commits'
      },
      wordpress: {
        posts: '/wordpress/posts'
      }
    }
  }
};

// Common test data
const testData = {
  git: {
    testRepo: {
      name: 'test-repo',
      path: '/path/to/test/repo',
      organization: 'test-org'
    },
    testCommit: {
      hash: 'abc123',
      message: 'Test commit message',
      author: 'test@example.com',
      date: new Date().toISOString()
    }
  },
  wordpress: {
    testPost: {
      title: 'Test Post',
      content: 'This is a test post content.',
      status: 'publish',
      slug: 'test-post'
    }
  }
};

// Mock data generators
const generateMockRepositories = (count = 3) => {
  return Array.from({ length: count }, (_, i) => ({
    name: `repo-${i + 1}`,
    path: `/path/to/repo-${i + 1}`,
    organization: `org-${(i % 2) + 1}`,
    commits: [{
      hash: `commit-${i}${i}${i}`,
      message: `Commit message ${i + 1}`,
      author: `user${i}@example.com`,
      date: new Date(Date.now() - i * 86400000).toISOString() // i days ago
    }]
  }));
};

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment,
  withTimeout,
  testConfig,
  testData,
  generateMockRepositories
};
