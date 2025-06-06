import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Create test-results directory if it doesn't exist
import { mkdirSync, existsSync } from 'fs';
if (!existsSync('test-results/screenshots')) {
  mkdirSync('test-results/screenshots', { recursive: true });
}

test.describe('Git2WP Application', () => {
  // Set a default test timeout to 60 seconds
  test.setTimeout(60000);

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
      // Take a screenshot on error
      await page.screenshot({ path: 'test-results/screenshots/beforeEach-error.png' });
      throw error;
    }
  });

// Test repository scanning functionality
test.describe('Repository Scanning', () => {
  testCases.repository_scan_tests.forEach((testCase, index) => {
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
          console.log(`[${testCase.name}] Executing action: ${actionName}`);
          
          try {
            switch (action.action) {
              case 'navigate':
                await withTimeout(
                  page.goto(action.url || '/', { waitUntil: 'networkidle' }),
                  stepTimeout,
                  `Navigation to ${action.url} timed out`
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
                  page.fill(action.selector, action.value, { timeout: stepTimeout }),
                  stepTimeout,
                  `Filling ${action.selector} timed out`
                );
                break;
                
              case 'selectOption':
                await withTimeout(
                  page.selectOption(action.selector, action.value, { timeout: stepTimeout }),
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
            
            // Add a small delay between actions with timeout
            await withTimeout(
              page.waitForTimeout(500),
              1000,
              'Delay between actions timed out'
            );
            
          } catch (error) {
            console.error(`Error in action ${actionName}:`, error);
            throw error; // Re-throw to fail the test
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
            
          } catch (error) {
            console.error('Assertion failed:', error);
            // Take a screenshot on assertion failure
            const screenshotPath = `test-results/screenshots/failure-${testCase.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
            await page.screenshot({ path: screenshotPath });
            console.log(`Screenshot saved to: ${screenshotPath}`);
            throw error; // Re-throw to fail the test
          }
        }
      } catch (error) {
        console.error(`Test case failed: ${testCase.name}`, error);
        throw error; // Re-throw to mark test as failed
      }
    });
  });
});

  // Test form validation with timeout handling
  test.describe('Form Validation', () => {
    test.setTimeout(120000); // 2 minutes for form validation tests
    
    testCases.form_validation_tests.forEach((testCase, index) => {
      test(`[${index + 1}] ${testCase.name}`, async ({ page }, testInfo) => {
        testInfo.setTimeout(120000); // 2 minutes for this test
        const stepTimeout = 30000; // 30s timeout per step
        
        console.log(`\nRunning test: ${testCase.name}`);
        console.log(`Description: ${testCase.description}`);
        
        try {
          // Execute actions with timeout
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
                default:
                  throw new Error(`Unknown action: ${action.action}`);
              }
              
              // Add a small delay between actions with timeout
              await withTimeout(
                page.waitForTimeout(500),
                1000,
                'Delay between actions timed out'
              );
              
            } catch (error) {
              console.error(`Error in form validation action ${actionName}:`, error);
              throw error;
            }

          }
          
          // Verify assertions with timeout
          console.log(`[Form Validation] Verifying assertions`);
          
          for (const assertion of testCase.assertions || []) {
            try {
              if (assertion.text) {
                const element = page.locator(assertion.selector);
                await withTimeout(
                  expect(element).toContainText(assertion.text),
                  stepTimeout,
                  `Text assertion failed for selector: ${assertion.selector}`
                );
              }
              
              if (assertion.exists) {
                const element = page.locator(assertion.selector);
                await withTimeout(
                  expect(element).toBeVisible(),
                  stepTimeout,
                  `Element not visible: ${assertion.selector}`
                );
              }
              
            } catch (error) {
              console.error('Form validation assertion failed:', error);
              // Take a screenshot on assertion failure
              const screenshotPath = `test-results/screenshots/form-validation-failure-${testCase.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
              await page.screenshot({ path: screenshotPath });
              console.log(`Screenshot saved to: ${screenshotPath}`);
              throw error;
            }
          }
          
        } catch (error) {
          console.error(`Form validation test case failed: ${testCase.name}`, error);
          throw error;
        }
        }
      });
    });
  });
});

// API tests
test.describe('API Tests', () => {
  testCases.api_tests.forEach(testCase => {
    test(testCase.name, async ({ request }) => {
      console.log(`\nRunning API test: ${testCase.name}`);
      console.log(`Description: ${testCase.description}`);

      const response = await request[testCase.request.method.toLowerCase()](testCase.request.url);
      
      // Verify status code
      if (testCase.assertions) {
        for (const assertion of testCase.assertions) {
          if (assertion.status) {
            expect(response.status()).toBe(assertion.status);
          }
          
          if (assertion.jsonPath) {
            const json = await response.json();
            const value = jsonPath(json, assertion.jsonPath);
            
            if (assertion.equals !== undefined) {
              expect(value).toBe(assertion.equals);
            } else if (assertion.exists !== undefined) {
              if (assertion.exists) {
                expect(value).toBeDefined();
              } else {
                expect(value).toBeUndefined();
              }
            }
          }
        }
      }
    });
  });
});

// Simple JSON path implementation
function jsonPath(obj, path) {
  return path.split('.').reduce((o, p) => o && o[p], obj);
}
