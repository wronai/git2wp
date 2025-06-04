import '@testing-library/jest-dom';
import { fireEvent, waitFor, screen } from '@testing-library/dom';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import WordPressAuthHelper from './helpers/wordpressAuth';

// Mock the DOM environment
const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously' });
global.document = dom.window.document;
global.window = dom.window;

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
    
    // Initialize auth helper
    authHelper = new WordPressAuthHelper(WP_URL, WP_USERNAME, WP_PASSWORD);
    
    // Mock the fetch API
    global.fetch = jest.fn();
    
    // Load our app.js
    require('../public/js/app');
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
