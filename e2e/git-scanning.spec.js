// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Git Repository Scanning', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display the scan repositories button', async ({ page }) => {
    // Check if the scan button is visible and enabled
    const scanButton = page.getByRole('button', { name: /scan repositories/i });
    await expect(scanButton).toBeVisible();
    await expect(scanButton).toBeEnabled();
  });

  test('should scan and display repositories', async ({ page }) => {
    // Mock the API response for scanning repositories
    await page.route('**/api/git/repos', async route => {
      // Simulate a delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Return mock data
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repositories: [
            {
              path: '/path/to/repo1',
              name: 'repo1',
              organization: 'testorg',
              commits: [
                {
                  hash: 'abc123',
                  message: 'Initial commit',
                  author: 'test@example.com',
                  date: '2023-01-01T00:00:00Z'
                }
              ]
            },
            {
              path: '/path/to/repo2',
              name: 'repo2',
              organization: 'testorg',
              commits: [
                {
                  hash: 'def456',
                  message: 'Update README',
                  author: 'test@example.com',
                  date: '2023-01-02T00:00:00Z'
                }
              ]
            }
          ]
        })
      });
    });

    // Click the scan button
    const scanButton = page.getByRole('button', { name: /scan repositories/i });
    await scanButton.click();

    // Check if loading state is shown
    await expect(scanButton.getByText('Scanning...')).toBeVisible();
    
    // Wait for the repositories to be loaded
    const repoSelect = page.locator('#repository-select');
    await repoSelect.waitFor({ state: 'visible' });

    // Verify the repository select has options
    await expect(repoSelect.locator('option')).toHaveCount(3); // Default option + 2 repos
    
    // Verify the repositories are in the select
    await expect(repoSelect.locator('option:nth-child(2)')).toHaveText('testorg/repo1');
    await expect(repoSelect.locator('option:nth-child(3)')).toHaveText('testorg/repo2');
  });

  test('should show error when repository scan fails', async ({ page }) => {
    // Mock a failed API response
    await page.route('**/api/git/repos', async route => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Failed to scan repositories' })
      });
    });

    // Click the scan button
    const scanButton = page.getByRole('button', { name: /scan repositories/i });
    await scanButton.click();

    // Check if error message is shown
    await expect(page.getByText(/failed to scan repositories/i)).toBeVisible();
  });
});
