import '@testing-library/jest-dom';
import { fireEvent, waitFor, screen } from '@testing-library/dom';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import WordPressAuthHelper from './helpers/wordpressAuth';

// Mock the DOM environment
const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
const dom = new JSDOM(html, { 
  runScripts: 'dangerously',
  url: 'http://localhost'
});
global.document = dom.window.document;
global.window = dom.window;

// Mock import.meta for tests
if (!global.import) {
  global.import = { meta: { url: 'http://localhost/public/js/app.js' } };
}

// Mock document.currentScript for tests
if (!document.currentScript) {
  Object.defineProperty(document, 'currentScript', {
    value: { src: 'http://localhost/public/js/app.js' },
    writable: true
  });
}

describe('WordPress Git Publisher', () => {
  let originalFetch;
  let authHelper;
  
  // Mock WordPress credentials
  const WP_URL = 'http://localhost:8000';
  const WP_USERNAME = 'admin';
  const WP_PASSWORD = 'password';
  
  beforeAll(() => {
    // Set up our document body
    document.body.innerHTML = html;
    
    // Create any missing form elements needed for tests
    const createIfNotExists = (id, type = 'input', parent = document.body) => {
      if (!document.getElementById(id)) {
        const el = document.createElement(type);
        el.id = id;
        if (type === 'input') el.type = 'text';
        parent.appendChild(el);
      }
      return document.getElementById(id);
    };
    
    // Create form elements if they don't exist
    createIfNotExists('wordpressUrl');
    createIfNotExists('wordpressUsername');
    createIfNotExists('wordpressPassword');
    createIfNotExists('githubPath');
    createIfNotExists('selectedDate');
    createIfNotExists('testWordPressBtn', 'button');
    createIfNotExists('testOllamaBtn', 'button');
    createIfNotExists('scanGitBtn', 'button');
    createIfNotExists('generateBtn', 'button');
    createIfNotExists('publishArticleBtn', 'button');
    
    // Create a container for status messages if it doesn't exist
    if (!document.getElementById('status-message')) {
      const statusDiv = document.createElement('div');
      statusDiv.id = 'status-message';
      document.body.appendChild(statusDiv);
    }
    
    // Initialize auth helper
    authHelper = new WordPressAuthHelper(WP_URL, WP_USERNAME, WP_PASSWORD);
    
    // Mock the fetch API
    global.fetch = jest.fn();
    
    // Mock the app.js functionality we need for tests
    global.configManager = {
      get: jest.fn().mockImplementation((key) => {
        const config = {
          'wordpress.url': 'http://localhost:8000',
          'wordpress.username': 'admin',
          'ollama.url': 'http://localhost:11434',
          'ollama.model': 'llama2',
          'git.basePath': '/path/to/repos'
        };
        return config[key];
      })
    };
    
    // Mock the showStatus function
    global.showStatus = jest.fn();
    
    // Mock the loadGitConfig function
    global.loadGitConfig = jest.fn().mockResolvedValue({});
    
    // Mock the testWordPressConnection function
    global.testWordPressConnection = jest.fn().mockResolvedValue(true);
    
    // Mock the testOllamaConnection function
    global.testOllamaConnection = jest.fn().mockResolvedValue(true);
    
    // Mock the scanGitProjects function
    global.scanGitProjects = jest.fn().mockResolvedValue([]);
    
    // Mock the generateArticle function
    global.generateArticle = jest.fn().mockResolvedValue('Generated article content');
    
    // Mock the publishArticle function
    global.publishArticle = jest.fn().mockResolvedValue({ success: true });
    
    // Add event listeners for our test buttons
    document.getElementById('testWordPressBtn')?.addEventListener('click', async () => {
      const success = await testWordPressConnection();
      showStatus(success ? 'WordPress connection successful' : 'WordPress connection failed', 
                success ? 'success' : 'error');
    });
    
    document.getElementById('testOllamaBtn')?.addEventListener('click', async () => {
      const success = await testOllamaConnection();
      showStatus(success ? 'Ollama connection successful' : 'Ollama connection failed', 
                success ? 'success' : 'error');
    });
    
    document.getElementById('scanGitBtn')?.addEventListener('click', async () => {
      showStatus('Scanning Git projects...', 'loading');
      const projects = await scanGitProjects();
      if (projects && projects.length > 0) {
        showStatus(`Found ${projects.length} Git projects`, 'success');
      } else {
        showStatus('No Git projects found', 'warning');
      }
    });
    
    document.getElementById('generateArticleBtn')?.addEventListener('click', async () => {
      showStatus('Generating article...', 'loading');
      const content = await generateArticle();
      if (content) {
        showStatus('Article generated successfully', 'success');
      } else {
        showStatus('Failed to generate article', 'error');
      }
    });
    
    document.getElementById('publishArticleBtn')?.addEventListener('click', async () => {
      showStatus('Publishing article...', 'loading');
      const result = await publishArticle();
      if (result.success) {
        showStatus('Article published successfully', 'success');
      } else {
        showStatus('Failed to publish article', 'error');
      }
    });
  });
  
  beforeEach(() => {
    // Reset fetch mock before each test
    fetch.mockClear();
    
    // Set up default mock responses
    fetch.mockImplementation((url, options) => {
      if (url.includes('test-wordpress')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} })
      });
    });
  });
  
  describe('WordPress Connection', () => {
    it('should show error when WordPress URL is missing', async () => {
      // Arrange
      document.getElementById('wordpressUrl').value = '';
      
      // Act
      fireEvent.click(document.getElementById('testWordPressBtn'));
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Proszę wypełnić wszystkie wymagane pola konfiguracji WordPress/i)).toBeInTheDocument();
      });
    });
    
    it('should test WordPress connection successfully', async () => {
      // Arrange
      document.getElementById('wordpressUrl').value = WP_URL;
      document.getElementById('wordpressUsername').value = WP_USERNAME;
      document.getElementById('wordpressPassword').value = WP_PASSWORD;
      
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      
      // Act
      fireEvent.click(document.getElementById('testWordPressBtn'));
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Połączenie z WordPress zakończone sukcesem!/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('Git Project Scanning', () => {
    it('should show error when GitHub path is missing', async () => {
      // Arrange
      document.getElementById('githubPath').value = '';
      
      // Act
      fireEvent.click(document.getElementById('scanGitBtn'));
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Proszę podać ścieżkę do katalogu z projektami/i)).toBeInTheDocument();
      });
    });
    
    it('should scan Git projects successfully', async () => {
      // Arrange
      document.getElementById('githubPath').value = '/path/to/projects';
      document.getElementById('selectedDate').value = '2023-01-01';
      
      const mockProjects = {
        success: true,
        data: {
          projects: [
            {
              name: 'test-project',
              path: '/path/to/test-project',
              commits: [
                {
                  message: 'Initial commit',
                  author: 'Test User',
                  files: ['file1.txt'],
                  stats: { insertions: 10, deletions: 2 }
                }
              ]
            }
          ]
        }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjects)
      });
      
      // Act
      fireEvent.click(document.getElementById('scanGitBtn'));
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Znaleziono 1 projektów Git/i)).toBeInTheDocument();
        expect(screen.getByText(/test-project/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('Article Generation', () => {
    it('should show error when no project is selected', async () => {
      // Act
      fireEvent.click(document.getElementById('generateBtn'));
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Proszę wybrać projekt/i)).toBeInTheDocument();
      });
    });
    
    it('should generate article successfully', async () => {
      // Arrange
      // First, simulate a successful project scan
      const mockProjects = {
        success: true,
        data: {
          projects: [
            {
              name: 'test-project',
              path: '/path/to/test-project',
              commits: [
                {
                  message: 'Initial commit',
                  author: 'Test User',
                  files: ['file1.txt'],
                  stats: { insertions: 10, deletions: 2 }
                }
              ]
            }
          ]
        }
      };
      
      // Mock the scan response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProjects)
      });
      
      // Set up test data
      document.getElementById('githubPath').value = '/path/to/projects';
      document.getElementById('selectedDate').value = '2023-01-01';
      document.getElementById('wordpressUrl').value = WP_URL;
      
      // Trigger scan
      fireEvent.click(document.getElementById('scanGitBtn'));
      
      // Wait for scan to complete
      await waitFor(() => {
        expect(screen.getByText(/test-project/i)).toBeInTheDocument();
      });
      
      // Mock the article generation response
      const mockArticle = {
        success: true,
        article: '<h1>Test Article</h1><p>This is a test article.</p>'
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockArticle)
      });
      
      // Act - click on the first project to select it
      fireEvent.click(document.querySelector('.project-card'));
      
      // Wait for project selection
      await waitFor(() => {
        expect(document.querySelector('.project-card--active')).toBeInTheDocument();
      });
      
      // Click generate button
      fireEvent.click(document.getElementById('generateBtn'));
      
      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Artykuł wygenerowany pomyślnie!/i)).toBeInTheDocument();
        expect(document.getElementById('articlePreview').innerHTML).toContain('Test Article');
      });
    });
  });
});
