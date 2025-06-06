# Git2WP CLI

[![Python Version](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![Imports: isort](https://img.shields.io/badge/%20imports-isort-%231674b1?style=flat&labelColor=ef8336)](https://pycqa.github.io/isort/)

A command-line tool for publishing Git repository changes to WordPress.

## Features

- Publish Git commits to WordPress as posts
- Test WordPress connection
- Dry-run mode to preview changes
- Support for different post statuses (draft, publish, pending, private)
- Colorful terminal output with rich formatting
- Environment-based configuration
- Git repository validation
- Detailed commit information display
- Changed files tracking
- Comprehensive documentation
- Makefile for development tasks

## Installation

1. Make sure you have Python 3.7+ installed
2. Install the package in development mode:

```bash
pip install -e .
```

Or install it globally:

```bash
pip install git+https://github.com/yourusername/git2wp.git
```

## Configuration

Create a `.env` file in your home directory under `~/.config/git2wp/` with the following variables:

```ini
WORDPRESS_URL=https://your-wordpress-site.com
WORDPRESS_USERNAME=your-username
WORDPRESS_PASSWORD=your-password
# OR use an application password
# WORDPRESS_TOKEN=your-application-password

# Optional: Default path to look for Git repositories
GIT_PATH=~/repos
```

## Usage

```bash
# Publish the latest commit from a repository
git2wp publish /path/to/your/repo

# Publish a specific commit
git2wp publish /path/to/your/repo --commit abc1234

# Publish as a published post (default is draft)
git2wp publish /path/to/your/repo --status publish

# Dry run (show what would be published)
git2wp publish /path/to/your/repo --dry-run

# Test WordPress connection
git2wp test-connection

# Show help
git2wp --help
```

## Development

1. Clone the repository
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install development dependencies:
   ```bash
   pip install -e .[dev]
   ```

## License

MIT
