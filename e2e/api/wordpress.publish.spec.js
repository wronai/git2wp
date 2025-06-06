// @ts-check
import { test, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper.js';

test.describe('WordPress Publishing API', () => {
  let apiHelper;
  let testPostData = {
    title: 'Test Post from API',
    content: 'This is a test post created by the API test suite',
    status: 'draft',
    categories: ['test'],
    tags: ['api-test', 'automated']
  };
  let createdPostId = null;

  test.beforeEach(async ({ request }) => {
    apiHelper = new ApiHelper(request);
  });

  test.afterEach(async () => {
    // Cleanup: Delete the test post if it was created
    if (createdPostId) {
      try {
        await apiHelper.request.delete(`/wordpress/posts/${createdPostId}`);
      } catch (error) {
        console.warn('Failed to clean up test post:', error);
      }
    }
  });

  test('should authenticate with WordPress', async () => {
    // Skip if WordPress URL is not configured
    test.skip(!process.env.WORDPRESS_URL, 'WordPress URL is not configured');
    
    // Act - Test authentication by getting current user
    const response = await apiHelper.get('/wordpress/me');
    
    // Assert
    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('username');
    expect(response).toHaveProperty('name');
  });

  test('should create a new post', async () => {
    // Skip if WordPress URL is not configured
    test.skip(!process.env.WORDPRESS_URL, 'WordPress URL is not configured');
    
    // Act
    const response = await apiHelper.post('/wordpress/posts', testPostData);
    
    // Store the created post ID for cleanup
    createdPostId = response.id;
    
    // Assert
    expect(response).toHaveProperty('id');
    expect(response.title.rendered).toContain(testPostData.title);
    expect(response.status).toBe(testPostData.status);
    expect(response.content.rendered).toContain(testPostData.content);
  });

  test('should update an existing post', async () => {
    // Skip if WordPress URL is not configured
    test.skip(!process.env.WORDPRESS_URL, 'WordPress URL is not configured');
    
    // Arrange - First create a post
    const createResponse = await apiHelper.post('/wordpress/posts', testPostData);
    createdPostId = createResponse.id;
    
    // Update data
    const updateData = {
      title: 'Updated ' + testPostData.title,
      content: 'This post has been updated',
      status: 'publish'
    };
    
    // Act - Update the post
    const updateResponse = await apiHelper.post(
      `/wordpress/posts/${createdPostId}`,
      updateData
    );
    
    // Assert
    expect(updateResponse.id).toBe(createdPostId);
    expect(updateResponse.title.rendered).toContain(updateData.title);
    expect(updateResponse.status).toBe(updateData.status);
    expect(updateResponse.content.rendered).toContain(updateData.content);
  });

  test('should get a list of posts', async () => {
    // Skip if WordPress URL is not configured
    test.skip(!process.env.WORDPRESS_URL, 'WordPress URL is not configured');
    
    // Act
    const response = await apiHelper.get('/wordpress/posts', {
      per_page: 5,
      page: 1
    });
    
    // Assert
    expect(Array.isArray(response)).toBeTruthy();
    
    // If there are posts, verify their structure
    if (response.length > 0) {
      const post = response[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('content');
      expect(post).toHaveProperty('status');
    }
  });

  test('should delete a post', async () => {
    // Skip if WordPress URL is not configured
    test.skip(!process.env.WORDPRESS_URL, 'WordPress URL is not configured');
    
    // Arrange - First create a post
    const createResponse = await apiHelper.post('/wordpress/posts', testPostData);
    const postId = createResponse.id;
    
    // Act - Delete the post
    const deleteResponse = await apiHelper.request.delete(`/wordpress/posts/${postId}`, {
      params: { force: true } // Bypass trash and force deletion
    });
    
    // Assert
    expect(deleteResponse.status()).toBe(200);
    const responseBody = await deleteResponse.json();
    expect(responseBody).toHaveProperty('deleted', true);
    
    // Verify the post is deleted
    const getResponse = await apiHelper.request.get(`/wordpress/posts/${postId}`);
    expect(getResponse.status()).toBe(404);
  });
});
