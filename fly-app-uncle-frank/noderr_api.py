#!/usr/bin/env python3
"""
Noderr API - Task and Project Management
Provides the missing endpoints for the Noderr frontend
"""

import os
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import time
from collections import deque

app = Flask(__name__)
CORS(app, origins="*", allow_headers=["Content-Type"], methods=["GET", "POST", "PATCH", "OPTIONS"])

# In-memory storage (replace with database in production)
projects = {}
tasks = {}
sse_clients = []

# Sample project for testing
default_project = {
    "id": "default",
    "name": "Default Project",
    "repo": "test/repo",
    "branch": "main",
    "created": datetime.now().isoformat()
}
projects["default"] = default_project

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    """Health check endpoint"""
    if request.method == 'OPTIONS':
        return '', 204
    return jsonify({
        'status': 'healthy',
        'cors_enabled': True,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/projects', methods=['GET', 'POST', 'OPTIONS'])
def handle_projects():
    """Get all projects or create a new one"""
    if request.method == 'OPTIONS':
        return '', 204
    
    if request.method == 'GET':
        return jsonify(list(projects.values()))
    
    if request.method == 'POST':
        data = request.json
        project_id = str(uuid.uuid4())
        project = {
            'id': project_id,
            'name': data.get('name', ''),
            'repo': data.get('repo', ''),
            'branch': data.get('branch', 'main'),
            'created': datetime.now().isoformat()
        }
        projects[project_id] = project
        
        # Notify SSE clients
        notify_sse('project:created', project)
        
        return jsonify(project), 201

@app.route('/tasks', methods=['GET', 'POST', 'OPTIONS'])
def handle_tasks():
    """Get tasks for a project or create a new task"""
    if request.method == 'OPTIONS':
        return '', 204
    
    if request.method == 'GET':
        project_id = request.args.get('projectId')
        if project_id:
            project_tasks = [t for t in tasks.values() if t.get('projectId') == project_id]
            return jsonify(project_tasks)
        return jsonify(list(tasks.values()))
    
    if request.method == 'POST':
        data = request.json
        task_id = str(uuid.uuid4())
        task = {
            'id': task_id,
            'projectId': data.get('projectId'),
            'description': data.get('description', ''),
            'status': data.get('status', 'backlog'),
            'progress': 0,
            'created': datetime.now().isoformat()
        }
        tasks[task_id] = task
        
        # Notify SSE clients
        notify_sse('task:created', task)
        
        return jsonify(task), 201

@app.route('/tasks/<task_id>', methods=['PATCH', 'OPTIONS'])
def update_task(task_id):
    """Update a task"""
    if request.method == 'OPTIONS':
        return '', 204
    
    if task_id not in tasks:
        return jsonify({'error': 'Task not found'}), 404
    
    data = request.json
    task = tasks[task_id]
    
    # Update allowed fields
    if 'status' in data:
        task['status'] = data['status']
    if 'progress' in data:
        task['progress'] = data['progress']
    if 'agentId' in data:
        task['agentId'] = data['agentId']
    
    task['updated'] = datetime.now().isoformat()
    
    # Notify SSE clients
    notify_sse('task:updated', task)
    
    return jsonify(task)

@app.route('/tasks/<task_id>/approve', methods=['POST', 'OPTIONS'])
def approve_task(task_id):
    """Approve a task and mark it as pushed"""
    if request.method == 'OPTIONS':
        return '', 204
    
    if task_id not in tasks:
        return jsonify({'error': 'Task not found'}), 404
    
    task = tasks[task_id]
    task['status'] = 'pushed'
    task['pushedAt'] = datetime.now().isoformat()
    
    # Notify SSE clients
    notify_sse('task:completed', task)
    
    return jsonify({'success': True, 'task': task})

@app.route('/tasks/<task_id>/revise', methods=['POST', 'OPTIONS'])
def revise_task(task_id):
    """Send task back for revision"""
    if request.method == 'OPTIONS':
        return '', 204
    
    if task_id not in tasks:
        return jsonify({'error': 'Task not found'}), 404
    
    task = tasks[task_id]
    task['status'] = 'ready'
    task['revised'] = True
    
    # Notify SSE clients
    notify_sse('task:updated', task)
    
    return jsonify({'success': True, 'task': task})

@app.route('/tasks/<task_id>/changes', methods=['GET', 'OPTIONS'])
def get_task_changes(task_id):
    """Get changes for a task"""
    if request.method == 'OPTIONS':
        return '', 204
    
    # Mock response for now
    return jsonify({
        'diff': '+ Added new feature\n- Removed old code\n~ Modified existing function'
    })

@app.route('/sse')
def sse():
    """Server-sent events endpoint"""
    def generate():
        client_queue = deque(maxlen=100)
        sse_clients.append(client_queue)
        
        # Send initial ping
        yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        
        try:
            while True:
                # Check for messages
                if client_queue:
                    event_type, data = client_queue.popleft()
                    yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
                else:
                    # Send heartbeat every 30 seconds
                    time.sleep(1)
                    yield f": heartbeat\n\n"
        except GeneratorExit:
            sse_clients.remove(client_queue)
    
    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    return response

def notify_sse(event_type, data):
    """Notify all SSE clients of an event"""
    for client_queue in sse_clients:
        try:
            client_queue.append((event_type, data))
        except:
            pass

@app.route('/', methods=['GET'])
def index():
    """Root endpoint"""
    return jsonify({
        'service': 'Noderr API',
        'version': '1.0',
        'endpoints': [
            '/health',
            '/projects',
            '/tasks',
            '/sse'
        ],
        'cors_enabled': True
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)