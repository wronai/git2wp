import puppeteer from 'puppeteer';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSettingsPage() {
  // Launch a headless browser
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI/CD
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'],
    dumpio: true // Enable browser process logging
  });

  let page;
  
  try {
    // Open a new page
    page = await browser.newPage();
    
    // Set a default timeout for all page actions
    page.setDefaultTimeout(15000);

    // Enable request/response logging
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log('>>', request.method(), request.url());
      }
      request.continue();
    });

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log('<<', response.status(), response.url());
      }
    });

    // Log console messages
    page.on('console', msg => {
      const type = msg.type();
      if (['error', 'warning'].includes(type)) {
        console.log(`CONSOLE ${type.toUpperCase()}:`, msg.text());
      }
    });

    // Log page errors
    page.on('pageerror', error => {
      console.error('PAGE ERROR:', error.message);
    });

    // Log request failures
    page.on('requestfailed', request => {
      console.error('REQUEST FAILED:', request.failure().errorText, request.url());
    });

    // Navigate to the settings page
    console.log('\n=== 1. Navigating to settings page... ===');
    await page.goto('http://localhost:3001/settings.html', { 
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000
    });

    // Wait for the settings form to load
    console.log('\n=== 2. Waiting for settings form... ===');
    try {
      await page.waitForSelector('#settings-form', { 
        visible: true, 
        timeout: 10000 
      });
      console.log('✅ Settings form is visible');
    } catch (error) {
      console.error('❌ Settings form not found');
      throw error;
    }

    // Check if save button exists
    console.log('\n=== 3. Checking save button... ===');
    let saveButton;
    try {
      saveButton = await page.$('button[type="submit"]');
      const saveButtonText = await page.evaluate(btn => btn ? btn.textContent.trim() : 'Not found', saveButton);
      console.log(`✅ Save button found: "${saveButtonText}"`);
    } catch (error) {
      console.error('❌ Save button not found');
      throw error;
    }

    // Test 4: Try to save settings
    console.log('\n=== 4. Attempting to save settings... ===');
    
    // Wait for any pending requests to complete
    await page.waitForNetworkIdle({ idleTime: 1000 });
    
    // Set up response listener before clicking the button
    const savePromise = page.waitForResponse(response => 
      response.url().includes('/api/config') && 
      response.request().method() === 'POST',
      { timeout: 10000 }
    );
    
    // Click the save button
    console.log('Clicking save button...');
    await saveButton.click();
    
    try {
      const response = await savePromise;
      console.log(`✅ Save request completed with status: ${response.status()}`);
      
      try {
        const data = await response.json();
        console.log('Save response data:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.warn('Could not parse response as JSON:', await response.text());
      }
    } catch (error) {
      console.error('❌ Save request failed or timed out:', error.message);
      
      // Check for any error messages on the page
      const errorMessages = await page.$$eval('.alert-danger, .error-message', 
        elements => elements.map(el => el.textContent.trim())
      );
      
      if (errorMessages.length > 0) {
        console.log('Error messages on page:', errorMessages);
      }
      
      throw error;
    }

    // Take a screenshot
    console.log('\n=== 5. Taking screenshot... ===');
    await delay(2000); // Wait for any UI updates
    await page.screenshot({ 
      path: 'settings-test.png', 
      fullPage: true 
    });
    console.log('✅ Screenshot saved as settings-test.png');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    // Take a screenshot on error if page is available
    if (page) {
      try {
        await page.screenshot({ 
          path: 'settings-error.png', 
          fullPage: true 
        });
        console.log('✅ Error screenshot saved as settings-error.png');
      } catch (screenshotError) {
        console.error('Failed to take error screenshot:', screenshotError);
      }
    }
    
    return 1; // Return error code
    
  } finally {
    // Close the browser
    console.log('\n=== Cleaning up... ===');
    if (browser) {
      await browser.close();
      console.log('✅ Browser closed');
    }
    return 0; // Success
  }
}

// Run the test
(async () => {
  console.log('=== Starting settings page test ===');
  const exitCode = await testSettingsPage();
  console.log('=== Test completed with exit code', exitCode, '===');
  process.exit(exitCode);
})();
