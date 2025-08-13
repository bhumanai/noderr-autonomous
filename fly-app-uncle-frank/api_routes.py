#!/usr/bin/env python3
"""
API Routes for Noderr Fleet Command UI
Provides project and task management endpoints
"""

import json
import time
from flask import request, jsonify
from flask_cors import CORS, cross_origin

# In-memory storage (will reset on restart)
projects = []
tasks = []

def setup_api_routes(app):
    """Setup API routes for the Flask app"""
    
    # Enable CORS for all routes
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    @app.route('/api/projects', methods=['GET', 'POST', 'OPTIONS'])
    @cross_origin()
    def handle_projects():
        """Handle project operations"""
        if request.method == 'OPTIONS':
            return '', 200
            
        if request.method == 'GET':
            return jsonify(projects)
        
        elif request.method == 'POST':
            data = request.get_json()
            project = {
                'id': f'project-{int(time.time())}',
                'name': data.get('name', 'Unnamed Project'),
                'repo': data.get('repo', ''),
                'branch': data.get('branch', 'main'),
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%S')
            }
            projects.append(project)
            return jsonify(project), 201
    
    @app.route('/api/projects/<project_id>', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'])
    @cross_origin()
    def handle_project(project_id):
        """Handle individual project operations"""
        if request.method == 'OPTIONS':
            return '', 200
            
        project = next((p for p in projects if p['id'] == project_id), None)
        
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        if request.method == 'GET':
            return jsonify(project)
        
        elif request.method == 'PUT':
            data = request.get_json()
            project.update(data)
            return jsonify(project)
        
        elif request.method == 'DELETE':
            projects.remove(project)
            return '', 204
    
    @app.route('/api/tasks', methods=['GET', 'POST', 'OPTIONS'])
    @cross_origin()
    def handle_tasks():
        """Handle task operations"""
        if request.method == 'OPTIONS':
            return '', 200
            
        if request.method == 'GET':
            project_id = request.args.get('projectId')
            if project_id:
                filtered_tasks = [t for t in tasks if t.get('projectId') == project_id]
                return jsonify(filtered_tasks)
            return jsonify(tasks)
        
        elif request.method == 'POST':
            data = request.get_json()
            task = {
                'id': f'task-{int(time.time())}-{len(tasks)}',
                'description': data.get('description', ''),
                'projectId': data.get('projectId'),
                'status': data.get('status', 'backlog'),
                'createdAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
                'agentId': None,
                'progress': 0
            }
            tasks.append(task)
            return jsonify(task), 201
    
    @app.route('/api/tasks/<task_id>', methods=['GET', 'PATCH', 'DELETE', 'OPTIONS'])
    @cross_origin()
    def handle_task(task_id):
        """Handle individual task operations"""
        if request.method == 'OPTIONS':
            return '', 200
            
        task = next((t for t in tasks if t['id'] == task_id), None)
        
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        if request.method == 'GET':
            return jsonify(task)
        
        elif request.method == 'PATCH':
            data = request.get_json()
            task.update(data)
            
            # Update timestamps based on status changes
            if data.get('status') == 'working' and not task.get('startedAt'):
                task['startedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')
            elif data.get('status') == 'review' and not task.get('completedAt'):
                task['completedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')
            elif data.get('status') == 'pushed' and not task.get('pushedAt'):
                task['pushedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')
            
            return jsonify(task)
        
        elif request.method == 'DELETE':
            tasks.remove(task)
            return '', 204
    
    @app.route('/api/tasks/<task_id>/approve', methods=['POST', 'OPTIONS'])
    @cross_origin()
    def approve_task(task_id):
        """Approve a task for pushing"""
        if request.method == 'OPTIONS':
            return '', 200
            
        task = next((t for t in tasks if t['id'] == task_id), None)
        
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        data = request.get_json()
        task['status'] = 'pushed'
        task['pushedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')
        task['commitMessage'] = data.get('commitMessage', 'Task completed')
        
        return jsonify({
            'success': True,
            'task': task,
            'message': 'Task approved and pushed'
        })
    
    @app.route('/api/tasks/<task_id>/changes', methods=['GET', 'OPTIONS'])
    @cross_origin()
    def get_task_changes(task_id):
        """Get changes for a task"""
        if request.method == 'OPTIONS':
            return '', 200
            
        # Mock changes for now
        return jsonify({
            'diff': '+ Added new feature\n- Removed old code\n~ Modified configuration',
            'files': ['src/app.js', 'config.json']
        })
    
    @app.route('/api/git/status', methods=['GET', 'OPTIONS'])
    @cross_origin()
    def git_status():
        """Get git status"""
        if request.method == 'OPTIONS':
            return '', 200
            
        return jsonify({
            'branch': 'main',
            'modified': [],
            'untracked': [],
            'staged': [],
            'ahead': 0,
            'behind': 0
        })
    
    @app.route('/api/git/commit', methods=['POST', 'OPTIONS'])
    @cross_origin()
    def git_commit():
        """Create a git commit"""
        if request.method == 'OPTIONS':
            return '', 200
            
        data = request.get_json()
        return jsonify({
            'success': True,
            'commit': f'commit-{int(time.time())}',
            'message': data.get('message', 'Commit from Noderr')
        })
    
    @app.route('/api/git/push', methods=['POST', 'OPTIONS'])
    @cross_origin()
    def git_push():
        """Push to remote"""
        if request.method == 'OPTIONS':
            return '', 200
            
        return jsonify({
            'success': True,
            'pushed': True,
            'branch': 'main'
        })
    
    @app.route('/api/status', methods=['GET', 'OPTIONS'])
    @cross_origin()
    def api_status():
        """Get API status"""
        if request.method == 'OPTIONS':
            return '', 200
            
        return jsonify({
            'status': 'healthy',
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'projects': len(projects),
            'tasks': len(tasks)
        })