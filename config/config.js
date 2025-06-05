const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

class ConfigManager {
    constructor() {
        this.config = {};
        this.envPath = path.join(__dirname, '..', '.env');
        this.loadConfig();
    }

    /**
     * Load configuration from .env file and environment variables
     */
    loadConfig() {
        // Load .env file if it exists
        if (fs.existsSync(this.envPath)) {
            const envConfig = dotenv.parse(fs.readFileSync(this.envPath));
            for (const key in envConfig) {
                process.env[key] = envConfig[key];
            }
        }

        // Define default configuration structure with default values
        this.config = {
            // Server Configuration
            PORT: process.env.PORT || 3001,
            NODE_ENV: process.env.NODE_ENV || 'development',
            LOG_LEVEL: process.env.LOG_LEVEL || 'info',
            
            // Frontend Configuration
            FRONTEND_PORT: process.env.FRONTEND_PORT || 8088,
            API_URL: process.env.API_URL || 'http://localhost:3001',
            
            // WordPress Configuration
            WORDPRESS_URL: process.env.WORDPRESS_URL || '',
            WORDPRESS_USERNAME: process.env.WORDPRESS_USERNAME || '',
            WORDPRESS_TOKEN: process.env.WORDPRESS_TOKEN || '',
            
            // Ollama Configuration
            OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'llama3:latest',
            
            // Git Configuration
            GIT_SCAN_DEPTH: parseInt(process.env.GIT_SCAN_DEPTH) || 3,
            DEFAULT_GITHUB_PATH: process.env.DEFAULT_GITHUB_PATH || process.env.GIT_PATH || '',
            
            // Article Generation
            ARTICLE_STYLE: process.env.ARTICLE_STYLE || 'first_person',
            ARTICLE_TONE: process.env.ARTICLE_TONE || 'professional',
            ARTICLE_LANGUAGE: process.env.ARTICLE_LANGUAGE || 'polish',
            
            // Prompt Templates
            PROMPT_TEMPLATE: process.env.PROMPT_TEMPLATE || '',
            PROMPT_PREFIX: process.env.PROMPT_PREFIX || '',
            
            // CORS
            ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3001,http://127.0.0.1:3001'
        };

        return this.config;
    }

    /**
     * Get a configuration value
     * @param {string} key - Configuration key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Configuration value
     */
    get(key, defaultValue = null) {
        return key in this.config ? this.config[key] : defaultValue;
    }

    /**
     * Set a configuration value (in memory only)
     * @param {string} key - Configuration key
     * @param {*} value - New value
     */
    set(key, value) {
        this.config[key] = value;
        process.env[key] = value ? value.toString() : '';
    }

    /**
     * Save current configuration to .env file
     */
    async save() {
        try {
            let envContent = '';
            
            // Build .env content
            for (const [key, value] of Object.entries(this.config)) {
                if (value !== undefined && value !== null) {
                    // Escape newlines and quotes in values
                    const escapedValue = String(value).replace(/\n/g, '\\n').replace(/"/g, '\\"');
                    envContent += `${key}="${escapedValue}"\n`;
                }
            }
            
            await fs.writeFile(this.envPath, envContent);
            return true;
        } catch (error) {
            console.error('Error saving configuration:', error);
            return false;
        }
    }

    /**
     * Get all configuration as an object
     * @returns {Object} All configuration
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Update multiple configuration values at once
     * @param {Object} updates - Key-value pairs to update
     */
    update(updates) {
        for (const [key, value] of Object.entries(updates)) {
            if (key in this.config) {
                this.set(key, value);
            }
        }
    }
}

// Create and export a singleton instance
const configManager = new ConfigManager();

// For CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = configManager;
}

// For ES modules
if (typeof exports !== 'undefined') {
    exports.default = configManager;
}

// For browser environment
if (typeof window !== 'undefined') {
    window.appConfig = configManager;
}

// Export the class as well for testing/extending
module.exports.ConfigManager = ConfigManager;
