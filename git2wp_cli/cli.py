""
Git2WP Command Line Interface
"""
import os
import sys
import json
import logging
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, List

import click
from dotenv import load_dotenv
import requests
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize console
console = Console()

class Config:
    """Configuration manager for Git2WP"""
    
    def __init__(self):
        self.config_path = Path.home() / ".config" / "git2wp"
        self.config_file = self.config_path / "config.json"
        self.env_file = self.config_path / ".env"
        self.config = {}
        self._ensure_config()
        self._load_config()
    
    def _ensure_config(self):
        """Ensure config directory and files exist"""
        self.config_path.mkdir(parents=True, exist_ok=True)
        if not self.config_file.exists():
            self.config_file.write_text("{}")
        if not self.env_file.exists():
            self.env_file.touch()
    
    def _load_config(self):
        """Load configuration from file"""
        try:
            self.config = json.loads(self.config_file.read_text())
        except json.JSONDecodeError:
            self.config = {}
    
    def save_config(self):
        """Save configuration to file"""
        self.config_file.write_text(json.dumps(self.config, indent=2))
    
    def load_env(self):
        """Load environment variables from .env file"""
        if self.env_file.exists():
            load_dotenv(self.env_file, override=True)
        
        # Set default values from environment
        self.config.update({
            'wordpress_url': os.getenv('WORDPRESS_URL', ''),
            'wordpress_username': os.getenv('WORDPRESS_USERNAME', ''),
            'wordpress_password': os.getenv('WORDPRESS_PASSWORD', ''),
            'wordpress_token': os.getenv('WORDPRESS_TOKEN', ''),
            'git_path': os.getenv('GIT_PATH', str(Path.home() / 'github')),
            'api_url': os.getenv('API_URL', 'http://localhost:3001'),
        })

class GitUtils:
    """Git repository utilities"""
    
    @staticmethod
    def is_git_repo(path: str) -> bool:
        """Check if a path is a Git repository"""
        try:
            result = subprocess.run(
                ['git', '-C', path, 'rev-parse', '--is-inside-work-tree'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True
            )
            return result.stdout.decode().strip() == 'true'
        except subprocess.CalledProcessError:
            return False
    
    @staticmethod
    def get_commit_info(repo_path: str, commit_hash: str = 'HEAD') -> Dict[str, Any]:
        """Get information about a specific commit"""
        try:
            # Get commit details
            result = subprocess.run(
                ['git', '-C', repo_path, 'show', '--no-patch', 
                 '--format={"hash":"%H","short_hash":"%h","author":"%an","email":"%ae","date":"%ad","subject":"%s","body":"%b"}',
                 commit_hash],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True
            )
            commit_info = json.loads(result.stdout.decode())
            
            # Get changed files
            result = subprocess.run(
                ['git', '-C', repo_path, 'diff', '--name-status', f'{commit_hash}^..{commit_hash}'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True
            )
            changed_files = [line.split('\t') for line in result.stdout.decode().splitlines()]
            
            commit_info['changed_files'] = [
                {'status': status, 'path': path} 
                for status, path in changed_files if path
            ]
            
            return commit_info
            
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            logger.error(f"Error getting commit info: {e}")
            return {}

class WordPressPublisher:
    """Handle WordPress publishing operations"""
    
    def __init__(self, config: Config):
        self.config = config
        self.session = requests.Session()
        
        # Set up authentication
        if config.config.get('wordpress_token'):
            self.session.headers.update({
                'Authorization': f'Bearer {config.config["wordpress_token"]}'
            })
        elif config.config.get('wordpress_username') and config.config.get('wordpress_password'):
            self.session.auth = (
                config.config['wordpress_username'], 
                config.config['wordpress_password']
            )
    
    def test_connection(self) -> bool:
        """Test connection to WordPress"""
        try:
            response = self.session.get(
                f"{self.config.config['wordpress_url']}/wp-json",
                timeout=10
            )
            return response.status_code == 200
        except requests.RequestException as e:
            logger.error(f"Error connecting to WordPress: {e}")
            return False
    
    def create_post(self, title: str, content: str, status: str = 'draft', **kwargs) -> Dict[str, Any]:
        """Create a new WordPress post"""
        try:
            data = {
                'title': title,
                'content': content,
                'status': status,
                **kwargs
            }
            
            response = self.session.post(
                f"{self.config.config['wordpress_url']}/wp-json/wp/v2/posts",
                json=data,
                timeout=30
            )
            
            if response.status_code == 201:
                return response.json()
            else:
                logger.error(f"Failed to create post: {response.text}")
                return {}
                
        except requests.RequestException as e:
            logger.error(f"Error creating WordPress post: {e}")
            return {}

def format_commit_for_wordpress(commit_info: Dict[str, Any]) -> str:
    """Format Git commit information for WordPress"""
    content = f"""<h2>Commit Details</h2>
    <p><strong>Repository:</strong> {repo_name}</p>
    <p><strong>Commit:</strong> <code>{short_hash}</code></p>
    <p><strong>Author:</strong> {author} &lt;{email}&gt;</p>
    <p><strong>Date:</strong> {date}</p>
    <h3>Message</h3>
    <p>{subject}</p>
    """
    
    if commit_info.get('body'):
        content += f"<pre>{commit_info['body']}</pre>"
    
    if commit_info.get('changed_files'):
        content += "<h3>Changed Files</h3><ul>"
        for file in commit_info['changed_files']:
            content += f"<li><code>{file['status']}</code> {file['path']}</li>"
        content += "</ul>"
    
    return content

def print_commit_info(commit_info: Dict[str, Any]):
    """Print commit information in a formatted way"""
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Field", style="dim", width=15)
    table.add_column("Value")
    
    table.add_row("Commit", f"{commit_info['short_hash']} ({commit_info['hash']})")
    table.add_row("Author", f"{commit_info['author']} <{commit_info['email']}>")
    table.add_row("Date", commit_info['date'])
    table.add_row("Subject", commit_info['subject'])
    
    console.print(Panel.fit(table, title="[bold]Commit Information"))
    
    if commit_info.get('changed_files'):
        files_table = Table(show_header=True, header_style="bold blue")
        files_table.add_column("Status", style="dim", width=10)
        files_table.add_column("File Path")
        
        for file in commit_info['changed_files']:
            status = file['status']
            status_style = {
                'A': 'green',
                'M': 'yellow',
                'D': 'red',
                'R': 'cyan',
                'C': 'blue',
                'U': 'magenta'
            }.get(status[0], 'white')
            
            files_table.add_row(
                f"[{status_style}]{status}[/{status_style}]",
                file['path']
            )
        
        console.print(Panel.fit(files_table, title="[bold]Changed Files"))

@click.group()
@click.version_option()
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose output')
@click.pass_context
def cli(ctx, verbose):
    """Git2WP - Publish Git repository changes to WordPress"""
    # Set up logging
    log_level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=log_level)
    
    # Initialize config
    ctx.obj = {}
    ctx.obj['config'] = Config()
    ctx.obj['config'].load_env()
    ctx.obj['git'] = GitUtils()
    ctx.obj['wp'] = WordPressPublisher(ctx.obj['config'])

@cli.command()
@click.argument('repo_path', type=click.Path(exists=True, file_okay=False, resolve_path=True))
@click.option('--commit', '-c', default='HEAD', help='Commit hash to publish (default: HEAD)')
@click.option('--dry-run', is_flag=True, help='Show what would be published without making changes')
@click.option('--status', type=click.Choice(['draft', 'publish', 'pending', 'private']), 
              default='draft', help='Status for the WordPress post')
@click.pass_context
def publish(ctx, repo_path: str, commit: str, dry_run: bool, status: str):
    """Publish Git repository changes to WordPress"""
    config = ctx.obj['config']
    git = ctx.obj['git']
    wp = ctx.obj['wp']
    
    # Validate repository
    if not git.is_git_repo(repo_path):
        console.print(f"[red]Error:[/red] Not a Git repository: {repo_path}")
        sys.exit(1)
    
    # Get commit information
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task(description="Fetching commit information...", total=None)
        commit_info = git.get_commit_info(repo_path, commit)
    
    if not commit_info:
        console.print(f"[red]Error:[/red] Could not get information for commit {commit}")
        sys.exit(1)
    
    # Print commit information
    print_commit_info(commit_info)
    
    # Format content for WordPress
    repo_name = os.path.basename(os.path.abspath(repo_path))
    post_title = f"{repo_name}: {commit_info['subject']}"
    
    # Generate post content
    post_content = format_commit_for_wordpress(commit_info)
    
    if dry_run:
        console.print("\n[bold yellow]Dry run:[/bold yellow] Would publish to WordPress:")
        console.print(f"[bold]Title:[/bold] {post_title}")
        console.print(f"[bold]Status:[/bold] {status}")
        console.print("\n[bold]Content Preview:[/bold]")
        console.print(Panel.fit(post_content.split('\n', 1)[0] + "..."))
        return
    
    # Publish to WordPress
    console.print("\n[bold]Publishing to WordPress...[/bold]")
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
    ) as progress:
        progress.add_task(description="Publishing to WordPress...", total=None)
        result = wp.create_post(
            title=post_title,
            content=post_content,
            status=status
        )
    
    if result:
        console.print(f"\n[green]✓ Successfully published to WordPress![/green]")
        console.print(f"Post URL: {result.get('link', 'Unknown')}")
    else:
        console.print("\n[red]✗ Failed to publish to WordPress.[/red]")
        sys.exit(1)

@cli.command()
@click.pass_context
def test_connection(ctx):
    """Test connection to WordPress"""
    wp = ctx.obj['wp']
    
    with console.status("Testing WordPress connection..."):
        if wp.test_connection():
            console.print("[green]✓ Successfully connected to WordPress![/green]")
            return True
        else:
            console.print("[red]✗ Could not connect to WordPress.[/red]")
            return False

def main():
    """Main entry point."""
    cli()

if __name__ == "__main__":
    main()
