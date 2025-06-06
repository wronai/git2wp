import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Git2WP Application', () => {
    let browser;
    let page;
    const APP_URL = 'http://localhost:3001';

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
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
            if (['error', 'warning'].includes(type)) {
                console.log(`CONSOLE ${type.toUpperCase()}:`, msg.text());
            }
        });
    });

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    test('loads the home page', async () => {
        await page.goto(APP_URL, { waitUntil: 'networkidle0' });
        await expect(page.title()).resolves.toMatch('Git2WP - WordPress Git Publisher');
    });

    test('scans repositories when scan button is clicked', async () => {
        // Navigate to the home page
        await page.goto(APP_URL, { waitUntil: 'networkidle0' });
        
        // Wait for the scan button to be visible
        const scanButton = await page.waitForSelector('#scan-repos');
        expect(scanButton).toBeTruthy();
        
        // Mock the API response
        await page.setRequestInterception(true);
        
        const mockRepos = [
            { organization: 'testorg', name: 'repo1' },
            { organization: 'testorg', name: 'repo2' }
        ];
        
        page.on('request', request => {
            if (request.url().includes('/api/git/repos') && request.method() === 'GET') {
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        data: mockRepos
                    })
                });
            } else {
                request.continue();
            }
        });
        
        // Click the scan button
        await Promise.all([
            page.waitForResponse(response => 
                response.url().includes('/api/git/repos') && 
                response.request().method() === 'GET'
            ),
            scanButton.click()
        ]);
        
        // Check if the select list is updated
        await page.waitForSelector('#repository-select option', { timeout: 5000 });
        const options = await page.$$eval('#repository-select option', 
            options => options.map(option => ({
                value: option.value,
                text: option.textContent
            }))
        );
        
        // Should have 3 options: default + 2 repos
        expect(options.length).toBe(3);
        expect(options[1].text).toContain('testorg/repo1');
        expect(options[2].text).toContain('testorg/repo2');
        
        // Verify the select is enabled after loading
        const isSelectDisabled = await page.$eval(
            '#repository-select', 
            select => select.disabled
        );
        expect(isSelectDisabled).toBe(false);
    });

    test('enables analyze button when repository is selected and date is set', async () => {
        await page.goto(APP_URL, { waitUntil: 'networkidle0' });
        
        // Mock the API response for repositories
        await page.setRequestInterception(true);
        const mockRepos = [{ organization: 'testorg', name: 'repo1' }];
        
        page.on('request', request => {
            if (request.url().includes('/api/git/repos') && request.method() === 'GET') {
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: mockRepos })
                });
            } else {
                request.continue();
            }
        });
        
        // Click scan button
        await page.click('#scan-repos');
        await page.waitForSelector('#repository-select:not([disabled])');
        
        // Select a repository
        await page.select('#repository-select', '0');
        
        // Set a date (today by default)
        const today = new Date().toISOString().split('T')[0];
        await page.$eval('#date-select', (el, date) => el.value = date, today);
        
        // Verify analyze button is enabled
        const isAnalyzeDisabled = await page.$eval(
            '#analyze-btn', 
            button => button.disabled
        );
        
        expect(isAnalyzeDisabled).toBe(false);
    });

    test('shows error when repository scan fails', async () => {
        await page.goto(APP_URL, { waitUntil: 'networkidle0' });
        
        // Mock a failed API response
        await page.setRequestInterception(true);
        
        page.on('request', request => {
            if (request.url().includes('/api/git/repos') && request.method() === 'GET') {
                request.respond({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: false,
                        error: 'Failed to scan repositories'
                    })
                });
            } else {
                request.continue();
            }
        });
        
        // Click the scan button
        await page.click('#scan-repos');
        
        // Check for error message
        await page.waitForFunction(
            'document.querySelector("#repository-select")?.innerText.includes("Error")',
            { timeout: 5000 }
        );
        
        const selectText = await page.$eval(
            '#repository-select', 
            select => select.textContent
        );
        
        expect(selectText).toContain('Error');
    });
});
