// server.refactored.js - Refactored version of server.js using the new configuration system
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

// Import our custom modules
const configManager = require('./config/config');
const { log } = require('./utils/logger');
const GitScanner = require('./services/gitScanner');
const OllamaClient = require('./services/ollamaClient');
const WordPressClient = require('./services/wordpressClient');

// Import routes
const configRoutes = require('./routes/config');
// Import other routes as needed

// Initialize Express app
const app = express();

// ======================
// Configuration
// ======================
const PORT = configManager.get('PORT');
const NODE_ENV = configManager.get('NODE_ENV');
const ALLOWED_ORIGINS = configManager.get('ALLOWED_ORIGINS', 'http://localhost:3001').split(',').map(s => s.trim());

// ======================
// Middleware
// ======================
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
            callback(null, true);
        } else {
            log(`CORS blocked for origin: ${origin}`, 'warn');
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        log(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, 'http');
    });
    
    next();
});

// ======================
// Initialize Services
// ======================
log('Initializing services...', 'info');

// Git Scanner
const gitScanner = new GitScanner({
    scanDepth: configManager.get('GIT_SCAN_DEPTH'),
    defaultPath: configManager.get('DEFAULT_GITHUB_PATH')
});

// Ollama Client
const ollamaClient = new OllamaClient({
    baseUrl: configManager.get('OLLAMA_BASE_URL'),
    defaultModel: configManager.get('DEFAULT_MODEL')
});

// WordPress Client
const wordpressClient = new WordPressClient({
    url: configManager.get('WORDPRESS_URL'),
    username: configManager.get('WORDPRESS_USERNAME'),
    token: configManager.get('WORDPRESS_TOKEN')
});

// ======================
// API Routes
// ======================
app.use('/api/config', configRoutes);

// Add other route files here
// app.use('/api/git', gitRoutes);
// app.use('/api/ollama', ollamaRoutes);
// app.use('/api/wordpress', wordpressRoutes);

// ======================
// Health Check Endpoint
// ======================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        version: process.env.npm_package_version || 'unknown'
    });
});

// ======================
// Error Handling
// ======================
// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Global error handler
app.use((err, req, res, next) => {
    log(`Error: ${err.message}`, 'error');
    log(err.stack, 'debug');
    
    res.status(err.status || 500).json({
        success: false,
        error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
        stack: NODE_ENV === 'development' ? err.stack : undefined
    });
});

// ======================
// Start Server
// ======================
const startServer = async () => {
    try {
        // Test connections to external services
        await testConnections();
        
        // Start the server
        const server = app.listen(PORT, () => {
            log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`, 'info');
            log(`📝 API available at: http://localhost:${PORT}/api`, 'info');
            log(`🏥 Health check: http://localhost:${PORT}/api/health`, 'info');
        });
        
        // Handle graceful shutdown
        process.on('SIGTERM', () => gracefulShutdown(server));
        process.on('SIGINT', () => gracefulShutdown(server));
        
        return server;
    } catch (error) {
        log(`Failed to start server: ${error.message}`, 'error');
        process.exit(1);
    }
};

// ======================
// Helper Functions
// ======================
async function testConnections() {
    try {
        log('Testing connections to external services...', 'info');
        
        // Test Ollama connection
        try {
            const models = await ollamaClient.listModels();
            log(`✅ Ollama connection successful. Found ${models.length} models.`, 'info');
        } catch (error) {
            log(`⚠️  Ollama connection failed: ${error.message}`, 'warn');
        }
        
        // Test WordPress connection
        try {
            const isConnected = await wordpressClient.testConnection();
            if (isConnected) {
                log('✅ WordPress connection successful', 'info');
            } else {
                log('⚠️  WordPress connection failed', 'warn');
            }
        } catch (error) {
            log(`⚠️  WordPress connection failed: ${error.message}`, 'warn');
        }
        
        // Test Git scanner
        try {
            const repos = await gitScanner.scanRepositories();
            log(`✅ Git scanner found ${repos.length} repositories`, 'info');
        } catch (error) {
            log(`⚠️  Git scanner failed: ${error.message}`, 'warn');
        }
        
    } catch (error) {
        log(`Error testing connections: ${error.message}`, 'error');
        throw error;
    }
}

function gracefulShutdown(server) {
    log('Shutting down gracefully...', 'info');
    
    server.close((err) => {
        if (err) {
            log(`Error during shutdown: ${err.message}`, 'error');
            process.exit(1);
        }
        
        log('Server stopped', 'info');
        process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
        log('Forcing shutdown...', 'warn');
        process.exit(1);
    }, 10000);
}

// Only start the server if this file is run directly
if (require.main === module) {
    startServer();
}

module.exports = {
    app,
    startServer,
    config: configManager,
    gitScanner,
    ollamaClient,
    wordpressClient
};
