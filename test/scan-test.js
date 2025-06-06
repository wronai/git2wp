import puppeteer from 'puppeteer';

async function testScanRepositories() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        dumpio: true // Enable browser process logging
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable request/response logging
        page.on('request', request => 
            console.log('>>', request.method(), request.url())
        );
        page.on('response', response => 
            console.log('<<', response.status(), response.url())
        );
        
        // Log console messages
        page.on('console', msg => {
            const type = msg.type();
            if (['error', 'warning', 'log', 'info'].includes(type)) {
                console.log(`PAGE ${type.toUpperCase()}:`, msg.text());
            }
        });
        
        console.log('Navigating to http://localhost:3001...');
        await page.goto('http://localhost:3001', { 
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        console.log('Page loaded, checking for scan button...');
        
        // Wait for the scan button to be visible
        const scanButton = await page.waitForSelector('#scan-repos', { 
            visible: true, 
            timeout: 10000 
        });
        
        // Check button state
        const isDisabled = await page.$eval('#scan-repos', btn => btn.disabled);
        console.log('Scan button found. Disabled:', isDisabled);
        
        if (isDisabled) {
            console.log('Button is disabled, checking for error messages...');
            const errorMessages = await page.$$eval('.error-message, .alert-danger', 
                elements => elements.map(el => el.textContent.trim())
            );
            if (errorMessages.length > 0) {
                console.log('Error messages found:', errorMessages);
            }
        }
        
        console.log('Clicking scan button...');
        await scanButton.click();
        
        // Check if button shows loading state
        const buttonText = await page.$eval('#scan-repos', btn => btn.innerHTML);
        console.log('Button content after click:', buttonText);
        
        // Wait for the repository select to be populated or show an error
        console.log('Waiting for repository select to update...');
        try {
            await page.waitForFunction(
                'document.querySelector("#repository-select").children.length > 1 || ' +
                'document.querySelector("#repository-select").textContent.includes("Error")',
                { 
                    timeout: 15000,
                    polling: 500
                }
            );
        } catch (error) {
            console.error('Error waiting for repository select update:', error);
            
            // Take a screenshot for debugging
            await page.screenshot({ path: 'scan-error.png' });
            console.log('Screenshot saved as scan-error.png');
            
            // Check if there are any errors in the console
            const consoleLogs = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('script')).map(script => {
                    try {
                        // Try to find any inline scripts that might contain errors
                        return script.textContent;
                    } catch (e) {
                        return '';
                    }
                }).join('\n');
            });
            
            if (consoleLogs.includes('error') || consoleLogs.includes('Error')) {
                console.log('Potential errors found in scripts:', consoleLogs);
            }
            
            throw error;
        }
        
        // Check if there was an error
        const selectText = await page.$eval('#repository-select', select => select.textContent);
        
        if (selectText.includes('Error')) {
            console.error('Error scanning repositories:', selectText);
            return false;
        }
        
        // Check if repositories were found
        const options = await page.$$('#repository-select option');
        console.log(`Found ${options.length - 1} repositories`);
        
        return options.length > 1;
        
    } catch (error) {
        console.error('Test failed:', error);
        return false;
    } finally {
        await browser.close();
    }
}

// Run the test
testScanRepositories()
    .then(success => {
        console.log(success ? 'Test passed!' : 'Test failed!');
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });
