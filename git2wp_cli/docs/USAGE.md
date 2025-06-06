# Git2WP - Usage Guide

## Table of Contents
- [Installation](#installation)
- [Configuration](#configuration)
- [Commands](#commands)
- [Examples](#examples)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Installation

### Using pip
```bash
pip install git2wp
```

### Using Poetry (for development)
```bash
# Clone the repository
git clone https://github.com/yourusername/git2wp.git
cd git2wp/git2wp_cli

# Install dependencies
poetry install

# Activate the virtual environment
poetry shell
```

## Configuration

Create a configuration file at `~/.config/git2wp/.env` with the following content:

```env
# WordPress Configuration
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your_username
WORDPRESS_PASSWORD=your_password
# OR use a token instead of username/password
# WORDPRESS_TOKEN=your_token

# Git Configuration
GIT_PATH=/path/to/your/git/repositories

# Logging (optional)
LOG_LEVEL=info  # can be: error, warn, info, debug
```

## Commands

### Test WordPress Connection
```bash
git2wp test-connection
```

### Publish Git Commit
```bash
# Show help
git2wp publish --help

# Dry run (preview)
git2wp publish /path/to/git/repo --dry-run

# Publish a specific commit
git2wp publish /path/to/git/repo --commit HEAD~1 --status draft

# Publish with custom status
git2wp publish /path/to/git/repo --status publish
```

## Examples

### Example 1: Publish the latest commit
```bash
git2wp publish /path/to/repo --status publish
```

### Example 2: Preview changes before publishing
```bash
git2wp publish /path/to/repo --dry-run
```

### Example 3: Publish a specific commit
```bash
git2wp publish /path/to/repo --commit abc123 --status draft
```

## Development

### Running Tests
```bash
make test
```

### Building the Package
```bash
make build
```

### Linting
```bash
make lint
```

## Troubleshooting

### WordPress Connection Issues
- Verify your WordPress URL is correct
- Check your credentials
- Ensure the WordPress REST API is enabled
- Check if any security plugins are blocking the API

### Git Repository Issues
- Make sure the repository path is correct
- Verify you have read access to the repository
- Check if the commit hash exists

### Common Errors
- **ModuleNotFoundError**: Make sure all dependencies are installed
- **ConnectionError**: Check your internet connection and WordPress URL
- **AuthenticationError**: Verify your WordPress credentials
