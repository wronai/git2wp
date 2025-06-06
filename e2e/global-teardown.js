// @ts-check

/**
 * Global teardown function that runs once after all tests
 * @param {import('@playwright/test').FullConfig} config
 */
export default async (config) => {
  console.log('Running global teardown...');
  
  // Perform any global cleanup here (e.g., remove test data, close connections)
  try {
    // Example: Clean up test data from the database
    // import { MongoClient } from 'mongodb';
    // const client = new MongoClient(process.env.MONGO_URI);
    // await client.connect();
    // await client.db().collection('testData').deleteMany({ test: true });
    // await client.close();
    
    console.log('Global teardown completed successfully');
  } catch (error) {
    console.error('Error during global teardown:', error);
    throw error;
  }
};
