#!/usr/bin/env python3
"""
Local Development Server for Noderr System
Runs the entire system locally without requiring deployment credentials
"""

import os
import json
import subprocess
import time
import threading
import logging
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import socketserver
import signal
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NoderrLocalServer:
    def __init__(self):
        self.ui_port = 8080
        self.api_port = 8081
        self.mock_fly_port = 8082
        self.servers = []
        self.threads = []
        
    def start(self):
        """Start all local servers"""
        logger.info("Starting Noderr Local Development Environment...")
        
        # Start UI server
        self.start_ui_server()
        
        # Start mock API server
        self.start_api_server()
        
        # Start mock Fly.io server
        self.start_mock_fly_server()
        
        logger.info("=" * 60)
        logger.info("Noderr Local Development Environment Running!")
        logger.info("=" * 60)
        logger.info(f"UI Dashboard: http://localhost:{self.ui_port}")
        logger.info(f"API Server: http://localhost:{self.api_port}")
        logger.info(f"Mock Fly.io: http://localhost:{self.mock_fly_port}")
        logger.info("=" * 60)
        logger.info("Press Ctrl+C to stop all servers")
        
        try:
            # Keep main thread alive
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()
    
    def start_ui_server(self):
        """Start the UI server"""
        def run_ui():
            os.chdir('docs')
            handler = SimpleHTTPRequestHandler
            with socketserver.TCPServer(("", self.ui_port), handler) as httpd:
                logger.info(f"UI Server running on port {self.ui_port}")
                self.servers.append(httpd)
                httpd.serve_forever()
        
        thread = threading.Thread(target=run_ui, daemon=True)
        thread.start()
        self.threads.append(thread)
        time.sleep(1)  # Give server time to start
    
    def start_api_server(self):
        """Start mock Cloudflare Worker API"""
        from http.server import BaseHTTPRequestHandler
        
        class APIHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                """Handle GET requests"""
                if self.path == '/api/status':
                    self.send_json({
                        'status': 'healthy',
                        'mode': 'local_development',
                        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
                        'queue_length': 0,
                        'tasks': []
                    })
                elif self.path == '/api/projects':
                    self.send_json([
                        {'id': 'demo-1', 'name': 'Demo Project', 'repo': 'demo/repo', 'branch': 'main'}
                    ])
                elif self.path.startswith('/api/tasks'):
                    self.send_json([
                        {
                            'id': 'task-1',
                            'description': 'Demo task',
                            'status': 'ready',
                            'projectId': 'demo-1'
                        }
                    ])
                elif self.path.startswith('/api/git/status'):
                    self.send_json({
                        'branch': 'main',
                        'modified': [],
                        'untracked': [],
                        'staged': []
                    })
                else:
                    self.send_404()
            
            def do_POST(self):
                """Handle POST requests"""
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length) if content_length else b'{}'
                
                try:
                    data = json.loads(body)
                except:
                    data = {}
                
                if self.path == '/api/tasks':
                    # Create task
                    task = {
                        'id': f'task-{int(time.time())}',
                        'description': data.get('description', 'New task'),
                        'status': 'ready',
                        'projectId': data.get('projectId'),
                        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%S')
                    }
                    self.send_json(task, status=201)
                elif self.path.startswith('/api/tasks/') and self.path.endswith('/approve'):
                    # Approve task
                    self.send_json({
                        'success': True,
                        'message': 'Task approved (local mock)',
                        'commit': 'mock-commit-123'
                    })
                else:
                    self.send_json({'success': True})
            
            def do_OPTIONS(self):
                """Handle CORS preflight"""
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
            
            def send_json(self, data, status=200):
                """Send JSON response"""
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            
            def send_404(self):
                """Send 404 response"""
                self.send_response(404)
                self.end_headers()
            
            def log_message(self, format, *args):
                """Suppress default logging"""
                pass
        
        def run_api():
            with HTTPServer(('', self.api_port), APIHandler) as httpd:
                logger.info(f"API Server running on port {self.api_port}")
                self.servers.append(httpd)
                httpd.serve_forever()
        
        thread = threading.Thread(target=run_api, daemon=True)
        thread.start()
        self.threads.append(thread)
        time.sleep(1)
    
    def start_mock_fly_server(self):
        """Start mock Fly.io server"""
        from http.server import BaseHTTPRequestHandler
        
        class FlyHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/health':
                    self.send_json({
                        'status': 'healthy',
                        'claude_session': True,
                        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
                    })
                elif self.path.startswith('/git/status'):
                    self.send_json({
                        'success': True,
                        'branch': 'main',
                        'modified': ['demo.js'],
                        'untracked': []
                    })
                else:
                    self.send_404()
            
            def do_POST(self):
                if self.path == '/inject':
                    self.send_json({'success': True, 'message': 'Command injected (mock)'})
                elif self.path.startswith('/git/'):
                    self.send_json({'success': True, 'message': 'Git operation completed (mock)'})
                else:
                    self.send_404()
            
            def send_json(self, data, status=200):
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            
            def send_404(self):
                self.send_response(404)
                self.end_headers()
            
            def log_message(self, format, *args):
                pass
        
        def run_fly():
            with HTTPServer(('', self.mock_fly_port), FlyHandler) as httpd:
                logger.info(f"Mock Fly.io Server running on port {self.mock_fly_port}")
                self.servers.append(httpd)
                httpd.serve_forever()
        
        thread = threading.Thread(target=run_fly, daemon=True)
        thread.start()
        self.threads.append(thread)
        time.sleep(1)
    
    def stop(self):
        """Stop all servers"""
        logger.info("\nShutting down servers...")
        for server in self.servers:
            try:
                server.shutdown()
            except:
                pass
        logger.info("Local development environment stopped.")
        sys.exit(0)

def update_ui_config():
    """Update UI configuration for local development"""
    config_content = """// Local Development Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:8081',
    FALLBACK_API: 'http://localhost:8082',
    SSE_ENDPOINT: 'http://localhost:8081/api/sse',
    ENVIRONMENT: 'local',
    FEATURES: {
        GIT_INTEGRATION: true,
        AUTO_COMMIT: false,  // Disabled in local mode
        REAL_TIME_UPDATES: false  // SSE disabled in local mode
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
"""
    
    # Update the config file
    with open('docs/deploy-config.js', 'w') as f:
        f.write(config_content)
    logger.info("Updated UI configuration for local development")

def main():
    """Main entry point"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║          Noderr Local Development Environment                ║
║                                                              ║
║  This will start a complete local environment including:     ║
║  • UI Dashboard (port 8080)                                 ║
║  • Mock API Server (port 8081)                              ║
║  • Mock Fly.io Server (port 8082)                           ║
║                                                              ║
║  No deployment credentials required!                         ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    # Check if docs directory exists
    if not os.path.exists('docs'):
        logger.error("Error: docs/ directory not found. Please run from the repo root.")
        sys.exit(1)
    
    # Update configuration for local mode
    update_ui_config()
    
    # Start the server
    server = NoderrLocalServer()
    
    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, lambda s, f: server.stop())
    
    # Start all services
    server.start()

if __name__ == "__main__":
    main()