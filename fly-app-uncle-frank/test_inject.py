#!/usr/bin/env python3
"""
Test script for command injection to Fly.io Claude instance
"""

import hmac
import hashlib
import requests
import json
import sys
import time

def sign_command(command: str, secret: str) -> str:
    """Generate HMAC signature for command"""
    return hmac.new(
        secret.encode(),
        command.encode(),
        hashlib.sha256
    ).hexdigest()

def inject_command(url: str, command: str, secret: str):
    """Send command to injection agent"""
    signature = sign_command(command, secret)
    
    response = requests.post(
        f"{url}/inject",
        json={
            "command": command,
            "signature": signature
        },
        timeout=10
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    return response.json()

def get_status(url: str):
    """Get current tmux session status"""
    response = requests.get(f"{url}/status", timeout=10)
    return response.json()

def main():
    # Configuration
    FLY_APP_URL = "https://uncle-frank-claude.fly.dev"
    HMAC_SECRET = "your-hmac-secret-here"  # Must match env var on Fly.io
    
    if len(sys.argv) < 2:
        print("Usage: python test_inject.py <command>")
        print("Example: python test_inject.py 'echo Hello from remote!'")
        sys.exit(1)
    
    command = sys.argv[1]
    
    print(f"Injecting command: {command}")
    print("-" * 50)
    
    try:
        # Inject command
        result = inject_command(FLY_APP_URL, command, HMAC_SECRET)
        
        if result.get('success'):
            print("✓ Command injected successfully")
            
            # Wait a moment for command to execute
            time.sleep(2)
            
            # Get session status to see output
            print("\nSession status:")
            status = get_status(FLY_APP_URL)
            if status.get('current_output'):
                print("Recent output:")
                print(status['current_output'])
        else:
            print(f"✗ Injection failed: {result.get('message')}")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()