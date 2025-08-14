#!/usr/bin/env python3
"""
Claude Authentication Handler
Manages Claude Code CLI authentication through web interface
"""

import os
import subprocess
import json
import re
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import uuid

app = Flask(__name__)
CORS(app, origins="*", allow_headers=["Content-Type"], methods=["GET", "POST", "OPTIONS"])

# Store active auth sessions
auth_sessions = {}

@app.route('/claude/auth/start', methods=['POST', 'OPTIONS'])
def start_auth():
    """Start Claude authentication process"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Start claude auth login in background
        def run_auth():
            try:
                # Run claude auth login and capture output
                result = subprocess.run(
                    ['claude', 'auth', 'login'],
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                # Extract auth URL from output
                output = result.stdout + result.stderr
                url_match = re.search(r'https://[^\s]+', output)
                
                if url_match:
                    auth_url = url_match.group()
                    auth_sessions[session_id] = {
                        'status': 'pending',
                        'auth_url': auth_url,
                        'created': time.time()
                    }
                else:
                    auth_sessions[session_id] = {
                        'status': 'error',
                        'error': 'Could not extract auth URL',
                        'output': output
                    }
            except subprocess.TimeoutExpired:
                auth_sessions[session_id] = {
                    'status': 'timeout',
                    'error': 'Authentication timeout'
                }
            except Exception as e:
                auth_sessions[session_id] = {
                    'status': 'error',
                    'error': str(e)
                }
        
        # Start auth in background thread
        thread = threading.Thread(target=run_auth)
        thread.start()
        
        # Wait briefly for URL to be available
        time.sleep(2)
        
        # Return session info
        if session_id in auth_sessions:
            return jsonify({
                'session_id': session_id,
                **auth_sessions[session_id]
            })
        else:
            return jsonify({
                'session_id': session_id,
                'status': 'starting'
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/claude/auth/status/<session_id>', methods=['GET', 'OPTIONS'])
def check_auth_status(session_id):
    """Check authentication status"""
    if request.method == 'OPTIONS':
        return '', 204
    
    # Check if session exists
    if session_id not in auth_sessions:
        return jsonify({'error': 'Session not found'}), 404
    
    session = auth_sessions[session_id]
    
    # Check if Claude is now authenticated
    try:
        result = subprocess.run(
            ['claude', 'auth', 'status'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if 'Authenticated' in result.stdout or 'logged in' in result.stdout.lower():
            session['status'] = 'authenticated'
            session['authenticated'] = True
        else:
            session['authenticated'] = False
            
    except:
        session['authenticated'] = False
    
    return jsonify(session)

@app.route('/claude/auth/verify', methods=['GET', 'OPTIONS'])
def verify_auth():
    """Verify current Claude authentication"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Check Claude auth status
        result = subprocess.run(
            ['claude', 'auth', 'status'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        authenticated = 'Authenticated' in result.stdout or 'logged in' in result.stdout.lower()
        
        # Try to get user info
        user_info = None
        if authenticated:
            try:
                # Try to extract user email or ID from status
                email_match = re.search(r'[\w\.-]+@[\w\.-]+', result.stdout)
                if email_match:
                    user_info = email_match.group()
            except:
                pass
        
        return jsonify({
            'authenticated': authenticated,
            'user': user_info,
            'output': result.stdout
        })
        
    except Exception as e:
        return jsonify({
            'authenticated': False,
            'error': str(e)
        })

@app.route('/claude/auth/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Logout from Claude"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        result = subprocess.run(
            ['claude', 'auth', 'logout'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        return jsonify({
            'success': True,
            'message': 'Logged out from Claude',
            'output': result.stdout
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Health check with Claude status"""
    if request.method == 'OPTIONS':
        return '', 204
    
    # Check Claude authentication
    try:
        result = subprocess.run(
            ['claude', 'auth', 'status'],
            capture_output=True,
            text=True,
            timeout=5
        )
        claude_authenticated = 'Authenticated' in result.stdout or 'logged in' in result.stdout.lower()
    except:
        claude_authenticated = False
    
    return jsonify({
        'status': 'healthy',
        'claude_authenticated': claude_authenticated,
        'timestamp': time.time()
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8083))
    app.run(host='0.0.0.0', port=port, debug=False)