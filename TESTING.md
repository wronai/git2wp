# Testing Guide

This document provides information about the testing setup and how to run tests for the WordPress Git Publisher project.

## Test Types

1. **Unit Tests**: Test individual functions and components in isolation.
2. **Integration Tests**: Test the interaction between components.
3. **API Tests**: Test the API endpoints.
4. **E2E Tests**: Test the application from the user's perspective.

## Running Tests

### Prerequisites

- Node.js 16+
- npm 8+
- Playwright browsers (will be installed automatically)

### Install Dependencies

```bash
npm install
npx playwright install --with-deps
```

### Running All Tests

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run API tests
npm run test:api

# Run E2E tests
npm run test:e2e
```

### Running Tests with UI

```bash
# Run E2E tests with UI
npm run test:e2e:ui

# Run API tests with UI
npm run test:api:ui
```

### Debugging Tests

```bash
# Run in debug mode (Playwright Inspector)
npm run test:e2e:debug

# Run in watch mode
npm run test:watch
```

### Test Coverage

Generate test coverage report:

```bash
npm run test:coverage
```

## Writing Tests

### Unit Tests

Place unit tests in `src/__tests__/` directory with `.test.js` extension.

### Integration Tests

Place integration tests in `src/__tests__/` directory with `.integration.js` extension.

### API Tests

API tests are located in the `e2e/api` directory. They test the API endpoints directly.

### E2E Tests

E2E tests are located in the `e2e` directory. They test the application from the user's perspective.

## Test Configuration

- `playwright.config.js`: Configuration for Playwright tests
- `jest.config.js`: Configuration for Jest tests
- `test/setup.js`: Global test setup

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
NODE_ENV=test
PORT=3001
WORDPRESS_URL=http://localhost:8080
WORDPRESS_USERNAME=admin
WORDPRESS_PASSWORD=password
GIT_BASE_PATH=/path/to/your/repos
OLLAMA_BASE_URL=http://localhost:11434
```

## CI/CD Integration

Tests can be integrated into your CI/CD pipeline. The Playwright configuration includes settings for CI environments.

## Generating Reports

```bash
# Generate HTML report
npm run test:e2e:report
```

## Best Practices

- Write small, focused tests
- Use descriptive test names
- Mock external dependencies
- Clean up after tests
- Follow the AAA pattern (Arrange-Act-Assert)
- Keep tests independent and idempotent
