#!/usr/bin/env python3
"""
Quick test to send '1+1=?' to Claude CLI on Fly.io
"""

import hmac
import hashlib
import requests
import json
import time
import os

def sign_command(command: str, secret: str) -> str:
    """Generate HMAC signature for command"""
    return hmac.new(
        secret.encode(),
        command.encode(),
        hashlib.sha256
    ).hexdigest()

def test_claude():
    # Configuration - using your Fly.io app
    FLY_APP_URL = "https://uncle-frank-claude.fly.dev"
    
    # We need to set a consistent HMAC secret
    # For testing, let's use a simple one (you should set this as a Fly secret)
    HMAC_SECRET = os.environ.get("HMAC_SECRET", "test-secret-change-in-production")
    
    print("=" * 60)
    print("Testing Command Injection to Claude CLI")
    print("=" * 60)
    
    # First, check if the service is running
    try:
        print("\n1. Checking service health...")
        health_response = requests.get(f"{FLY_APP_URL}/health", timeout=5)
        print(f"   Health check status: {health_response.status_code}")
        if health_response.status_code == 200:
            print(f"   Response: {health_response.json()}")
        else:
            print(f"   Service may not be running. Status: {health_response.status_code}")
            print("   You may need to deploy the Docker container first:")
            print("   cd fly-app && fly deploy")
            return
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Cannot connect to {FLY_APP_URL}")
        print(f"   Error: {e}")
        print("\n   The service doesn't appear to be deployed yet.")
        print("   To deploy:")
        print("   1. cd fly-app")
        print("   2. fly auth login")
        print("   3. fly deploy --app uncle-frank-claude")
        return
    
    # Check current status
    try:
        print("\n2. Getting current session status...")
        status_response = requests.get(f"{FLY_APP_URL}/status", timeout=5)
        if status_response.status_code == 200:
            status = status_response.json()
            print(f"   Sessions: {status.get('sessions', [])}")
            if status.get('current_output'):
                print(f"   Last output preview: ...{status['current_output'][-100:]}")
    except:
        print("   Status endpoint not available")
    
    # Now send the test command
    command = "1+1=?"
    print(f"\n3. Sending command: '{command}'")
    
    signature = sign_command(command, HMAC_SECRET)
    
    try:
        inject_response = requests.post(
            f"{FLY_APP_URL}/inject",
            json={
                "command": command,
                "signature": signature
            },
            timeout=10
        )
        
        print(f"   Injection status: {inject_response.status_code}")
        result = inject_response.json()
        
        if inject_response.status_code == 200:
            print(f"   ✓ {result.get('message', 'Command sent successfully')}")
        elif inject_response.status_code == 401:
            print(f"   ✗ Authentication failed - HMAC signature mismatch")
            print(f"   Make sure to set the HMAC_SECRET on Fly.io:")
            print(f"   fly secrets set HMAC_SECRET=\"{HMAC_SECRET}\" --app uncle-frank-claude")
        elif inject_response.status_code == 403:
            print(f"   ✗ IP not authorized")
        elif inject_response.status_code == 429:
            print(f"   ✗ Rate limit exceeded")
        else:
            print(f"   ✗ Error: {result}")
            
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Request failed: {e}")
        return
    
    # Wait for Claude to process
    if inject_response.status_code == 200:
        print("\n4. Waiting for Claude to respond...")
        time.sleep(3)
        
        # Get the output
        try:
            status_response = requests.get(f"{FLY_APP_URL}/status", timeout=5)
            if status_response.status_code == 200:
                status = status_response.json()
                if status.get('current_output'):
                    print("\n5. Claude's response (last 10 lines):")
                    print("-" * 40)
                    print(status['current_output'])
                    print("-" * 40)
                    
                    # Check if we can see the answer
                    if "2" in status['current_output']:
                        print("\n✓ SUCCESS! Claude answered the question!")
                    else:
                        print("\n⚠ Command was sent but answer not visible in output")
                        print("  Claude might need more time or the session might need initialization")
        except:
            print("   Could not retrieve output")

    print("\n" + "=" * 60)
    print("Test complete!")
    
    # Provide next steps
    if inject_response.status_code != 200:
        print("\nTo fix issues:")
        print("1. Make sure the app is deployed: fly deploy --app uncle-frank-claude")
        print("2. Set the HMAC secret: fly secrets set HMAC_SECRET=\"test-secret-change-in-production\"")
        print("3. Set Claude API key: fly secrets set CLAUDE_API_KEY=\"your-api-key-here\"")
        print("4. Check logs: fly logs --app uncle-frank-claude")

if __name__ == "__main__":
    test_claude()