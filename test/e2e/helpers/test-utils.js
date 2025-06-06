/**
 * Helper functions for Playwright tests
 */

export class TestUtils {
  /**
   * Wait for a specific response from the page
   * @param {import('@playwright/test').Page} page - The Playwright page object
   * @param {string} url - The URL to wait for
   * @param {number} [timeout=10000] - Timeout in milliseconds
   * @returns {Promise<Object>} The response object
   */
  static async waitForResponse(page, url, timeout = 10000) {
    return page.waitForResponse(
      response => response.url().includes(url),
      { timeout }
    );
  }

  /**
   * Wait for a specific element to be visible
   * @param {import('@playwright/test').Page} page - The Playwright page object
   * @param {string} selector - The CSS selector of the element
   * @param {number} [timeout=10000] - Timeout in milliseconds
   * @returns {Promise<import('@playwright/test').ElementHandle>} The element handle
   */
  static async waitForElement(page, selector, timeout = 10000) {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return page.$(selector);
  }

  /**
   * Fill a form field and verify the value
   * @param {import('@playwright/test').Page} page - The Playwright page object
   * @param {string} selector - The CSS selector of the input field
   * @param {string} value - The value to fill
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.clear=true] - Whether to clear the field first
   * @param {number} [options.timeout=5000] - Timeout in milliseconds
   */
  static async fillField(page, selector, value, { clear = true, timeout = 5000 } = {}) {
    const field = await this.waitForElement(page, selector, timeout);
    if (clear) {
      await field.fill('');
    }
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }

  /**
   * Click an element and wait for navigation
   * @param {import('@playwright/test').Page} page - The Playwright page object
   * @param {string} selector - The CSS selector of the element to click
   * @param {Object} [options] - Additional options
   * @param {number} [options.timeout=10000] - Timeout in milliseconds
   * @param {boolean} [options.waitForNavigation=true] - Whether to wait for navigation
   */
  static async clickAndWaitForNavigation(page, selector, { timeout = 10000, waitForNavigation = true } = {}) {
    const [navigation] = waitForNavigation 
      ? await Promise.all([
          page.waitForNavigation({ timeout, waitUntil: 'networkidle' }),
          page.click(selector, { timeout })
        ])
      : await page.click(selector, { timeout });
    return navigation;
  }

  /**
   * Take a screenshot of the current page
   * @param {import('@playwright/test').Page} page - The Playwright page object
   * @param {string} name - The name of the screenshot file (without extension)
   * @param {Object} [options] - Additional options
   * @param {string} [options.dir='test-results/screenshots'] - Directory to save the screenshot
   * @param {boolean} [options.fullPage=false] - Whether to capture the full page
   */
  static async takeScreenshot(page, name, { dir = 'test-results/screenshots', fullPage = false } = {}) {
    await page.screenshot({
      path: `${dir}/${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
      fullPage
    });
  }
}
