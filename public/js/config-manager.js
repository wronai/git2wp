/**
 * Configuration Manager for the frontend
 * Handles loading, saving, and managing application configuration
 */
class ConfigManager {
    constructor() {
        this.config = {};
        this.apiBaseUrl = window.API_URL || '/api';
        this.configUrl = `${this.apiBaseUrl}/config`;
        this.events = {};
    }

    /**
     * Load configuration from the server
     * @returns {Promise<Object>} The loaded configuration
     */
    async load() {
        try {
            const response = await fetch(this.configUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success && data.config) {
                this.config = data.config;
                this.trigger('config:loaded', this.config);
                return this.config;
            } else {
                throw new Error(data.error || 'Failed to load configuration');
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.trigger('config:error', error);
            throw error;
        }
    }

    /**
     * Save configuration to the server
     * @param {Object} updates - Key-value pairs to update
     * @returns {Promise<Object>} The updated configuration
     */
    async save(updates) {
        try {
            const response = await fetch(this.configUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ updates })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Update local config with the updated values
                Object.assign(this.config, updates);
                this.trigger('config:updated', { updates, config: this.config });
                return data;
            } else {
                throw new Error(data.error || 'Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.trigger('config:error', error);
            throw error;
        }
    }

    /**
     * Reset configuration to default values
     * @returns {Promise<Object>} The reset configuration
     */
    async reset() {
        try {
            const response = await fetch(`${this.configUrl}/reset`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Reload the configuration after reset
                return await this.load();
            } else {
                throw new Error(data.error || 'Failed to reset configuration');
            }
        } catch (error) {
            console.error('Error resetting configuration:', error);
            this.trigger('config:error', error);
            throw error;
        }
    }

    /**
     * Get a configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} The configuration value
     */
    get(key, defaultValue = null) {
        return key in this.config ? this.config[key] : defaultValue;
    }

    /**
     * Set a configuration value (local only, use save() to persist)
     * @param {string} key - Configuration key
     * @param {*} value - New value
     */
    set(key, value) {
        this.config[key] = value;
        this.trigger('config:changed', { key, value, config: this.config });
    }

    /**
     * Get all configuration as an object
     * @returns {Object} All configuration
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Add an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (!this.events[event]) return;
        
        if (callback) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        } else {
            delete this.events[event];
        }
    }

    /**
     * Trigger an event
     * @private
     * @param {string} event - Event name
     * @param {*} data - Data to pass to event listeners
     */
    trigger(event, data = {}) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} handler:`, error);
            }
        });
    }
}

// Create a singleton instance
const configManager = new ConfigManager();

// Export for ES modules
export { configManager };

// Also make available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.configManager = configManager;
}

// Auto-initialize if included directly in a script tag
if (document.currentScript && document.currentScript.getAttribute('data-auto-init') !== 'false') {
    document.addEventListener('DOMContentLoaded', () => {
        configManager.load().catch(console.error);
    });
}

export default configManager;
