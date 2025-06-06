// Jest setup file
import '@testing-library/jest-dom';
import { enableFetchMocks } from 'jest-fetch-mock';

// Polyfill for TextEncoder/TextDecoder
const { TextEncoder, TextDecoder } = require('util');

// Mock globals
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock window and document
global.window = {};
global.document = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  createElement: jest.fn(() => ({
    setAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn(),
    },
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    style: {},
  })),
  getElementById: jest.fn(() => ({
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
    },
    style: {},
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
  querySelector: jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
  createTextNode: jest.fn((text) => ({
    nodeValue: text,
  })),
};

// Mock fetch
global.fetch = jest.fn();

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
