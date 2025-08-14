#!/usr/bin/env python3
"""
OAuth Authentication Handler for Claude CLI
Captures OAuth URL, lets user authenticate, and injects the code
"""

import subprocess
import re
import time
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading

app = Flask(__name__)
CORS(app)  # Allow UI to call this

# Global state
oauth_state = {
    "status": "idle",  # idle, waiting_for_url, waiting_for_code, authenticating, authenticated
    "auth_url": None,
    "auth_code": None,
    "error": None,
    "session_active": False
}

def get_claude_oauth_url():
    """Start Claude login and capture the OAuth URL"""
    global oauth_state
    
    try:
        # Kill any existing Claude session
        subprocess.run(['sudo', '-u', 'claude-user', 'tmux', 'kill-session', '-t', 'claude-auth'], 
                      capture_output=True)
        time.sleep(1)
        
        # Start Claude login in tmux
        subprocess.run([
            'sudo', '-u', 'claude-user', 'tmux', 'new-session', '-d', '-s', 'claude-auth',
            'claude login'
        ])
        
        time.sleep(3)  # Give Claude time to start
        
        # Capture the output
        result = subprocess.run([
            'sudo', '-u', 'claude-user', 'tmux', 'capture-pane', '-t', 'claude-auth', '-p'
        ], capture_output=True, text=True)
        
        output = result.stdout
        
        # Look for the OAuth URL pattern
        # Claude shows: "Visit this URL to authenticate: https://..."
        url_pattern = r'(https://[^\s]+oauth[^\s]+)'
        match = re.search(url_pattern, output)
        
        if match:
            oauth_state["auth_url"] = match.group(1)
            oauth_state["status"] = "waiting_for_code"
            return match.group(1)
        
        # Also check for the specific Claude.ai auth URL
        claude_pattern = r'(https://claude\.ai/[^\s]+)'
        match = re.search(claude_pattern, output)
        
        if match:
            oauth_state["auth_url"] = match.group(1)
            oauth_state["status"] = "waiting_for_code"
            return match.group(1)
            
        # If no URL yet, might need to select auth method
        if "Choose how to authenticate" in output or "Select authentication method" in output:
            # Select option 1 (Claude subscription)
            subprocess.run([
                'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', 'claude-auth', '1', 'C-m'
            ])
            time.sleep(2)
            
            # Try capturing again
            result = subprocess.run([
                'sudo', '-u', 'claude-user', 'tmux', 'capture-pane', '-t', 'claude-auth', '-p'
            ], capture_output=True, text=True)
            
            output = result.stdout
            match = re.search(url_pattern, output) or re.search(claude_pattern, output)
            
            if match:
                oauth_state["auth_url"] = match.group(1)
                oauth_state["status"] = "waiting_for_code"
                return match.group(1)
        
        oauth_state["error"] = "Could not find OAuth URL in output"
        return None
        
    except Exception as e:
        oauth_state["error"] = str(e)
        return None

def inject_auth_code(code):
    """Inject the auth code into the tmux session"""
    global oauth_state
    
    try:
        # Send the code to tmux
        subprocess.run([
            'sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', 'claude-auth',
            code, 'C-m'
        ])
        
        oauth_state["status"] = "authenticating"
        time.sleep(5)  # Wait for authentication
        
        # Check if authentication succeeded
        result = subprocess.run([
            'sudo', '-u', 'claude-user', 'tmux', 'capture-pane', '-t', 'claude-auth', '-p'
        ], capture_output=True, text=True)
        
        output = result.stdout
        
        if "Successfully authenticated" in output or "Logged in" in output:
            oauth_state["status"] = "authenticated"
            oauth_state["session_active"] = True
            
            # Start the main Claude session
            subprocess.run(['sudo', '-u', 'claude-user', 'tmux', 'kill-session', '-t', 'claude-auth'],
                          capture_output=True)
            
            subprocess.run([
                'sudo', '-u', 'claude-user', 'tmux', 'new-session', '-d', '-s', 'claude-code',
                'cd /workspace && claude --dangerously-skip-permissions'
            ])
            
            return True
        else:
            oauth_state["error"] = "Authentication failed - check code"
            oauth_state["status"] = "waiting_for_code"
            return False
            
    except Exception as e:
        oauth_state["error"] = str(e)
        return False

@app.route('/oauth/start', methods=['POST'])
def start_oauth():
    """Start the OAuth flow and return the URL"""
    global oauth_state
    
    oauth_state["status"] = "waiting_for_url"
    oauth_state["error"] = None
    
    # Start in background to not block
    def get_url_async():
        url = get_claude_oauth_url()
        if url:
            oauth_state["auth_url"] = url
            oauth_state["status"] = "waiting_for_code"
    
    thread = threading.Thread(target=get_url_async)
    thread.start()
    
    # Wait a bit for URL
    time.sleep(5)
    
    return jsonify({
        "status": oauth_state["status"],
        "auth_url": oauth_state["auth_url"],
        "error": oauth_state["error"]
    })

@app.route('/oauth/submit-code', methods=['POST'])
def submit_code():
    """Submit the auth code from user"""
    data = request.json
    code = data.get('code', '').strip()
    
    if not code:
        return jsonify({"error": "No code provided"}), 400
    
    oauth_state["auth_code"] = code
    
    # Inject code in background
    def inject_async():
        success = inject_auth_code(code)
        if not success:
            oauth_state["status"] = "waiting_for_code"
    
    thread = threading.Thread(target=inject_async)
    thread.start()
    
    return jsonify({
        "status": "authenticating",
        "message": "Code submitted, authenticating..."
    })

@app.route('/oauth/status', methods=['GET'])
def oauth_status():
    """Get current OAuth status"""
    global oauth_state
    
    # Check if Claude session is actually running
    try:
        result = subprocess.run([
            'sudo', '-u', 'claude-user', 'tmux', 'has-session', '-t', 'claude-code'
        ], capture_output=True)
        
        oauth_state["session_active"] = (result.returncode == 0)
    except:
        oauth_state["session_active"] = False
    
    return jsonify(oauth_state)

@app.route('/oauth/health', methods=['GET'])
def health():
    """Health check with OAuth status"""
    return jsonify({
        "status": "healthy",
        "oauth_configured": oauth_state["status"] == "authenticated",
        "claude_session": oauth_state["session_active"],
        "timestamp": time.time()
    })

if __name__ == '__main__':
    print("OAuth Handler Starting...")
    print("Endpoints:")
    print("  POST /oauth/start - Start OAuth flow")
    print("  POST /oauth/submit-code - Submit auth code")
    print("  GET /oauth/status - Check status")
    print("  GET /oauth/health - Health check")
    
    app.run(host='0.0.0.0', port=8085, debug=False)