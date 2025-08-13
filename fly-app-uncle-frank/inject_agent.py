#!/usr/bin/env python3
"""
Command Injection Agent for Autonomous Noderr
Receives authenticated commands and injects them into Claude Code CLI via tmux
"""

import os
import subprocess
import hmac
import hashlib
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration from environment
HMAC_SECRET = os.environ.get('HMAC_SECRET', 'default-secret-change-me')
SESSION_NAME = os.environ.get('SESSION_NAME', 'claude-code')
ALLOWED_IPS = os.environ.get('ALLOWED_IPS', '').split(',') if os.environ.get('ALLOWED_IPS') else []
RATE_LIMIT = int(os.environ.get('RATE_LIMIT', '10'))  # commands per minute

# In-memory rate limiting (simple implementation)
command_history: list = []

def verify_hmac(command: str, signature: str) -> bool:
    """Verify HMAC signature for command authentication"""
    expected = hmac.new(
        HMAC_SECRET.encode(),
        command.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

def check_rate_limit() -> bool:
    """Simple rate limiting check"""
    now = datetime.now()
    # Remove commands older than 1 minute
    global command_history
    command_history = [t for t in command_history if (now - t).seconds < 60]
    
    if len(command_history) >= RATE_LIMIT:
        return False
    
    command_history.append(now)
    return True

def inject_command(command: str) -> Dict[str, Any]:
    """Inject command into tmux session"""
    try:
        # Try as claude-user first (where Claude is actually running)
        check_session = subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'has-session', '-t', SESSION_NAME],
            capture_output=True,
            text=True
        )
        
        if check_session.returncode == 0:
            # Check if session is actually alive by trying to list it
            list_check = subprocess.run(
                ['sudo', '-u', 'claude-user', 'tmux', 'list-sessions'],
                capture_output=True,
                text=True
            )
            
            if SESSION_NAME in list_check.stdout:
                # Session exists and is alive, inject there
                result = subprocess.run([
                    'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', SESSION_NAME, command
                ], capture_output=True, text=True)
                
                if result.returncode == 0:
                    # Send Enter key
                    result = subprocess.run([
                        'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', SESSION_NAME, 'C-m'
                    ], capture_output=True, text=True)
                
                if result.returncode == 0:
                    logger.info(f"Injected command to claude-user session: {command[:50]}...")
                    return {'success': True, 'message': 'Command injected'}
                elif "server exited unexpectedly" in result.stderr or "no server running" in result.stderr:
                    # Session died, recreate it
                    logger.warning("Claude session died, recreating...")
                    subprocess.run([
                        'sudo', '-u', 'claude-user', 'tmux', 'new-session', '-d', '-s', SESSION_NAME,
                        'cd /workspace && claude --dangerously-skip-permissions'
                    ])
                    # Try injection again
                    result = subprocess.run([
                        'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', SESSION_NAME, command
                    ], capture_output=True, text=True)
                    if result.returncode == 0:
                        result = subprocess.run([
                            'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', SESSION_NAME, 'C-m'
                        ], capture_output=True, text=True)
                    if result.returncode == 0:
                        return {'success': True, 'message': 'Command injected after session restart'}
        
        # Try as root (fallback)
        check_session = subprocess.run(
            ['tmux', 'has-session', '-t', SESSION_NAME],
            capture_output=True,
            text=True
        )
        
        if check_session.returncode != 0 or "server exited unexpectedly" in check_session.stderr:
            # Create session if it doesn't exist or died
            subprocess.run([
                'tmux', 'new-session', '-d', '-s', SESSION_NAME,
                'claude --dangerously-skip-permissions'
            ])
            logger.info(f"Created new tmux session: {SESSION_NAME}")
        
        # Inject command with proper Enter key
        result = subprocess.run([
            'tmux', 'send-keys', '-t', SESSION_NAME, command
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            # Send Enter key
            result = subprocess.run([
                'tmux', 'send-keys', '-t', SESSION_NAME, 'C-m'
            ], capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info(f"Injected command: {command[:50]}...")
            return {'success': True, 'message': 'Command injected'}
        else:
            logger.error(f"Failed to inject command: {result.stderr}")
            return {'success': False, 'message': result.stderr}
            
    except Exception as e:
        logger.exception("Error injecting command")
        return {'success': False, 'message': str(e)}

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    # Check if any Claude session exists
    claude_running = False
    
    # Check claude-user session
    result = subprocess.run([
        'sudo', '-u', 'claude-user', 'tmux', 'has-session', '-t', SESSION_NAME
    ], capture_output=True)
    if result.returncode == 0:
        claude_running = True
    
    # Check root session if user session not found
    if not claude_running:
        result = subprocess.run([
            'tmux', 'has-session', '-t', SESSION_NAME
        ], capture_output=True)
        if result.returncode == 0:
            claude_running = True
    
    return jsonify({
        'status': 'healthy', 
        'timestamp': datetime.now().isoformat(),
        'claude_session': claude_running
    })

@app.route('/inject', methods=['POST'])
def inject():
    """Main injection endpoint"""
    # IP allowlisting
    if ALLOWED_IPS and request.remote_addr not in ALLOWED_IPS:
        logger.warning(f"Rejected request from unauthorized IP: {request.remote_addr}")
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Rate limiting
    if not check_rate_limit():
        return jsonify({'error': 'Rate limit exceeded'}), 429
    
    # Parse request
    try:
        data = request.get_json()
        command = data['command']
        signature = data['signature']
    except (KeyError, TypeError) as e:
        return jsonify({'error': 'Invalid request format'}), 400
    
    # Verify HMAC
    if not verify_hmac(command, signature):
        logger.warning("Invalid HMAC signature")
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Inject command
    result = inject_command(command)
    
    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 500

@app.route('/status', methods=['GET'])
def status():
    """Get tmux session status"""
    try:
        sessions = []
        current_output = None
        
        # Try claude-user sessions first
        result = subprocess.run([
            'sudo', '-u', 'claude-user', 'tmux', 'list-sessions', '-F',
            '#{session_name}:#{session_created}:#{session_attached}'
        ], capture_output=True, text=True)
        
        logger.info(f"Claude-user tmux list result: return={result.returncode}, stdout={result.stdout[:100]}, stderr={result.stderr}")
        
        if result.returncode == 0:
            for line in result.stdout.strip().split('\n'):
                if line:
                    parts = line.split(':')
                    sessions.append({
                        'name': f"claude-user:{parts[0]}",
                        'created': parts[1] if len(parts) > 1 else None,
                        'attached': parts[2] == '1' if len(parts) > 2 else False
                    })
            
            # Try to capture from claude-user session
            capture = subprocess.run([
                'sudo', '-u', 'claude-user', 'tmux', 'capture-pane', 
                '-t', SESSION_NAME, '-p', '-S', '-30'  # Get last 30 lines
            ], capture_output=True, text=True)
            if capture.returncode == 0:
                current_output = capture.stdout
            else:
                logger.warning(f"Failed to capture claude-user tmux: {capture.stderr}")
        
        # Also check root sessions
        result = subprocess.run([
            'tmux', 'list-sessions', '-F',
            '#{session_name}:#{session_created}:#{session_attached}'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            for line in result.stdout.strip().split('\n'):
                if line:
                    parts = line.split(':')
                    sessions.append({
                        'name': f"root:{parts[0]}",
                        'created': parts[1] if len(parts) > 1 else None,
                        'attached': parts[2] == '1' if len(parts) > 2 else False
                    })
            
            # Try root capture if no user capture
            if not current_output:
                capture = subprocess.run([
                    'tmux', 'capture-pane', '-t', SESSION_NAME, '-p', '-S', '-10'
                ], capture_output=True, text=True)
                if capture.returncode == 0:
                    current_output = capture.stdout
        
        return jsonify({
            'sessions': sessions,
            'current_output': current_output,
            'rate_limit': {
                'current': len(command_history),
                'limit': RATE_LIMIT
            }
        })
        
    except Exception as e:
        logger.exception("Error getting status")
        return jsonify({'error': str(e)}), 500

@app.route('/execute', methods=['POST'])
def execute_batch():
    """Execute a batch of commands with delays"""
    try:
        data = request.get_json()
        commands = data['commands']  # List of {command, delay_ms}
        signature = data['signature']
        
        # Verify signature for entire batch
        batch_str = json.dumps(commands, sort_keys=True)
        if not verify_hmac(batch_str, signature):
            return jsonify({'error': 'Invalid signature'}), 401
        
        results = []
        for cmd_data in commands:
            command = cmd_data['command']
            delay = cmd_data.get('delay_ms', 0)
            
            # Add delay if specified
            if delay > 0:
                subprocess.run(['sleep', str(delay/1000)])
            
            result = inject_command(command)
            results.append(result)
        
        return jsonify({'results': results}), 200
        
    except Exception as e:
        logger.exception("Error executing batch")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # For development - in production use gunicorn
    app.run(host='0.0.0.0', port=8080, debug=False)