const express = require('express');
const router = express.Router();
const configManager = require('../config/config');
const { log } = require('../utils/logger');

/**
 * @route   GET /api/config
 * @desc    Get all configuration
 * @access  Public
 */
router.get('/', (req, res) => {
    try {
        const config = configManager.getAll();
        
        // Don't expose sensitive data in the response
        const safeConfig = { ...config };
        if (safeConfig.WORDPRESS_TOKEN) {
            safeConfig.WORDPRESS_TOKEN = '***';
        }
        
        res.json({
            success: true,
            config: safeConfig
        });
    } catch (error) {
        log(`Error getting configuration: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: 'Failed to load configuration'
        });
    }
});

/**
 * @route   GET /api/config/:key
 * @desc    Get a specific configuration value
 * @access  Public
 */
router.get('/:key', (req, res) => {
    try {
        const { key } = req.params;
        let value = configManager.get(key);
        
        // Mask sensitive values
        if (key === 'WORDPRESS_TOKEN' && value) {
            value = '***';
        }
        
        if (value === undefined) {
            return res.status(404).json({
                success: false,
                error: `Configuration key '${key}' not found`
            });
        }
        
        res.json({
            success: true,
            key,
            value
        });
    } catch (error) {
        log(`Error getting configuration key ${req.params.key}: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: 'Failed to get configuration value'
        });
    }
});

/**
 * @route   POST /api/config
 * @desc    Update configuration values
 * @access  Public
 * @body    {Object} updates - Key-value pairs to update
 */
router.post('/', async (req, res) => {
    try {
        const { updates } = req.body;
        
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid updates object'
            });
        }
        
        // Don't allow updating certain sensitive or read-only fields
        const disallowedUpdates = ['NODE_ENV', 'PORT', 'FRONTEND_PORT'];
        const invalidUpdates = Object.keys(updates).filter(key => disallowedUpdates.includes(key));
        
        if (invalidUpdates.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot update read-only configuration keys: ${invalidUpdates.join(', ')}`
            });
        }
        
        // Update configuration in memory
        configManager.update(updates);
        
        // Save to .env file
        const saved = await configManager.save();
        
        if (!saved) {
            throw new Error('Failed to save configuration to disk');
        }
        
        // Log the update (without sensitive data)
        const safeUpdates = { ...updates };
        if ('WORDPRESS_TOKEN' in safeUpdates) {
            safeUpdates.WORDPRESS_TOKEN = '***';
        }
        
        log(`Configuration updated: ${JSON.stringify(safeUpdates)}`, 'info');
        
        res.json({
            success: true,
            message: 'Configuration updated successfully',
            updated: safeUpdates
        });
    } catch (error) {
        log(`Error updating configuration: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: 'Failed to update configuration',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/config/reset
 * @desc    Reset configuration to default values
 * @access  Public
 */
router.get('/reset', async (req, res) => {
    try {
        // Create a new config manager to get default values
        const defaultConfig = new (require('../config/config').ConfigManager)();
        
        // Get current config
        const currentConfig = configManager.getAll();
        
        // Reset all values to defaults
        const defaultValues = {};
        for (const key in defaultConfig.getAll()) {
            defaultValues[key] = defaultConfig.get(key);
        }
        
        // Keep some values that shouldn't be reset
        const keepValues = ['NODE_ENV', 'PORT', 'FRONTEND_PORT'];
        for (const key of keepValues) {
            if (key in currentConfig) {
                defaultValues[key] = currentConfig[key];
            }
        }
        
        // Update and save
        configManager.update(defaultValues);
        const saved = await configManager.save();
        
        if (!saved) {
            throw new Error('Failed to save default configuration');
        }
        
        log('Configuration reset to default values', 'info');
        
        res.json({
            success: true,
            message: 'Configuration reset to default values',
            reset: true
        });
    } catch (error) {
        log(`Error resetting configuration: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: 'Failed to reset configuration'
        });
    }
});

module.exports = router;
