// @ts-check
import { expect } from '@playwright/test';

/**
 * API Test Helper
 */
export class ApiHelper {
  /**
   * @param {import('@playwright/test').APIRequestContext} request
   */
  constructor(request) {
    this.request = request;
  }

  /**
   * Make a GET request to the API
   * @param {string} endpoint - API endpoint
   * @param {Object} [params] - Query parameters
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, params = {}) {
    const response = await this.request.get(endpoint, { params });
    await this._verifyResponse(response);
    return response.json();
  }

  /**
   * Make a POST request to the API
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, data) {
    const response = await this.request.post(endpoint, { data });
    await this._verifyResponse(response);
    return response.json();
  }

  /**
   * Verify the API response
   * @private
   * @param {import('@playwright/test').APIResponse} response
   */
  async _verifyResponse(response) {
    expect(response.status()).toBe(200);
    
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
    
    const body = await response.json();
    expect(body).toBeDefined();
    
    if (body.error) {
      throw new Error(`API Error: ${body.error}`);
    }
    
    return body;
  }
}
