import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure test results directory exists
const resultsDir = join(__dirname, '../test-results/screenshots');
if (!existsSync(resultsDir)) {
  mkdirSync(resultsDir, { recursive: true });
}

// Load test cases from YAML file
const testCasesPath = join(__dirname, 'test-data/test-cases.yaml');
const testCases = yaml.load(readFileSync(testCasesPath, 'utf8'));

// Helper function to wrap test steps with timeout and error handling
async function withTimeout(promise, timeout = 30000, errorMessage = 'Operation timed out') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeout);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper function to take a screenshot
async function takeScreenshot(page, testName) {
  const safeTestName = testName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = join(resultsDir, `${safeTestName}-${timestamp}.png`);
  
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error('Failed to take screenshot:', error);
    return null;
  }
}

test.describe('Git2WP Application', () => {
  // Set a default test timeout to 2 minutes
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    try {
      // Navigate to the home page before each test with timeout
      await withTimeout(
        page.goto('http://localhost:3001', { waitUntil: 'networkidle' }),
        30000,
        'Navigation to home page timed out'
      );
      
      // Verify page title with timeout
      await withTimeout(
        expect(page).toHaveTitle('Git2WP - WordPress Git Publisher'),
        10000,
        'Page title verification timed out'
      );
    } catch (error) {
      console.error('Error in beforeEach:', error);
      await takeScreenshot(page, 'beforeEach-error');
      throw error;
    }
  });

  // Test repository scanning functionality
  test.describe('Repository Scanning', () => {
    testCases.repository_scan_tests.forEach((testCase, index) => {
      test(`[${index + 1}] ${testCase.name}`, async ({ page }, testInfo) => {
        // Set a timeout for this specific test
        testInfo.setTimeout(180000); // 3 minutes
        const stepTimeout = 30000; // 30s timeout per step
        
        console.log(`\nRunning test: ${testCase.name}`);
        console.log(`Description: ${testCase.description}`);

        try {
          // Execute actions
          for (const action of testCase.actions || []) {
            const actionName = action.action || 'unknown';
            console.log(`[${testCase.name}] Executing action: ${actionName}`);
            
            try {
              switch (action.action) {
                case 'navigate':
                  await withTimeout(
                    page.goto(action.url || 'http://localhost:3001', { 
                      waitUntil: 'networkidle',
                      timeout: stepTimeout 
                    }),
                    stepTimeout,
                    `Navigation to ${action.url || 'home page'} timed out`
                  );
                  break;
                  
                case 'click':
                  await withTimeout(
                    page.click(action.selector, { timeout: stepTimeout }),
                    stepTimeout,
                    `Click on ${action.selector} timed out`
                  );
                  break;
                  
                case 'fill':
                  await withTimeout(
                    page.fill(
                      action.selector, 
                      action.value, 
                      { timeout: stepTimeout }
                    ),
                    stepTimeout,
                    `Filling ${action.selector} timed out`
                  );
                  break;
                  
                case 'selectOption':
                  await withTimeout(
                    page.selectOption(
                      action.selector, 
                      action.value, 
                      { timeout: stepTimeout }
                    ),
                    stepTimeout,
                    `Selecting option in ${action.selector} timed out`
                  );
                  break;
                  
                case 'waitForSelector':
                  await withTimeout(
                    page.waitForSelector(action.selector, { 
                      state: action.state || 'visible',
                      timeout: stepTimeout 
                    }),
                    stepTimeout,
                    `Waiting for selector ${action.selector} timed out`
                  );
                  break;
                  
                case 'waitForResponse':
                  await withTimeout(
                    page.waitForResponse(
                      response => response.url().includes(action.url) && 
                      (!action.method || response.request().method() === action.method),
                      { timeout: stepTimeout }
                    ),
                    stepTimeout,
                    `Waiting for response from ${action.url} timed out`
                  );
                  break;
                  
                default:
                  throw new Error(`Unknown action: ${action.action}`);
              }
              
              // Add a small delay between actions
              await page.waitForTimeout(500);
              
            } catch (error) {
              console.error(`Error in action ${actionName}:`, error);
              await takeScreenshot(page, `action-error-${testCase.name}-${actionName}`);
              throw error;
            }
          }
          
          // Verify assertions with timeout
          console.log(`[${testCase.name}] Verifying assertions`);
          
          for (const assertion of testCase.assertions || []) {
            try {
              if (assertion.text !== undefined) {
                if (assertion.selector) {
                  const element = page.locator(assertion.selector);
                  await withTimeout(
                    expect(element).toContainText(assertion.text),
                    stepTimeout,
                    `Text assertion failed for selector: ${assertion.selector}`
                  );
                } else {
                  await withTimeout(
                    expect(page).toContainText(assertion.text),
                    stepTimeout,
                    'Page text assertion failed'
                  );
                }
              }
              
              if (assertion.exists !== undefined) {
                const element = page.locator(assertion.selector);
                await withTimeout(
                  assertion.exists ? 
                    expect(element).toBeVisible() : 
                    expect(element).not.toBeVisible(),
                  stepTimeout,
                  `Visibility assertion failed for selector: ${assertion.selector}`
                );
              }
              
              if (assertion.isDisabled !== undefined) {
                const element = page.locator(assertion.selector);
                await withTimeout(
                  assertion.isDisabled ?
                    expect(element).toBeDisabled() :
                    expect(element).toBeEnabled(),
                  stepTimeout,
                  `Disabled state assertion failed for selector: ${assertion.selector}`
                );
              }
              
              if (assertion.count !== undefined) {
                const elements = page.locator(assertion.selector);
                await withTimeout(
                  expect(elements).toHaveCount(assertion.count),
                  stepTimeout,
                  `Count assertion failed for selector: ${assertion.selector}`
                );
              }
              
            } catch (error) {
              console.error('Assertion failed:', error);
              await takeScreenshot(page, `assertion-failed-${testCase.name}`);
              throw error;
            }
          }
          
        } catch (error) {
          console.error(`Test case failed: ${testCase.name}`, error);
          await takeScreenshot(page, `test-failed-${testCase.name}`);
          throw error;
        }
      });
    });
  });

  // Test form validation
  test.describe('Form Validation', () => {
    testCases.form_validation_tests.forEach((testCase, index) => {
      test(`[${index + 1}] ${testCase.name}`, async ({ page }, testInfo) => {
        // Set a timeout for this specific test
        testInfo.setTimeout(120000); // 2 minutes
        const stepTimeout = 30000; // 30s timeout per step
        
        console.log(`\nRunning test: ${testCase.name}`);
        console.log(`Description: ${testCase.description}`);
        
        try {
          // Execute actions
          for (const action of testCase.actions || []) {
            const actionName = action.action || 'unknown';
            console.log(`[Form Validation] Executing action: ${actionName}`);
            
            try {
              switch (action.action) {
                case 'click':
                  await withTimeout(
                    page.click(action.selector, { timeout: stepTimeout }),
                    stepTimeout,
                    `Click on ${action.selector} timed out`
                  );
                  break;
                  
                case 'fill':
                  await withTimeout(
                    page.fill(
                      action.selector, 
                      action.value, 
                      { timeout: stepTimeout }
                    ),
                    stepTimeout,
                    `Filling ${action.selector} timed out`
                  );
                  break;
                  
                default:
                  throw new Error(`Unknown action: ${action.action}`);
              }
              
              // Add a small delay between actions
              await page.waitForTimeout(500);
              
            } catch (error) {
              console.error(`Error in form action ${actionName}:`, error);
              await takeScreenshot(page, `form-action-error-${testCase.name}-${actionName}`);
              throw error;
            }
          }
          
          // Verify assertions
          console.log(`[Form Validation] Verifying assertions`);
          
          for (const assertion of testCase.assertions || []) {
            try {
              if (assertion.text !== undefined) {
                const element = page.locator(assertion.selector);
                await withTimeout(
                  expect(element).toContainText(assertion.text),
                  stepTimeout,
                  `Text assertion failed for selector: ${assertion.selector}`
                );
              }
              
              if (assertion.exists !== undefined) {
                const element = page.locator(assertion.selector);
                await withTimeout(
                  assertion.exists ? 
                    expect(element).toBeVisible() : 
                    expect(element).not.toBeVisible(),
                  stepTimeout,
                  `Visibility assertion failed for selector: ${assertion.selector}`
                );
              }
              
              if (assertion.isDisabled !== undefined) {
                const element = page.locator(assertion.selector);
                await withTimeout(
                  assertion.isDisabled ?
                    expect(element).toBeDisabled() :
                    expect(element).toBeEnabled(),
                  stepTimeout,
                  `Disabled state assertion failed for selector: ${assertion.selector}`
                );
              }
              
            } catch (error) {
              console.error('Form validation assertion failed:', error);
              await takeScreenshot(page, `form-assertion-failed-${testCase.name}`);
              throw error;
            }
          }
          
        } catch (error) {
          console.error(`Form validation test case failed: ${testCase.name}`, error);
          await takeScreenshot(page, `form-test-failed-${testCase.name}`);
          throw error;
        }
      });
    });
  });
});
