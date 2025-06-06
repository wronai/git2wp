// Mock import.meta for Jest
if (typeof global.import === 'undefined') {
  Object.defineProperty(global, 'import', {
    value: {
      meta: {
        url: 'file:///home/tom/github/wronai/git2wp/public/js/app.js'
      }
    },
    configurable: true,
    writable: true
  });
}

// Mock document.currentScript using defineProperty
Object.defineProperty(document, 'currentScript', {
  value: {
    src: 'file:///home/tom/github/wronai/git2wp/public/js/app.js'
  },
  writable: true
});

// Mock global objects that might be needed in tests
global.APP_CONFIG = {
  API_URL: 'http://localhost:3000/api',
  ENV: 'test'
};

// Mock fetch if not already mocked
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Add any other global mocks or configurations needed for your tests
