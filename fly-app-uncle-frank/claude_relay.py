#!/usr/bin/env python3
"""
Simple Claude Relay System - MVP
Relays messages from user through pilot to executor
"""

import subprocess
import time
import re
from flask import Flask, request, jsonify
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

if __name__ == '__main__':
    port = 8084
    app.run(host='0.0.0.0', port=port, debug=False)