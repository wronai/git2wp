// @ts-check
import { request } from '@playwright/test';

/**
 * Global setup function that runs once before all tests
 * @param {import('@playwright/test').FullConfig} config
 */
export default async (config) => {
  const { baseURL } = config.projects[0].use;
  
  // Create a new request context
  const requestContext = await request.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
  });

  try {
    // Perform any global setup here (e.g., authenticate, set up test data)
    console.log('Running global setup...');
    
    // Verify API is accessible
    const healthResponse = await requestContext.get('/health');
    if (!healthResponse.ok()) {
      throw new Error(`API health check failed: ${healthResponse.status()}`);
    }
    
    console.log('Global setup completed successfully');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    // Clean up
    await requestContext.dispose();
  }
};
