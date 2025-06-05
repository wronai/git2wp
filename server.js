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

// Configure EJS with minimal settings
app.engine('html', (filePath, data, callback) => {
    // Create config object with 'it' as the root object
    const config = {
        it: {
            API_URL: process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`,
            OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'llama2',
            WORDPRESS_URL: process.env.WORDPRESS_URL || '',
            WORDPRESS_USERNAME: process.env.WORDPRESS_USERNAME || '',
            WORDPRESS_TOKEN: process.env.WORDPRESS_TOKEN || '',
            NODE_ENV: process.env.NODE_ENV || 'development'
        },
        ...data // Allow route-specific data to override
    };

    console.log('Rendering template with config:', {
        ...config.it,
        WORDPRESS_TOKEN: config.it.WORDPRESS_TOKEN ? '***' : 'not set'
    });

    ejs.renderFile(filePath, config, {
        root: path.join(__dirname, 'views'),
        cache: false,
        compileDebug: true,
        _with: false,
        strict: false,
        delimiter: '%',
        async: false,
        localsName: 'it' // Use 'it' as the locals variable name
    }, (err, str) => {
        if (err) {
            console.error('EJS render error:', err);
            return callback(err);
        }
        callback(null, str);
    });
});

// Set the view engine to use .html files
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// Log the views directory for debugging
console.log('Views directory:', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static('public', {
    setHeaders: function (res, path) {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Helper function to parse .env file
function parseEnvFile(content) {
    return content.split('\n').reduce((acc, line) => {
        const [key, ...values] = line.split('=');
        if (key && key.trim() !== '' && !key.startsWith('#')) {
            acc[key.trim()] = values.join('=').trim();
        }
        return acc;
    }, {});
}

// Helper function to create the HTML template
function createHtmlTemplate(envVars, host) {
    const safeEnv = {
        WORDPRESS_URL: envVars.WORDPRESS_URL || '',
        WORDPRESS_USERNAME: envVars.WORDPRESS_USERNAME || '',
        WORDPRESS_TOKEN: envVars.WORDPRESS_TOKEN || '',
        OLLAMA_BASE_URL: envVars.OLLAMA_BASE_URL || 'http://localhost:11434',
        DEFAULT_MODEL: envVars.DEFAULT_MODEL || 'llama2'
    };

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Git2WP - WordPress Git Publisher</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body { padding: 20px; background-color: #f8f9fa; }
                .settings-section { margin-bottom: 30px; }
                .card { margin-bottom: 20px; box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075); border: none; border-radius: 0.5rem; }
                .card-header { font-weight: 600; border-bottom: 1px solid rgba(0,0,0,.125); background-color: #f8f9fa; }
                .loading { opacity: 0.7; pointer-events: none; }
                .form-label { font-weight: 500; color: #495057; }
                .btn-primary { background-color: #0d6efd; border: none; }
                .btn-primary:hover { background-color: #0b5ed7; }
                .repo-card { transition: transform 0.2s; cursor: pointer; }
                .repo-card:hover { transform: translateY(-2px); }
                .repo-org { color: #6c757d; font-size: 0.9em; }
                .repo-desc { color: #6c757d; font-size: 0.9em; }
                .repo-meta { font-size: 0.8em; color: #6c757d; }
                .repo-badge { font-size: 0.75em; margin-right: 5px; }
                .spinner-border { width: 1rem; height: 1rem; border-width: 0.15em; }
                .status-indicator { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 5px; }
                .status-active { background-color: #198754; }
                .status-inactive { background-color: #6c757d; }
                .nav-tabs .nav-link { color: #6c757d; }
                .nav-tabs .nav-link.active { font-weight: 600; color: #0d6efd; }
                .log-entry { font-family: monospace; font-size: 0.85em; margin-bottom: 2px; padding: 2px 5px; border-radius: 3px; }
                .log-entry.debug { color: #6c757d; }
                .log-entry.info { color: #0d6efd; }
                .log-entry.success { color: #198754; }
                .log-entry.warning { color: #ffc107; }
                .log-entry.error { color: #dc3545; background-color: #fff5f5; }
        </head>
                    <body>
            <div class="container">
                <h1 class="my-4">Git2WP - WordPress Git Publisher</h1>
                
                <!-- Status Bar -->
                <div class="alert alert-info d-flex align-items-center" role="alert" id="status-bar" style="display: none;">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    <div id="status-message">Ładowanie...</div>
                </div>
                
                <div class="row">
                    <!-- Left Sidebar -->
                    <div class="col-md-4">
                        <!-- Settings Panel -->
                        <div class="card mb-4">
                            <div class="card-header bg-primary text-white">
                                <h5 class="mb-0"><i class="fas fa-cog me-2"></i>Ustawienia</h5>
                            </div>
                            <div class="card-body">
                                <form id="settings-form">
                                    <div class="mb-3">
                                        <label class="form-label">WordPress URL</label>
                                        <input type="text" class="form-control" name="WORDPRESS_URL" value="${safeEnv.WORDPRESS_URL}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">WordPress Username</label>
                                        <input type="text" class="form-control" name="WORDPRESS_USERNAME" value="${safeEnv.WORDPRESS_USERNAME}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">WordPress Token</label>
                                        <div class="input-group">
                                            <input type="password" class="form-control" name="WORDPRESS_TOKEN" value="${safeEnv.WORDPRESS_TOKEN}" required>
                                            <button class="btn btn-outline-secondary" type="button" id="toggleToken">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Ollama URL</label>
                                        <input type="url" class="form-control" name="OLLAMA_BASE_URL" value="${safeEnv.OLLAMA_BASE_URL}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Domyślny model</label>
                                        <input type="text" class="form-control" name="DEFAULT_MODEL" value="${safeEnv.DEFAULT_MODEL}">
                                    </div>
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-save me-1"></i> Zapisz ustawienia
                                    </button>
                                </form>
                            </div>
                        </div>
                        
                        <!-- Actions Panel -->
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                <h5 class="mb-0"><i class="fas fa-play-circle me-2"></i>Akcje</h5>
                            </div>
                            <div class="card-body">
                                <div class="d-grid gap-2">
                                    <button id="scan-repos-btn" class="btn btn-outline-primary">
                                        <i class="fas fa-sync-alt me-1"></i> Skanuj repozytoria
                                    </button>
                                    <button id="publish-changes-btn" class="btn btn-success" disabled>
                                        <i class="fas fa-upload me-1"></i> Opublikuj zmiany
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Main Content -->
                    <div class="col-md-8">
                        <!-- Repository List -->
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h5 class="mb-0"><i class="fas fa-code-branch me-2"></i>Repozytoria</h5>
                                <div class="text-muted small" id="repo-stats">
                                    <span id="repo-count">0</span> repozytoriów
                                </div>
                            </div>
                            <div class="card-body p-0">
                                <div class="list-group list-group-flush" id="repo-list">
                                    <div class="text-center p-4 text-muted">
                                        <i class="fas fa-folder-open fa-2x mb-2"></i>
                                        <p class="mb-0">Kliknij przycisk "Skanuj repozytoria" aby załadować listę repozytoriów</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Logs Panel -->
                        <div class="card mt-4">
                            <div class="card-header">
                                <ul class="nav nav-tabs card-header-tabs" id="logs-tab" role="tablist">
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link active" id="logs-tab" data-bs-toggle="tab" data-bs-target="#logs-content" type="button" role="tab">
                                            <i class="fas fa-terminal me-1"></i> Logi
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link" id="preview-tab" data-bs-toggle="tab" data-bs-target="#preview-content" type="button" role="tab">
                                            <i class="fas fa-eye me-1"></i> Podgląd
                                        </button>
                                    </li>
                                </ul>
                            </div>
                            <div class="card-body p-0">
                                <div class="tab-content" id="logs-tab-content">
                                    <div class="tab-pane fade show active p-3" id="logs-content" role="tabpanel" style="max-height: 300px; overflow-y: auto;">
                                        <div id="log-entries">
                                            <div class="log-entry info">Witaj w Git2WP! Rozpocznij od skanowania repozytoriów.</div>
                                        </div>
                                    </div>
                                    <div class="tab-pane fade p-3" id="preview-content" role="tabpanel">
                                        <div id="article-preview" class="p-2">
                                            <p class="text-muted text-center my-4">Wybierz repozytorium, aby zobaczyć podgląd zmian</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>    
                        <div class="card mt-3">
                            <div class="card-header bg-success text-white">
                                <h5 class="mb-0"><i class="fas fa-rocket me-2"></i>Akcje</h5>
                            </div>
                            <div class="card-body">
                                <button id="scan-repos" class="btn btn-outline-primary w-100 mb-2">
                                    <i class="fas fa-search me-2"></i>Skanuj repozytoria
                                </button>
                                <button id="publish-btn" class="btn btn-success w-100" disabled>
                                    <i class="fas fa-paper-plane me-2"></i>Opublikuj zmiany
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Main Content -->
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">Podgląd artykułu</h5>
                            </div>
                            <div class="card-body">
                                <div id="article-preview" class="border p-3 bg-light" style="min-height: 200px;">
                                    Wybierz repozytorium i kliknij "Skanuj repozytoria" aby rozpocząć.
                                </div>
                            </div>
                        </div>
                        
                        <div class="card mt-3">
                            <div class="card-header">
                                <h5 class="mb-0">Logi</h5>
                            </div>
                            <div class="card-body p-0">
                                <pre id="logs" class="p-3 mb-0 bg-dark text-white" style="min-height: 200px; max-height: 300px; overflow-y: auto;"></pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    // UI Elements
                    const settingsForm = document.getElementById('settings-form');
                    const scanReposBtn = document.getElementById('scan-repos-btn');
                    const publishBtn = document.getElementById('publish-changes-btn');
                    const repoList = document.getElementById('repo-list');
                    const repoCount = document.getElementById('repo-count');
                    const logEntries = document.getElementById('log-entries');
                    const statusBar = document.getElementById('status-bar');
                    const statusMessage = document.getElementById('status-message');
                    const toggleTokenBtn = document.getElementById('toggleToken');
                    const tokenInput = document.querySelector('input[name="WORDPRESS_TOKEN"]');
                    const articlePreview = document.getElementById('article-preview');
                    
                    // API URL
                    const API_URL = '/api';
                    
                    // Toggle token visibility
                    if (toggleTokenBtn && tokenInput) {
                        toggleTokenBtn.addEventListener('click', function() {
                            const type = tokenInput.type === 'password' ? 'text' : 'password';
                            tokenInput.type = type;
                            const icon = this.querySelector('i');
                            icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
                            
                            // Focus back on the input
                            tokenInput.focus();
                        });
                    }
                    
                    // Show status message
                    function showStatus(message, type = 'info') {
                        statusMessage.textContent = message;
                        statusBar.className = `alert alert-${type} d-flex align-items-center`;
                        statusBar.style.display = 'flex';
                        
                        // Auto-hide success messages after 5 seconds
                        if (type === 'success') {
                            setTimeout(() => {
                                statusBar.style.display = 'none';
                            }, 5000);
                        }
                    }
                    
                    // Add log entry
                    function addLogEntry(message, type = 'info') {
                        const entry = document.createElement('div');
                        entry.className = `log-entry ${type}`;
                        
                        const timestamp = new Date().toLocaleTimeString();
                        entry.innerHTML = `[${timestamp}] ${message}`;
                        
                        logEntries.prepend(entry);
                        
                        // Auto-scroll to top
                        logEntries.scrollTop = 0;
                    }
                    
                    // Toggle loading state
                    function setLoading(loading) {
                        if (loading) {
                            document.body.classList.add('loading');
                            if (scanReposBtn) {
                                scanReposBtn.disabled = true;
                                scanReposBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Skanowanie...';
                            }
                        } else {
                            document.body.classList.remove('loading');
                            if (scanReposBtn) {
                                scanReposBtn.disabled = false;
                                scanReposBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Skanuj repozytoria';
                            }
                        }
                    }
                    
                    // Save settings
                    if (settingsForm) {
                        settingsForm.addEventListener('submit', async function(e) {
                            e.preventDefault();
                            
                            const formData = new FormData(settingsForm);
                            const data = {};
                            formData.forEach((value, key) => data[key] = value);
                            
                            try {
                                setLoading(true);
                                showStatus('Zapisywanie ustawień...', 'info');
                                
                                const response = await fetch(API_URL + '/config', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(data)
                                });
                                
                                const result = await response.json();
                                
                                if (result.success) {
                                    showStatus('Ustawienia zostały zapisane pomyślnie', 'success');
                                    addLogEntry('Zaktualizowano ustawienia aplikacji', 'success');
                                } else {
                                    throw new Error(result.error || 'Nie udało się zapisać ustawień');
                                }
                            } catch (error) {
                                console.error('Error saving settings:', error);
                                showStatus(`Błąd: ${error.message}`, 'danger');
                                addLogEntry(`Błąd podczas zapisywania ustawień: ${error.message}`, 'error');
                            } finally {
                                setLoading(false);
                            }
                        });
                    }
                    
                    // Display repositories in the UI
                    function displayRepositories(repositories) {
                        if (!repositories || !repositories.length) {
                            repoList.innerHTML = `
                                <div class="text-center p-4 text-muted">
                                    <i class="fas fa-exclamation-circle fa-2x mb-2"></i>
                                    <p class="mb-0">Nie znaleziono żadnych repozytoriów</p>
                                </div>`;
                            repoCount.textContent = '0';
                            return;
                        }
                        
                        repoList.innerHTML = repositories.map(repo => `
                            <div class="list-group-item list-group-item-action repo-card" data-repo-path="${repo.path}">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">
                                        <i class="fas fa-code-branch me-2"></i>${repo.name}
                                        <span class="badge bg-secondary repo-badge">${repo.organization}</span>
                                    </h6>
                                    <small class="text-muted">${new Date(repo.lastModified).toLocaleDateString()}</small>
                                </div>
                                <div class="mb-1">
                                    <small class="repo-desc">${repo.lastCommit?.message || 'Brak wiadomości commit'}</small>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="repo-meta">
                                        <span class="me-2">
                                            <i class="fas fa-code-branch"></i> ${repo.currentBranch || 'main'}
                                        </span>
                                        <span>
                                            <i class="fas fa-user"></i> ${repo.lastCommit?.author || 'Brak danych'}
                                        </span>
                                    </div>
                                    <span class="badge bg-primary">
                                        ${repo.lastCommit?.hash ? repo.lastCommit.hash.substring(0, 7) : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        `).join('');
                        
                        repoCount.textContent = repositories.length;
                        
                        // Add click handlers to repo cards
                        document.querySelectorAll('.repo-card').forEach(card => {
                            card.addEventListener('click', function() {
                                // Remove active class from all cards
                                document.querySelectorAll('.repo-card').forEach(c => c.classList.remove('active'));
                                // Add active class to clicked card
                                this.classList.add('active');
                                
                                // Enable publish button when a repo is selected
                                if (publishBtn) {
                                    publishBtn.disabled = false;
                                }
                                
                                // Update article preview
                                const repoName = this.querySelector('h6').textContent.trim();
                                const repoPath = this.dataset.repoPath;
                                updateArticlePreview(repoName, repoPath);
                                
                                addLogEntry(`Wybrano repozytorium: ${repoName}`, 'info');
                            });
                        });
                    }
                    
                    // Update article preview
                    async function updateArticlePreview(repoName, repoPath) {
                        articlePreview.innerHTML = `
                            <div class="text-center py-4">
                                <div class="spinner-border text-primary mb-3" role="status">
                                    <span class="visually-hidden">Ładowanie...</span>
                                </div>
                                <p>Ładowanie podglądu dla: <strong>${repoName}</strong></p>
                            </div>`;
                        
                        try {
                            // Here you would fetch the actual article content
                            // For now, we'll simulate a delay and show a placeholder
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            articlePreview.innerHTML = `
                                <h4>${repoName}</h4>
                                <p class="text-muted">Ścieżka: ${repoPath}</p>
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle me-2"></i>
                                    Tutaj będzie wyświetlany podgląd artykułu wygenerowanego na podstawie zmian w repozytorium.
                                </div>`;
                        } catch (error) {
                            console.error('Error loading article preview:', error);
                            articlePreview.innerHTML = `
                                <div class="alert alert-danger">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    Wystąpił błąd podczas ładowania podglądu: ${error.message}
                                </div>`;
                        }
                    }
                    
                    // Scan repositories
                    if (scanReposBtn) {
                        scanReposBtn.addEventListener('click', async function() {
                            try {
                                setLoading(true);
                                showStatus('Skanowanie repozytoriów...', 'info');
                                addLogEntry('Rozpoczęto skanowanie repozytoriów', 'info');
                                
                                const response = await fetch(API_URL + '/scan-repositories');
                                const result = await response.json();
                                
                                if (!response.ok) {
                                    throw new Error(result.error || 'Nie udało się przeskanować repozytoriów');
                                }
                                
                                displayRepositories(result.repositories);
                                showStatus(`Znaleziono ${result.repositories.length} repozytoriów`, 'success');
                                addLogEntry(`Zakończono skanowanie. Znaleziono ${result.repositories.length} repozytoriów`, 'success');
                                
                            } catch (error) {
                                console.error('Error scanning repositories:', error);
                                showStatus(`Błąd: ${error.message}`, 'danger');
                                addLogEntry(`Błąd podczas skanowania repozytoriów: ${error.message}`, 'error');
                            } finally {
                                setLoading(false);
                            }
                        });
                    }
                    
                    // Publish changes
                    if (publishBtn) {
                        publishBtn.addEventListener('click', async function() {
                            const selectedRepo = document.querySelector('.repo-card.active');
                            if (!selectedRepo) {
                                showStatus('Wybierz repozytorium do opublikowania', 'warning');
                                return;
                            }
                            
                            const repoPath = selectedRepo.dataset.repoPath;
                            const repoName = selectedRepo.querySelector('h6').textContent.trim();
                            
                            try {
                                setLoading(true);
                                showStatus(`Publikowanie zmian dla ${repoName}...`, 'info');
                                addLogEntry(`Rozpoczęto publikowanie zmian dla ${repoName}`, 'info');
                                
                                // TODO: Implement actual publish functionality
                                await new Promise(resolve => setTimeout(resolve, 1500));
                                
                                showStatus(`Pomyślnie opublikowano zmiany dla ${repoName}`, 'success');
                                addLogEntry(`Zakończono publikowanie zmian dla ${repoName}`, 'success');
                                
                            } catch (error) {
                                console.error('Error publishing changes:', error);
                                showStatus(`Błąd podczas publikowania zmian: ${error.message}`, 'danger');
                                addLogEntry(`Błąd podczas publikowania zmian: ${error.message}`, 'error');
                            } finally {
                                setLoading(false);
                            }
                        });
                    }
                    
                    // Initialize tooltips
                    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
                    tooltipTriggerList.map(function (tooltipTriggerEl) {
                        return new bootstrap.Tooltip(tooltipTriggerEl);
                    });
                    
                    // Add initial log entry
                    addLogEntry('Aplikacja została załadowana. Rozpocznij od skanowania repozytoriów.', 'info');
            </script>
        </body>
        </html>`;
}

// Serve the main page with all settings
app.get('/', (req, res) => {
    try {
        // Read the .env file
        const envContent = fs.readFileSync('.env', 'utf8');
        const envVars = parseEnvFile(envContent);
        
        // Send the main HTML with the settings
        const html = createHtmlTemplate(envVars, req.headers.host);
        res.send(html);
    } catch (error) {
        console.error('Error serving main page:', error);
        res.status(500).send('Wystąpił błąd podczas ładowania strony');
    }
});

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Logging helper
const log = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
};

// Log all requests
app.use((req, res, next) => {
  log(`[${req.method}] ${req.originalUrl}`, 'debug');
  next();
});

// Handle preflight requests
app.options('*', cors(corsOptions));

// Git helper functions
class GitScanner {
    constructor() {
        this.gitPath = '';
    }

    setGitPath(gitPath) {
        this.gitPath = gitPath;
    }

    /**
     * Get commit history from the Git repository
     * @returns {Promise<Array>} Array of commit objects
     */
    async getCommitHistory(limit = 50) {
        try {
            // Change to the repository directory
            process.chdir(this.gitPath);
            
            // Execute git log command to get commit history
            const command = `git log --pretty=format:'%H|%an|%ae|%ad|%s' --date=iso -n ${limit}`;
            const output = execSync(command, { encoding: 'utf8' });
            
            // Parse the git log output
            const commits = output.trim().split('\n')
                .filter(line => line.trim() !== '')
                .map(line => {
                    const [hash, author, email, date, ...messageParts] = line.split('|');
                    const message = messageParts.join('|');
                    return {
                        hash,
                        author,
                        email,
                        date: new Date(date.trim()),
                        message: message.trim()
                    };
                });
            
            return commits;
            
        } catch (error) {
            console.error('Error getting commit history:', error);
            throw new Error(`Failed to get commit history: ${error.message}`);
        }
    }
}

// Ollama helper class
class OllamaClient {
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl.trim();
        if (this.baseUrl.endsWith('/')) {
            this.baseUrl = this.baseUrl.slice(0, -1);
        }
        log(`OllamaClient initialized with base URL: ${this.baseUrl}`, 'debug');
    }
    
    // ... (rest of OllamaClient class implementation)
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
    
    // ... (rest of WordPressClient class implementation)
}

// Initialize services
const gitScanner = new GitScanner();

// API Routes

// Configuration endpoint
app.get('/api/config', async (req, res) => {
    try {
        const config = {
            API_URL: process.env.API_URL || `http://localhost:${PORT}`,
            OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'llama2',
            WORDPRESS_URL: process.env.WORDPRESS_URL || '',
            WORDPRESS_USERNAME: process.env.WORDPRESS_USERNAME || '',
            // Don't send token to frontend
            NODE_ENV: process.env.NODE_ENV || 'development'
        };
        res.json({ success: true, config });
    } catch (error) {
        log(`Error getting config: ${error.message}`, 'error');
        res.status(500).json({ success: false, error: 'Failed to get configuration' });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        const { updates } = req.body;
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ success: false, error: 'Invalid updates' });
        }

        // Read current .env content
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        try {
            envContent = await fs.readFile(envPath, 'utf8');
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        // Update .env file
        const lines = envContent.split('\n');
        for (const [key, value] of Object.entries(updates)) {
            const index = lines.findIndex(line => line.startsWith(`${key}=`));
            const newLine = `${key}=${value}`;
            if (index >= 0) {
                lines[index] = newLine;
            } else {
                lines.push(newLine);
            }
        }

        // Write back to .env
        await fs.writeFile(envPath, lines.join('\n'));

        // Reload environment
        Object.assign(process.env, updates);

        res.json({ success: true, config: updates });
    } catch (error) {
        log(`Error updating config: ${error.message}`, 'error');
        res.status(500).json({ success: false, error: 'Failed to update configuration' });
    }
});
// Scan Git repository
app.post('/api/scan-git', async (req, res) => {
    try {
        const { repoPath } = req.body;
        
        if (!repoPath) {
            return res.status(400).json({
                success: false,
                error: 'Path to Git repository is required'
            });
        }
        
        // Set the Git repository path
        gitScanner.setGitPath(repoPath);
        
        // Get commit history (you'll need to implement this method in GitScanner)
        const commitHistory = await gitScanner.getCommitHistory();
        
        res.json({
            success: true,
            data: {
                path: repoPath,
                commits: commitHistory,
                lastScanned: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error scanning Git repository:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scan Git repository',
            details: error.message
        });
    }
});

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get Git configuration
app.get('/api/config/git', (req, res) => {
    try {
        res.json({
            success: true,
            gitPath: process.env.GIT_PATH || '',
            defaultBranch: process.env.DEFAULT_BRANCH || 'main',
            lastSync: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting Git config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load Git configuration'
        });
    }
});

// Helper function to get repository details
async function getRepoDetails(repoPath) {
    try {
        const gitPath = path.join(repoPath, '.git');
        const gitStat = await fs.stat(gitPath);
        
        if (!gitStat.isDirectory()) {
            return null;
        }
        
        // Get last commit info using git command
        const getLastCommit = async () => {
            try {
                const { execSync } = require('child_process');
                const cmd = `cd ${repoPath} && git log -1 --pretty=format:'%h|%an|%ae|%ad|%s' --date=iso`;
                const output = execSync(cmd).toString().trim();
                if (!output) return null;
                
                const [hash, author, email, date, message] = output.split('|');
                return { hash, author, email, date, message };
            } catch (error) {
                console.error(`Error getting commit info for ${repoPath}:`, error);
                return null;
            }
        };
        
        // Get branch info
        const getCurrentBranch = async () => {
            try {
                const { execSync } = require('child_process');
                const cmd = `cd ${repoPath} && git rev-parse --abbrev-ref HEAD`;
                return execSync(cmd).toString().trim();
            } catch (error) {
                console.error(`Error getting branch for ${repoPath}:`, error);
                return 'unknown';
            }
        };
        
        const [lastCommit, currentBranch] = await Promise.all([
            getLastCommit(),
            getCurrentBranch()
        ]);
        
        return {
            lastCommit,
            currentBranch,
            lastUpdated: new Date(gitStat.mtime),
            isDirty: false // Will be set in the main function
        };
    } catch (error) {
        console.error(`Error checking Git repository at ${repoPath}:`, error);
        return null;
    }
}

// Helper function to get repository details
async function getRepoDetails(repoPath) {
    try {
        const gitPath = path.join(repoPath, '.git');
        const gitStat = await fs.stat(gitPath);
        
        if (!gitStat.isDirectory()) {
            return null;
        }
        
        // Get last commit info using git command
        const getLastCommit = async () => {
            try {
                const { execSync } = require('child_process');
                const cmd = `cd ${repoPath} && git log -1 --pretty=format:'%h|%an|%ae|%ad|%s' --date=iso`;
                const output = execSync(cmd).toString().trim();
                if (!output) return null;
                
                const [hash, author, email, date, message] = output.split('|');
                return { hash, author, email, date, message };
            } catch (error) {
                console.error(`Error getting commit info for ${repoPath}:`, error);
                return null;
            }
        };
        
        // Get branch info
        const getCurrentBranch = async () => {
            try {
                const { execSync } = require('child_process');
                const cmd = `cd ${repoPath} && git rev-parse --abbrev-ref HEAD`;
                return execSync(cmd).toString().trim();
            } catch (error) {
                console.error(`Error getting branch for ${repoPath}:`, error);
                return 'unknown';
            }
        };
        
        const [lastCommit, currentBranch] = await Promise.all([
            getLastCommit(),
            getCurrentBranch()
        ]);
        
        return {
            lastCommit,
            currentBranch,
            lastUpdated: new Date(gitStat.mtime),
            isDirty: false // Will be set in the main function
        };
    } catch (error) {
        console.error(`Error checking Git repository at ${repoPath}:`, error);
        return null;
    }
}

// Scan for Git repositories
app.get('/api/scan-repositories', async (req, res) => {
    try {
        const basePath = process.env.GIT_BASE_PATH || path.join(process.env.HOME || '/home', 'github');
        const repositories = [];
        
        // Check if base directory exists
        try {
                try {
                    // Change to repository directory
                    process.chdir(repoPath);
                    
                    // Get current branch
                    const branchOutput = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
                    
                    // Get last commit details
                    const commitOutput = execSync('git log -1 --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso', { encoding: 'utf8' }).trim();
                    let lastCommit = null;
                    
                    if (commitOutput) {
                        const [hash, author, email, date, ...messageParts] = commitOutput.split('|');
                        lastCommit = {
                            hash,
                            author,
                            email,
                            date: new Date(date.trim()).toISOString(),
                            message: messageParts.join('|').trim()
                        };
                    }
                    
                    // Get last modified time of the repository
                    const stats = fs.statSync(repoPath);
                    
                    return {
                        currentBranch: branchOutput,
                        lastCommit,
                        lastModified: stats.mtime.toISOString(),
                        hasChanges: false // You can implement this by checking git status
                    };
                    
                } finally {
                    // Restore original working directory
                    process.chdir(originalCwd);
                }
            } catch (error) {
                console.error(`Error getting details for ${repoPath}:`, error);
                return {
                    currentBranch: null,
                    lastCommit: null,
                    lastModified: null,
                    hasChanges: false,
                    error: error.message
                };
            }
        }

        // Function to recursively find Git repositories
        const findGitRepos = async (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            
            // Check if current directory is a Git repo
            const gitDir = items.find(item => item.isDirectory() && item.name === '.git');
            if (gitDir) {
                const relativePath = path.relative(gitBasePath, dir);
                const parts = relativePath.split(path.sep);
                const name = parts.pop() || '';
                const organization = parts.length > 0 ? parts[0] : 'Other';
                
                try {
                    const details = await getRepoDetails(dir);
                    
                    repositories.push({
                        path: dir,
                        name,
                        organization,
                        fullPath: relativePath,
                        ...details
                    });
                } catch (error) {
                    console.error(`Error processing repository ${dir}:`, error);
                }
                return; // Don't look for nested repos inside a Git repo
            }
            
            // Recursively search subdirectories
            for (const item of items) {
                if (item.isDirectory() && !item.name.startsWith('.')) {
                    try {
                        await findGitRepos(path.join(dir, item.name));
                    } catch (err) {
                        console.error(`Error scanning directory ${path.join(dir, item.name)}:`, err);
                    }
                }
            }
        };
        
        // Start scanning from the base directory
        await findGitRepos(gitBasePath);
        
        // Sort repositories by organization and name
        const sortedRepositories = repositories.sort((a, b) => {
            if (a.organization < b.organization) return -1;
            if (a.organization > b.organization) return 1;
            return a.name.localeCompare(b.name);
        });
        
        // Count repositories by organization
        const byOrganization = sortedRepositories.reduce((acc, repo) => {
            acc[repo.organization] = (acc[repo.organization] || 0) + 1;
            return acc;
        }, {});
        
        res.json({
            success: true,
            repositories: sortedRepositories,
            stats: {
                total: sortedRepositories.length,
                byOrganization
            },
            scannedAt: new Date().toISOString()
        });

Please format the article in HTML with appropriate headings, paragraphs, and lists where necessary.`;

        res.json({
            success: true,
            prompt: process.env.PROMPT_TEMPLATE || defaultPrompt,
            maxTokens: parseInt(process.env.MAX_TOKENS) || 2000,
            temperature: parseFloat(process.env.TEMPERATURE) || 0.7
        });
    } catch (error) {
        console.error('Error getting prompt config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load prompt configuration'
        });
    }
});

// Serve the main application with all required environment variables
app.get('/', (req, res) => {
    try {
        // Set no-cache headers
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
        
        // Render the template using Express view engine
        // Pass an empty object as locals since we're handling config in the engine
        res.render('index', {}, (err, html) => {
            if (err) {
                console.error('Error during template rendering:', err);
                return res.status(500).send('Error rendering template: ' + err.message);
            }
            res.send(html);
        });
        
    } catch (error) {
        console.error('Error in root route:', error);
        res.status(500).send('Error loading the application: ' + error.message);
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    log(`Unhandled error: ${error.message}`, 'error');
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve views directory
const viewsDir = path.join(__dirname, 'views');
log(`Views directory: ${viewsDir}`);
app.use('/views', express.static(viewsDir));

// Start server
const server = app.listen(PORT, () => {
    log(`🚀 Server running on port ${PORT}`);
    log(`📝 API available at: http://localhost:${PORT}/api`);
    log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    log(`WordPress URL: ${process.env.WORDPRESS_URL || 'Not set'}`);
    log(`WordPress Username: ${process.env.WORDPRESS_USERNAME || 'Not set'}`);
    log('WordPress Token: ' + (process.env.WORDPRESS_TOKEN ? '***' : 'Not set'));
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        log('Server closed');
        process.exit(0);
    });
});

module.exports = app;
