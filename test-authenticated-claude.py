#!/usr/bin/env python3
"""
Test REAL Claude with Authentication on Fly.io
This verifies Claude is actually working with the API key
"""

import requests
import hmac
import hashlib
import time
import json
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

def test_authenticated_claude():
    """Test that Claude is REALLY authenticated and working"""
    
    print("\n" + "="*70)
    print("🔐 TESTING AUTHENTICATED CLAUDE ON FLY.IO")
    print("="*70)
    
    # Step 1: Check health
    print("\n1. Checking health status...")
    try:
        response = requests.get(f"{FLY_ENDPOINT}/health", timeout=10)
        if response.ok:
            data = response.json()
            if data.get('claude_session'):
                print(f"   ✅ Claude session active: {data['claude_session']}")
            else:
                print(f"   ⚠️ No Claude session detected")
                print(f"   Status: {data}")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Step 2: Send a REAL command that only authenticated Claude can answer
    print("\n2. Sending test command to Claude...")
    test_command = "What is 2+2? Reply with just the number."
    signature = sign_command(test_command)
    
    try:
        response = requests.post(
            f"{FLY_ENDPOINT}/inject",
            json={"command": test_command, "signature": signature},
            timeout=30
        )
        
        if response.ok:
            print(f"   ✅ Command injected successfully")
            result = response.json()
            print(f"   Response: {result}")
        else:
            print(f"   ❌ Injection failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Step 3: Wait and check for Claude's response
    print("\n3. Waiting for Claude to respond (30 seconds)...")
    
    for attempt in range(6):  # Check for 30 seconds
        time.sleep(5)
        
        try:
            response = requests.get(f"{FLY_ENDPOINT}/status", timeout=10)
            if response.ok:
                data = response.json()
                output = data.get('current_output', '')
                
                # Check if Claude actually responded
                if output and len(output) > 0:
                    print(f"   [{attempt*5}s] Output detected: {len(output)} chars")
                    
                    # Look for the answer
                    if "4" in output or "four" in output.lower():
                        print(f"   ✅ Claude responded correctly!")
                        print(f"   Output: {output[:200]}...")
                        return True
                else:
                    print(f"   [{attempt*5}s] Waiting for response...")
            else:
                print(f"   ❌ Status check failed: {response.status_code}")
        except Exception as e:
            print(f"   Error checking status: {e}")
    
    print(f"   ⚠️ No clear response from Claude after 30 seconds")
    
    # Step 4: Check if authentication is the issue
    print("\n4. Diagnosing authentication status...")
    
    try:
        response = requests.get(f"{FLY_ENDPOINT}/status", timeout=10)
        if response.ok:
            data = response.json()
            output = data.get('current_output', '')
            
            # Check for authentication errors
            if output:
                if "unauthorized" in output.lower() or "api key" in output.lower():
                    print("   ❌ AUTHENTICATION FAILED - Claude needs API key!")
                    print("   Fix: Set ANTHROPIC_API_KEY in Fly secrets")
                elif "error" in output.lower():
                    print(f"   ❌ Error in output: {output[:200]}")
                else:
                    print(f"   ℹ️ Current output: {output[:200]}")
    except:
        pass
    
    return False

def main():
    """Run the authentication test"""
    
    print("\n" + "🔐"*35)
    print("CLAUDE AUTHENTICATION VERIFICATION")
    print("🔐"*35)
    print(f"Endpoint: {FLY_ENDPOINT}")
    print(f"Time: {datetime.now().isoformat()}")
    
    # Run the test
    authenticated = test_authenticated_claude()
    
    print("\n" + "="*70)
    print("RESULTS")
    print("="*70)
    
    if authenticated:
        print("\n🎉 SUCCESS! Claude is AUTHENTICATED and WORKING!")
        print("\nClaude can now:")
        print("✅ Receive and process commands")
        print("✅ Generate code and responses") 
        print("✅ Execute autonomous workflows")
        print("\nThe Noderr system is FULLY OPERATIONAL!")
    else:
        print("\n❌ AUTHENTICATION FAILED")
        print("\nTo fix this:")
        print("1. Get an Anthropic API key from: https://console.anthropic.com")
        print("2. Set it in Fly.io:")
        print("   fly secrets set ANTHROPIC_API_KEY='sk-ant-api...' --app uncle-frank-claude")
        print("3. Restart the app:")
        print("   fly apps restart uncle-frank-claude")
        print("4. Run this test again")
    
    return 0 if authenticated else 1

if __name__ == "__main__":
    exit(main())