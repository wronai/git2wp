// Mock the window object and DOM
global.window = global;

document.body.innerHTML = `
  <div id="app">
    <div id="wordpressConfig">
      <input type="url" id="wordpressUrl" />
      <input type="text" id="wordpressUsername" />
      <input type="password" id="wordpressPassword" />
      <button id="testWordPressBtn">Test Connection</button>
    </div>
    <div id="gitConfig">
      <input type="text" id="githubPath" />
      <input type="date" id="selectedDate" />
      <button id="scanGitBtn">Scan Projects</button>
    </div>
    <div id="gitProjects">
      <!-- Project cards will be added here -->
    </div>
    <div id="articleGeneration">
      <button id="generateBtn" disabled>Generate Article</button>
      <div id="articlePreview"></div>
    </div>
    <div id="statusMessage"></div>
  </div>
`;

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock window.location
const mockLocation = new URL('http://localhost/');
delete window.location;
window.location = mockLocation;

// Mock window.open
window.open = jest.fn();
