#!/usr/bin/env python3
"""
Simple Claude Relay System - MVP
Relays messages from user through pilot to executor
"""

import subprocess
import time
import re
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins="*", allow_headers=["Content-Type"], methods=["GET", "POST", "OPTIONS"])

# Noderr principles for the pilot to enforce
PILOT_PROMPT = """You are a Claude Pilot that reformats user requests for another Claude instance.
Your job is to take the user's message and reformat it with these principles:

1. NEVER simulate or mock - insist on real implementation
2. Go to the root cause of issues - don't just fix symptoms  
3. Complete the entire task - don't leave things half done
4. Test everything that's created
5. Be explicit and thorough
6. Document what you're doing

Take the user's message and reformat it to ensure the executor Claude follows these principles.
Keep the reformatted message clear and concise but comprehensive.

User message: {user_message}

Reformatted message for executor (respond with ONLY the reformatted message, nothing else):"""

def send_to_tmux(session_name, message):
    """Send a message to a tmux session and wait for response"""
    try:
        # Clear any existing input
        subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', session_name, 'C-c'],
            capture_output=True,
            timeout=2
        )
        time.sleep(0.5)
        
        # Send the message
        subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'send-keys', '-t', session_name, message, 'C-m'],
            capture_output=True,
            timeout=5
        )
        
        # Wait for response (Claude takes 3-15 seconds typically)
        response = ""
        for attempt in range(30):  # 30 seconds max
            time.sleep(1)
            
            # Capture output
            result = subprocess.run(
                ['sudo', '-u', 'claude-user', 'tmux', 'capture-pane', '-t', session_name, '-p'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            output = result.stdout
            
            # Check if Claude is still processing
            if any(indicator in output for indicator in ['Frolicking', 'Working', '⎿', 'Thinking']):
                continue
            
            # Look for the response after our message
            if message[:50] in output:
                # Find everything after our message until the next prompt
                msg_index = output.rfind(message[:50])
                if msg_index != -1:
                    response_text = output[msg_index + len(message):]
                    # Clean up the response
                    response_text = response_text.strip()
                    # Remove the trailing prompt if present
                    if response_text.endswith('>'):
                        response_text = response_text[:-1].strip()
                    if response_text:
                        response = response_text
                        break
            
            # Check if we see the prompt again (Claude finished)
            if output.rstrip().endswith('>'):
                break
        
        return response
    except Exception as e:
        return f"Error: {str(e)}"

@app.route('/relay', methods=['POST', 'OPTIONS'])
def relay_message():
    """Simple relay endpoint - user -> pilot -> executor -> response"""
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json
    user_message = data.get('message', '').strip()
    
    if not user_message:
        return jsonify({'error': 'No message provided'}), 400
    
    try:
        # Step 1: Send to pilot for reformatting
        pilot_prompt = PILOT_PROMPT.format(user_message=user_message)
        pilot_response = send_to_tmux('claude-pilot', pilot_prompt)
        
        if not pilot_response or 'Error' in pilot_response:
            # If pilot fails, just use the original message
            reformatted_message = user_message
        else:
            reformatted_message = pilot_response
        
        # Step 2: Send reformatted message to executor
        executor_response = send_to_tmux('claude-executor', reformatted_message)
        
        if not executor_response:
            executor_response = "Claude is processing your request. Please check the tmux session for details."
        
        return jsonify({
            'success': True,
            'original_message': user_message,
            'pilot_reformatted': reformatted_message,
            'executor_response': executor_response
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Check if both Claude sessions are running"""
    if request.method == 'OPTIONS':
        return '', 204
    
    pilot_running = False
    executor_running = False
    
    try:
        result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'has-session', '-t', 'claude-pilot'],
            capture_output=True
        )
        pilot_running = (result.returncode == 0)
    except:
        pass
    
    try:
        result = subprocess.run(
            ['sudo', '-u', 'claude-user', 'tmux', 'has-session', '-t', 'claude-executor'],
            capture_output=True
        )
        executor_running = (result.returncode == 0)
    except:
        pass
    
    return jsonify({
        'status': 'healthy',
        'pilot_running': pilot_running,
        'executor_running': executor_running,
        'ready': pilot_running and executor_running
    })

@app.route('/test', methods=['GET'])
def serve_test_page():
    """Serve the test HTML page"""
    html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Relay Test - MVP</title>
    <style>
        body {
            font-family: 'Monaco', 'Courier New', monospace;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        h1 { color: #569cd6; }
        .container {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-top: 20px;
        }
        .panel {
            background: #2d2d30;
            border: 1px solid #3e3e42;
            padding: 15px;
            border-radius: 5px;
        }
        .panel h2 {
            color: #4ec9b0;
            margin-top: 0;
            font-size: 14px;
            text-transform: uppercase;
        }
        input, textarea {
            width: 100%;
            padding: 10px;
            background: #1e1e1e;
            border: 1px solid #3e3e42;
            color: #d4d4d4;
            font-family: inherit;
            border-radius: 3px;
            box-sizing: border-box;
        }
        button {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            cursor: pointer;
            font-family: inherit;
            border-radius: 3px;
            margin-top: 10px;
        }
        button:hover { background: #005a9e; }
        button:disabled { background: #3e3e42; cursor: not-allowed; }
        .status {
            padding: 5px 10px;
            border-radius: 3px;
            margin-bottom: 10px;
            font-size: 12px;
        }
        .status.ready { background: #0e5a0e; color: #4ec9b0; }
        .status.processing { background: #5a4b0e; color: #dcdcaa; }
        .status.error { background: #5a0e0e; color: #f48771; }
        .content {
            background: #1e1e1e;
            padding: 10px;
            border-radius: 3px;
            min-height: 200px;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 13px;
            line-height: 1.5;
        }
        .loading { color: #569cd6; animation: pulse 1s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    </style>
</head>
<body>
    <h1>🚀 Claude Relay System - MVP</h1>
    <div class="panel">
        <div id="status" class="status">Checking system status...</div>
        <input type="text" id="message" placeholder="Enter your message for Claude..." autofocus>
        <button id="sendBtn" onclick="sendMessage()">Send Message</button>
    </div>
    <div class="container">
        <div class="panel">
            <h2>1. User Message</h2>
            <div id="userMessage" class="content">Your message will appear here...</div>
        </div>
        <div class="panel">
            <h2>2. Pilot Reformatted</h2>
            <div id="pilotMessage" class="content">Pilot will reformat with Noderr principles...</div>
        </div>
        <div class="panel">
            <h2>3. Executor Response</h2>
            <div id="executorResponse" class="content">Executor's response will appear here...</div>
        </div>
    </div>
    <script>
        const API_BASE = window.location.origin;
        checkStatus();
        setInterval(checkStatus, 10000);

        async function checkStatus() {
            try {
                const response = await fetch(`${API_BASE}/health`);
                const data = await response.json();
                if (data.ready) {
                    updateStatus('ready', 'System Ready - Both Claudes Running');
                } else {
                    updateStatus('error', `Pilot: ${data.pilot_running ? '✓' : '✗'} | Executor: ${data.executor_running ? '✓' : '✗'}`);
                }
            } catch (error) {
                updateStatus('error', 'Cannot connect to server');
            }
        }

        function updateStatus(type, message) {
            const status = document.getElementById('status');
            status.className = `status ${type}`;
            status.textContent = message;
            document.getElementById('sendBtn').disabled = (type === 'error');
        }

        async function sendMessage() {
            const messageInput = document.getElementById('message');
            const message = messageInput.value.trim();
            if (!message) return;
            
            document.getElementById('userMessage').textContent = message;
            document.getElementById('pilotMessage').innerHTML = '<span class="loading">Pilot is reformatting...</span>';
            document.getElementById('executorResponse').innerHTML = '<span class="loading">Waiting for executor...</span>';
            
            updateStatus('processing', 'Processing...');
            document.getElementById('sendBtn').disabled = true;
            
            try {
                const response = await fetch(`${API_BASE}/relay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                
                const data = await response.json();
                if (data.success) {
                    document.getElementById('pilotMessage').textContent = data.pilot_reformatted || 'No reformatting needed';
                    document.getElementById('executorResponse').textContent = data.executor_response || 'No response yet';
                } else {
                    throw new Error(data.error || 'Unknown error');
                }
                updateStatus('ready', 'Ready for next message');
            } catch (error) {
                document.getElementById('pilotMessage').textContent = 'Error: ' + error.message;
                document.getElementById('executorResponse').textContent = 'Failed to process message';
                updateStatus('error', 'Error: ' + error.message);
            }
            
            document.getElementById('sendBtn').disabled = false;
            messageInput.value = '';
            messageInput.focus();
        }

        document.getElementById('message').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !document.getElementById('sendBtn').disabled) {
                sendMessage();
            }
        });
    </script>
</body>
</html>'''
    return Response(html, mimetype='text/html')

if __name__ == '__main__':
    port = 8084
    app.run(host='0.0.0.0', port=port, debug=False)