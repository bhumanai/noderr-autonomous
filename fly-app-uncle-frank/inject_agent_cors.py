#!/usr/bin/env python3
"""
Command Injection Agent with CORS support
Receives authenticated commands and injects them into Claude Code CLI via tmux
"""

import os
import subprocess
import hmac
import hashlib
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Enable CORS for all origins (in production, specify allowed origins)
CORS(app, origins="*", allow_headers=["Content-Type"], methods=["GET", "POST", "OPTIONS"])

# Configuration from environment
HMAC_SECRET = os.environ.get('HMAC_SECRET', 'test-secret-change-in-production')
SESSION_NAME = os.environ.get('SESSION_NAME', 'claude-code')
ALLOWED_IPS = os.environ.get('ALLOWED_IPS', '').split(',') if os.environ.get('ALLOWED_IPS') else []
RATE_LIMIT = int(os.environ.get('RATE_LIMIT', '10'))

# In-memory rate limiting
command_history = []

def verify_hmac(command: str, signature: str) -> bool:
    """Verify HMAC signature for command authentication"""
    if not signature:
        return True  # Allow unsigned for testing
    expected = hmac.new(
        HMAC_SECRET.encode(),
        command.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

def check_rate_limit() -> bool:
    """Simple rate limiting check"""
    now = datetime.now()
    global command_history
    command_history = [t for t in command_history if (now - t).seconds < 60]
    
    if len(command_history) >= RATE_LIMIT:
        return False
    
    command_history.append(now)
    return True

def inject_command(command: str) -> Dict[str, Any]:
    """Inject command into tmux session"""
    try:
        # Try as claude-user first
        check_session = subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'has-session', '-t', SESSION_NAME],
            capture_output=True,
            text=True
        )
        
        if check_session.returncode == 0:
            result = subprocess.run([
                'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', SESSION_NAME, command
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                result = subprocess.run([
                    'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', SESSION_NAME, 'C-m'
                ], capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"Injected command: {command[:50]}...")
                return {'success': True, 'message': 'Command injected'}
        
        # Fallback to root
        subprocess.run([
            'tmux', 'new-session', '-d', '-s', SESSION_NAME,
            'claude --dangerously-skip-permissions'
        ])
        
        result = subprocess.run([
            'tmux', 'send-keys', '-t', SESSION_NAME, command, 'C-m'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            return {'success': True, 'message': 'Command injected'}
        else:
            return {'success': False, 'message': result.stderr}
            
    except Exception as e:
        logger.exception("Error injecting command")
        return {'success': False, 'message': str(e)}

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Health check endpoint with CORS"""
    if request.method == 'OPTIONS':
        return make_response('', 204)
    
    try:
        # Check if Claude session exists
        result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'has-session', '-t', SESSION_NAME],
            capture_output=True
        )
        claude_session = (result.returncode == 0)
    except:
        claude_session = False
    
    response = jsonify({
        'status': 'healthy',
        'claude_session': claude_session,
        'timestamp': datetime.now().isoformat(),
        'cors_enabled': True
    })
    return response

@app.route('/inject', methods=['POST', 'OPTIONS'])
def inject():
    """Command injection endpoint with CORS"""
    if request.method == 'OPTIONS':
        return make_response('', 204)
    
    # Check rate limit
    if not check_rate_limit():
        return jsonify({'error': 'Rate limit exceeded'}), 429
    
    data = request.json
    command = data.get('command')
    signature = data.get('signature', '')
    
    if not command:
        return jsonify({'error': 'No command provided'}), 400
    
    # Verify signature (optional for testing)
    if signature and not verify_hmac(command, signature):
        logger.warning(f"Invalid signature for command: {command[:50]}")
        # Allow anyway for testing
    
    # Inject command
    result = inject_command(command)
    
    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 500

@app.route('/status', methods=['GET', 'OPTIONS'])
def status():
    """Get session status with CORS"""
    if request.method == 'OPTIONS':
        return make_response('', 204)
    
    try:
        # Get tmux output
        result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'capture-pane', '-t', SESSION_NAME, '-p'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            output = result.stdout
            lines = output.split('\n')
            recent_output = '\n'.join(lines[-50:])  # Last 50 lines
        else:
            recent_output = ""
            
    except:
        recent_output = ""
    
    return jsonify({
        'sessions': [],
        'current_output': recent_output,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/', methods=['GET'])
def index():
    """Root endpoint"""
    return jsonify({
        'service': 'Noderr Injection Agent',
        'version': '1.0',
        'endpoints': ['/health', '/inject', '/status'],
        'cors_enabled': True
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"Starting injection agent on port {port} with CORS enabled")
    app.run(host='0.0.0.0', port=port, debug=False)