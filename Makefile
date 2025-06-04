.PHONY: install start stop restart dev clean

# Default target when you just run 'make'
help:
	@echo "Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make start      - Start the application"
	@echo "  make stop       - Stop the application"
	@echo "  make restart    - Restart the application"
	@echo "  make dev        - Start in development mode with auto-reload"
	@echo "  make clean      - Remove node_modules and logs"

# Install dependencies
install:
	npm install

# Start the application
start:
	node server.js

# Stop the application by killing the process on port 3001
stop:
	@echo "Stopping application on port 3001..."
	@-lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@echo "Application stopped"

# Restart the application
restart: stop start

# Start in development mode with auto-reload (using nodemon if available)
dev:
	npx nodemon server.js || npm run dev

# Clean up
distclean: clean
	@echo "Removing node_modules and logs..."
	rm -rf node_modules
	rm -rf logs

clean:
	@echo "Cleaning up..."
	@find . -name '*.log' -delete
	@find . -name '*.pid' -delete

# Include environment variables if .env exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif
