import { strict as assert } from 'assert';
import WordPressHelper from './helpers/wordpress-helper.js';

// Skip these tests if WordPress credentials are not set
const shouldRunTests = process.env.WORDPRESS_USERNAME && process.env.WORDPRESS_PASSWORD;

// Skip message
const skipMessage = 'Skipping WordPress API tests - Set WORDPRESS_USERNAME and WORDPRESS_PASSWORD to run these tests';

// Only run tests if we have the required environment variables
(shouldRunTests ? describe : describe.skip)('WordPress Helper', function() {
  // Increase timeout for API tests
  this.timeout(10000);
  
  let helper;
  let testPostId;
  
  before(() => {
    helper = new WordPressHelper(
      process.env.WORDPRESS_URL,
      process.env.WORDPRESS_USERNAME,
      process.env.WORDPRESS_PASSWORD
    );
  });
  
  // Clean up any existing posts before running tests
  before(async function() {
    if (!shouldRunTests) return;
    try {
      console.log('Cleaning up existing posts...');
      const result = await helper.cleanUpPosts();
      console.log(`Cleaned up ${result.deleted} posts`);
    } catch (error) {
      console.error('Error during cleanup:', error.message);
    }
  });
  
  it('should create a new post', async function() {
    const postData = {
      title: 'Test Post',
      content: 'This is a test post',
      status: 'publish'
    };
    
    const post = await helper.createPost(postData);
    assert.ok(post.id, 'Post should have an ID');
    assert.strictEqual(post.title.rendered, postData.title);
    assert.strictEqual(post.status, postData.status);
    
    // Save the post ID for later tests
    testPostId = post.id;
  });
  
  it('should retrieve the created post', async function() {
    const post = await helper.getPost(testPostId);
    assert.strictEqual(post.id, testPostId);
    assert.strictEqual(post.title.rendered, 'Test Post');
  });
  
  it('should delete the test post', async function() {
    const result = await helper.deletePost(testPostId);
    assert.ok(result.deleted, 'Post should be deleted');
    
    // Verify the post is deleted
    try {
      await helper.getPost(testPostId);
      assert.fail('Post should not exist after deletion');
    } catch (error) {
      assert.strictEqual(error.response.status, 404, 'Should return 404 for deleted post');
    }
  });
});

// Add a test that runs when WordPress credentials are not set
(shouldRunTests ? describe.skip : describe)('WordPress Helper - No Credentials', function() {
  it('should skip tests when no credentials are provided', function() {
    console.log(skipMessage);
    this.skip();
  });
});
