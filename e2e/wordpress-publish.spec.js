// @ts-check
import { test, expect } from '@playwright/test';

test.describe('WordPress Publishing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Mock the repositories API
    await page.route('**/api/git/repos', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repositories: [{
            path: '/path/to/repo1',
            name: 'test-repo',
            organization: 'testorg',
            commits: [{
              hash: 'abc123',
              message: 'Initial commit',
              author: 'test@example.com',
              date: new Date().toISOString()
            }]
          }]
        })
      });
    });
    
    // Click the scan button to load repositories
    await page.getByRole('button', { name: /scan repositories/i }).click();
    await page.locator('#repository-select').waitFor({ state: 'visible' });
  });

  test('should allow selecting a repository and show commit details', async ({ page }) => {
    // Select the repository
    await page.selectOption('#repository-select', '0');
    
    // Verify the commit details are shown
    await expect(page.locator('.commit-details')).toBeVisible();
    await expect(page.getByText('Initial commit')).toBeVisible();
  });

  test('should publish a post to WordPress', async ({ page }) => {
    // Mock the WordPress API
    await page.route('**/api/wordpress/posts', async route => {
      const request = route.request();
      const postData = request.postDataJSON();
      
      // Verify the request data
      expect(postData).toHaveProperty('title');
      expect(postData).toHaveProperty('content');
      
      // Return a success response
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 123,
          title: { rendered: postData.title },
          content: { rendered: postData.content },
          status: 'publish',
          link: 'https://example.com/test-post'
        })
      });
    });

    // Select the repository
    await page.selectOption('#repository-select', '0');
    
    // Fill in the post details
    await page.fill('#post-title', 'Test Post');
    await page.fill('#post-content', 'This is a test post content.');
    
    // Click the publish button
    const publishButton = page.getByRole('button', { name: /publish to wordpress/i });
    await publishButton.click();
    
    // Verify success message
    await expect(page.getByText(/post published successfully/i)).toBeVisible();
    await expect(page.getByText('https://example.com/test-post')).toBeVisible();
  });

  test('should show error when publishing fails', async ({ page }) => {
    // Mock a failed WordPress API request
    await page.route('**/api/wordpress/posts', async route => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Failed to publish post' })
      });
    });

    // Select the repository
    await page.selectOption('#repository-select', '0');
    
    // Fill in the post details
    await page.fill('#post-title', 'Test Post');
    await page.fill('#post-content', 'This is a test post content.');
    
    // Click the publish button
    const publishButton = page.getByRole('button', { name: /publish to wordpress/i });
    await publishButton.click();
    
    // Verify error message
    await expect(page.getByText(/failed to publish post/i)).toBeVisible();
  });
});
