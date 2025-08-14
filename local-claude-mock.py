#!/usr/bin/env python3
"""
Local Claude Mock Server
Simulates Claude's responses for testing the complete Noderr workflow
"""

from flask import Flask, request, jsonify
import time
import json
import hashlib
import hmac
from datetime import datetime
import threading
import queue

app = Flask(__name__)

# Configuration
HMAC_SECRET = "test-secret-change-in-production"

# Session storage
sessions = {}
command_queue = queue.Queue()
current_output = ""
claude_active = False

def verify_hmac(command: str, signature: str) -> bool:
    """Verify HMAC signature"""
    expected = hmac.new(
        HMAC_SECRET.encode(),
        command.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

def process_command(command: str) -> str:
    """Process a command and generate a mock Claude response"""
    responses = {
        "brainstorm": """
# Brainstorming Session Started

## Project Analysis
I've analyzed the project structure and identified the following opportunities:

1. **Add Health Monitoring Dashboard**
   - Real-time system status
   - Performance metrics
   - Error tracking

2. **Implement Auto-Recovery System**
   - Detect failures
   - Automatic restart
   - Alert notifications

3. **Create Test Suite**
   - Unit tests
   - Integration tests
   - E2E tests

## Recommended Next Steps
- Start with health monitoring
- Add comprehensive logging
- Improve error handling
""",
        "tasks": """
# Task List Generated

## Priority 1: Core Infrastructure
- [ ] Add health check endpoint
- [ ] Implement logging system
- [ ] Create error boundaries

## Priority 2: Features
- [ ] Build monitoring dashboard
- [ ] Add notification system
- [ ] Create API documentation

## Priority 3: Testing
- [ ] Write unit tests
- [ ] Add integration tests
- [ ] Create E2E test suite
""",
        "pilot": """
# Pilot Execution Started

## Implementing Health Check Endpoint

Creating `/health` endpoint...

```python
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'services': check_services()
    })
```

✅ Health endpoint implemented
✅ Tests passing
✅ Documentation updated

## Next: Implementing Logging System...
""",
        "hello": "print('Hello World')\n# Simple Python script created successfully!",
        "default": f"""
# Processing Command

Received: {command[:100]}...

## Analysis
I'm analyzing your request and preparing a response.

## Implementation
Working on the solution...

## Result
✅ Task completed successfully at {datetime.now().isoformat()}
"""
    }
    
    # Match command patterns
    command_lower = command.lower()
    
    if "brainstorm" in command_lower:
        return responses["brainstorm"]
    elif "task" in command_lower:
        return responses["tasks"]
    elif "pilot" in command_lower:
        return responses["pilot"]
    elif "hello" in command_lower or "print" in command_lower:
        return responses["hello"]
    else:
        return responses["default"].format(command=command)

def claude_worker():
    """Background worker that processes commands like Claude would"""
    global current_output, claude_active
    
    while True:
        try:
            if not command_queue.empty():
                command = command_queue.get()
                claude_active = True
                
                # Process command instantly
                response = process_command(command)
                current_output = response
                
                # Keep output available for a bit
                time.sleep(0.1)
                
                claude_active = False
                command_queue.task_done()
            else:
                time.sleep(0.1)  # Check queue more frequently
        except Exception as e:
            print(f"Worker error: {e}")
            claude_active = False

# Start background worker
worker_thread = threading.Thread(target=claude_worker, daemon=True)
worker_thread.start()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'claude_session': True,  # Always true for mock
        'timestamp': datetime.now().isoformat(),
        'mock_mode': True
    })

@app.route('/inject', methods=['POST'])
def inject():
    """Inject command endpoint - mimics Fly.io behavior"""
    data = request.json
    command = data.get('command')
    signature = data.get('signature')
    
    # Verify signature
    if signature and not verify_hmac(command, signature):
        return jsonify({'error': 'Invalid signature'}), 403
    
    # Queue command for processing
    command_queue.put(command)
    
    # Create session
    session_id = f"session_{int(time.time())}"
    sessions[session_id] = {
        'command': command,
        'started': datetime.now().isoformat(),
        'status': 'processing'
    }
    
    return jsonify({
        'success': True,
        'message': 'Command injected',
        'session_id': session_id
    })

@app.route('/status', methods=['GET'])
def status():
    """Status endpoint - shows current Claude output"""
    return jsonify({
        'sessions': list(sessions.values())[-10:],  # Last 10 sessions
        'current_output': current_output,
        'claude_active': claude_active,
        'queue_size': command_queue.qsize()
    })

@app.route('/api/queue', methods=['POST'])
def queue_task():
    """CF Worker compatible queue endpoint"""
    data = request.json
    command = data.get('command', '')
    
    if not command:
        return jsonify({'error': 'Command required'}), 400
    
    # Queue the command
    command_queue.put(command)
    
    task_id = f"task_{hashlib.md5(command.encode()).hexdigest()[:8]}"
    
    return jsonify({
        'taskId': task_id,
        'command': command,
        'status': 'pending',
        'created': datetime.now().isoformat()
    })

@app.route('/api/process', methods=['GET'])
def process_queue():
    """Process queued commands"""
    processed = []
    
    # Process up to 5 commands
    for _ in range(min(5, command_queue.qsize())):
        if not command_queue.empty():
            command = command_queue.get()
            command_queue.put(command)  # Re-queue for worker
            
            processed.append({
                'taskId': f"task_{hashlib.md5(command.encode()).hexdigest()[:8]}",
                'status': 'completed',
                'result': {'success': True}
            })
    
    return jsonify(processed)

@app.route('/api/status', methods=['GET'])
def api_status():
    """CF Worker compatible status endpoint"""
    return jsonify({
        'queueLength': command_queue.qsize(),
        'stats': {
            'pending': command_queue.qsize(),
            'executing': 1 if claude_active else 0,
            'completed': len(sessions),
            'failed': 0
        },
        'tasks': list(sessions.values())[-5:]
    })

if __name__ == '__main__':
    print("=" * 60)
    print("LOCAL CLAUDE MOCK SERVER")
    print("=" * 60)
    print("Simulating Claude responses for Noderr testing")
    print("Endpoints:")
    print("  - http://localhost:8083/health")
    print("  - http://localhost:8083/inject")
    print("  - http://localhost:8083/status")
    print("  - http://localhost:8083/api/queue")
    print("  - http://localhost:8083/api/process")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=8083, debug=False)