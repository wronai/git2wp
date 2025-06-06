import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../../config.js';

// Use configuration from config.js
const APP_URL = TEST_CONFIG.BASE_URL;
const WAIT_TIMEOUT = 60000; // 60 seconds

// Test credentials - these should be set in the environment
// or use the default values for a fresh Open WebUI installation
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password';

test('Debug login flow', async ({ page }) => {
  // Listen to all network requests
  const requests = [];
  const requestHandler = request => {
    const url = request.url();
    if (url.includes('auth') || url.includes('login') || url.includes('signin')) {
      console.log(`Request: ${request.method()} ${url}`);
      requests.push({
        url: url,
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
    }
  };
  
  // Listen to all responses
  const responses = [];
  const responseHandler = async response => {
    const url = response.url();
    if (url.includes('auth') || url.includes('login') || url.includes('signin')) {
      try {
        const body = await response.text().catch(() => 'Could not parse response body');
        const responseData = {
          url: url,
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
          body: body
        };
        console.log(`Response: ${response.status()} ${response.statusText()} ${url}`);
        responses.push(responseData);
      } catch (e) {
        console.error('Error processing response:', e);
      }
    }
  };
  
  // Add listeners
  page.on('request', requestHandler);
  page.on('response', responseHandler);
  
  // Store console logs
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      args: msg.args()
    });
  });
  console.log('\n--- Starting debug login test ---');
  
  try {
    // Navigate to the page
    console.log(`Navigating to ${APP_URL}...`);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    
    // Log the page URL and title
    console.log(`Page URL: ${page.url()}`);
    console.log(`Page title: ${await page.title()}`);
    
    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(2000);
    
    // Take a screenshot of the initial page
    await page.screenshot({ path: 'test-results/debug-initial.png' });
    
    // Try to find the login form
    const emailInput = await page.$('input[type="email"], input[type="text"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Sign in")');
    
    console.log('\nForm elements found:');
    console.log(`- Email input: ${emailInput ? 'Found' : 'Not found'}`);
    console.log(`- Password input: ${passwordInput ? 'Found' : 'Not found'}`);
    console.log(`- Submit button: ${submitButton ? 'Found' : 'Not found'}`);
    
    // If we found the login form, try to log in
    if (emailInput && passwordInput && submitButton) {
      console.log('\nAttempting to log in...');
      
      // Fill in the form
      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);
      
      // Take a screenshot before submitting
      await page.screenshot({ path: 'test-results/debug-before-login.png' });
      
      // Submit the form without waiting for navigation
      console.log('Clicking submit button...');
      await submitButton.click();
      
      // Wait a bit for any potential navigation or UI update
      console.log('Waiting for 3 seconds...');
      await page.waitForTimeout(3000);
      
      // Take a screenshot after login attempt
      console.log('Taking screenshot after login attempt...');
      await page.screenshot({ path: 'test-results/debug-after-login.png' });
      
      console.log('\nAfter login attempt:');
      console.log(`- URL: ${page.url()}`);
      console.log(`- Title: ${await page.title()}`);
      
      // Check if we're still on the login page
      const currentUrl = page.url();
      const isStillOnLoginPage = currentUrl.includes('login') || 
                                currentUrl === APP_URL || 
                                (await page.$('input[type="email"], input[type="text"]') !== null);
      
      console.log(`- Still on login page: ${isStillOnLoginPage}`);
      
      // Look for error messages
      const errorSelectors = [
        '.error', 
        '.error-message', 
        '[role="alert"]', 
        '.MuiAlert-message',
        '.text-red-500',
        '.text-error'
      ];
      
      let errorFound = false;
      for (const selector of errorSelectors) {
        const errorElement = await page.$(selector);
        if (errorElement) {
          const errorText = await errorElement.textContent();
          if (errorText && errorText.trim()) {
            console.log(`- Error message (${selector}): ${errorText.trim()}`);
            errorFound = true;
          }
        }
      }
      
      if (!errorFound) {
        console.log('- No error messages found');
      }
      
      // Wait a bit more to capture all network activity
      console.log('\nWaiting for network activity to complete...');
      await page.waitForTimeout(5000);
      
      // Log all captured requests and responses
      console.log('\n=== Network Activity ===');
      
      // Log requests with more details
      if (requests.length > 0) {
        console.log('\n=== Requests ===');
        requests.forEach((req, i) => {
          console.log(`\n[${i + 1}] ${req.method} ${req.url}`);
          if (req.postData) {
            console.log('Request Body:', req.postData);
          }
          console.log('Headers:', JSON.stringify(req.headers, null, 2));
        });
      } else {
        console.log('\nNo relevant requests captured');
      }
      
      // Log responses with more details
      if (responses.length > 0) {
        console.log('\n=== Responses ===');
        responses.forEach((res, i) => {
          console.log(`\n[${i + 1}] ${res.status} ${res.statusText} ${res.url}`);
          console.log('Response Body:', res.body.substring(0, 1000) + (res.body.length > 1000 ? '...' : ''));
        });
      } else {
        console.log('\nNo relevant responses captured');
      }
      
      // Check for any cookies
      const cookies = await page.context().cookies();
      if (cookies.length > 0) {
        console.log('\n=== Cookies ===');
        cookies.forEach(cookie => {
          console.log(`- ${cookie.name}: ${cookie.value}`);
        });
      } else {
        console.log('\nNo cookies found');
      }
      
      // Log console messages
      if (consoleLogs.length > 0) {
        console.log('\n=== Browser Console Logs ===');
        consoleLogs.forEach((log, i) => {
          console.log(`[${i + 1}] [${log.type}] ${log.text}`);
        });
      }
      
      // Check if we're still on the login page
      const stillOnLoginPage = await page.$('input[type="email"], input[type="text"]') !== null;
      console.log(`- Still on login page: ${stillOnLoginPage}`);
      
      // Look for error messages
      const errorMessage = await page.$('.error, .error-message, [role="alert"], .MuiAlert-message');
      if (errorMessage) {
        const errorText = await errorMessage.textContent();
        console.log(`- Error message: ${errorText}`);
      } else {
        console.log('- No error messages found');
      }
    } else {
      console.log('\nLogin form not found or incomplete');
    }
    
    // Log the final page HTML for debugging
    const pageContent = await page.content();
    console.log('\nPage content (first 2000 chars):');
    console.log(pageContent.substring(0, 2000) + '...');
    
  } catch (error) {
    console.error('\nError during test:', error);
    
    // Try to take a screenshot on error
    try {
      await page.screenshot({ path: 'test-results/debug-error.png' });
    } catch (e) {
      console.error('Failed to take error screenshot:', e);
    }
    
    throw error;
  }
});
