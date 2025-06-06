#!/usr/bin/env python3
"""
Test CLI for git2text module.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add the parent directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from git2wp.git2text import generate_commit_summary

def get_git_log(repo_path, since=None):
    """Get git log as a list of commits."""
    cmd = ["git", "-C", str(repo_path), "log", "--no-merges", "--pretty=format:%H %an <%ae> %ad %s", "--date=iso"]
    
    if since:
        if since == 'yesterday':
            since = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        cmd.extend(["--since", since])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error getting git log: {result.stderr}")
        return []
    
    commits = []
    for line in result.stdout.strip().split('\n'):
        if not line.strip():
            continue
        commit_hash = line.split()[0]
        author = ' '.join(line.split()[1:-2])
        date = line.split()[-2]
        message = line.split()[-1]
        
        # Get changed files
        files = subprocess.run(
            ["git", "-C", str(repo_path), "show", "--pretty=\"\"", "--name-status", commit_hash],
            capture_output=True, text=True
        ).stdout.strip().split('\n')
        
        changed_files = []
        for file_line in files:
            if not file_line.strip():
                continue
            status = file_line[0]
            path = file_line[1:].strip()
            changed_files.append({'status': status, 'file': path})
        
        commits.append({
            'short_sha': commit_hash[:7],
            'author': author,
            'date': date,
            'message': message,
            'changed_files': changed_files
        })
    
    return commits

def generate_report(repo_path, since=None, limit=5):
    """Generate a report for a repository."""
    repo_name = Path(repo_path).name
    commits = get_git_log(repo_path, since)[:limit]
    
    print(f"\n{'='*80}")
    print(f"Repository: {repo_name}")
    print(f"Found {len(commits)} commits")
    print(f"{'='*80}")
    
    for commit in commits:
        print(f"\nProcessing commit: {commit['short_sha']} - {commit['message']}")
        try:
            content = generate_commit_summary(repo_name, commit, debug=True)
            print("\nGenerated Content:")
            print("-" * 40)
            print(content)
            print("-" * 40)
        except Exception as e:
            print(f"Error generating summary: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Test git2text with git repositories')
    parser.add_argument('path', nargs='?', default='.', help='Path to git repository (default: current directory)')
    parser.add_argument('--since', help='Show commits more recent than specific date (e.g., "yesterday", "2023-01-01")')
    parser.add_argument('--limit', type=int, default=5, help='Maximum number of commits to process (default: 5)')
    
    args = parser.parse_args()
    
    path = Path(args.path).expanduser().resolve()
    
    if not path.exists():
        print(f"Error: Path does not exist: {path}")
        return 1
    
    if (path / '.git').exists():
        # Single repository
        generate_report(path, args.since, args.limit)
    else:
        # Directory containing repositories
        print(f"Scanning directory for git repositories: {path}")
        for repo_dir in path.iterdir():
            if (repo_dir / '.git').exists():
                generate_report(repo_dir, args.since, args.limit)
    
    return 0

if __name__ == "__main__":
    import subprocess
    sys.exit(main())
