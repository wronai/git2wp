// server.js - Backend dla WordPress Git Publisher
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const ejs = require('ejs');

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced CORS configuration
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Configure EJS as the view engine
app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'public'));

// Serve static files
app.use(express.static('public'));

// Log all requests
app.use((req, res, next) => {
  log(`[${req.method}] ${req.originalUrl}`, 'debug');
  next();
});

// Handle preflight requests
app.options('*', cors(corsOptions));

// Logging helper
const log = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
};

// Git helper functions
class GitScanner {
    constructor() {
        this.gitPath = '';
    }

    setGitPath(gitPath) {
        this.gitPath = gitPath;
    }

    async scanProjects(selectedDate) {
        try {
            log(`Skanowanie projektów w: ${this.gitPath}`);
            const projects = [];

            // Sprawdź czy ścieżka istnieje
            const exists = await fs.access(this.gitPath).then(() => true).catch(() => false);
            if (!exists) {
                throw new Error(`Ścieżka ${this.gitPath} nie istnieje`);
            }

            // Znajdź wszystkie foldery git
            const gitRepos = await this.findGitRepositories(this.gitPath);
            log(`Znaleziono ${gitRepos.length} repozytoriów Git`);

            // Przeanalizuj każde repozytorium
            for (const repoPath of gitRepos) {
                try {
                    const projectData = await this.analyzeRepository(repoPath, selectedDate);
                    if (projectData.commits.length > 0) {
                        projects.push(projectData);
                    }
                } catch (error) {
                    log(`Błąd analizy repo ${repoPath}: ${error.message}`, 'warning');
                }
            }

            log(`Znaleziono ${projects.length} projektów z commitami z dnia ${selectedDate}`);
            return {
                projects,
                date: selectedDate,
                scannedRepos: gitRepos.length,
                activeProjects: projects.length
            };

        } catch (error) {
            log(`Błąd skanowania: ${error.message}`, 'error');
            throw error;
        }
    }

    async findGitRepositories(basePath) {
        const gitRepos = [];

        async function scanDirectory(dirPath, depth = 0) {
            if (depth > 3) return; // Ograniczenie głębokości

            try {
                const items = await fs.readdir(dirPath, { withFileTypes: true });

                for (const item of items) {
                    if (item.isDirectory()) {
                        const fullPath = path.join(dirPath, item.name);

                        // Sprawdź czy to repozytorium Git
                        const gitDir = path.join(fullPath, '.git');
                        const isGitRepo = await fs.access(gitDir).then(() => true).catch(() => false);

                        if (isGitRepo) {
                            gitRepos.push(fullPath);
                        } else {
                            // Kontynuuj skanowanie w głąb
                            await scanDirectory(fullPath, depth + 1);
                        }
                    }
                }
            } catch (error) {
                // Ignoruj błędy dostępu do folderów
            }
        }

        await scanDirectory(basePath);
        return gitRepos;
    }

    async analyzeRepository(repoPath, selectedDate) {
        const projectName = path.basename(repoPath);
        log(`Analizowanie projektu: ${projectName}`);

        // Przejdź do katalogu repo
        const originalCwd = process.cwd();
        process.chdir(repoPath);

        try {
            // Pobierz commity z wybranej daty
            const gitCommand = `git log --since="${selectedDate} 00:00:00" --until="${selectedDate} 23:59:59" --pretty=format:"%H|%s|%an|%ad|%ae" --date=short`;

            let gitOutput;
            try {
                gitOutput = execSync(gitCommand, { encoding: 'utf8' });
            } catch (error) {
                log(`Brak commitów w ${projectName} na dzień ${selectedDate}`);
                return {
                    name: projectName,
                    path: repoPath,
                    commits: []
                };
            }

            const commits = [];
            if (gitOutput.trim()) {
                const commitLines = gitOutput.trim().split('\n');

                for (const line of commitLines) {
                    const [hash, message, author, date, email] = line.split('|');

                    // Pobierz listę zmienionych plików
                    const filesCommand = `git show --name-only --pretty=format: ${hash}`;
                    const filesOutput = execSync(filesCommand, { encoding: 'utf8' });
                    const files = filesOutput.trim().split('\n').filter(f => f.length > 0);

                    // Pobierz statystyki zmian
                    const statsCommand = `git show --stat --pretty=format: ${hash}`;
                    const statsOutput = execSync(statsCommand, { encoding: 'utf8' });
                    const stats = this.parseGitStats(statsOutput);

                    commits.push({
                        hash: hash.substring(0, 8),
                        fullHash: hash,
                        message: message.trim(),
                        author: author.trim(),
                        email: email.trim(),
                        date: date,
                        files: files,
                        stats: stats
                    });
                }
            }

            // Pobierz podstawowe informacje o repo
            const branchCommand = 'git branch --show-current';
            const currentBranch = execSync(branchCommand, { encoding: 'utf8' }).trim();

            const remoteCommand = 'git remote get-url origin 2>/dev/null || echo "no-remote"';
            const remoteUrl = execSync(remoteCommand, { encoding: 'utf8', shell: true }).trim();

            return {
                name: projectName,
                path: repoPath,
                branch: currentBranch,
                remote: remoteUrl !== 'no-remote' ? remoteUrl : null,
                commits: commits
            };

        } finally {
            process.chdir(originalCwd);
        }
    }

    parseGitStats(statsOutput) {
        const lines = statsOutput.trim().split('\n');
        let insertions = 0;
        let deletions = 0;
        let filesChanged = 0;

        for (const line of lines) {
            if (line.includes('insertion') || line.includes('deletion')) {
                const match = line.match(/(\d+) insertion.*?(\d+) deletion/);
                if (match) {
                    insertions += parseInt(match[1]) || 0;
                    deletions += parseInt(match[2]) || 0;
                }
            }
            if (line.includes('file') && line.includes('changed')) {
                const match = line.match(/(\d+) file/);
                if (match) {
                    filesChanged = parseInt(match[1]) || 0;
                }
            }
        }

        return { insertions, deletions, filesChanged };
    }
}

// Ollama helper class
class OllamaClient {
    constructor(baseUrl = 'http://localhost:11434') {
        // Ensure base URL is properly formatted
        this.baseUrl = baseUrl.trim();
        if (this.baseUrl.endsWith('/')) {
            this.baseUrl = this.baseUrl.slice(0, -1);
        }
        
        // Log the base URL being used
        log(`OllamaClient initialized with base URL: ${this.baseUrl}`, 'debug');
    }

    async listModels() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json'
                }
            });
            return response.data.models || [];
        } catch (error) {
            log(`Error listing models: ${error.message}`, 'error');
            return [];
        }
    }

    async testConnection() {
        try {
            const models = await this.listModels();
            return {
                success: true,
                models: models,
                message: `Connected to Ollama. Found ${models.length} models.`
            };
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.message;
            log(`Błąd połączenia z Ollama: ${errorMessage}`, 'error');
            return {
                success: false,
                error: errorMessage,
                status: error.response?.status
            };
        }
    }

    async generateArticle(prompt, model) {
        try {
            log(`Generowanie artykułu z modelem: ${model}`);
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40
                }
            });

            return {
                success: true,
                content: response.data.response
            };
        } catch (error) {
            log(`Błąd generowania artykułu: ${error.message}`, 'error');
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate article with streaming support
     * @param {string} prompt - The prompt to generate text from
     * @param {string} model - The model to use for generation
     * @returns {Promise<Stream>} A readable stream of the generated content
     */
    async generateArticleStream(prompt, model = process.env.DEFAULT_MODEL) {
        // Debug environment variables
        log('Environment Variables:', 'debug');
        log(`- OLLAMA_BASE_URL: ${process.env.OLLAMA_BASE_URL}`, 'debug');
        log(`- DEFAULT_MODEL: ${process.env.DEFAULT_MODEL}`, 'debug');
        log(`- Using model: ${model}`, 'debug');
        log(`- Prompt length: ${prompt.length} characters`, 'debug');
        const { PassThrough } = require('stream');
        const stream = new PassThrough();
        
        try {
            log(`Starting streaming generation with model: ${model}`, 'debug');
            log(`Using Ollama base URL: ${this.baseUrl}`, 'debug');
            
            // Verify the model is available
            try {
                const models = await this.listModels();
                const modelExists = models.some(m => m.name === model || m.model === model);
                if (!modelExists) {
                    const error = new Error(`Model '${model}' not found. Available models: ${models.map(m => m.name || m.model).join(', ')}`);
                    error.status = 404;
                    throw error;
                }
            } catch (error) {
                log(`Error checking models: ${error.message}`, 'error');
                // Continue anyway, as the API might still work
            }
            
            // Build the API URL
            const apiUrl = `${this.baseUrl}/api/generate`;
            log(`Making request to: ${apiUrl}`, 'debug');
            
            const requestData = {
                model: model,
                prompt: prompt,
                stream: true,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40,
                    num_ctx: 2048
                }
            };
            
            log(`Sending request with data: ${JSON.stringify({
                ...requestData,
                prompt: prompt.substring(0, 50) + '...' // Don't log full prompt
            }, null, 2)}`, 'debug');
            
            // Create a new agent to avoid socket issues
            const httpsAgent = new (require('https').Agent)({ 
                rejectUnauthorized: false, // For self-signed certs
                keepAlive: true
            });
            
            const response = await axios({
                method: 'post',
                url: apiUrl,
                data: requestData,
                responseType: 'stream',
                timeout: 120000, // 2 minute timeout
                httpsAgent: apiUrl.startsWith('https') ? httpsAgent : undefined,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Connection': 'keep-alive'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                validateStatus: null // Don't throw on any status code
            });
            
            log(`Received response with status: ${response.status}`, 'debug');
            
            if (response.status !== 200) {
                let errorData = '';
                
                // Handle error response
                return new Promise((_, reject) => {
                    response.data.on('data', chunk => {
                        try {
                            const data = JSON.parse(chunk.toString());
                            errorData = data.error || JSON.stringify(data);
                        } catch (e) {
                            errorData += chunk.toString();
                        }
                    });
                    
                    response.data.on('end', () => {
                        const error = new Error(`Ollama API error: ${response.status} - ${errorData || 'No error details'}`);
                        error.status = response.status;
                        error.data = errorData;
                        log(error.message, 'error');
                        reject(error);
                    });
                    
                    response.data.on('error', (err) => {
                        log(`Error reading error response: ${err.message}`, 'error');
                        reject(err);
                    });
                });
            }
            
            // Process the stream
            let buffer = '';
            
            response.data.on('data', (chunk) => {
                try {
                    const chunkStr = chunk.toString();
                    buffer += chunkStr;
                    
                    // Process complete lines
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer
                    
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);
                            if (data.response !== undefined) {
                                // Send each token as it's generated with proper JSON format
                                const safeData = { response: data.response };
                                if (data.done) safeData.done = true;
                                stream.write(JSON.stringify(safeData) + '\n');
                            }
                        } catch (e) {
                            log(`Error parsing line: ${line}`, 'error');
                            log(`Error details: ${e.message}`, 'debug');
                        }
                    }
                } catch (e) {
                    log(`Error processing chunk: ${e.message}`, 'error');
                }
            });
            
            response.data.on('end', () => {
                log('Stream ended', 'debug');
                stream.end();
            });
            
            response.data.on('error', (error) => {
                log(`Stream error: ${error.message}`, 'error');
                stream.emit('error', error);
            });
            
            return stream;
            
        } catch (error) {
            // Handle different types of errors
            let errorMessage = 'Unknown error';
            let statusCode = 500;
            
            if (error.response) {
                // Server responded with error status
                statusCode = error.response.status;
                errorMessage = `Ollama API error: ${statusCode}`;
                if (error.response.data) {
                    try {
                        const errorData = typeof error.response.data === 'string' 
                            ? error.response.data 
                            : JSON.stringify(error.response.data);
                        errorMessage += ` - ${errorData}`;
                    } catch (e) {
                        errorMessage += ' - Could not parse error response';
                    }
                }
            } else if (error.request) {
                // Request was made but no response received
                errorMessage = 'No response from Ollama server. Please check if the server is running.';
                if (error.code) errorMessage += ` (${error.code})`;
            } else {
                // Other errors
                errorMessage = error.message || 'Unknown error';
            }
            
            log(`Error in generateArticleStream: ${errorMessage}`, 'error');
            
            // Send error through the stream
            stream.emit('error', new Error(errorMessage));
            stream.end();
            
            return stream;
        }
    }
}

// WordPress helper class
class WordPressClient {
    constructor(url, username, token) {
        this.baseUrl = url;
        this.username = username;
        this.token = token;
        
        // Log the initialization (without showing the actual token for security)
        console.log(`WordPress client initialized for: ${url}`);
        console.log(`Using username: ${username}`);
        console.log('Token is ' + (token ? 'set' : 'not set'));
    }
    
    getAuthHeader() {
        if (this.token) {
            return {
                'Authorization': `Basic ${Buffer.from(`${this.username}:${this.token}`).toString('base64')}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
        }
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async testConnection() {
        try {
            // Construct the full URL
            const url = new URL('/wp-json/wp/v2/posts?per_page=1', this.baseUrl).toString();
            log(`Testing WordPress connection to: ${url}`, 'debug');
            
            // Get authentication headers
            const headers = this.getAuthHeader();
            
            // Log request details (without sensitive data)
            log('Sending request with headers:', 'debug');
            Object.entries(headers).forEach(([key]) => {
                log(`- ${key}: ${key === 'Authorization' ? '***' : headers[key]}`, 'debug');
            });
            
            // Make the request
            const response = await axios.get(url, { 
                headers,
                timeout: 10000 // 10 second timeout
            });
            
            log(`WordPress API response status: ${response.status}`, 'debug');
            
            return {
                success: true,
                status: response.status,
                message: 'Połączenie z WordPressem udane!',
                data: response.data
            };
        } catch (error) {
            // Enhanced error handling
            let errorDetails = 'Unknown error';
            
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                errorDetails = `Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
                log(`WordPress API Error Response: ${errorDetails}`, 'error');
            } else if (error.request) {
                // The request was made but no response was received
                errorDetails = 'No response received from server';
                log(`WordPress API Error: ${errorDetails}`, 'error');
            } else {
                // Something happened in setting up the request that triggered an Error
                errorDetails = error.message;
                log(`WordPress API Request Error: ${errorDetails}`, 'error');
            }
            
            return {
                success: false,
                status: error.response?.status || 500,
                error: errorDetails,
                message: error.response?.data?.message || error.message,
                details: error.response?.data
            };
        }
    }

    async publishPost(postData) {
        try {
            log('Publikowanie artykułu na WordPress');
            const response = await axios.post(`${this.baseUrl}/wp-json/wp/v2/posts`, postData, {
                headers: this.getAuthHeader()
            });

            return {
                success: true,
                post: response.data
            };
        } catch (error) {
            log(`Błąd publikacji: ${error.message}`, 'error');
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

// Initialize services
const gitScanner = new GitScanner();

// Set default GitHub path from environment variables
if (process.env.DEFAULT_GITHUB_PATH) {
    gitScanner.setGitPath(process.env.DEFAULT_GITHUB_PATH);
    log(`Ustawiono domyślną ścieżkę Git na: ${process.env.DEFAULT_GITHUB_PATH}`, 'info');
} else if (process.env.GIT_PATH) {
    gitScanner.setGitPath(process.env.GIT_PATH);
    log(`Ustawiono ścieżkę Git z GIT_PATH: ${process.env.GIT_PATH}`, 'info');
} else {
    log('Nie ustawiono domyślnej ścieżki Git. Należy ją podać ręcznie.', 'warn');
}

// Initialize Ollama client with environment variable or default
let ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').trim();
// Ensure URL has protocol
if (!ollamaBaseUrl.startsWith('http')) {
    ollamaBaseUrl = `http://${ollamaBaseUrl}`;
}
// Remove trailing slashes
ollamaBaseUrl = ollamaBaseUrl.replace(/\/+$/, '');

log(`Initializing Ollama client with URL: ${ollamaBaseUrl}`, 'info');
const ollamaClient = new OllamaClient(ollamaBaseUrl);

// Test Ollama connection on startup
(async () => {
    try {
        const result = await ollamaClient.testConnection();
        if (result.success) {
            log(`✅ Ollama connection successful. ${result.message}`, 'info');
            log(`Available models: ${result.models.map(m => m.name || m.model).join(', ')}`, 'debug');
        } else {
            log(`⚠️  Ollama connection failed: ${result.error}`, 'warn');
        }
    } catch (error) {
        log(`❌ Error testing Ollama connection: ${error.message}`, 'error');
    }
})();

// Initialize WordPress client with token from environment
const wpUrl = (process.env.WORDPRESS_URL || '').trim();
const wpUsername = (process.env.WORDPRESS_USERNAME || '').trim();
const wpToken = (process.env.WORDPRESS_TOKEN || '').replace(/[\"']/g, '').trim();

// Create a global WordPress client instance
let wordpressClient = null;

if (wpUrl && wpUsername && wpToken) {
    log(`Initializing WordPress client for: ${wpUrl}`, 'info');
    wordpressClient = new WordPressClient(wpUrl, wpUsername, wpToken);
    
    // Make wordpressClient available globally
    global.wordpressClient = wordpressClient;
    
    // Test WordPress connection on startup
    (async () => {
        try {
            const result = await wordpressClient.testConnection();
            if (result.success) {
                log('✅ WordPress connection successful', 'info');
            } else {
                log(`⚠️  WordPress connection failed: ${result.error}`, 'warn');
            }
        } catch (error) {
            log(`❌ Error testing WordPress connection: ${error.message}`, 'error');
        }
    })();
} else {
    log('⚠️  WordPress client not initialized - missing required environment variables', 'warn');
}

// Helper function to update .env file
const updateEnvFile = async (key, value) => {
    try {
        const envPath = path.join(__dirname, '.env');
        let envContent = await fs.readFile(envPath, 'utf8');
        
        // Update or add the key-value pair
        const keyExists = envContent.includes(`${key}=`);
        if (keyExists) {
            envContent = envContent.replace(
                new RegExp(`^${key}=.*$`, 'm'),
                `${key}="${value.replace(/"/g, '\\"')}"`
            );
        } else {
            envContent += `\n${key}="${value.replace(/"/g, '\\"')}"`;
        }
        
        await fs.writeFile(envPath, envContent);
        return true;
    } catch (error) {
        log(`Błąd aktualizacji pliku .env: ${error.message}`, 'error');
        throw error;
    }
};

// Routes

// Get current prompt
app.get('/api/config/prompt', (req, res) => {
    try {
        res.json({
            success: true,
            prompt: process.env.PROMPT_PREFIX || ''
        });
    } catch (error) {
        log(`Błąd pobierania promptu: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update prompt
app.post('/api/config/prompt', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: 'Brak treści promptu'
            });
        }
        
        await updateEnvFile('PROMPT_PREFIX', prompt);
        
        // Update the in-memory environment variable
        process.env.PROMPT_PREFIX = prompt;
        
        res.json({
            success: true,
            message: 'Prompt zaktualizowany pomyślnie'
        });
    } catch (error) {
        log(`Błąd aktualizacji promptu: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'WordPress Git Publisher Backend'
    });
});

// Test WordPress connection
app.post('/api/test-wordpress', async (req, res) => {
    try {
        const { url, username, password } = req.body;
        
        if (!url || !username || !password) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        try {
            // Test the connection with the provided credentials
            const testClient = new WordPressClient(url, username, password);
            const result = await testClient.testConnection();
            
            if (result.success) {
                // Update environment variables
                process.env.WORDPRESS_URL = url;
                process.env.WORDPRESS_USERNAME = username;
                process.env.WORDPRESS_TOKEN = password;
                
                // Update the global client
                wordpressClient = new WordPressClient(url, username, password);
                global.wordpressClient = wordpressClient;
                
                return res.json({ success: true, message: result.message });
            } else {
                return res.status(401).json({ success: false, error: result.error });
            }
        } catch (error) {
            log(`Błąd testowania WordPress: ${error.message}`, 'error');
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    } catch (error) {
        log(`Błąd testowania WordPress: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test Ollama connection
app.post('/api/test-ollama', async (req, res) => {
    try {
        const { url } = req.body;

        if (url) {
            ollamaClient.baseUrl = url;
        }

        const result = await ollamaClient.testConnection();
        res.json(result);
    } catch (error) {
        log(`Błąd testowania Ollama: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Scan Git projects
app.post('/api/scan-git', cors(corsOptions), async (req, res) => {
  log('Received request to /api/scan-git', 'debug');
  log(`Request body: ${JSON.stringify(req.body)}`, 'debug');
    try {
        const { githubPath, selectedDate } = req.body;

        if (!githubPath || !selectedDate) {
            return res.status(400).json({
                success: false,
                error: 'Brak wymaganych danych (githubPath, selectedDate)'
            });
        }

        gitScanner.setGitPath(githubPath);
        const result = await gitScanner.scanProjects(selectedDate);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        log(`Błąd skanowania Git: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate article with streaming support
app.get('/api/generate-article-stream', async (req, res) => {
    console.log('Streaming endpoint hit');
    
    try {
        console.log('Parsing request data...');
        console.log('Query params:', req.query);
        const dataParam = req.query.data;
        if (!dataParam) {
            throw new Error('Missing required parameter: data');
        }
        const requestData = JSON.parse(decodeURIComponent(dataParam));
        console.log('Request data:', JSON.stringify({
            ...requestData,
            gitData: { ...requestData.gitData, projects: requestData.gitData.projects.map(p => ({
                ...p,
                commits: p.commits.map(c => ({
                    ...c,
                    message: c.message,
                    files: c.files,
                    stats: c.stats
                }))
            }))}
        }, null, 2));

        // Update Ollama URL if provided
        if (requestData.ollamaUrl) {
            console.log(`Setting Ollama URL to: ${requestData.ollamaUrl}`);
            // Instead of creating a new instance, update the existing one
            ollamaClient.baseUrl = requestData.ollamaUrl.trim();
            if (ollamaClient.baseUrl.endsWith('/')) {
                ollamaClient.baseUrl = ollamaClient.baseUrl.slice(0, -1);
            }
            console.log(`Ollama client URL updated to: ${ollamaClient.baseUrl}`);
        }

        // Set response headers for SSE
        console.log('Setting SSE headers...');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');  // Disable buffering for nginx
        res.flushHeaders();

        // Send initial message to confirm connection
        console.log('Sending initial SSE message...');
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Connected to server' })}\n\n`);

        // Generate the prompt
        const prompt = `Na podstawie poniższych zmian w repozytorium Git, stwórz szczegółowy artykuł techniczny w języku polskim. Uwzględnij kontekst zmian, ich znaczenie i potencjalny wpływ na projekt.

${JSON.stringify(requestData.gitData, null, 2)}

Napisz kompletny artykuł w HTML:`;
        console.log('Generated prompt length:', prompt.length);
        console.log('First 200 chars:', prompt.substring(0, 200));

        // Get available models
        const availableModels = (await ollamaClient.listModels()).map(m => m.name || m.model);
        console.log('Available models:', availableModels);

        // Get model from environment variables or request
        const model = requestData.model || process.env.DEFAULT_MODEL;
        
        // Throw error if no model is specified
        if (!model) {
            throw new Error('No model specified. Please set DEFAULT_MODEL in your .env file or provide a model in the request.');
        }
        
        // Check if model is available
        if (!availableModels.includes(model)) {
            throw new Error(`Model '${model}' not found in available models. Available models: ${availableModels.join(', ')}`);
        }
        
        console.log(`Using model: ${model}`);
        console.log('Environment variables:', {
            OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
            DEFAULT_MODEL: process.env.DEFAULT_MODEL,
            NODE_ENV: process.env.NODE_ENV
        });
        
        try {
            console.log('Calling Ollama generateArticleStream...');
            const stream = await ollamaClient.generateArticleStream(prompt, model);
            console.log('Ollama stream created');
            
            stream.on('data', (chunk) => {
                try {
                    const content = chunk.toString().trim();
                    if (!content) return;
                    
                    console.log('Received chunk:', content.substring(0, 100) + (content.length > 100 ? '...' : ''));
                    
                    // Try to parse the chunk as JSON
                    try {
                        const data = JSON.parse(content);
                        if (data && data.response) {
                            // Send as SSE formatted data
                            res.write(`data: ${JSON.stringify({ content: data.response })}\n\n`);
                            // Flush the response to send data immediately
                            if (res.flush) res.flush();
                        }
                    } catch (e) {
                        console.error('Error parsing JSON chunk:', e);
                        // If it's not JSON, send as raw text
                        res.write(`data: ${JSON.stringify({ content: content })}\n\n`);
                        if (res.flush) res.flush();
                    }
                } catch (e) {
                    console.error('Error processing chunk:', e);
                }
            });

            stream.on('end', () => {
                console.log('Stream ended');
                res.write('event: end\ndata: [DONE]\n\n');
                res.end();
            });

            stream.on('error', (error) => {
                console.error('Stream error:', error);
                res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
                res.end();
            });
            
            // Handle client disconnect
            req.on('close', () => {
                console.log('Client disconnected');
                stream.destroy();
            });
            
        } catch (error) {
            console.error('Error in Ollama stream:', error);
            res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
        
    } catch (error) {
        console.error('Error in generate-article-stream:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

// Original generate article endpoint (kept for backward compatibility)
app.post('/api/generate-article', async (req, res) => {
    try {
        const { gitData, ollamaUrl, model, customTitle } = req.body;

        if (!gitData || !gitData.projects || gitData.projects.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Brak danych Git do analizy'
            });
        }

        // Initialize Ollama client with environment variable or default
        const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        log(`Initializing Ollama client with URL: ${ollamaBaseUrl}`, 'info');
        const ollamaClient = new OllamaClient(ollamaBaseUrl);
        log(`Using OLLAMA_BASE_URL from .env: ${process.env.OLLAMA_BASE_URL}`, 'debug');
        if (ollamaUrl) {
            // Fallback to the URL from request if env var is not set
            ollamaClient.baseUrl = ollamaUrl;
            log(`Using OLLAMA_BASE_URL from request: ${ollamaUrl}`, 'debug');
        }

        // Prepare detailed prompt
        const projectSummary = gitData.projects.map(project => {
            const commitDetails = project.commits.map(commit => {
                const fileList = commit.files.length > 0 ? commit.files.join(', ') : 'brak zmian w plikach';
                const stats = commit.stats ?
                    `(+${commit.stats.insertions || 0} -${commit.stats.deletions || 0} linii)` : '';

                return `  - ${commit.message} ${stats}\n    Pliki: ${fileList}\n    Autor: ${commit.author}`;
            }).join('\n');

            const totalCommits = project.commits.length;
            const totalInsertions = project.commits.reduce((sum, c) => sum + (c.stats?.insertions || 0), 0);
            const totalDeletions = project.commits.reduce((sum, c) => sum + (c.stats?.deletions || 0), 0);

            return `## Projekt: ${project.name}
Gałąź: ${project.branch || 'main'}
Commity (${totalCommits}):
${commitDetails}
Łączne zmiany: +${totalInsertions} -${totalDeletions} linii
${project.remote ? `Repository: ${project.remote}` : ''}`;
        }).join('\n\n');

        // Get prompt prefix from environment or use default
        const defaultPrompt = process.env.PROMPT_PREFIX || `Jesteś profesjonalnym programistą i blogerem technicznym. Napisz artykuł na bloga o dzisiejszych postępach w projektach programistycznych.`;
        
        // Use custom prompt if provided, otherwise use the default
        const promptPrefix = customPrompt || defaultPrompt;
        
        const prompt = `
${promptPrefix}

INSTRUKCJE:
- Napisz w języku polskim
- Użyj profesjonalnego, ale przystępnego tonu
- Artykuł powinien mieć 600-1000 słów
- Stwórz właściwą strukturę HTML z tagami <h1>, <h2>, <p>, <ul>, <li>
- Dodaj konkretne przykłady z commitów
- Podkreśl najważniejsze osiągnięcia
- Dodaj sekcję podsumowującą
- Użyj pierwszej osoby liczby pojedynczej (ja, mój, moje)
- Zachowaj profesjonalny ton
- Pisz w języku polskim

DANE:
Data: ${gitData.date}
${customTitle ? `Sugerowany tytuł: ${customTitle}` : ''}

SZCZEGÓŁY PROJEKTÓW:
${projectSummary}

STRUKTURA ARTYKUŁU:
1. Tytuł główny (H1)
2. Krótkie wprowadzenie
3. Sekcje dla każdego projektu (H2)
4. Podsumowanie i plany na przyszłość
5. Zakończenie

Napisz kompletny artykuł w HTML:`;

        const result = await ollamaClient.generateArticle(prompt, model);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json({
            success: true,
            article: result.content,
            metadata: {
                projects: gitData.projects.length,
                totalCommits: gitData.projects.reduce((sum, p) => sum + p.commits.length, 0),
                date: gitData.date
            }
        });
    } catch (error) {
        log(`Błąd generowania artykułu: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Publish to WordPress
app.post('/api/publish-wordpress', async (req, res) => {
    try {
        const {
            wpUrl,
            wpUsername,
            wpPassword,
            article,
            title,
            category,
            tags,
            gitData
        } = req.body;

        if (!article) {
            return res.status(400).json({
                success: false,
                error: 'Brak treści artykułu'
            });
        }

        let wpClient;
        
        // Use global wordpressClient if no credentials provided
        if (!wpUrl || !wpUsername || !wpPassword) {
            if (!wordpressClient) {
                return res.status(400).json({
                    success: false,
                    error: 'Brak poświadczeń WordPress. Proszę podać dane logowania lub skonfigurować połączenie w ustawieniach.'
                });
            }
            wpClient = wordpressClient;
            console.log('Using global WordPress client');
        } else {
            // Create a new client with provided credentials
            wpClient = new WordPressClient(wpUrl, wpUsername, wpPassword);
            console.log('Created new WordPress client with provided credentials');
        }

        // Extract title from article if not provided
        let finalTitle = title;
        if (!finalTitle) {
            const titleMatch = article.match(/<h1[^>]*>(.*?)<\/h1>/i);
            finalTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : `Postępy w projektach - ${gitData?.date || new Date().toISOString().split('T')[0]}`;
        }

        const postData = {
            title: finalTitle,
            content: article,
            status: 'publish',
            excerpt: `Podsumowanie postępów w projektach programistycznych${gitData?.date ? ` z dnia ${gitData.date}` : ''}`,
            meta: {
                _git_publisher_data: JSON.stringify({
                    projects: gitData?.projects?.map(p => ({
                        name: p.name,
                        commits: p.commits.length,
                        branch: p.branch
                    })) || [],
                    generation_date: new Date().toISOString(),
                    source_date: gitData?.date,
                    backend_version: '1.0.0'
                })
            }
        };

        // Add categories and tags if provided
        if (category) {
            postData.categories = Array.isArray(category) ? category : [category];
        }
        if (tags) {
            postData.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
        }

        const result = await wpClient.publishPost(postData);

        if (result.success) {
            log(`Artykuł opublikowany: ${result.post.link}`);
        }

        res.json(result);
    } catch (error) {
        log(`Błąd publikacji WordPress: ${error.message}`, 'error');
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    log(`Nieobsłużony błąd: ${error.message}`, 'error');
    res.status(500).json({
        success: false,
        error: 'Wewnętrzny błąd serwera'
    });
});

// Serve the main application
app.get('/', (req, res) => {
    res.render('index', {
        WORDPRESS_URL: process.env.WORDPRESS_URL || '',
        WORDPRESS_USERNAME: process.env.WORDPRESS_USERNAME || '',
        WORDPRESS_TOKEN: process.env.WORDPRESS_TOKEN || ''
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint nie został znaleziony'
    });
});

// Start server
app.listen(PORT, () => {
    log(`🚀 Backend uruchomiony na porcie ${PORT}`);
    log(`📝 API dostępne pod: http://localhost:${PORT}/api`);
    log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    log(`WordPress URL: ${process.env.WORDPRESS_URL || 'Not set'}`);
    log(`WordPress Username: ${process.env.WORDPRESS_USERNAME || 'Not set'}`);
    log('WordPress Token: ' + (process.env.WORDPRESS_TOKEN ? '***' : 'Not set'));
});

module.exports = app;