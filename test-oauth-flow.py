#!/usr/bin/env python3
"""
Test the OAuth UI Flow
"""

import requests
import time
import json

BASE_URL = "https://uncle-frank-claude.fly.dev"

def test_oauth_flow():
    print("=" * 60)
    print("TESTING OAUTH UI FLOW")
    print("=" * 60)
    
    # Test 1: Check if UI is accessible
    print("\n1. Testing OAuth UI...")
    try:
        response = requests.get(BASE_URL, timeout=10)
        if "Claude OAuth Setup" in response.text:
            print("   ✅ OAuth UI is accessible")
        else:
            print("   ❌ OAuth UI not found")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Test 2: Check OAuth handler
    print("\n2. Testing OAuth handler...")
    try:
        response = requests.get(f"{BASE_URL}/oauth/status", timeout=10)
        data = response.json()
        print(f"   Status: {data.get('status', 'unknown')}")
        
        if data.get('status') == 'authenticated':
            print("   ✅ Already authenticated!")
            return True
        else:
            print("   ⏳ Not authenticated yet")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Test 3: Start OAuth flow
    print("\n3. Starting OAuth flow...")
    try:
        response = requests.post(f"{BASE_URL}/oauth/start", 
                                json={}, 
                                timeout=30)
        data = response.json()
        
        if data.get('auth_url'):
            print(f"   ✅ OAuth URL generated!")
            print(f"   URL: {data['auth_url'][:50]}...")
            print("\n" + "="*60)
            print("MANUAL STEPS REQUIRED:")
            print("="*60)
            print(f"1. Visit: {BASE_URL}")
            print("2. Complete the OAuth flow in the UI")
            print("3. The system will be authenticated")
            return True
        else:
            print(f"   ⚠️ No URL generated yet")
            print(f"   Status: {data}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    return False

if __name__ == "__main__":
    success = test_oauth_flow()
    
    if success:
        print("\n✅ OAuth flow is working!")
        print(f"\nVisit {BASE_URL} to complete authentication")
    else:
        print("\n❌ OAuth flow needs attention")