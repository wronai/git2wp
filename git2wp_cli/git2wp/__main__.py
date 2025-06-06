#!/usr/bin/env python3
"""
Git2WP - A command-line tool for publishing Git repository changes to WordPress.
"""
import base64
import json
import os
import subprocess
import sys
import requests
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path.home() / ".config" / "git2wp" / ".env")

import click

# Colors for console output
class Colors:
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    END = "\033[0m"

# Load environment variables from .env file in the current directory or home config
env_path = Path.home() / ".config" / "git2wp" / ".env"
if env_path.exists():
    print(f"{Colors.YELLOW}Loading environment from: {env_path}{Colors.END}")
    load_dotenv(env_path, override=True)
    
    # Debug: Print loaded environment variables
    print(f"{Colors.YELLOW}=== Loaded Environment Variables ==={Colors.END}")
    for key in ["WORDPRESS_URL", "WORDPRESS_USERNAME", "WORDPRESS_PASSWORD", 
               "WORDPRESS_AUTH_METHOD", "GIT_PATH"]:
        value = os.getenv(key, "[Not Set]")
        masked_value = value if key != "WORDPRESS_PASSWORD" else "*" * len(value) if value else "[Not Set]"
        print(f"{key}: {masked_value}")
    print(f"{Colors.YELLOW}=================================={Colors.END}")

# Configuration
CONFIG = {
    "wordpress_url": os.getenv("WORDPRESS_URL", "").rstrip("/"),
    "wordpress_username": os.getenv("WORDPRESS_USERNAME", ""),
    "wordpress_password": os.getenv("WORDPRESS_PASSWORD", ""),
    "wordpress_token": os.getenv("WORDPRESS_TOKEN", ""),
    "wordpress_application_password": os.getenv("WORDPRESS_APPLICATION_PASSWORD", ""),
    "auth_method": os.getenv("WORDPRESS_AUTH_METHOD", "basic").lower(),
    "git_path": os.getenv("GIT_PATH", str(Path.home() / "github")),
    "wordpress_debug": os.getenv("WORDPRESS_DEBUG", "false").lower() == "true",
}


def is_git_repo(path: str) -> bool:
    """Check if a path is a Git repository."""
    try:
        result = subprocess.run(
            ["git", "-C", path, "rev-parse", "--is-inside-work-tree"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return result.stdout.decode().strip() == "true"
    except subprocess.CalledProcessError:
        return False


def get_commit_info(repo_path: str, commit_hash: str = "HEAD") -> Dict[str, Any]:
    """Get information about a specific commit."""
    try:
        # Get commit details
        result = subprocess.run(
            [
                "git",
                "-C",
                repo_path,
                "show",
                "--no-patch",
                '--format={"hash":"%H","short_hash":"%h","author":"%an","email":"%ae","date":"%ad","subject":"%s","body":"%b"}',
                commit_hash,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        commit_info = json.loads(result.stdout.decode())

        # Get changed files
        result = subprocess.run(
            [
                "git",
                "-C",
                repo_path,
                "diff",
                "--name-status",
                f"{commit_hash}^..{commit_hash}",
                "--"  # Explicitly separate options from paths
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
            text=True
        )
        
        # Parse the output of git diff --name-status
        changed_files = []
        for line in result.stdout.splitlines():
            if not line.strip():
                continue
                
            # Split on the first tab to separate status from path
            parts = line.strip().split('\t', 1)
            if len(parts) == 2:
                status, path = parts
                changed_files.append({"status": status, "path": path})
            else:
                # If there's no tab, it's probably just a path (unlikely but possible)
                changed_files.append({"status": "M", "path": line.strip()})
        
        commit_info["changed_files"] = changed_files

        return commit_info

    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        print(
            f"{Colors.RED}Error getting commit info: {e}{Colors.END}", file=sys.stderr
        )
        sys.exit(1)


def get_auth_headers():
    """Get authentication headers based on the configured method."""
    auth_headers = {}
    
    # Debug: Print the configuration being used
    print(f"{Colors.YELLOW}=== Debug: WordPress Configuration ==={Colors.END}")
    print(f"URL: {CONFIG.get('wordpress_url')}")
    print(f"Username: {CONFIG.get('wordpress_username')}")
    print(f"Password: {'*' * len(CONFIG.get('wordpress_password', '')) if CONFIG.get('wordpress_password') else 'None'}")
    print(f"Auth Method: {CONFIG.get('auth_method', 'basic')}")
    print(f"Debug Mode: {CONFIG.get('wordpress_debug', False)}")
    
    # Always use basic authentication with the token as the password
    username = CONFIG.get("wordpress_username", "").strip()
    password = CONFIG.get("wordpress_password", "").strip()
    
    if not username or not password:
        print(f"{Colors.RED}Error: Missing WordPress username or password in configuration{Colors.END}")
        return auth_headers
    
    try:
        # Create the Basic Auth header
        credentials = f"{username}:{password}"
        token = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
        auth_headers["Authorization"] = f"Basic {token}"
        
        # Debug information
        print(f"{Colors.YELLOW}Using Basic Auth with username: {username}")
        print(f"Auth Header: {auth_headers['Authorization'][:30]}...")
        
        # Add User-Agent to help with debugging
        auth_headers["User-Agent"] = "Git2WP/1.0"
        
    except Exception as e:
        print(f"{Colors.RED}Error creating auth header: {str(e)}{Colors.END}")
        import traceback
        print(f"{Colors.RED}Stack Trace:\n{traceback.format_exc()}{Colors.END}")
    
    # Add Content-Type header for all requests
    auth_headers["Content-Type"] = "application/json"
    
    return auth_headers


def test_wordpress_connection():
    """Test connection to WordPress."""
    try:
        import requests
        from requests.exceptions import RequestException

        if not CONFIG["wordpress_url"]:
            click.echo(f"{Colors.RED}Error: WORDPRESS_URL is not set in the configuration.{Colors.END}")
            return False

        # Get authentication headers
        auth_headers = get_auth_headers()
        
        if not auth_headers:
            click.echo(f"{Colors.YELLOW}Warning: No valid authentication method configured.{Colors.END}")
            # Try unauthenticated request to check if the API is accessible
            try:
                response = requests.get(
                    f"{CONFIG['wordpress_url']}/wp-json/",
                    timeout=10,
                )
                if response.status_code == 200:
                    click.echo(f"{Colors.YELLOW}WordPress API is accessible but authentication is required for full access.{Colors.END}")
                    return False
            except RequestException:
                pass
                
            click.echo(f"{Colors.RED}Error: Please configure authentication in ~/.config/git2wp/.env{Colors.END}")
            return False

        # Test authentication by accessing the users/me endpoint
        response = requests.get(
            f"{CONFIG['wordpress_url']}/wp-json/wp/v2/users/me",
            headers=auth_headers,
            timeout=10,
        )

        if response.status_code == 200:
            user_data = response.json()
            click.echo(f"{Colors.GREEN}✓ Successfully connected to WordPress as {user_data.get('name', 'Unknown User')} (ID: {user_data.get('id', 'N/A')}){Colors.END}")
            return True
        else:
            click.echo(f"{Colors.RED}✗ Could not authenticate with WordPress. Status code: {response.status_code}{Colors.END}")
            if response.text:
                click.echo(f"Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        click.echo(f"{Colors.RED}Error testing WordPress connection: {str(e)}{Colors.END}")
        return False


def publish_to_wordpress(title: str, content: str, status: str = "draft"):
    """Publish content to WordPress."""
    try:
        import requests
        from requests.exceptions import RequestException
        import json

        if not CONFIG["wordpress_url"]:
            click.echo(f"{Colors.RED}Error: WORDPRESS_URL is not set in the configuration.{Colors.END}")
            return None

        # Get authentication headers
        auth_headers = get_auth_headers()
        if not auth_headers:
            click.echo(f"{Colors.RED}Error: No valid authentication method configured.{Colors.END}")
            return None

        # Set default title if empty or contains only whitespace
        if not title or not title.strip():
            title = f"Git Commit - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            
        # Ensure status is one of the valid WordPress statuses
        valid_statuses = ['publish', 'future', 'draft', 'pending', 'private']
        if status.lower() not in valid_statuses:
            if CONFIG.get("wordpress_debug", False):
                print(f"{Colors.YELLOW}Warning: Invalid status '{status}'. Defaulting to 'draft'.{Colors.END}")
            status = 'draft'
        
        # Get default category ID from WordPress
        default_category_id = 1  # Fallback to 1 if we can't fetch categories
        try:
            # Try to get categories from WordPress
            categories_response = requests.get(
                f"{CONFIG['wordpress_url']}/wp-json/wp/v2/categories",
                headers=auth_headers,
                timeout=10
            )
            
            if categories_response.status_code == 200:
                categories = categories_response.json()
                # Find the 'Uncategorized' category or use the first available
                for category in categories:
                    if category.get('slug') == 'uncategorized':
                        default_category_id = category['id']
                        break
                else:
                    if categories:  # If no 'uncategorized' but we have categories
                        default_category_id = categories[0]['id']
        except Exception as e:
            if CONFIG.get("wordpress_debug", False):
                print(f"{Colors.YELLOW}Warning: Could not fetch categories: {str(e)}{Colors.END}")
        
        # Prepare the post data
        post_data = {
            "title": title,
            "content": content,
            "status": status,
            "categories": [default_category_id]
        }

        # Add Content-Type header
        headers = {"Content-Type": "application/json"}
        headers.update(auth_headers)


        # Debug: Print request details
        click.echo(f"{Colors.BLUE}=== WordPress API Request ==={Colors.END}")
        click.echo(f"URL: {CONFIG['wordpress_url']}/wp-json/wp/v2/posts")
        click.echo(f"Headers: {json.dumps(headers, indent=2)}")
        click.echo(f"Data: {json.dumps(post_data, indent=2)}")

        # Make the API request
        try:
            response = requests.post(
                f"{CONFIG['wordpress_url']}/wp-json/wp/v2/posts",
                headers=headers,
                json=post_data,
                timeout=30,
            )

            # Debug: Print response details
            click.echo(f"{Colors.BLUE}=== WordPress API Response ==={Colors.END}")
            click.echo(f"Status Code: {response.status_code}")
            click.echo(f"Headers: {json.dumps(dict(response.headers), indent=2)}")
            click.echo(f"Response: {response.text[:1000]}")

            if response.status_code == 201:
                post_data = response.json()
                click.echo(f"{Colors.GREEN}✓ Successfully published post: {post_data.get('link', 'N/A')}{Colors.END}")
                return post_data
            else:
                click.echo(f"{Colors.RED}✗ Error publishing to WordPress. Status code: {response.status_code}{Colors.END}")
                if response.text:
                    click.echo(f"Response: {response.text[:1000]}")
                
                # Check for specific WordPress authentication errors
                if response.status_code == 403:
                    click.echo(f"{Colors.RED}Authentication failed. Please check your WordPress credentials and permissions.{Colors.END}")
                    click.echo(f"{Colors.YELLOW}Make sure the user has the 'edit_posts' capability.{Colors.END}")
                
                return None
                
        except RequestException as e:
            click.echo(f"{Colors.RED}Error making request to WordPress: {str(e)}{Colors.END}")
            if hasattr(e, 'response') and e.response is not None:
                click.echo(f"Status Code: {e.response.status_code}")
                click.echo(f"Response: {e.response.text[:1000]}")
            return None
            
    except Exception as e:
        import traceback
        click.echo(f"{Colors.RED}Unexpected error publishing to WordPress: {str(e)}{Colors.END}")
        click.echo(f"{Colors.RED}Stack Trace:\n{traceback.format_exc()}{Colors.END}")
        return None


def is_ollama_available() -> bool:
    """Check if Ollama server is available."""
    try:
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/version"
        response = requests.get(ollama_url, timeout=5)
        return response.status_code == 200
    except Exception as e:
        if CONFIG.get("wordpress_debug", False):
            print(f"{Colors.YELLOW}Ollama server not available: {str(e)}{Colors.END}")
        return False

def generate_llm_summary(repo_name: str, commit_info: Dict[str, Any]) -> Tuple[str, str]:
    """Generate a summary of changes using Ollama with fallback to simple formatting."""
    # First check if Ollama is available
    if not is_ollama_available():
        print(f"{Colors.YELLOW}Ollama server not available, using simple formatting{Colors.END}")
        return generate_simple_summary(repo_name, commit_info)
    
    try:
        # Prepare the prompt using the template from .env
        prompt_template = os.getenv("PROMPT_TEMPLATE", "")
        prompt_prefix = os.getenv("PROMPT_PREFIX", "")
        
        # Safely get commit information with defaults
        commit_sha = commit_info.get('short_sha', commit_info.get('short_hash', 'unknown'))
        author = commit_info.get('author', commit_info.get('author_name', 'unknown'))
        commit_date = commit_info.get('date', commit_info.get('commit_date', 'unknown'))
        commit_message = commit_info.get('message', commit_info.get('subject', 'No commit message'))
        
        # Format the changed files for the prompt
        changed_files = []
        for change in commit_info.get("changed_files", []):
            # Handle different possible field names for file changes
            if isinstance(change, dict):
                status = change.get('status', '?')
                file_path = change.get('file', change.get('path', 'unknown'))
                changed_files.append(f"{status} {file_path}")
            else:
                changed_files.append(str(change))
        
        changed_files_str = "\n".join(changed_files) if changed_files else "No files changed"
        
        # Create the full prompt
        prompt = f"""{prompt_template}
        
Repository: {repo_name}
Commit: {commit_sha}
Author: {author}
Date: {commit_date}
Message: {commit_message}

Changed files:
{changed_files_str}

{'-'*40}
{prompt_prefix}"""
        
        if CONFIG.get("wordpress_debug", False):
            print(f"{Colors.YELLOW}=== Ollama Prompt ==={Colors.END}")
            print(prompt[:500] + (prompt[500:] and '...'))
        
        # Call Ollama API with a reasonable timeout
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434") + "/api/generate"
        model = os.getenv("DEFAULT_MODEL", "llama3:latest")
        
        try:
            response = requests.post(
                ollama_url,
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=30  # 30 seconds timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                summary = result.get("response", "")
                
                if not summary.strip():
                    summary = f"No summary generated. Original commit message: {commit_message}"
                
                # Create a title from the first line of the summary
                first_line = summary.split('\n')[0][:100].strip()
                title = f"{repo_name}: {first_line}" if first_line else f"{repo_name}: Update"
                
                return title, summary
            else:
                error_msg = f"Error from Ollama (HTTP {response.status_code}): {response.text}"
                print(f"{Colors.RED}{error_msg}{Colors.END}")
                raise Exception(error_msg)
                
        except requests.exceptions.RequestException as e:
            print(f"{Colors.RED}Error connecting to Ollama: {str(e)}{Colors.END}")
            return generate_simple_summary(repo_name, commit_info)
            
    except Exception as e:
        print(f"{Colors.RED}Error in generate_llm_summary: {str(e)}{Colors.END}")
        if CONFIG.get("wordpress_debug", False):
            import traceback
            print(f"{Colors.YELLOW}Stack Trace:\n{traceback.format_exc()}{Colors.END}")
        return generate_simple_summary(repo_name, commit_info)

def generate_simple_summary(repo_name: str, commit_info: Dict[str, Any]) -> Tuple[str, str]:
    """Generate a simple summary when LLM is not available."""
    commit_message = commit_info.get('message', commit_info.get('subject', 'Update'))
    title = f"{repo_name}: {commit_message.splitlines()[0][:100]}" if commit_message else f"{repo_name}: Update"
    
    # Create a simple content with commit details
    content = f"<h2>Commit Details</h2>\n" \
             f"<p><strong>Repository:</strong> {repo_name}</p>\n" \
             f"<p><strong>Commit:</strong> <code>{commit_info.get('short_sha', commit_info.get('short_hash', 'unknown'))}</code></p>\n" \
             f"<p><strong>Author:</strong> {commit_info.get('author', commit_info.get('author_name', 'unknown'))}</p>\n" \
             f"<p><strong>Date:</strong> {commit_info.get('date', commit_info.get('commit_date', 'unknown'))}</p>\n" \
             f"<h3>Message</h3>\n<p>{commit_message}</p>"
    
    # Add changed files if available
    if commit_info.get("changed_files"):
        content += "<h3>Changed Files</h3><ul>"
        for change in commit_info["changed_files"]:
            if isinstance(change, dict):
                status = change.get('status', '?')
                file_path = change.get('file', change.get('path', 'unknown'))
                content += f"<li>{status} {file_path}</li>"
        content += "</ul>"
    
    return title, content


def format_commit_for_wordpress(repo_name: str, commit_info: Dict[str, Any]) -> Dict[str, Any]:
    """Format Git commit information for WordPress using LLM."""
    # Generate the summary using LLM
    title, content = generate_llm_summary(repo_name, commit_info)
    
    # Add the original commit details as a reference
    content += "\n\n<h3>Original Commit Details</h3>"
    content += f"<p><strong>Repository:</strong> {repo_name}</p>"
    content += f"<p><strong>Commit:</strong> <code>{commit_info.get('short_sha', '')}</code></p>"
    content += f"<p><strong>Author:</strong> {commit_info.get('author', '')}</p>"
    content += f"<p><strong>Date:</strong> {commit_info.get('date', '')}</p>"
    content += f"<h4>Changed Files:</h4><ul>"
    
    # Add status colors for changed files
    status_colors = {
        "A": "green",
        "M": "yellow",
        "D": "red",
        "R": "blue",
        "C": "cyan",
        "U": "orange"
    }
    
    for change in commit_info.get("changed_files", []):
        status = change.get("status", "?")
        file_path = change.get("file", "")
        status_color = status_colors.get(status[0] if status else "?", "gray")
        content += f"<li><span style='color: {status_color}'>{status}</span> {file_path}</li>"
    
    content += "</ul>"
    
    return {
        "title": title,
        "content": content,
        "status": "draft"
    }


@click.group()
@click.version_option(version="0.1.0")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
def cli(verbose):
    """Git2WP - Publish Git repository changes to WordPress."""
    if verbose:
        print("Verbose mode enabled")


@cli.command()
@click.argument(
    "repo_path", type=click.Path(exists=True, file_okay=False, resolve_path=True)
)
@click.option(
    "--commit", "-c", default="HEAD", help="Commit hash to publish (default: HEAD)"
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Show what would be published without making changes",
)
@click.option(
    "--status",
    type=click.Choice(["draft", "publish", "pending", "private"]),
    default="draft",
    help="Status for the WordPress post",
)
def publish(repo_path: str, commit: str, dry_run: bool, status: str):
    """Publish Git repository changes to WordPress."""
    # Validate repository
    if not is_git_repo(repo_path):
        print(
            f"{Colors.RED}Error: Not a Git repository: {repo_path}{Colors.END}",
            file=sys.stderr,
        )
        sys.exit(1)

    # Get commit information
    print(f"{Colors.BLUE}Fetching commit information...{Colors.END}")
    commit_info = get_commit_info(repo_path, commit)

    # Print commit information
    print(f"\n{Colors.YELLOW}=== Commit Information ==={Colors.END}")
    print(
        f"{Colors.BLUE}Repository:{Colors.END} {os.path.basename(os.path.abspath(repo_path))}"
    )
    print(
        f"{Colors.BLUE}Commit:{Colors.END} {commit_info['short_hash']} ({commit_info['hash']})"
    )
    print(
        f"{Colors.BLUE}Author:{Colors.END} {commit_info['author']} <{commit_info['email']}>"
    )
    print(f"{Colors.BLUE}Date:{Colors.END} {commit_info['date']}")
    print(f"{Colors.BLUE}Subject:{Colors.END} {commit_info['subject']}")

    if commit_info.get("changed_files"):
        print(f"\n{Colors.YELLOW}=== Changed Files ==={Colors.END}")
        for file in commit_info["changed_files"]:
            status = file["status"]
            status_color = {
                "A": Colors.GREEN,
                "M": Colors.YELLOW,
                "D": Colors.RED,
                "R": Colors.BLUE,
                "C": Colors.BLUE,
                "U": Colors.BLUE,
            }.get(status[0], Colors.END)
            print(f"{status_color}{status}{Colors.END} {file['path']}")

    # Format content for WordPress
    repo_name = os.path.basename(os.path.abspath(repo_path))
    
    # Get post data from format_commit_for_wordpress
    post_data = format_commit_for_wordpress(repo_name, commit_info)
    
    # Use the title and content from the post_data
    post_title = post_data.get('title', f"{repo_name}: {commit_info.get('subject', 'Update')}")
    post_content = post_data.get('content', '')
    post_status = post_data.get('status', 'draft')

    if dry_run:
        print(f"\n{Colors.YELLOW}=== Dry Run ==={Colors.END}")
        print(f"{Colors.BLUE}Would publish to WordPress with status: {post_status}{Colors.END}")
        print(f"{Colors.BLUE}Title:{Colors.END} {post_title}")
        print(f"{Colors.BLUE}Content Preview:{Colors.END}")
        print("-" * 80)
        print(str(post_content)[:500] + ("..." if len(str(post_content)) > 500 else ""))
        print("-" * 80)
        return

    # Publish to WordPress
    print(f"\n{Colors.YELLOW}=== Publishing to WordPress ==={Colors.END}")
    success = publish_to_wordpress(post_title, post_content, post_status)

    if not success:
        sys.exit(1)


@cli.command()
def test_connection():
    """Test connection to WordPress."""
    print(f"{Colors.BLUE}Testing WordPress connection...{Colors.END}")
    if test_wordpress_connection():
        print(f"{Colors.GREEN}✓ Successfully connected to WordPress!{Colors.END}")
    else:
        print(f"{Colors.RED}✗ Could not connect to WordPress.{Colors.END}")
        sys.exit(1)


if __name__ == "__main__":
    cli()
