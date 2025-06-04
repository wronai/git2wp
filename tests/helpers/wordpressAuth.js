/**
 * WordPress Authentication Helper for Tests
 * 
 * This module provides utilities for testing WordPress authentication
 * and generating application passwords programmatically.
 */

class WordPressAuthHelper {
  /**
   * Create a new WordPressAuthHelper instance
   * @param {string} baseUrl - WordPress site URL (e.g., 'http://localhost:8000')
   * @param {string} username - WordPress admin username
   * @param {string} password - WordPress admin password
   */
  constructor(baseUrl, username, password) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.username = username;
    this.password = password;
    this.authHeader = `Basic ${btoa(`${username}:${password}`)}`;
    this.nonce = null;
  }

  /**
   * Get authentication headers with nonce
   * @returns {Object} Headers object with authentication
   */
  async getAuthHeaders() {
    if (!this.nonce) {
      await this.authenticate();
    }
    
    return {
      'X-WP-Nonce': this.nonce,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Authenticate with WordPress and get nonce
   */
  async authenticate() {
    try {
      // First, get the nonce by making a request to the REST API
      const authUrl = `${this.baseUrl}/wp-json`;
      const response = await fetch(authUrl, {
        headers: {
          'Authorization': this.authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.nonce = response.headers.get('x-wp-nonce') || data.nonce;
      
      if (!this.nonce) {
        throw new Error('Could not retrieve nonce from WordPress');
      }
      
      return this.nonce;
    } catch (error) {
      console.error('Authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Create a new application password
   * @param {string} appName - Name for the application
   * @returns {Promise<string>} The generated application password
   */
  async createApplicationPassword(appName = 'Test Application') {
    try {
      const userId = await this.getCurrentUserId();
      const url = `${this.baseUrl}/wp-json/wp/v2/users/${userId}/application-passwords`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: appName })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create application password: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      
      // The password is only available in the response when first created
      if (data && data.password) {
        return data.password;
      }
      
      throw new Error('Failed to create application password: No password in response');
    } catch (error) {
      console.error('Failed to create application password:', error.message);
      throw error;
    }
  }

  /**
   * Get the current user's ID
   * @returns {Promise<number>} User ID
   */
  async getCurrentUserId() {
    try {
      const url = `${this.baseUrl}/wp-json/wp/v2/users/me`;
      const response = await fetch(url, {
        headers: {
          'Authorization': this.authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get current user: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('Failed to get current user ID:', error.message);
      throw error;
    }
  }

  /**
   * Test if the provided credentials are valid
   * @returns {Promise<boolean>} True if credentials are valid
   */
  async testCredentials() {
    try {
      await this.authenticate();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default WordPressAuthHelper;
