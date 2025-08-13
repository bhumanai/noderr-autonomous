#!/usr/bin/env python3
"""
Git Operations Module for Noderr
Provides Git functionality via tmux commands to Claude Code
"""

import os
import subprocess
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

SESSION_NAME = os.environ.get('SESSION_NAME', 'claude-code')

def execute_git_command(command: str) -> Dict[str, Any]:
    """Execute a git command in the Claude Code session and capture output"""
    try:
        # First inject the command
        result = subprocess.run([
            'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', SESSION_NAME, command
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            # Send Enter key
            subprocess.run([
                'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', SESSION_NAME, 'C-m'
            ], capture_output=True, text=True)
            
            # Wait a moment for command to execute
            subprocess.run(['sleep', '2'])
            
            # Capture the output
            capture = subprocess.run([
                'sudo', '-u', 'claude-user', 'tmux', 'capture-pane', 
                '-t', SESSION_NAME, '-p', '-S', '-50'  # Get last 50 lines
            ], capture_output=True, text=True)
            
            if capture.returncode == 0:
                return {
                    'success': True,
                    'output': capture.stdout,
                    'command': command
                }
            else:
                return {
                    'success': False,
                    'error': f"Failed to capture output: {capture.stderr}",
                    'command': command
                }
        else:
            return {
                'success': False,
                'error': f"Failed to execute command: {result.stderr}",
                'command': command
            }
    except Exception as e:
        logger.exception(f"Error executing git command: {command}")
        return {
            'success': False,
            'error': str(e),
            'command': command
        }

def get_git_status(project_path: str = '/workspace') -> Dict[str, Any]:
    """Get current git status"""
    command = f"cd {project_path} && git status --porcelain"
    result = execute_git_command(command)
    
    if result['success']:
        output = result['output']
        # Parse git status output
        modified = []
        untracked = []
        staged = []
        
        for line in output.split('\n'):
            if line.startswith(' M '):
                modified.append(line[3:].strip())
            elif line.startswith('?? '):
                untracked.append(line[3:].strip())
            elif line.startswith('M  ') or line.startswith('A  '):
                staged.append(line[3:].strip())
        
        # Get branch info
        branch_command = f"cd {project_path} && git branch --show-current"
        branch_result = execute_git_command(branch_command)
        branch = 'main'
        if branch_result['success']:
            # Extract branch name from output
            lines = branch_result['output'].split('\n')
            for line in reversed(lines):
                if line and not line.startswith('$') and not line.startswith('cd '):
                    branch = line.strip()
                    break
        
        return {
            'success': True,
            'branch': branch,
            'modified': modified,
            'untracked': untracked,
            'staged': staged
        }
    else:
        return result

def get_git_diff(project_path: str = '/workspace', staged: bool = False) -> Dict[str, Any]:
    """Get git diff for changes"""
    if staged:
        command = f"cd {project_path} && git diff --staged"
    else:
        command = f"cd {project_path} && git diff"
    
    result = execute_git_command(command)
    
    if result['success']:
        # Parse diff output to extract changed files
        files = []
        diff_lines = result['output'].split('\n')
        for line in diff_lines:
            if line.startswith('diff --git'):
                # Extract filename from diff header
                parts = line.split(' ')
                if len(parts) >= 4:
                    filename = parts[3][2:] if parts[3].startswith('b/') else parts[3]
                    if filename not in files:
                        files.append(filename)
        
        return {
            'success': True,
            'diff': result['output'],
            'files': files
        }
    else:
        return result

def git_add(project_path: str = '/workspace', files: list = None) -> Dict[str, Any]:
    """Stage files for commit"""
    if files:
        file_list = ' '.join(files)
        command = f"cd {project_path} && git add {file_list}"
    else:
        command = f"cd {project_path} && git add ."
    
    return execute_git_command(command)

def git_commit(project_path: str = '/workspace', message: str = None) -> Dict[str, Any]:
    """Create a git commit"""
    if not message:
        message = "Update from Noderr autonomous system"
    
    # Escape quotes in message
    message = message.replace('"', '\\"')
    command = f'cd {project_path} && git commit -m "{message}"'
    
    result = execute_git_command(command)
    
    if result['success']:
        # Extract commit hash from output
        commit_hash = None
        for line in result['output'].split('\n'):
            if '[' in line and ']' in line:
                # Parse commit info line
                import re
                match = re.search(r'\[[\w\-]+ ([a-f0-9]+)\]', line)
                if match:
                    commit_hash = match.group(1)
                    break
        
        return {
            'success': True,
            'commit': commit_hash,
            'message': message,
            'output': result['output']
        }
    else:
        return result

def git_push(project_path: str = '/workspace', branch: str = None, force: bool = False) -> Dict[str, Any]:
    """Push commits to remote"""
    if not branch:
        # Get current branch
        status = get_git_status(project_path)
        branch = status.get('branch', 'main')
    
    if force:
        command = f"cd {project_path} && git push origin {branch} --force"
    else:
        command = f"cd {project_path} && git push origin {branch}"
    
    return execute_git_command(command)

def git_pull(project_path: str = '/workspace', branch: str = None) -> Dict[str, Any]:
    """Pull latest changes from remote"""
    if not branch:
        # Get current branch
        status = get_git_status(project_path)
        branch = status.get('branch', 'main')
    
    command = f"cd {project_path} && git pull origin {branch}"
    return execute_git_command(command)

# Flask route handlers to be imported by inject_agent.py
def setup_git_routes(app):
    """Setup Git-related Flask routes"""
    
    @app.route('/git/status', methods=['GET'])
    def git_status_route():
        """Get git status"""
        from flask import request, jsonify
        project_path = request.args.get('path', '/workspace')
        result = get_git_status(project_path)
        return jsonify(result)
    
    @app.route('/git/diff', methods=['GET'])
    def git_diff_route():
        """Get git diff"""
        from flask import request, jsonify
        project_path = request.args.get('path', '/workspace')
        staged = request.args.get('staged', 'false').lower() == 'true'
        result = get_git_diff(project_path, staged)
        return jsonify(result)
    
    @app.route('/git/add', methods=['POST'])
    def git_add_route():
        """Stage files"""
        from flask import request, jsonify
        data = request.get_json()
        project_path = data.get('path', '/workspace')
        files = data.get('files', None)
        result = git_add(project_path, files)
        return jsonify(result)
    
    @app.route('/git/commit', methods=['POST'])
    def git_commit_route():
        """Create commit"""
        from flask import request, jsonify
        data = request.get_json()
        project_path = data.get('path', '/workspace')
        message = data.get('message', None)
        result = git_commit(project_path, message)
        return jsonify(result)
    
    @app.route('/git/push', methods=['POST'])
    def git_push_route():
        """Push to remote"""
        from flask import request, jsonify
        data = request.get_json()
        project_path = data.get('path', '/workspace')
        branch = data.get('branch', None)
        force = data.get('force', False)
        result = git_push(project_path, branch, force)
        return jsonify(result)
    
    @app.route('/git/pull', methods=['POST'])
    def git_pull_route():
        """Pull from remote"""
        from flask import request, jsonify
        data = request.get_json()
        project_path = data.get('path', '/workspace')
        branch = data.get('branch', None)
        result = git_pull(project_path, branch)
        return jsonify(result)