// Configuration
const API_BASE_URL = window.APP_CONFIG.API_URL || window.location.origin;
const OLLAMA_URL = window.APP_CONFIG.OLLAMA_URL || 'http://localhost:11434';

// Global variables
let gitData = {};
let selectedProject = null;
let generatedArticle = '';
let defaultPrompt = '';

/**
 * Shows a status message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of status (loading, success, error)
 */
function showStatus(message, type = 'loading') {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    
    // Always show the status div when called
    statusDiv.style.display = 'flex';
    statusDiv.className = `status status--${type}`;
    statusDiv.innerHTML = `
        <div class="status-content">
            ${type === 'loading' ? '⏳' : type === 'success' ? '✅' : '❌'}
            <span>${message}</span>
        </div>
    `;
    
    // Auto-hide success messages after 5 seconds
    if (type !== 'loading') {
        setTimeout(() => {
            if (statusDiv.className.includes(`status--${type}`)) {
                statusDiv.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                    statusDiv.className = 'status';
                    statusDiv.innerHTML = '';
                    statusDiv.style.animation = '';
                }, 300);
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

/**
 * Publishes the generated article to WordPress
 */
async function publishArticle() {
    if (!generatedArticle) {
        showStatus('Brak wygenerowanego artykułu', 'error');
        return;
    }
    
    const wordpressUrl = document.getElementById('wordpressUrl').value;
    const username = document.getElementById('wordpressUsername').value;
    const password = document.getElementById('wordpressPassword').value;
    const title = document.getElementById('articleTitle').value || `Podsumowanie zmian w projekcie ${gitData.projects[selectedProject].name}`;
    
    showStatus('Publikowanie artykułu...', 'loading');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/publish-wordpress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                wordpressUrl,
                username,
                password,
                title,
                content: generatedArticle
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStatus('✅ Artykuł opublikowany pomyślnie!', 'success');
        } else {
            showStatus(`❌ Błąd: ${data.error || 'Nieznany błąd'}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Błąd: ${error.message}`, 'error');
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

document.addEventListener('DOMContentLoaded', () => {
    // Load WordPress configuration from environment
    loadWordPressConfig();
    
    // Set up event listeners
    document.getElementById('goToWordPressBtn')?.addEventListener('click', openWordPressAdmin);
    document.getElementById('testWordPressBtn')?.addEventListener('click', testWordPressConnection);
    document.getElementById('refreshModelsBtn')?.addEventListener('click', fetchOllamaModels);
    document.getElementById('ollamaUrl')?.addEventListener('change', updateOllamaUrl);
    
    // Set up password toggle
    setupPasswordToggle();
    
    // Initial fetch of models
    fetchOllamaModels();
    document.getElementById('testOllamaBtn')?.addEventListener('click', testOllamaConnection);
    document.getElementById('scanGitBtn')?.addEventListener('click', scanGitProjects);
    document.getElementById('generateBtn')?.addEventListener('click', generateArticle);
    document.getElementById('generatePublishBtn')?.addEventListener('click', generateAndPublishArticle);
    document.getElementById('regenerateBtn')?.addEventListener('click', generateArticle);
    document.getElementById('publishBtn')?.addEventListener('click', publishArticle);
    document.getElementById('savePromptBtn')?.addEventListener('click', saveDefaultPrompt);
    
    // Load default prompt when the page loads
    loadDefaultPrompt();
    
    // Make functions available globally for inline event handlers
    window.generateArticle = generateArticle;
    window.testWordPressConnection = testWordPressConnection;
    window.testOllamaConnection = testOllamaConnection;
    window.scanGitProjects = scanGitProjects;
    window.publishToWordPress = publishArticle;
    
    // Initialize UI state
    document.getElementById('generateBtn').disabled = true;
    document.getElementById('generatePublishBtn').style.display = 'none';
    document.getElementById('publishBtn').disabled = true;
    
    // Add help text for WordPress Application Password
    const wordpressPasswordHelp = document.createElement('div');
    wordpressPasswordHelp.className = 'help-text';
    wordpressPasswordHelp.innerHTML = `
        <p><strong>Jak uzyskać Application Password w WordPress:</strong></p>
        <ol>
            <li>Zaloguj się do panelu administracyjnego WordPress</li>
            <li>Przejdź do Profil > Application Passwords</li>
            <li>Wpisz nazwę aplikacji (np. "Git Publisher")</li>
            <li>Kliknij "Add New"</li>
            <li>Skopiuj wygenerowane hasło i wklej je w polu powyżej</li>
        </ol>
        <p><em>Uwaga: Hasło wyświetli się tylko raz, więc zapisz je w bezpiecznym miejscu.</em></p>
    `;
    document.getElementById('wordpressPassword').insertAdjacentElement('afterend', wordpressPasswordHelp);
    document.getElementById('publishBtn').disabled = true;
    
    // Show initial status message
    showStatus('💡 Skonfiguruj wszystkie sekcje, a następnie wygeneruj artykuł na podstawie aktywności Git!', 'success');
});
