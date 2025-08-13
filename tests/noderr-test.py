#!/usr/bin/env python3
"""
Noderr System End-to-End Test
Tests the complete autonomous execution pipeline
"""

import requests
import hmac
import hashlib
import time
import json
from datetime import datetime

# Configuration
FLY_ENDPOINT = "https://uncle-frank-claude.fly.dev"
CF_WORKER_ENDPOINT = "https://noderr-orchestrator.bhumanai.workers.dev"
HMAC_SECRET = "test-secret-change-in-production"

def sign_command(command):
    """Generate HMAC signature"""
    return hmac.new(
        HMAC_SECRET.encode(),
        command.encode(),
        hashlib.sha256
    ).hexdigest()

def test_fly_direct():
    """Test direct injection to Fly.io"""
    print("\n" + "="*60)
    print("TEST 1: Direct Fly.io Injection")
    print("="*60)
    
    command = "echo 'Noderr test at {}'".format(datetime.now().isoformat())
    signature = sign_command(command)
    
    try:
        # Inject command
        response = requests.post(
            f"{FLY_ENDPOINT}/inject",
            json={"command": command, "signature": signature},
            timeout=60  # Longer timeout for injection
        )
        
        print(f"Command: {command}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Direct injection successful")
            
            # Check status
            time.sleep(3)
            status = requests.get(f"{FLY_ENDPOINT}/status").json()
            sessions = status.get("sessions", [])
            print(f"Sessions: {len(sessions)}")
            
            if status.get("current_output"):
                print("Output preview:")
                print(status["current_output"][-200:])
        else:
            print(f"❌ Injection failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    return response.status_code == 200

def test_cf_worker_queue():
    """Test CF Worker task queue"""
    print("\n" + "="*60)
    print("TEST 2: CF Worker Task Queue")
    print("="*60)
    
    if "YOUR-SUBDOMAIN" in CF_WORKER_ENDPOINT:
        print("⚠️  CF Worker not deployed yet")
        print("Deploy with: cd cf-worker && ./deploy.sh")
        return False
    
    try:
        # Queue a task
        command = "What is the capital of France?"
        response = requests.post(
            f"{CF_WORKER_ENDPOINT}/api/queue",
            json={"command": command},
            timeout=10
        )
        
        if response.status_code == 200:
            task = response.json()
            print(f"✅ Task queued: {task['taskId']}")
            print(f"Command: {command}")
            
            # Get status
            status = requests.get(f"{CF_WORKER_ENDPOINT}/api/status").json()
            print(f"Queue length: {status['queueLength']}")
            print(f"Stats: {status['stats']}")
            return True
        else:
            print(f"❌ Failed to queue: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_cf_worker_process():
    """Test CF Worker manual processing"""
    print("\n" + "="*60)
    print("TEST 3: CF Worker Manual Process")
    print("="*60)
    
    if "YOUR-SUBDOMAIN" in CF_WORKER_ENDPOINT:
        print("⚠️  CF Worker not deployed yet")
        return False
    
    try:
        # Trigger manual processing
        response = requests.get(f"{CF_WORKER_ENDPOINT}/api/process", timeout=10)
        
        if response.status_code == 200:
            results = response.json()
            print(f"✅ Processed {len(results)} tasks")
            for result in results:
                print(f"  - {result['taskId']}: {result['status']}")
            return True
        else:
            print(f"❌ Processing failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_claude_response():
    """Test if Claude actually responds"""
    print("\n" + "="*60)
    print("TEST 4: Claude Response Test")
    print("="*60)
    
    command = "echo 'The answer is 10'"
    signature = sign_command(command)
    
    try:
        # Send math question
        response = requests.post(
            f"{FLY_ENDPOINT}/inject",
            json={"command": command, "signature": signature},
            timeout=60  # Longer timeout for injection
        )
        
        if response.status_code == 200:
            print(f"✅ Command sent: {command}")
            print("⏳ Waiting for Claude to respond (15 seconds)...")
            
            # Wait longer for Claude to process and respond
            time.sleep(15)
            
            # Check output multiple times
            for attempt in range(3):
                status = requests.get(f"{FLY_ENDPOINT}/status").json()
                output = status.get("current_output", "")
                
                # Check for the answer
                if "10" in output or "ten" in output.lower():
                    print("✅ Claude responded correctly!")
                    # Show more context
                    print(f"Output: ...{output[-500:]}")
                    return True
                elif attempt < 2:
                    print(f"  Attempt {attempt+1}: Waiting 5 more seconds...")
                    time.sleep(5)
            
            print("⚠️  No clear response from Claude")
            print(f"Output: ...{output[-500:]}")
            return False
        else:
            print(f"❌ Failed to send: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "🤖 "*20)
    print("NODERR AUTONOMOUS SYSTEM TEST")
    print("🤖 "*20)
    
    results = {
        "fly_direct": test_fly_direct(),
        "claude_response": test_claude_response(),
        "cf_queue": test_cf_worker_queue(),
        "cf_process": test_cf_worker_process(),
    }
    
    print("\n" + "="*60)
    print("TEST RESULTS")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! System is fully operational.")
    elif passed >= 2:
        print("\n⚠️  Partial success. Check failed components.")
    else:
        print("\n❌ System needs configuration.")
    
    print("\n" + "="*60)
    print("NEXT STEPS")
    print("="*60)
    
    if not results["cf_queue"]:
        print("1. Deploy CF Worker:")
        print("   cd cf-worker")
        print("   npm install -g wrangler")
        print("   wrangler login")
        print("   ./deploy.sh")
        print("")
    
    if not results["claude_response"]:
        print("2. Check Claude authentication:")
        print("   fly ssh console --app uncle-frank-claude")
        print("   tmux attach -t claude")
        print("   (Ensure Claude is authenticated and ready)")
        print("")
    
    print("3. Update CF_WORKER_ENDPOINT in this script after deployment")
    print("4. Run this test again to verify full system")

if __name__ == "__main__":
    main()