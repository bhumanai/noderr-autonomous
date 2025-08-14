#!/usr/bin/env python3
"""
Simple Claude Relay using existing tmux session
"""

import os
import json
import subprocess
import time
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=['*'])

# Project name for tmux session
PROJECT_NAME = "fly-app-uncle-frank"
CLAUDE_SESSION = f"claude-{PROJECT_NAME}"

def check_tmux_session(session_name):
    """Check if a tmux session exists"""
    try:
        result = subprocess.run(
            ['tmux', 'has-session', '-t', session_name],
            capture_output=True,
            text=True
        )
        return result.returncode == 0
    except:
        return False

def send_to_claude(message):
    """Send message to Claude in tmux session and get response"""
    try:
        # Check if session exists
        if not check_tmux_session(CLAUDE_SESSION):
            return None, "Claude session not running"
        
        # Clear any existing output
        subprocess.run(['tmux', 'clear-history', '-t', CLAUDE_SESSION], capture_output=True)
        
        # Send the message
        subprocess.run(['tmux', 'send-keys', '-t', CLAUDE_SESSION, message, 'Enter'], capture_output=True)
        
        # Wait for response (adjust timeout as needed)
        time.sleep(5)
        
        # Capture the output
        result = subprocess.run(
            ['tmux', 'capture-pane', '-t', CLAUDE_SESSION, '-p'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            return result.stdout, None
        else:
            return None, "Failed to capture output"
            
    except Exception as e:
        return None, str(e)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    session_running = check_tmux_session(CLAUDE_SESSION)
    return jsonify({
        'status': 'healthy',
        'claude_session': session_running,
        'session_name': CLAUDE_SESSION if session_running else None
    })

@app.route('/send', methods=['POST'])
def send_message():
    """Send message to Claude"""
    try:
        data = request.json
        message = data.get('message', '')
        
        if not message:
            return jsonify({'error': 'No message provided'}), 400
        
        response, error = send_to_claude(message)
        
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify({
            'success': True,
            'response': response
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/test', methods=['GET'])
def test_page():
    """Simple test page"""
    html = '''<!DOCTYPE html>
<html>
<head>
    <title>Claude Relay Test</title>
    <style>
        body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        input, textarea { width: 100%; padding: 10px; background: #2d2d30; border: 1px solid #3e3e42; color: #d4d4d4; }
        button { background: #007acc; color: white; border: none; padding: 10px 20px; cursor: pointer; }
        #response { background: #2d2d30; padding: 10px; margin-top: 20px; min-height: 200px; white-space: pre-wrap; }
        .status { padding: 5px; background: #2d2d30; margin-bottom: 10px; }
        .status.ready { background: #0e5a0e; }
        .status.error { background: #5a0e0e; }
    </style>
</head>
<body>
    <h1>Claude Relay Test</h1>
    <div id="status" class="status">Checking...</div>
    <textarea id="message" placeholder="Enter message..." rows="3"></textarea>
    <button onclick="sendMessage()">Send</button>
    <div id="response"></div>
    
    <script>
        async function checkStatus() {
            try {
                const res = await fetch('/health');
                const data = await res.json();
                const status = document.getElementById('status');
                if (data.claude_session) {
                    status.className = 'status ready';
                    status.textContent = 'Claude Ready: ' + data.session_name;
                } else {
                    status.className = 'status error';
                    status.textContent = 'Claude Not Running';
                }
            } catch (e) {
                document.getElementById('status').textContent = 'Error: ' + e.message;
            }
        }
        
        async function sendMessage() {
            const message = document.getElementById('message').value;
            if (!message) return;
            
            document.getElementById('response').textContent = 'Sending...';
            
            try {
                const res = await fetch('/send', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({message})
                });
                const data = await res.json();
                
                if (data.success) {
                    document.getElementById('response').textContent = data.response;
                } else {
                    document.getElementById('response').textContent = 'Error: ' + (data.error || 'Unknown');
                }
            } catch (e) {
                document.getElementById('response').textContent = 'Error: ' + e.message;
            }
        }
        
        checkStatus();
        setInterval(checkStatus, 5000);
    </script>
</body>
</html>'''
    return Response(html, mimetype='text/html')

if __name__ == '__main__':
    port = 8085
    print(f"Starting Claude Relay on port {port}")
    print(f"Looking for tmux session: {CLAUDE_SESSION}")
    app.run(host='0.0.0.0', port=port, debug=False)