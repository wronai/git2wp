import { jest } from '@jest/globals';

/**
 * Creates a mock DOM environment for testing
 * @param {string} html - HTML string to use as the document body
 * @returns {Object} - Object containing window, document, and cleanup function
 */
export const setupDOM = (html = '<div id="app"></div>') => {
  // Create a new JSDOM instance
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(html, {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });

  // Set global variables
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.Event = dom.window.Event;
  global.MouseEvent = dom.window.MouseEvent;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.CustomEvent = dom.window.CustomEvent;
  global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);

  // Mock fetch
  global.fetch = jest.fn();

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock localStorage
  const localStorageMock = (() => {
    let store = {};
    return {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => {
        store[key] = value.toString();
      },
      removeItem: (key) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    enumerable: true,
    writable: false,
  });

  // Cleanup function
  const cleanup = () => {
    // Clean up any global variables or mocks
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.HTMLElement;
    delete global.Node;
    delete global.Event;
    delete global.MouseEvent;
    delete global.KeyboardEvent;
    delete global.CustomEvent;
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
    delete global.fetch;
  };

  return { window, document, cleanup };
};

/**
 * Wait for a specific amount of time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for all promises to resolve
 * @returns {Promise<void>}
 */
export const flushPromises = () => new Promise(setImmediate);

/**
 * Mock fetch response
 * @param {*} data - Response data
 * @param {Object} options - Additional options
 * @returns {Object} - Mock response object
 */
export const mockFetchResponse = (data, options = {}) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
  ...options,
});

/**
 * Mock fetch error
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Promise<never>} - Rejected promise with error
 */
export const mockFetchError = (message = 'Network error', status = 500) =>
  Promise.reject({
    ok: false,
    status,
    statusText: message,
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(JSON.stringify({ error: message })),
  });

// Export all testing utilities
export * from '@testing-library/dom';
export { default as userEvent } from '@testing-library/user-event';
