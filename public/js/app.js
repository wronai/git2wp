// Configuration
const API_BASE_URL = 'http://localhost:3001';

// Global variables
let gitData = {};
let selectedProject = null;
let generatedArticle = '';

/**
 * Shows a status message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of status (loading, success, error)
 */
function showStatus(message, type = 'loading') {
    const statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) return;
    
    statusDiv.className = `status status--${type}`;
    statusDiv.innerHTML = message;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (statusDiv.className.includes('status--success')) {
                statusDiv.className = 'status';
                statusDiv.innerHTML = '';
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
    const ollamaUrl = document.getElementById('ollamaUrl').value || 'http://localhost:11437';
    const customPrompt = document.getElementById('customPrompt').value;
    
    // Show loading state
    showStatus('Generowanie artykułu...', 'loading');
    
    // Clear previous article and show preview section
    const previewSection = document.getElementById('previewSection');
    const articlePreview = document.getElementById('articlePreview');
    articlePreview.innerHTML = '<div class="loading-dots">Generuję artykuł<span>.</span><span>.</span><span>.</span></div>';
    previewSection.style.display = 'block';
    
    // Scroll to preview section
    previewSection.scrollIntoView({ behavior: 'smooth' });
    
    try {
        // Format the data to match server's expected structure
        const requestData = {
            gitData: {
                projects: [project]
            },
            ollamaUrl: ollamaUrl,
            model: 'llama2',
            customTitle: customPrompt || `Podsumowanie projektu ${project.name}`,
            stream: true  // Request streaming response
        };
        
        // Check if Ollama is accessible
        try {
            const ollamaCheck = await fetch(`${ollamaUrl}/api/tags`);
            if (!ollamaCheck.ok) {
                throw new Error('Nie można połączyć się z serwerem Ollama');
            }
        } catch (error) {
            showStatus(`❌ Błąd połączenia z Ollama: ${error.message}. Upewnij się, że serwer Ollama jest uruchomiony.`, 'error');
            return;
        }

        console.log('Sending request to generate article:', requestData);

        // Use EventSource for server-sent events (SSE) for real-time updates
        const eventSource = new EventSource(
            `${API_BASE_URL}/api/generate-article-stream?` + 
            new URLSearchParams({
                data: JSON.stringify(requestData)
            })
        );
        
        let fullArticle = '';
        
        eventSource.onmessage = (event) => {
            if (event.data === '[DONE]') {
                eventSource.close();
                document.getElementById('publishBtn').disabled = false;
                showStatus('Artykuł wygenerowany pomyślnie!', 'success');
                return;
            }
            
            try {
                const chunk = JSON.parse(event.data);
                if (chunk.content) {
                    fullArticle += chunk.content;
                    articlePreview.innerHTML = fullArticle + 
                        '<div class="typing-indicator">|</div>';
                    
                    // Auto-scroll to bottom
                    articlePreview.scrollTop = articlePreview.scrollHeight;
                }
            } catch (e) {
                console.error('Error parsing chunk:', e);
            }
        };
        
        eventSource.onerror = (error) => {
            console.error('EventSource failed:', error);
            eventSource.close();
            showStatus('❌ Wystąpił błąd podczas generowania artykułu', 'error');
        };
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

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners
    document.getElementById('goToWordPressBtn')?.addEventListener('click', openWordPressAdmin);
    document.getElementById('testWordPressBtn')?.addEventListener('click', testWordPressConnection);
    document.getElementById('testOllamaBtn')?.addEventListener('click', testOllamaConnection);
    document.getElementById('scanGitBtn')?.addEventListener('click', scanGitProjects);
    document.getElementById('generateBtn')?.addEventListener('click', generateArticle);
    document.getElementById('generatePublishBtn')?.addEventListener('click', generateAndPublishArticle);
    document.getElementById('regenerateBtn')?.addEventListener('click', generateArticle);
    document.getElementById('publishBtn')?.addEventListener('click', publishArticle);
    
    // Alias for backward compatibility
    window.generateArticleOnly = generateArticle;
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
