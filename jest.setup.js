// Jest setup file
import '@testing-library/jest-dom';
import { enableFetchMocks } from 'jest-fetch-mock';

// Polyfill for TextEncoder/TextDecoder
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Enable fetch mocks
enableFetchMocks();

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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock global fetch
global.fetch = jest.fn();

// Mock window.location
const mockLocation = new URL('http://localhost/');
delete window.location;
window.location = mockLocation;
Object.defineProperty(window, 'open', {
  value: jest.fn(),
});
