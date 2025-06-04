// server.js - Backend dla WordPress Git Publisher
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
        this.baseUrl = baseUrl;
    }

    async testConnection() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`);
            return {
                success: true,
                models: response.data.models || []
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async generateArticle(prompt, model = 'mistral:7b') {
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
}

// WordPress helper class
class WordPressClient {
    constructor(url, username, password) {
        this.baseUrl = url;
        this.authHeader = Buffer.from(`${username}:${password}`).toString('base64');
    }

    async testConnection() {
        try {
            const response = await axios.get(`${this.baseUrl}/wp-json/wp/v2/users/me`, {
                headers: {
                    'Authorization': `Basic ${this.authHeader}`
                }
            });

            return {
                success: true,
                user: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    async publishPost(postData) {
        try {
            log('Publikowanie artykułu na WordPress');
            const response = await axios.post(`${this.baseUrl}/wp-json/wp/v2/posts`, postData, {
                headers: {
                    'Authorization': `Basic ${this.authHeader}`,
                    'Content-Type': 'application/json'
                }
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
const ollamaClient = new OllamaClient();

// Routes

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
            return res.status(400).json({
                success: false,
                error: 'Brak wymaganych danych (url, username, password)'
            });
        }

        const wpClient = new WordPressClient(url, username, password);
        const result = await wpClient.testConnection();

        res.json(result);
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
app.post('/api/scan-git', async (req, res) => {
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

// Generate article
app.post('/api/generate-article', async (req, res) => {
    try {
        const { gitData, ollamaUrl, model, customTitle } = req.body;

        if (!gitData || !gitData.projects || gitData.projects.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Brak danych Git do analizy'
            });
        }

        if (ollamaUrl) {
            ollamaClient.baseUrl = ollamaUrl;
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

        const prompt = `
Jesteś profesjonalnym programistą i blogerem technicznym. Napisz artykuł na bloga o dzisiejszych postępach w projektach programistycznych.

INSTRUKCJE:
- Napisz w języku polskim
- Użyj profesjonalnego, ale przystępnego tonu
- Artykuł powinien mieć 600-1000 słów
- Stwórz właściwą strukturę HTML z tagami <h1>, <h2>, <p>, <ul>, <li>
- Dodaj konkretne przykłady z commitów
- Podkreśl najważniejsze osiągnięcia
- Dodaj sekcję podsumowującą

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

        if (!wpUrl || !wpUsername || !wpPassword || !article) {
            return res.status(400).json({
                success: false,
                error: 'Brak wymaganych danych WordPress lub artykułu'
            });
        }

        const wpClient = new WordPressClient(wpUrl, wpUsername, wpPassword);

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
});

module.exports = app;