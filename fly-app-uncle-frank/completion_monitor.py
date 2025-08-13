#!/usr/bin/env python3
"""
Simplified Completion Monitor for Noderr
Monitors Claude output changes and notifies CF Worker to orchestrate next steps
"""

import os
import subprocess
import time
import requests
import json
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any

# Configuration
CF_WORKER_URL = os.environ.get('CF_WORKER_URL', 'https://noderr-orchestrator.bhumanai.workers.dev')
SESSION_NAME = os.environ.get('SESSION_NAME', 'claude-code')
CHECK_INTERVAL = int(os.environ.get('CHECK_INTERVAL', '30'))  # seconds
NOTIFY_THRESHOLD = int(os.environ.get('NOTIFY_THRESHOLD', '500'))  # chars change

class CompletionMonitor:
    def __init__(self):
        self.last_output = ""
        self.last_output_hash = ""
        self.monitoring = True
        self.last_notification = time.time()
        
    def get_claude_output(self) -> Optional[str]:
        """Get current output from Claude tmux session"""
        try:
            # Try claude-user first
            result = subprocess.run([
                'sudo', '-u', 'claude-user', 'tmux', 'capture-pane',
                '-t', SESSION_NAME, '-p', '-S', '-200'  # Last 200 lines
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                return result.stdout
                
            # Fallback to root
            result = subprocess.run([
                'tmux', 'capture-pane', '-t', SESSION_NAME, '-p', '-S', '-200'
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                return result.stdout
                
        except Exception as e:
            print(f"Error getting output: {e}")
            
        return None
    
    def should_notify(self, output: str) -> bool:
        """Determine if we should notify the orchestrator"""
        if not output:
            return False
            
        # Calculate hash of current output
        current_hash = hashlib.sha256(output.encode()).hexdigest()
        
        # Don't notify if output hasn't changed
        if current_hash == self.last_output_hash:
            return False
            
        # Check if enough has changed
        if self.last_output:
            change_size = abs(len(output) - len(self.last_output))
            if change_size < NOTIFY_THRESHOLD:
                # Only notify if significant time has passed
                if time.time() - self.last_notification < 60:
                    return False
        
        return True
    
    def notify_orchestrator(self, output: str) -> bool:
        """Notify CF Worker to analyze and orchestrate"""
        try:
            # Send last 3000 chars of output for analysis
            payload = {
                "event": "output_change",
                "timestamp": datetime.now().isoformat(),
                "output_sample": output[-3000:] if output else "",
                "output_length": len(output) if output else 0,
                "source": "completion_monitor"
            }
            
            response = requests.post(
                f"{CF_WORKER_URL}/api/webhook",
                json=payload,
                timeout=10
            )
            
            if response.ok:
                result = response.json()
                print(f"✅ Orchestrator notified: {result.get('status', 'ok')}")
                self.last_notification = time.time()
                return True
            else:
                print(f"❌ Orchestrator returned {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Failed to notify orchestrator: {e}")
            return False
    
    def run(self):
        """Main monitoring loop"""
        print(f"🔍 Noderr Completion Monitor Started (Simplified)")
        print(f"   CF Worker: {CF_WORKER_URL}")
        print(f"   Session: {SESSION_NAME}")
        print(f"   Check interval: {CHECK_INTERVAL}s")
        print(f"   Notify threshold: {NOTIFY_THRESHOLD} chars")
        print("-" * 50)
        
        while self.monitoring:
            try:
                # Get current output
                output = self.get_claude_output()
                
                if output and self.should_notify(output):
                    print(f"\n📊 Output change detected (+{abs(len(output) - len(self.last_output))} chars)")
                    
                    # Notify orchestrator to analyze and decide
                    if self.notify_orchestrator(output):
                        print(f"   Orchestrator will analyze and determine next action")
                    
                    # Update tracking
                    self.last_output = output
                    self.last_output_hash = hashlib.sha256(output.encode()).hexdigest()
                
            except KeyboardInterrupt:
                print("\n⏹️ Monitoring stopped by user")
                break
            except Exception as e:
                print(f"❌ Monitor error: {e}")
                
            time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    monitor = CompletionMonitor()
    monitor.run()