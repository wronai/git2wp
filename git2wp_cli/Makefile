.PHONY: help install test lint format check-format clean build publish docs

# Variables
PYTHON = python3
PIP = pip
POETRY = poetry
PACKAGE = git2wp
TESTS = tests/

# Help target
help:
	@echo "Git2WP - Makefile Help"
	@echo "----------------------"
	@echo "Available targets:"
	@echo "  install     : Install the package in development mode"
	@echo "  test        : Run tests"
	@echo "  lint        : Run linting checks"
	@echo "  format      : Format code"
	@echo "  check-format: Check code formatting"
	@echo "  clean       : Clean build artifacts"
	@echo "  build       : Build the package"
	@echo "  publish     : Publish the package to PyPI"
	@echo "  docs        : Generate documentation"
	@echo "  help        : Show this help message"

# Install the package in development mode
install:
	$(POETRY) install

# Run tests
test:
	$(POETRY) run pytest $(TESTS) -v --cov=$(PACKAGE) --cov-report=term-missing

# Run linting checks
lint:
	$(POETRY) run flake8 $(PACKAGE) tests
	$(POETRY) run mypy $(PACKAGE) tests
	$(POETRY) run bandit -r $(PACKAGE)

# Format code
format:
	$(POETRY) run black $(PACKAGE) tests
	$(POETRY) run isort $(PACKAGE) tests

# Check code formatting
check-format:
	$(POETRY) run black --check $(PACKAGE) tests
	$(POETRY) run isort --check-only $(PACKAGE) tests

# Clean build artifacts
clean:
	rm -rf build/ dist/ *.egg-info .pytest_cache/ .mypy_cache/ .coverage htmlcov/
	find . -type d -name '__pycache__' -exec rm -rf {} +
	find . -type f -name '*.py[co]' -delete

# Build the package
build: clean
	$(POETRY) build

# Publish the package to PyPI
publish: build
	$(POETRY) publish

# Generate documentation
docs:
	@echo "Generating documentation..."
	@mkdir -p docs/build
	@cp README.md docs/README.md
	@cp docs/USAGE.md docs/USAGE.md
	@echo "Documentation generated in docs/"

# Default target
.DEFAULT_GOAL := help
