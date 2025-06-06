import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  // Navigate to the application
  await page.goto('http://localhost:3000');
  
  // Check if the page title contains "Open WebUI"
  await expect(page).toHaveTitle(/Open WebUI/);
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'test-results/screenshot.png' });
});
