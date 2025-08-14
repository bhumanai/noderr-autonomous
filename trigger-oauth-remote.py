#!/usr/bin/env python3
"""
Trigger OAuth Authentication on Remote Fly.io
This starts the OAuth flow and helps you complete it
"""

import requests
import time
import hmac
import hashlib
import json
import webbrowser
from datetime import datetime

# Configuration
FLY_ENDPOINT = "https://uncle-frank-claude.fly.dev"
HMAC_SECRET = "test-secret-change-in-production"

def sign_command(command):
    """Generate HMAC signature"""
    return hmac.new(
        HMAC_SECRET.encode(),
        command.encode(),
        hashlib.sha256
    ).hexdigest()

def start_oauth_flow():
    """Start Claude OAuth flow on Fly.io"""
    
    print("\n" + "="*70)
    print("🔐 CLAUDE OAUTH AUTHENTICATION")
    print("="*70)
    print("This will authenticate Claude on Fly.io\n")
    
    # Step 1: Trigger OAuth login
    print("Step 1: Starting OAuth flow on Fly.io...")
    
    # Send command to start OAuth
    command = "claude login"
    signature = sign_command(command)
    
    try:
        response = requests.post(
            f"{FLY_ENDPOINT}/inject",
            json={"command": command, "signature": signature},
            timeout=30
        )
        
        if response.ok:
            print("   ✅ OAuth flow started on server")
        else:
            print(f"   ❌ Failed to start: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Step 2: Wait and select authentication method
    print("\nStep 2: Selecting authentication method...")
    time.sleep(3)
    
    # Send "1" to select Claude subscription login
    command = "1"
    signature = sign_command(command)
    
    response = requests.post(
        f"{FLY_ENDPOINT}/inject",
        json={"command": command, "signature": signature}
    )
    
    if response.ok:
        print("   ✅ Selected Claude subscription login")
    
    # Step 3: Get the OAuth URL
    print("\nStep 3: Getting OAuth URL...")
    time.sleep(3)
    
    # Try to capture the output to find URL
    print("\n" + "="*70)
    print("MANUAL STEPS REQUIRED:")
    print("="*70)
    
    # The URL should be something like:
    oauth_url = "https://claude.ai/login?return_to=%2Fapi%2Fauth%2Foauth%2Fauthorize"
    
    print("\n1. Visit this URL in your browser:")
    print(f"   {oauth_url}")
    print("\n2. Login to Claude with your account")
    print("\n3. After login, you'll see an authorization code")
    print("\n4. Copy that code")
    
    # Step 4: Get code from user
    print("\n" + "="*70)
    auth_code = input("Paste your authorization code here: ").strip()
    
    if not auth_code:
        print("❌ No code provided")
        return False
    
    # Step 5: Send code to Fly.io
    print(f"\nStep 5: Sending code to server...")
    
    signature = sign_command(auth_code)
    response = requests.post(
        f"{FLY_ENDPOINT}/inject",
        json={"command": auth_code, "signature": signature}
    )
    
    if response.ok:
        print("   ✅ Code sent to server")
    else:
        print(f"   ❌ Failed to send code: {response.status_code}")
        return False
    
    # Step 6: Verify authentication
    print("\nStep 6: Verifying authentication...")
    time.sleep(5)
    
    # Check if Claude is now authenticated
    response = requests.get(f"{FLY_ENDPOINT}/health")
    if response.ok:
        data = response.json()
        if data.get('claude_session'):
            print("   ✅ Claude is authenticated!")
            return True
        else:
            print("   ⚠️ Authentication may still be processing...")
    
    return False

def test_authenticated_claude():
    """Test if Claude is working"""
    
    print("\n" + "="*70)
    print("TESTING CLAUDE")
    print("="*70)
    
    command = "echo 'Claude is authenticated and working!'"
    signature = sign_command(command)
    
    response = requests.post(
        f"{FLY_ENDPOINT}/inject",
        json={"command": command, "signature": signature}
    )
    
    if response.ok:
        print("✅ Command sent successfully")
        
        time.sleep(3)
        
        response = requests.get(f"{FLY_ENDPOINT}/status")
        if response.ok:
            data = response.json()
            output = data.get('current_output', '')
            if output:
                print(f"Claude output: {output[:200]}")
                return True
    
    return False

def main():
    print("\n" + "🔐"*35)
    print("CLAUDE OAUTH AUTHENTICATION TOOL")
    print("🔐"*35)
    print(f"Target: {FLY_ENDPOINT}")
    print(f"Time: {datetime.now().isoformat()}")
    
    # Check current status
    print("\nChecking current status...")
    response = requests.get(f"{FLY_ENDPOINT}/health")
    if response.ok:
        data = response.json()
        if data.get('claude_session'):
            print("✅ Claude is already authenticated!")
            
            if test_authenticated_claude():
                print("\n🎉 Claude is working perfectly!")
            return
        else:
            print("❌ Claude is not authenticated")
    
    # Start OAuth flow
    print("\nStarting OAuth authentication...")
    
    if start_oauth_flow():
        print("\n" + "="*70)
        print("🎉 SUCCESS!")
        print("="*70)
        print("Claude is now authenticated on Fly.io!")
        print("\nYou can now send commands via the API")
        
        # Test it
        test_authenticated_claude()
    else:
        print("\n" + "="*70)
        print("❌ AUTHENTICATION FAILED")
        print("="*70)
        print("\nTroubleshooting:")
        print("1. Make sure you have a Claude subscription")
        print("2. Try visiting: https://claude.ai/login")
        print("3. Check Fly.io logs: fly logs --app uncle-frank-claude")

if __name__ == "__main__":
    main()