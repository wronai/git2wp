// Configuration
const API_BASE_URL = window.API_URL || window.location.origin + '/api';
const configManager = window.configManager || null;

// Global state
let repositories = [];
let selectedRepository = null;
let generatedArticle = null;

/**
 * Loads Git configuration and updates the UI
 */
async function loadGitConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/config/git`);
        if (!response.ok) {
            throw new Error('Nie udało się załadować konfiguracji Gita');
        }
        
        const config = await response.json();
        
        if (config.success && config.defaultPath) {
            const githubPathInput = document.getElementById('githubPath');
            if (githubPathInput && !githubPathInput.value) {
                githubPathInput.value = config.defaultPath;
                console.log('Ustawiono domyślną ścieżkę Git:', config.defaultPath);
            }
        }
        
        return config;
    } catch (error) {
        console.error('Błąd podczas ładowania konfiguracji Gita:', error);
        showStatus(`Błąd podczas ładowania konfiguracji Gita: ${error.message}`, 'error');
        return null;
    }
}

// Global variables
let gitData = {};
let selectedProject = null;
let defaultPrompt = '';

/**
 * Shows a status message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of status (loading, success, error)
 */
function showStatus(message, type = 'loading') {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    
    // Clear previous classes and set base alert class
    statusDiv.className = 'alert';
    
    // Add appropriate class based on type
    if (type === 'success') {
        statusDiv.classList.add('alert-success');
    } else if (type === 'error') {
        statusDiv.classList.add('alert-error');
    } else {
        statusDiv.classList.add('alert-info');
    }
    
    // Set the message
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.style.opacity = '1';
    
    // Auto-hide after 5 seconds if it's not an error
    if (type !== 'error') {
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                // Fade out effect
                statusDiv.style.transition = 'opacity 0.5s ease';
                statusDiv.style.opacity = '0';
                
                // Hide after fade out
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 500);
            }
        }, 5000);
    }
}

/**
 * Tests the WordPress connection
 */
async function testWordPressConnection() {
    const wordpressUrl = document.getElementById('wordpressUrl').value;
    const username = document.getElementById('wordpressUsername').value;
    const password = document.getElementById('wordpressPassword').value;
    
    if (!wordpressUrl || !username || !password) {
        showStatus('Proszę wypełnić wszystkie wymagane pola konfiguracji WordPress', 'error');
        return;
    }
    
    showStatus('Testowanie połączenia z WordPress...', 'loading');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/test-wordpress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: wordpressUrl,
                username,
                password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('✅ Połączenie z WordPress zakończone sukcesem!', 'success');
        } else {
            showStatus(`❌ Błąd: ${data.error || 'Nieznany błąd'}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Błąd połączenia: ${error.message}`, 'error');
    }
}

/**
 * Tests the Ollama connection
 */
async function testOllamaConnection() {
    const ollamaUrl = document.getElementById('ollamaUrl').value || 'http://localhost:11434';
    
    showStatus('Testowanie połączenia z Ollama...', 'loading');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/test-ollama`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ollamaUrl })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('✅ Połączenie z Ollama zakończone sukcesem!', 'success');
        } else {
            showStatus(`❌ Błąd: ${data.error || 'Nieznany błąd'}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Błąd połączenia: ${error.message}`, 'error');
    }
}

/**
 * Scans for Git projects
 */
async function scanGitProjects() {
    const githubPath = document.getElementById('githubPath').value;
    const selectedDate = document.getElementById('selectedDate').value;
    
    if (!githubPath) {
        showStatus('Proszę podać ścieżkę do katalogu z projektami', 'error');
        return;
    }
    
    if (!selectedDate) {
        showStatus('Proszę wybrać datę analizy', 'error');
        return;
    }
    
    showStatus('Skanowanie projektów Git...', 'loading');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/scan-git`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ githubPath, selectedDate })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            gitData = data.data;  // The projects are in data.data
            displayGitProjects(data.data.projects);
            showStatus(`Znaleziono ${data.data.projects.length} projektów Git`, 'success');
        } else {
            showStatus(`❌ Błąd: ${data.error || 'Nieznany błąd'}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Błąd: ${error.message}`, 'error');
    }
}

/**
 * Displays Git projects in the UI
 * @param {Array} projects - Array of Git projects
 */
function displayGitProjects(projects) {
    const projectsContainer = document.getElementById('gitProjects');
    const projectsSection = document.getElementById('gitProjectsSection');
    
    if (!projectsContainer || !projectsSection) {
        console.error('Required elements not found');
        return;
    }
    
    if (!projects || projects.length === 0) {
        projectsContainer.innerHTML = '<p>Brak projektów do wyświetlenia</p>';
        projectsSection.style.display = 'block';
        return;
    }
    
    // Show the projects section
    projectsSection.style.display = 'block';
    
    // Generate project cards
    projectsContainer.innerHTML = projects.map((project, index) => `
        <div class="project-card ${selectedProject === index ? 'project-card--active' : ''}" 
             onclick="selectProject(${index})">
            <div class="project-card__name">${project.name}</div>
            <div class="project-card__path">${project.path}</div>
            <div class="project-card__commits">${project.commits.length} commitów</div>
        </div>
    `).join('');
}

/**
 * Selects a project
 * @param {number} index - Index of the project to select
 */
function selectProject(index) {
    selectedProject = index;
    displayGitProjects(gitData.projects);
    // Enable generate button when project is selected
    document.getElementById('generateBtn').disabled = false;
    document.getElementById('generatePublishBtn').style.display = 'inline-block';
    
    // Update UI to show which project is selected
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach((card, i) => {
        if (i === index) {
            card.classList.add('project-card--active');
        } else {
            card.classList.remove('project-card--active');
        }
    });
}

/**
 * Generates an article based on the selected project
 */
async function getPromptPrefix() {
    const customPrompt = document.getElementById('customPrompt')?.value || '';
    return customPrompt || defaultPrompt || '';
}

async function generateArticle() {
    if (selectedProject === null || !gitData.projects || !gitData.projects[selectedProject]) {
        showStatus('Proszę wybrać projekt', 'error');
        return;
    }
    
    // Check if WordPress URL is provided
    const wordpressUrl = document.getElementById('wordpressUrl').value;
    if (!wordpressUrl) {
        showStatus('Proszę podać adres URL WordPress', 'error');
        return;
    }
    
    const project = gitData.projects[selectedProject];
    const ollamaUrl = document.getElementById('ollamaUrl').value || window.APP_CONFIG.OLLAMA_URL || 'http://localhost:11437';
    const customPrompt = document.getElementById('customPrompt').value;
    const articleTitle = document.getElementById('articleTitle').value;
    
    // Show loading state
    showStatus('Generowanie artykułu...', 'loading');
    
    // Clear previous article and show preview section
    const previewSection = document.getElementById('previewSection');
    const articlePreview = document.getElementById('articlePreview');
    articlePreview.innerHTML = '<div class="loading-dots">Łączenie z modelem AI<span>.</span><span>.</span><span>.</span></div>';
    previewSection.style.display = 'block';
    
    // Scroll to preview section
    previewSection.scrollIntoView({ behavior: 'smooth' });
    
    try {
        // Get selected model
        const selectedModel = document.getElementById('ollamaModel').value;
        if (!selectedModel) {
            showStatus('Proszę wybrać model z listy', 'error');
            return;
        }
        
        // Format the data to match server's expected structure
        const requestData = {
            gitData: {
                projects: [project],
                date: document.getElementById('selectedDate').value
            },
            ollamaUrl: ollamaUrl,
            model: selectedModel,
            customTitle: document.getElementById('articleTitle').value || undefined,
            customPrompt: getPromptPrefix()
        };
        
        // Check if Ollama is accessible
        try {
            const response = await fetch(`${ollamaUrl}/api/tags`);
            if (!response.ok) {
                throw new Error('Nie można połączyć się z serwerem Ollama');
            }
            const data = await response.json();
            console.log('Available Ollama models:', data);
        } catch (error) {
            showStatus(`❌ Błąd połączenia z Ollama: ${error.message}. Upewnij się, że serwer Ollama jest uruchomiony.`, 'error');
            return;
        }

        console.log('Sending request to generate article:', requestData);
        
        // Clear any previous content
        articlePreview.innerHTML = '<div class="loading-dots">Generuję artykuł<span>.</span><span>.</span><span>.</span></div>';
        
        // Use fetch with ReadableStream for better control
        const response = await fetch(`${API_BASE_URL}/api/generate-article-stream?data=${encodeURIComponent(JSON.stringify(requestData))}`, {
            method: 'GET',
            headers: {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Błąd serwera: ${response.status} ${response.statusText}\n${error}`);
        }
        
        if (!response.body) {
            throw new Error('Brak danych w odpowiedzi serwera');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullArticle = '';
        
        // Clear loading message
        articlePreview.innerHTML = '';
        
        // Process the stream
        while (true) {
            try {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('Stream completed');
                    break;
                }
                
                // Decode the chunk
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (!line.trim()) continue; // Skip empty lines
                    
                    try {
                        // Check if this is an event line
                        if (line.startsWith('data: ')) {
                            const data = line.substring(6).trim();
                            
                            if (data === '[DONE]') {
                                console.log('Received DONE signal');
                                document.getElementById('publishBtn').disabled = false;
                                showStatus('Artykuł wygenerowany pomyślnie!', 'success');
                                continue;
                            }
                            
                            // Try to parse the data as JSON
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed && parsed.content) {
                                    fullArticle += parsed.content;
                                    articlePreview.innerHTML = fullArticle + 
                                        '<span class="typing-indicator">|</span>';
                                    
                                    // Try to extract custom prompt instructions if custom prompt is empty
                                    if (!document.getElementById('customPrompt').value) {
                                        // Simplified regex to find first paragraph
                                        const firstParagraph = fullArticle.match(/<p[^>]*>(.*?)<\/p>/i);
                                        if (firstParagraph && firstParagraph[1]) {
                                            const promptText = firstParagraph[1].replace(/<[^>]*>/g, '').trim();
                                            // Only set if we have meaningful content (more than 20 chars)
                                            if (promptText.length > 20) {
                                                document.getElementById('customPrompt').value = promptText;
                                            }
                                        }
                                    }
                                    
                                    // Auto-scroll to bottom
                                    articlePreview.scrollTop = articlePreview.scrollHeight;
                                }
                            } catch (e) {
                                console.error('Error parsing JSON:', e, 'Data:', data);
                                // If it's not JSON, append as plain text
                                fullArticle += data;
                                articlePreview.innerHTML = fullArticle;
                            }
                        }
                    } catch (e) {
                        console.error('Error processing line:', e, 'Line:', line);
                    }
                }
            } catch (e) {
                console.error('Error reading stream:', e);
                showStatus(`Błąd podczas odczytu strumienia: ${e.message}`, 'error');
                return;
            }
        }
    } catch (error) {
        showStatus(`❌ Błąd: ${error.message}`, 'error');
    }
}

/**
 * Generates and immediately publishes an article
 */
async function generateAndPublishArticle() {
    await generateArticle();
    if (generatedArticle) {
        await publishArticle();
    }
}



// Function to open WordPress admin
function openWordPressAdmin() {
    const wordpressUrl = document.getElementById('wordpressUrl').value.trim();
    if (!wordpressUrl) {
        showStatus('Proszę podać adres URL WordPress', 'error');
        return;
    }
    
    // Ensure the URL has the correct format
    let adminUrl = wordpressUrl;
    if (!adminUrl.endsWith('/')) {
        adminUrl += '/';
    }
    if (!adminUrl.includes('wp-admin')) {
        adminUrl += 'wp-admin/';
    }
    
    // Open in a new tab
    window.open(adminUrl, '_blank');
}

// Load the default prompt when the page loads
async function loadDefaultPrompt() {
    try {
        showStatus('Ładowanie domyślnego promptu...', 'loading');
        const response = await fetch(`${API_BASE_URL}/api/config/prompt`);
        const data = await response.json();
        
        if (data.success) {
            const promptTextarea = document.getElementById('defaultPrompt');
            if (promptTextarea) {
                promptTextarea.value = data.prompt || '';
                defaultPrompt = data.prompt || '';
            }
            showStatus('Domyślny prompt załadowany', 'success');
        } else {
            showStatus('Błąd podczas ładowania promptu', 'error');
        }
    } catch (error) {
        console.error('Error loading prompt:', error);
        showStatus('Błąd podczas ładowania promptu', 'error');
    }
}

// Save the default prompt
async function saveDefaultPrompt() {
    const promptTextarea = document.getElementById('defaultPrompt');
    if (!promptTextarea) return;
    
    const newPrompt = promptTextarea.value.trim();
    if (!newPrompt) {
        showStatus('Prompt nie może być pusty', 'error');
        return;
    }
    
    try {
        showStatus('Zapisywanie promptu...', 'loading');
        const saveBtn = document.getElementById('savePromptBtn');
        const saveText = document.getElementById('savePromptText');
        
        if (saveBtn) saveBtn.disabled = true;
        if (saveText) saveText.textContent = '💾 Zapisuję...';
        
        const response = await fetch(`${API_BASE_URL}/api/config/prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: newPrompt })
        });
        
        const data = await response.json();
        
        if (data.success) {
            defaultPrompt = newPrompt;
            showStatus('Prompt został zapisany pomyślnie!', 'success');
        } else {
            showStatus(`Błąd: ${data.error || 'Nie udało się zapisać promptu'}`, 'error');
        }
    } catch (error) {
        console.error('Error saving prompt:', error);
        showStatus('Błąd podczas zapisywania promptu', 'error');
    } finally {
        const saveBtn = document.getElementById('savePromptBtn');
        const saveText = document.getElementById('savePromptText');
        if (saveBtn) saveBtn.disabled = false;
        if (saveText) saveText.textContent = '💾 Zapisz prompt';
    }
}

/**
 * Fetches available models from Ollama API and updates the UI
 */
async function fetchOllamaModels() {
    const ollamaUrl = document.getElementById('ollamaUrl').value || OLLAMA_URL;
    const modelSelect = document.getElementById('ollamaModel');
    const modelStatus = document.getElementById('modelStatus');
    
    // Clear previous state
    modelStatus.textContent = 'Pobieranie dostępnych modeli...';
    modelStatus.className = '';
    modelStatus.classList.add('loading');
    
    // Clear existing options but keep the loading state
    modelSelect.innerHTML = '';
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Ładowanie...';
    loadingOption.disabled = true;
    modelSelect.appendChild(loadingOption);
    modelSelect.disabled = true;
    
    try {
        const response = await fetch(`${ollamaUrl}/api/tags`);
        if (!response.ok) {
            throw new Error(`Błąd HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.models || !Array.isArray(data.models) || data.models.length === 0) {
            throw new Error('Brak dostępnych modeli na serwerze Ollama');
        }
        
        // Sort models alphabetically
        data.models.sort((a, b) => a.name.localeCompare(b.name));
        
        // Clear existing options
        modelSelect.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Wybierz model...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        modelSelect.appendChild(defaultOption);
        
        // Add models to select
        data.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            // Add model size if available
            if (model.size) {
                const sizeInGB = (model.size / 1024 / 1024 / 1024).toFixed(1);
                option.textContent += ` (${sizeInGB}GB)`;
            }
            modelSelect.appendChild(option);
        });
        
        // Select the default model if available
        const defaultModel = window.APP_CONFIG.OLLAMA_MODEL;
        if (defaultModel) {
            const matchingModel = data.models.find(m => m.name === defaultModel);
            if (matchingModel) {
                modelSelect.value = defaultModel;
            }
        }
        
        modelSelect.disabled = false;
        modelStatus.textContent = `Załadowano ${data.models.length} modeli`;
        modelStatus.className = 'success';
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            if (modelStatus.textContent.includes('Załadowano')) {
                modelStatus.textContent = '';
                modelStatus.className = '';
            }
        }, 3000);
        
    } catch (error) {
        console.error('Błąd podczas pobierania modeli:', error);
        modelStatus.textContent = `Błąd: ${error.message}`;
        modelStatus.className = 'error';
        
        // Add a retry button
        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'Spróbuj ponownie';
        retryBtn.className = 'btn-text';
        retryBtn.onclick = fetchOllamaModels;
        
        modelStatus.appendChild(document.createElement('br'));
        modelStatus.appendChild(retryBtn);
        
        // Add a default model option
        modelSelect.innerHTML = '';
        const errorOption = document.createElement('option');
        errorOption.value = '';
        errorOption.textContent = 'Błąd ładowania modeli';
        errorOption.disabled = true;
        modelSelect.appendChild(errorOption);
    }
}

/**
 * Updates the Ollama URL and refreshes the models list
 */
function updateOllamaUrl() {
    const urlInput = document.getElementById('ollamaUrl');
    if (urlInput.value) {
        OLLAMA_URL = urlInput.value;
        fetchOllamaModels();
    }
}

/**
 * Loads WordPress configuration from environment variables and populates the form
 */
function loadWordPressConfig() {
    try {
        const wordpressUrl = document.getElementById('wordpressUrl');
        const wordpressUsername = document.getElementById('wordpressUsername');
        const wordpressPassword = document.getElementById('wordpressPassword');
        
        // Get values from environment variables
        const config = {
            url: window.APP_CONFIG.WORDPRESS_URL || '',
            username: window.APP_CONFIG.WORDPRESS_USERNAME || '',
            token: window.APP_CONFIG.WORDPRESS_TOKEN || ''
        };
        
        // Log the loaded config (without sensitive data)
        console.log('Loading WordPress config:', {
            url: config.url ? 'set' : 'not set',
            username: config.username ? 'set' : 'not set',
            token: config.token ? '***' : 'not set'
        });
        
        // Set values if they exist
        if (wordpressUrl) wordpressUrl.value = config.url;
        if (wordpressUsername) wordpressUsername.value = config.username;
        if (wordpressPassword) wordpressPassword.value = config.token;
        
        // Show status if any config is missing
        const missingFields = [];
        if (!config.url) missingFields.push('WordPress URL');
        if (!config.username) missingFields.push('username');
        if (!config.token) missingFields.push('application password');
        
        if (missingFields.length > 0) {
            console.warn('Missing WordPress configuration:', missingFields.join(', '));
        }
        
        return missingFields.length === 0;
    } catch (error) {
        console.error('Error loading WordPress config:', error);
        return false;
    }
}

/**
 * Toggles password visibility
 */
function setupPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('wordpressPassword');
    
    if (!toggleBtn || !passwordInput) return;
    
    toggleBtn.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        
        // Toggle icon
        const icon = toggleBtn.querySelector('svg');
        if (icon) {
            if (type === 'text') {
                icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
            } else {
                icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            }
        }
    });
}

// Initialize the application
async function init() {
    try {
        console.log('Initializing application...');
        
        // Initialize UI elements
        const repoSelect = document.getElementById('repository-select');
        const dateSelect = document.getElementById('date-select');
        const analyzeBtn = document.getElementById('analyze-btn');
        const scanReposBtn = document.getElementById('scan-repos');
        const editArticleBtn = document.getElementById('edit-article-btn');
        const publishArticleBtn = document.getElementById('publish-article-btn');
        const generateArticleBtn = document.getElementById('generate-article-btn');
        const repositoryDetails = document.getElementById('repository-details');
        const articlePreview = document.getElementById('article-preview');
        const articleContent = document.getElementById('article-content');

        if (!repoSelect || !dateSelect || !analyzeBtn || !scanReposBtn || !editArticleBtn || !publishArticleBtn || !generateArticleBtn) {
            console.error('One or more required elements not found');
            return;
        }

        console.log('All UI elements found');

        // Event listeners
        scanReposBtn.addEventListener('click', async (e) => {
            console.log('Scan repositories button clicked');
            e.preventDefault();
            try {
                await scanRepositories();
                // Show repository details section after successful scan
                if (repositoryDetails) {
                    repositoryDetails.style.display = 'block';
                }
            } catch (err) {
                console.error('Error in scanRepositories:', err);
                showStatus(`Error scanning repositories: ${err.message}`, 'error');
            }
        });
        
        // Repository selection handler
        if (repoSelect) {
            repoSelect.addEventListener('change', (e) => {
                const selectedIndex = e.target.value;
                if (selectedIndex) {
                    // Enable analyze button when a repository is selected
                    if (analyzeBtn) analyzeBtn.disabled = false;
                    if (generateArticleBtn) generateArticleBtn.disabled = false;
                    
                    // Show repository details if not already visible
                    if (repositoryDetails) {
                        repositoryDetails.style.display = 'block';
                    }
                } else {
                    // Disable buttons when no repository is selected
                    if (analyzeBtn) analyzeBtn.disabled = true;
                    if (generateArticleBtn) generateArticleBtn.disabled = true;
                }
            });
        }

        // Analyze button click handler
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', async () => {
                try {
                    await analyzeChanges();
                    // Show article preview after successful analysis
                    if (articlePreview) {
                        articlePreview.style.display = 'block';
                    }
                } catch (err) {
                    console.error('Error analyzing changes:', err);
                    showStatus(`Error analyzing changes: ${err.message}`, 'error');
                }
            });
        }

        // Generate article button click handler
        if (generateArticleBtn) {
            generateArticleBtn.addEventListener('click', async () => {
                try {
                    await generateArticle();
                    // Show article preview after generating article
                    if (articlePreview) {
                        articlePreview.style.display = 'block';
                    }
                } catch (err) {
                    console.error('Error generating article:', err);
                    showStatus(`Error generating article: ${err.message}`, 'error');
                }
            });
        }

        // Edit article button click handler
        if (editArticleBtn) {
            editArticleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                editArticle();
            });
        }

        // Publish article button click handler
        if (publishArticleBtn) {
            publishArticleBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await publishArticle();
                    showStatus('Article published successfully!', 'success');
                } catch (err) {
                    console.error('Error publishing article:', err);
                    showStatus(`Error publishing article: ${err.message}`, 'error');
                }
            });
        }

        console.log('Event listeners attached');

        // Initial repository scan
        console.log('Starting initial repository scan...');
        try {
            await scanRepositories();
            // Show repository details after initial scan
            if (repositoryDetails) {
                repositoryDetails.style.display = 'block';
            }
            console.log('Initial repository scan completed');
        } catch (error) {
            console.error('Error during initial repository scan:', error);
            showStatus(`Error during initial repository scan: ${error.message}`, 'error');
        }
        
    } catch (error) {
        console.error('Error during initialization:', error);
        showStatus(`Initialization error: ${error.message}`, 'error');
    }
}

// Scan for Git repositories
async function scanRepositories() {
    console.log('Starting repository scan...');
    const repoSelect = document.getElementById('repository-select');
    const dateSelect = document.getElementById('date-select');
    const analyzeBtn = document.getElementById('analyze-btn');
    const scanReposBtn = document.getElementById('scan-repos');
    const generateArticleBtn = document.getElementById('generate-article-btn');

    if (!repoSelect || !scanReposBtn) {
        console.error('Required elements not found');
        return [];
    }

    try {
        console.log('Updating UI for scan...');
        // Update UI state
        if (scanReposBtn) {
            scanReposBtn.disabled = true;
            scanReposBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Scanning...';
        }
        
        if (repoSelect) {
            repoSelect.disabled = true;
            repoSelect.innerHTML = '<option value="">Scanning repositories...</option>';
        }

        // Disable buttons during scan
        if (analyzeBtn) analyzeBtn.disabled = true;
        if (generateArticleBtn) generateArticleBtn.disabled = true;

        console.log('Making API request to:', `${API_BASE_URL}/git/repos`);
        // Fetch repositories
        const response = await fetch(`${API_BASE_URL}/git/repos`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API response data:', data);
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to scan repositories');
        }

        // Update global state
        repositories = data.repositories || [];
        console.log(`Found ${repositories.length} repositories`);

        // Update repository select
        if (repoSelect) {
            repoSelect.innerHTML = [
                '<option value="">Select a repository...</option>',
                ...repositories.map((repo, index) => {
                    const repoName = repo.organization ? 
                        `${repo.organization}/${repo.name}` : 
                        repo.name;
                    return `<option value="${index}">${repoName}</option>`;
                })
            ].join('');
            repoSelect.disabled = false;
        }

        // Show success message
        showStatus(`Found ${repositories.length} repositories`, 'success');
        console.log('Repository scan completed successfully');
        
        return repositories;

    } catch (error) {
        console.error('Error scanning repositories:', error);
        if (repoSelect) {
            repoSelect.innerHTML = '<option value="">Error loading repositories</option>';
        }
        // Show error to user
        showStatus(`Error scanning repositories: ${error.message}`, 'error');
        throw error; // Re-throw to be handled by the caller
    } finally {
        // Reset button state
        if (scanReposBtn) {
            scanReposBtn.disabled = false;
            scanReposBtn.innerHTML = '<i class="fas fa-sync-alt me-2"></i>Scan Repositories';
        }
    }
}

// Handle repository selection
function handleRepositorySelect(event) {
    const dateSelect = document.getElementById('date-select');
    const analyzeBtn = document.getElementById('analyze-btn');
    const generateArticleBtn = document.getElementById('generate-article-btn');
    const repositoryDetails = document.getElementById('repository-details');
    const articlePreview = document.getElementById('article-preview');
    
    const selectedIndex = event.target.value;
    
    if (selectedIndex === '') {
        // No repository selected
        selectedRepository = null;
        if (analyzeBtn) analyzeBtn.disabled = true;
        if (generateArticleBtn) generateArticleBtn.disabled = true;
        if (dateSelect) dateSelect.disabled = true;
        if (repositoryDetails) repositoryDetails.style.display = 'none';
        if (articlePreview) articlePreview.style.display = 'none';
        return;
    }
    
    // Get the selected repository
    const index = parseInt(selectedIndex);
    selectedRepository = repositories[index] || null;
    
    if (!selectedRepository) {
        showStatus('Selected repository not found', 'error');
        return;
    }
    
    console.log('Selected repository:', selectedRepository);
    
    // Update UI based on selection
    if (repositoryDetails) {
        repositoryDetails.style.display = 'block';
    }
    
    if (dateSelect) {
        dateSelect.disabled = false;
        // Set default date to today
        dateSelect.value = new Date().toISOString().split('T')[0];
    }
    
    if (analyzeBtn) analyzeBtn.disabled = false;
    if (generateArticleBtn) generateArticleBtn.disabled = false;
    
    // Hide article preview when changing repository
    if (articlePreview) {
        articlePreview.style.display = 'none';
    }
    
    // Show success message
    showStatus(`Selected repository: ${selectedRepository.organization ? selectedRepository.organization + '/' : ''}${selectedRepository.name}`, 'success');
    analyzeBtn.disabled = !selectedRepository;
}

// Analyze repository changes
async function analyzeChanges() {
    const dateSelect = document.getElementById('date-select');
    const analyzeBtn = document.getElementById('analyze-btn');
    const results = document.getElementById('results');
    const articlePreview = document.getElementById('article-preview');

    if (!selectedRepository || !dateSelect.value) return;

    try {
        // Update UI state
        analyzeBtn.classList.add('loading');
        analyzeBtn.disabled = true;

        // Get commits for the selected date
        const response = await fetch(`${API_BASE_URL}/scan-git`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                repoPath: selectedRepository.path,
                date: dateSelect.value
            })
        });

        if (!response.ok) throw new Error('Failed to analyze repository');

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to analyze repository');

        // Display results
        results.style.display = 'block';
        articlePreview.innerHTML = `
            <h3>Commits Found: ${data.data.commits.length}</h3>
            <pre>${JSON.stringify(data.data.commits, null, 2)}</pre>
        `;

    } catch (error) {
        console.error('Error analyzing repository:', error);
        articlePreview.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    } finally {
        analyzeBtn.classList.remove('loading');
        analyzeBtn.disabled = false;
    }
}

// Edit article content
function editArticle() {
    const articlePreview = document.getElementById('article-preview');
    const content = articlePreview.innerHTML;

    articlePreview.innerHTML = `
        <div class="form-group">
            <textarea class="form-control" rows="10">${content}</textarea>
        </div>
    `;
}

// Publish article to WordPress
async function publishArticle() {
    const articlePreview = document.getElementById('article-preview');
    const publishBtn = document.getElementById('publish-btn');
    const wordpressUrl = document.getElementById('wordpressUrl').value.trim();
    const username = document.getElementById('wordpressUsername').value.trim();
    const password = document.getElementById('wordpressPassword').value.trim();
    const articleTitle = document.getElementById('article-title').value.trim();
    const articleContent = articlePreview.innerHTML;

    if (!wordpressUrl || !username || !password) {
        showStatus('Proszę skonfigurować połączenie z WordPress', 'error');
        return;
    }

    if (!articleContent) {
        showStatus('Brak zawartości artykułu do opublikowania', 'error');
        return;
    }

    try {
        publishBtn.classList.add('loading');
        publishBtn.disabled = true;
        showStatus('Publikowanie artykułu...', 'loading');

        const response = await fetch(`${API_BASE_URL}/wordpress/publish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: wordpressUrl,
                username,
                password,
                title: articleTitle || 'Podsumowanie zmian w projekcie',
                content: articleContent,
                status: 'draft' // Default to draft, can be changed to 'publish' later
            })
        });

        const result = await response.json();

        if (result.success) {
            showStatus('✅ Artykuł został pomyślnie zapisany jako szkic w WordPress!', 'success');
            if (result.link) {
                // Add a button to view the post
                const viewPostBtn = document.createElement('a');
                viewPostBtn.href = result.link;
                viewPostBtn.target = '_blank';
                viewPostBtn.className = 'btn btn-secondary mt-2';
                viewPostBtn.textContent = 'Zobacz post';
                
                const statusElement = document.querySelector('.status-message');
                statusElement.appendChild(document.createElement('br'));
                statusElement.appendChild(viewPostBtn);
            }
        } else {
            throw new Error(result.error || 'Nieznany błąd podczas publikowania');
        }
    } catch (error) {
        console.error('Error publishing article:', error);
        showStatus(`❌ Błąd podczas publikowania: ${error.message}`, 'error');
    } finally {
        publishBtn.classList.remove('loading');
        publishBtn.disabled = false;
    }
}

// Initialize the application when the script loads
(async function() {
    try {
        // Wait for the DOM to be fully loaded
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
        
        console.log('Initializing application...');
        await init();
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        
        // Show error message to the user
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = 'Error initializing application. Please check the console for details.';
            statusMessage.className = 'alert alert-danger';
            statusMessage.style.display = 'block';
        }
    }
})();

// Export the init function for ES modules
export { init };
