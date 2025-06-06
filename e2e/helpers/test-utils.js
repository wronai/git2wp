// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Navigate to the application and wait for it to be ready
 * @param {import('@playwright/test').Page} page
 */
exports.navigateToApp = async (page) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
};

/**
 * Mock the repositories API response
 * @param {import('@playwright/test').Page} page
 * @param {Array<Object>} repositories - Array of repository objects to return
 */
exports.mockRepositories = async (page, repositories = []) => {
  await page.route('**/api/git/repos', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repositories })
    });
  });
};

/**
 * Mock the WordPress API response for creating a post
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Options for the mock
 * @param {number} [options.status=201] - HTTP status code to return
 * @param {string} [options.error] - Error message to return
 * @param {Object} [options.post] - Post data to return in the response
 */
exports.mockWordPressPublish = async (page, { status = 201, error, post } = {}) => {
  await page.route('**/api/wordpress/posts', async route => {
    if (error) {
      await route.fulfill({
        status: status || 500,
        body: JSON.stringify({ error })
      });
    } else {
      const request = route.request();
      const postData = request.postDataJSON();
      
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 123,
          title: { rendered: post?.title || postData.title },
          content: { rendered: post?.content || postData.content },
          status: 'publish',
          link: post?.link || 'https://example.com/test-post',
          ...post
        })
      });
    }
  });
};

/**
 * Select a repository from the dropdown
 * @param {import('@playwright/test').Page} page
 * @param {number} index - Index of the repository to select (0-based)
 */
exports.selectRepository = async (page, index = 0) => {
  await page.selectOption('#repository-select', index.toString());
  await expect(page.locator('.commit-details')).toBeVisible();
};

/**
 * Fill in the post form
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Form options
 * @param {string} [options.title] - Post title
 * @param {string} [options.content] - Post content
 */
exports.fillPostForm = async (page, { title = 'Test Post', content = 'Test content' } = {}) => {
  if (title) await page.fill('#post-title', title);
  if (content) await page.fill('#post-content', content);
};

/**
 * Click the publish button and wait for the result
 * @param {import('@playwright/test').Page} page
 * @param {Object} options - Options
 * @param {boolean} [options.expectSuccess=true] - Whether to expect a successful publish
 */
exports.publishPost = async (page, { expectSuccess = true } = {}) => {
  const publishButton = page.getByRole('button', { name: /publish to wordpress/i });
  await publishButton.click();
  
  if (expectSuccess) {
    await expect(page.getByText(/post published successfully/i)).toBeVisible();
  } else {
    await expect(page.getByText(/failed to publish post/i)).toBeVisible();
  }
};
