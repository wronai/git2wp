.PHONY: install start stop restart frontend backend publish dev clean distclean help

# Load environment variables if .env exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Default target when you just run 'make'
help: ## Show this help message
	@echo "\033[1mWordPress Git Publisher\033[0m"
	@echo ""
	@echo "\033[1mAvailable commands:\033[0m"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "\033[1mConfiguration (from .env):\033[0m"
	@echo "  PORT: $(or $(PORT), not set)"
	@echo "  FRONTEND_PORT: $(or $(FRONTEND_PORT), not set)"
	@echo "  OLLAMA_BASE_URL: $(or $(OLLAMA_BASE_URL), not set)"
	@echo "  WORDPRESS_URL: $(or $(WORDPRESS_URL), not set)"

# Install dependencies
install: ## Install project dependencies
	@echo "Installing dependencies..."
	npm install

# Start all services
start: ## Start all services (backend and frontend)
	@echo "Starting all services..."
	@if [ -f .env ]; then \
		echo "Using environment variables from .env"; \
	else \
		echo "\033[33mWarning: No .env file found. Using default settings.\033[0m"; \
	fi
	@if [ -f start.sh ]; then \
		chmod +x start.sh; \
		./start.sh; \
	else \
		echo "\033[31mError: start.sh not found\033[0m"; \
		exit 1; \
	fi

# Start frontend only
frontend: ## Start frontend server only
	@echo "Starting frontend server..."
	@cd public && python3 simple_server.py --port $(or $(FRONTEND_PORT),9000) --log-file $(PWD)/logs/frontend.log

# Start backend only
backend: ## Start backend server only
	@echo "Starting backend server..."
	@node server.js

# Publish article
publish: ## Publish article to WordPress
	@if [ -z "$(date)" ]; then \
		echo "\033[31mError: date parameter is required. Usage: make publish date=YYYY-MM-DD\033[0m"; \
		exit 1; \
	fi
	@echo "Publishing article for date: $(date)..."
	@curl -X POST "http://localhost:$(or $(PORT),3001)/api/publish" \
		-H "Content-Type: application/json" \
		-d '{"date": "$(date)"}'


# Stop the application
stop: ## Stop all running services
	@echo "Stopping services..."
	@if [ -f stop.sh ]; then \
		chmod +x stop.sh; \
		./stop.sh; \
	else \
		echo "\033[33mWarning: stop.sh not found, trying to stop processes manually\033[0m"; \
		if [ -n "$(PORT)" ]; then \
			echo "Stopping process on port $(PORT)..."; \
			lsof -ti:$(PORT) | xargs -r kill -9 2>/dev/null || true; \
		fi; \
		if [ -n "$(FRONTEND_PORT)" ]; then \
			echo "Stopping process on port $(FRONTEND_PORT)..."; \
			lsof -ti:$(FRONTEND_PORT) | xargs -r kill -9 2>/dev/null || true; \
		fi; \
	fi

# Restart the application
restart: stop start ## Restart all services

# Start in development mode with auto-reload
dev: ## Start in development mode with auto-reload
	@echo "Starting in development mode..."
	npx nodemon server.js

# Clean up temporary files and logs
clean: ## Clean up temporary files and logs
	@echo "Cleaning up temporary files and logs..."
	@find . -name '*.log' -delete
	@find . -name '*.pid' -delete
	@rm -f logs/*.log 2>/dev/null || true

# Deep clean - remove node_modules and logs
distclean: clean ## Remove node_modules and logs
	@echo "Removing node_modules and logs..."
	@rm -rf node_modules
	@rm -rf logs
