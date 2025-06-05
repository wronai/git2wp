const fs = require('fs').promises;
const path = require('path');
const configManager = require('../config/config');
const { format } = require('date-fns');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
fs.mkdir(logsDir, { recursive: true }).catch(console.error);

class Logger {
    constructor() {
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            http: 3,
            debug: 4
        };
        
        this.colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[36m',  // Cyan
            http: '\x1b[35m',  // Magenta
            debug: '\x1b[37m', // White
            reset: '\x1b[0m'   // Reset
        };
        
        this.logLevel = this.levels[configManager.get('LOG_LEVEL', 'info').toLowerCase()] || this.levels.info;
    }

    /**
     * Get current timestamp in ISO format
     * @private
     */
    _getTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Format log message with timestamp and log level
     * @private
     */
    _formatMessage(level, message) {
        const timestamp = this._getTimestamp();
        const color = this.colors[level] || this.colors.reset;
        const reset = this.colors.reset;
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    /**
     * Write log to console and file
     * @private
     */
    async _log(level, message, ...args) {
        if (this.levels[level] > this.logLevel) return;
        
        const formattedMessage = this._formatMessage(level, message);
        const logEntry = `${formattedMessage}${args.length ? ' ' + args.join(' ') : ''}\n`;
        
        // Log to console with colors
        const color = this.colors[level] || this.colors.reset;
        const reset = this.colors.reset;
        console.log(`${color}${formattedMessage}${reset}`, ...args);
        
        // Log to file (without colors)
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const logFile = path.join(logsDir, `${today}.log`);
            await fs.appendFile(logFile, logEntry);
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    // Public logging methods
    error(message, ...args) {
        this._log('error', message, ...args);
    }

    warn(message, ...args) {
        this._log('warn', message, ...args);
    }

    info(message, ...args) {
        this._log('info', message, ...args);
    }

    http(message, ...args) {
        this._log('http', message, ...args);
    }

    debug(message, ...args) {
        this._log('debug', message, ...args);
    }
}

// Create and export a singleton instance
const logger = new Logger();

// For CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
}

// For ES modules
if (typeof exports !== 'undefined') {
    exports.default = logger;
}

// For browser environment
if (typeof window !== 'undefined') {
    window.logger = logger;
}

// Export the class as well for testing/extending
module.exports.Logger = Logger;
