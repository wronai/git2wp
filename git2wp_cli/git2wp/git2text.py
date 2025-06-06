#!/usr/bin/env python3
"""
Git2Text - Convert Git commits to human-readable text using LLM.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path.home() / ".config" / "git2wp" / ".env")

class OllamaClient:
    """Client for interacting with Ollama API."""
    
    def __init__(self, debug: bool = False):
        """Initialize the Ollama client with configuration from environment."""
        self.debug = debug
        self.servers = self._get_configured_servers()
    
    def _get_configured_servers(self) -> List[Dict[str, Any]]:
        """Get list of configured Ollama servers from environment."""
        servers = []
        
        # Primary server
        if os.getenv("OLLAMA_BASE_URL"):
            servers.append({
                'url': os.getenv("OLLAMA_BASE_URL"),
                'model': os.getenv("DEFAULT_MODEL", "llama3:latest"),
                'timeout': int(os.getenv("OLLAMA_TIMEOUT", 30000)) / 1000,  # Convert ms to seconds
                'name': 'Primary Ollama Server'
            })
        
        # Secondary server (if configured)
        if os.getenv("SEC_OLLAMA_BASE_URL"):
            servers.append({
                'url': os.getenv("SEC_OLLAMA_BASE_URL"),
                'model': os.getenv("SEC_DEFAULT_MODEL", "llama3:latest"),
                'timeout': int(os.getenv("SEC_OLLAMA_TIMEOUT", 30000)) / 1000,
                'name': 'Secondary Ollama Server'
            })
        
        return servers
    
    def _check_server(self, server: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Check if an Ollama server is available and return its info if available."""
        try:
            start_time = time.time()
            response = requests.get(f"{server['url']}/api/version", timeout=5)
            if response.status_code == 200:
                return {
                    **server,
                    'response_time': time.time() - start_time,
                    'available': True
                }
        except Exception as e:
            if self.debug:
                print(f"{server['name']} not available: {str(e)}")
        return None
    
    def get_fastest_server(self) -> Optional[Dict[str, Any]]:
        """Get the fastest responding Ollama server."""
        if not self.servers:
            return None
        
        # Check all servers in parallel
        with ThreadPoolExecutor(max_workers=len(self.servers)) as executor:
            results = list(executor.map(self._check_server, self.servers))
        
        # Filter out None results (unavailable servers) and sort by response time
        available_servers = [s for s in results if s is not None and s.get('available', False)]
        available_servers.sort(key=lambda x: x.get('response_time', float('inf')))
        
        if self.debug and available_servers:
            for server in available_servers:
                print(f"Available: {server['name']} (Response time: {server['response_time']:.2f}s)")
        
        return available_servers[0] if available_servers else None
    
    def generate_text(self, prompt: str, system_prompt: str = None) -> str:
        """Generate text using the fastest available Ollama server."""
        server = self.get_fastest_server()
        if not server:
            raise RuntimeError("No Ollama servers available")
        
        if self.debug:
            print(f"Using {server['name']} (Response time: {server['response_time']:.2f}s)")
        
        try:
            ollama_url = f"{server['url']}/api/generate"
            payload = {
                "model": server['model'],
                "prompt": prompt,
                "stream": False
            }
            
            if system_prompt:
                payload["system"] = system_prompt
            
            response = requests.post(
                ollama_url,
                json=payload,
                timeout=server['timeout']
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get("response", "")
            else:
                raise RuntimeError(f"Error from Ollama (HTTP {response.status_code}): {response.text}")
                
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Error connecting to Ollama: {str(e)}")


def generate_commit_summary(repo_name: str, commit_info: Dict[str, Any], debug: bool = False) -> str:
    """Generate a human-readable summary of a Git commit using Ollama.
    
    Args:
        repo_name: Name of the repository
        commit_info: Dictionary containing commit information
        debug: Whether to enable debug output
        
    Returns:
        str: Generated summary in HTML format
    """
    client = OllamaClient(debug=debug)
    
    # Format the commit information for the prompt
    commit_sha = commit_info.get('short_sha', commit_info.get('short_hash', 'unknown'))
    author = commit_info.get('author', commit_info.get('author_name', 'unknown'))
    commit_date = commit_info.get('date', commit_info.get('commit_date', 'unknown'))
    commit_message = commit_info.get('message', commit_info.get('subject', 'No commit message'))
    
    # Format changed files
    changed_files = []
    for change in commit_info.get("changed_files", []):
        if isinstance(change, dict):
            status = change.get('status', '?')
            file_path = change.get('file', change.get('path', 'unknown'))
            changed_files.append(f"{status} {file_path}")
        else:
            changed_files.append(str(change))
    
    # Create the prompt
    system_prompt = """You are a technical writer. Your task is to create a detailed, 
    informative article based on Git commit information. The article should be professional 
    yet accessible, explaining the changes and their significance in a clear, concise manner. 
    Use proper HTML formatting with appropriate headings, paragraphs, and lists."""
    
    prompt = f"""Please analyze the following Git commit and generate a detailed article:

Repository: {repo_name}
Commit: {commit_sha}
Author: {author}
Date: {commit_date}
Message: {commit_message}

Changed files:
"""
    
    for file_change in changed_files:
        prompt += f"- {file_change}\n"
    
    prompt += """

Please provide a detailed analysis of these changes, including:
1. What was changed and why it's important
2. Any potential impact on the project
3. Technical details that would be relevant to developers

Format your response in HTML with appropriate headings, paragraphs, and lists.
"""
    
    try:
        # Generate the summary using Ollama
        summary = client.generate_text(prompt, system_prompt)
        
        # Add the original commit details as a reference
        summary += """
        <h3>Original Commit Details</h3>
        <div class="commit-details">
            <p><strong>Repository:</strong> {repo_name}</p>
            <p><strong>Commit:</strong> <code>{commit_sha}</code></p>
            <p><strong>Author:</strong> {author}</p>
            <p><strong>Date:</strong> {commit_date}</p>
            <h4>Changed Files:</h4>
            <ul>
        """.format(
            repo_name=repo_name,
            commit_sha=commit_sha,
            author=author,
            commit_date=commit_date
        )
        
        # Add color-coded file changes
        for change in changed_files:
            status = change[0] if change else '?'
            file_path = change[2:] if len(change) > 2 else 'unknown'
            
            color = {
                'A': 'green',    # Added
                'M': 'yellow',   # Modified
                'D': 'red',      # Deleted
                'R': 'blue',     # Renamed
                'C': 'orange',   # Copied
                'U': 'purple',   # Unmerged
                '?': 'gray'      # Untracked
            }.get(status, 'gray')
            
            summary += f"""
            <li>
                <span style='color: {color}'>{status}</span> {file_path}
            </li>
            """
        
        summary += """
            </ul>
        </div>
        """
        
        return summary
        
    except Exception as e:
        if debug:
            print(f"Error generating summary: {str(e)}")
        # Fallback to simple formatting
        return generate_simple_summary(repo_name, commit_info)


def generate_simple_summary(repo_name: str, commit_info: Dict[str, Any]) -> str:
    """Generate a simple summary when LLM is not available."""
    commit_message = commit_info.get('message', commit_info.get('subject', 'Update'))
    
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
    
    return content
