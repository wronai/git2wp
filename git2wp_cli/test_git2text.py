#!/usr/bin/env python3
"""
Test script for git2text module.
"""
import sys
from pathlib import Path

# Add the parent directory to the path so we can import git2wp
sys.path.insert(0, str(Path(__file__).parent))

from git2wp.git2text import generate_commit_summary

def test_git2text():
    """Test the git2text module with sample commit data."""
    # Sample commit data
    repo_name = "test-repo"
    commit_info = {
        'short_sha': 'abc1234',
        'author': 'Test User <test@example.com>',
        'date': '2025-06-06 12:00:00 +0200',
        'message': 'Update test files\n\nThis is a test commit message.',
        'changed_files': [
            {'status': 'A', 'file': 'test/new_file.txt'},
            {'status': 'M', 'file': 'test/existing_file.py'},
            {'status': 'D', 'file': 'test/old_file.js'}
        ]
    }
    
    print("Testing git2text with sample data...")
    try:
        content = generate_commit_summary(repo_name, commit_info, debug=True)
        print("\n=== Generated Content ===")
        print(content)
        print("\n✓ Test completed successfully!")
    except Exception as e:
        print(f"\n✗ Test failed: {str(e)}")
        raise

if __name__ == "__main__":
    test_git2text()
