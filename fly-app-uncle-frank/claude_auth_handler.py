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
        tmux_session = "claude-auth-" + session_id[:8]
        
        # Start claude auth login in tmux session to handle interactive flow
        def run_auth():
            try:
                # Kill any existing auth tmux session
                subprocess.run(
                    ['sudo', '-u', 'claude-user', 'tmux', 'kill-session', '-t', tmux_session],
                    capture_output=True,
                    timeout=10
                )
            except:
                pass  # Session might not exist
            
            try:
                # Create new tmux session for auth
                subprocess.run(
                    ['sudo', '-u', 'claude-user', 'tmux', 'new-session', '-d', '-s', tmux_session,
                     'claude auth login'],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                # Wait for output to appear
                time.sleep(3)
                
                # Capture output from tmux session
                result = subprocess.run(
                    ['sudo', '-u', 'claude-user', 'tmux', 'capture-pane', '-t', tmux_session, '-p'],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                output = result.stdout
                
                # Look for auth URL patterns
                # Claude CLI typically shows: "Visit https://claude.ai/auth/..."
                url_patterns = [
                    r'https://claude\.ai/auth/[^\s]+',
                    r'https://[^\s]*claude[^\s]*auth[^\s]+',
                    r'Visit:\s*(https://[^\s]+)',
                    r'Open.*browser.*:\s*(https://[^\s]+)'
                ]
                
                auth_url = None
                for pattern in url_patterns:
                    match = re.search(pattern, output, re.IGNORECASE)
                    if match:
                        auth_url = match.group(1) if '(' in pattern else match.group()
                        break
                
                if auth_url:
                    auth_sessions[session_id] = {
                        'status': 'pending',
                        'auth_url': auth_url,
                        'tmux_session': tmux_session,
                        'created': time.time()
                    }
                else:
                    # Try device code flow if available
                    device_code_match = re.search(r'code:\s*([A-Z0-9-]+)', output, re.IGNORECASE)
                    if device_code_match:
                        auth_sessions[session_id] = {
                            'status': 'device_code',
                            'device_code': device_code_match.group(1),
                            'verification_url': 'https://claude.ai/device',
                            'tmux_session': tmux_session,
                            'output': output
                        }
                    else:
                        auth_sessions[session_id] = {
                            'status': 'error',
                            'error': 'Could not extract auth URL or device code',
                            'output': output,
                            'tmux_session': tmux_session
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
        
        # Wait for initial setup
        time.sleep(4)
        
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
    
    # If there's a tmux session, check its output for updates
    if 'tmux_session' in session:
        try:
            result = subprocess.run(
                ['sudo', '-u', 'claude-user', 'tmux', 'capture-pane', '-t', session['tmux_session'], '-p'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            output = result.stdout
            session['latest_output'] = output
            
            # Check for success patterns
            if 'successfully' in output.lower() or 'authenticated' in output.lower():
                session['status'] = 'authenticated'
                
                # Clean up tmux session
                try:
                    subprocess.run(
                        ['sudo', '-u', 'claude-user', 'tmux', 'kill-session', '-t', session['tmux_session']],
                        capture_output=True,
                        timeout=10
                    )
                except:
                    pass
        except:
            pass
    
    # Check if Claude is now authenticated globally
    try:
        result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'claude', 'auth', 'status'],
            capture_output=True,
            text=True,
            timeout=30
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
    
    # First check if Claude tmux session is running
    try:
        # Check for any tmux sessions
        list_result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'list-sessions'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # Look for claude-code session or any claude-auth session
        if list_result.returncode == 0 and list_result.stdout:
            # Get the first session name (could be claude-code or claude-auth-*)
            session_name = None
            for line in list_result.stdout.split('\n'):
                if line and ('claude-code' in line or 'claude-auth' in line):
                    session_name = line.split(':')[0]
                    break
            
            if session_name:
                try:
                    # Capture current state with shorter timeout
                    capture_result = subprocess.run(
                        ['sudo', '-u', 'claude-user', 'tmux', 'capture-pane', '-t', session_name, '-p'],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    
                    output = capture_result.stdout.lower()
                    
                    # Check various indicators that Claude is running
                    claude_indicators = [
                        'bypass permissions on',
                        'claude code',
                        'welcome to claude',
                        '> echo',  # Has executed commands
                        'preview',  # Showing preview
                        'cwd:',  # Shows working directory
                        'console.log'  # Shows code output
                    ]
                    
                    if any(indicator in output for indicator in claude_indicators):
                        # Claude is running
                        return jsonify({
                            'authenticated': True,
                            'user': 'claude-user',
                            'method': 'tmux_session_active',
                            'session': session_name,
                            'output': 'Claude CLI is running in tmux session'
                        })
                except Exception as e:
                    # Log but don't fail
                    pass
    except Exception as e:
        # Log but don't fail
        pass
    
    # Don't try auth status check if Claude might be running interactively
    # It will timeout because Claude can't respond while in interactive mode
    return jsonify({
        'authenticated': False,
        'method': 'no_tmux_session',
        'message': 'No active Claude session found. Please authenticate.'
    })

@app.route('/claude/auth/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Logout from Claude"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'claude', 'auth', 'logout'],
            capture_output=True,
            text=True,
            timeout=30
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

@app.route('/claude/debug', methods=['GET', 'OPTIONS'])
def debug_claude():
    """Debug Claude CLI installation and configuration"""
    if request.method == 'OPTIONS':
        return '', 204
    
    debug_info = {}
    
    # Check if claude binary exists
    try:
        which_result = subprocess.run(
            ['which', 'claude'],
            capture_output=True,
            text=True,
            timeout=10
        )
        debug_info['claude_path'] = which_result.stdout.strip() or 'Not found'
    except Exception as e:
        debug_info['claude_path'] = f'Error: {str(e)}'
    
    # Check claude version
    try:
        version_result = subprocess.run(
            ['claude', '--version'],
            capture_output=True,
            text=True,
            timeout=10
        )
        debug_info['claude_version'] = version_result.stdout.strip() or version_result.stderr.strip()
    except Exception as e:
        debug_info['claude_version'] = f'Error: {str(e)}'
    
    # Check claude-user home directory
    try:
        home_result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'sh', '-c', 'echo $HOME'],
            capture_output=True,
            text=True,
            timeout=10
        )
        debug_info['claude_user_home'] = home_result.stdout.strip()
    except Exception as e:
        debug_info['claude_user_home'] = f'Error: {str(e)}'
    
    # Check if .claude directory exists
    try:
        claude_dir_result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'ls', '-la', '/home/claude-user/.config/'],
            capture_output=True,
            text=True,
            timeout=10
        )
        debug_info['claude_config_dir'] = claude_dir_result.stdout or 'Empty'
    except Exception as e:
        debug_info['claude_config_dir'] = f'Error: {str(e)}'
    
    # Try running claude auth status with detailed output
    try:
        auth_result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'claude', 'auth', 'status'],
            capture_output=True,
            text=True,
            timeout=30
        )
        debug_info['auth_status_stdout'] = auth_result.stdout or 'No output'
        debug_info['auth_status_stderr'] = auth_result.stderr or 'No errors'
        debug_info['auth_status_code'] = auth_result.returncode
    except subprocess.TimeoutExpired:
        debug_info['auth_status'] = 'Timeout after 30 seconds'
    except Exception as e:
        debug_info['auth_status'] = f'Error: {str(e)}'
    
    # Check tmux sessions
    try:
        tmux_result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'list-sessions'],
            capture_output=True,
            text=True,
            timeout=10
        )
        debug_info['tmux_sessions'] = tmux_result.stdout or 'No sessions'
    except Exception as e:
        debug_info['tmux_sessions'] = f'Error or no sessions: {str(e)}'
    
    return jsonify(debug_info)

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Health check with Claude status"""
    if request.method == 'OPTIONS':
        return '', 204
    
    # Check Claude authentication
    try:
        result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'claude', 'auth', 'status'],
            capture_output=True,
            text=True,
            timeout=30
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