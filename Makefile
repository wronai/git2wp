.PHONY: install start stop restart dev clean help

# Load environment variables if .env exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Default target when you just run 'make'
help:
	@echo "\033[1mWordPress Git Publisher\033[0m"
	@echo ""
	@echo "\033[1mAvailable commands:\033[0m"
	@echo "  make install    - Install dependencies"
	@echo "  make start      - Start backend and frontend servers"
	@echo "  make stop       - Stop all services"
	@echo "  make restart    - Restart all services"
	@echo "  make dev        - Start in development mode with auto-reload"
	@echo "  make clean      - Clean up temporary files and logs"
	@echo "  make distclean  - Remove node_modules and logs"
	@echo ""
	@echo "\033[1mConfiguration (in .env):\033[0m"
	@echo "  PORT: $(PORT)"
	@echo "  FRONTEND_PORT: $(FRONTEND_PORT)"
	@echo "  OLLAMA_BASE_URL: $(OLLAMA_BASE_URL)"
	@echo "  WORDPRESS_URL: $(WORDPRESS_URL)"

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install

# Start the application
start:
	@echo "Starting services..."
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

# Stop the application
stop:
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
restart: stop start

# Start in development mode with auto-reload
dev:
	@echo "Starting in development mode..."
	npx nodemon server.js

# Clean up temporary files and logs
clean:
	@echo "Cleaning up temporary files and logs..."
	@find . -name '*.log' -delete
	@find . -name '*.pid' -delete
	@rm -f logs/*.log 2>/dev/null || true

# Deep clean - remove node_modules and logs
distclean: clean
	@echo "Removing node_modules and logs..."
	@rm -rf node_modules
	@rm -rf logs

# Include environment variables if .env exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Include environment variables if .env exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif
