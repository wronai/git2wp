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
        const response = await fetch('/test-wordpress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                wordpressUrl,
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
        const response = await fetch('/test-ollama', {
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
    const directory = document.getElementById('directoryPath').value;
    
    if (!directory) {
        showStatus('Proszę podać ścieżkę do katalogu z projektami', 'error');
        return;
    }
    
    showStatus('Skanowanie projektów Git...', 'loading');
    
    try {
        const response = await fetch('/scan-git', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ directory })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            gitData = data;
            displayGitProjects(data.projects);
            showStatus(`Znaleziono ${data.projects.length} projektów Git`, 'success');
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
    
    if (!projectsContainer) return;
    
    if (!projects || projects.length === 0) {
        projectsContainer.innerHTML = '<p>Brak projektów do wyświetlenia</p>';
        return;
    }
    
    projectsContainer.innerHTML = projects.map((project, index) => `
        <div class="project-card ${selectedProject === index ? 'project-card--active' : ''}" 
             onclick="selectProject(${index})">
            <div class="project-card__name">${project.name}</div>
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
    document.getElementById('generateArticleBtn').disabled = false;
}

/**
 * Generates an article based on the selected project
 */
async function generateArticle() {
    if (selectedProject === null) {
        showStatus('Proszę wybrać projekt', 'error');
        return;
    }
    
    const project = gitData.projects[selectedProject];
    const ollamaUrl = document.getElementById('ollamaUrl').value || 'http://localhost:11434';
    const customPrompt = document.getElementById('customPrompt').value;
    
    showStatus('Generowanie artykułu...', 'loading');
    
    try {
        const response = await fetch('/generate-article', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                project,
                ollamaUrl,
                customPrompt
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            generatedArticle = data.article;
            document.getElementById('articlePreview').innerHTML = generatedArticle;
            document.getElementById('previewSection').style.display = 'block';
            document.getElementById('publishBtn').disabled = false;
            showStatus('Artykuł wygenerowany pomyślnie!', 'success');
        } else {
            showStatus(`❌ Błąd: ${data.error || 'Nieznany błąd'}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Błąd: ${error.message}`, 'error');
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
        const response = await fetch('/publish-article', {
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

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners
    document.getElementById('testWordPressBtn').addEventListener('click', testWordPressConnection);
    document.getElementById('testOllamaBtn').addEventListener('click', testOllamaConnection);
    document.getElementById('scanGitBtn').addEventListener('click', scanGitProjects);
    document.getElementById('generateArticleBtn').addEventListener('click', generateArticle);
    document.getElementById('publishBtn').addEventListener('click', publishArticle);
    
    // Disable buttons that require project selection initially
    document.getElementById('generateArticleBtn').disabled = true;
    document.getElementById('publishBtn').disabled = true;
    
    // Show initial status message
    showStatus('💡 Skonfiguruj wszystkie sekcje, a następnie wygeneruj artykuł na podstawie aktywności Git!', 'success');
});
