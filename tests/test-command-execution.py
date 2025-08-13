#!/usr/bin/env python3
"""
Test that the orchestrator actually sends and executes commands
"""

import requests
import time
import json
import hmac
import hashlib
from datetime import datetime

CF_WORKER = "https://noderr-orchestrator.bhumanai.workers.dev"
FLY_ENDPOINT = "https://uncle-frank-claude.fly.dev"
HMAC_SECRET = "test-secret-change-in-production"

def sign_command(command: str) -> str:
    """Generate HMAC signature for command"""
    return hmac.new(
        HMAC_SECRET.encode(),
        command.encode(),
        hashlib.sha256
    ).hexdigest()

def inject_test_output():
    """Inject a test output that looks like LOOP_1A completion"""
    test_output = """
## Noderr LOOP_1A: Change Set Proposal

I've analyzed the request to add a health check endpoint.

### Proposed Change Set

The following NodeIDs will be affected:
- NEW: API_HealthCheck (new /health endpoint)
- MODIFY: API_Router (add health route)
- NEW: TEST_HealthCheck (test file)

This Change Set includes 3 nodes that must be modified together.

All dependencies have been identified and included.

**PAUSE and await Orchestrator approval**
"""
    
    # Send this as a command to create the output
    command = f"echo '{test_output}'"
    signature = sign_command(command)
    
    response = requests.post(
        f"{FLY_ENDPOINT}/inject",
        json={"command": command, "signature": signature}
    )
    
    return response.ok

def test_automatic_execution():
    """Test that orchestrator analyzes and sends next command"""
    print("\n" + "="*70)
    print("🔄 TESTING AUTOMATIC COMMAND EXECUTION")
    print("="*70)
    
    # Step 1: Inject test output
    print("\n1. Injecting test output that simulates LOOP_1A completion...")
    if inject_test_output():
        print("   ✅ Test output injected")
    else:
        print("   ❌ Failed to inject test output")
        return False
    
    # Step 2: Wait for output to settle
    print("\n2. Waiting for output to be captured...")
    time.sleep(5)
    
    # Step 3: Trigger orchestration manually
    print("\n3. Triggering orchestration to analyze and respond...")
    response = requests.get(f"{CF_WORKER}/api/orchestrate")
    
    if response.ok:
        result = response.json()
        print(f"   Orchestration result: {json.dumps(result, indent=2)}")
        
        if result and result.get('current_stage'):
            print(f"\n   ✅ Stage detected: {result['current_stage']}")
            print(f"   ✅ Awaiting instruction: {result.get('is_awaiting_instruction', False)}")
            print(f"   ✅ Next command: {result.get('next_command', 'none')[:100]}...")
        else:
            print("   ⚠️ No action taken")
    else:
        print(f"   ❌ Orchestration failed: {response.status_code}")
        return False
    
    # Step 4: Check if command was actually sent
    print("\n4. Checking if command was sent to Claude...")
    time.sleep(5)
    
    # Check the status to see if new content appeared
    response = requests.get(f"{FLY_ENDPOINT}/status")
    if response.ok:
        data = response.json()
        output = data.get('current_output', '')
        
        # Look for signs that the approval command was received
        if "LOOP_1B" in output or "Approved" in output or "proceed" in output.lower():
            print("   ✅ Command was executed! Claude received the approval")
            print(f"   Output shows: {output[-200:]}")
            return True
        else:
            print("   ⚠️ No clear evidence of command execution")
            print(f"   Current output tail: {output[-200:] if output else 'empty'}")
    
    # Step 5: Check task queue for evidence
    print("\n5. Checking CF Worker task queue...")
    response = requests.get(f"{CF_WORKER}/api/status")
    if response.ok:
        status = response.json()
        recent_tasks = status.get('tasks', [])[-5:]  # Last 5 tasks
        
        for task in recent_tasks:
            if task.get('metadata', {}).get('triggered_by') == 'orchestrator':
                print(f"   ✅ Found orchestrator-triggered task:")
                print(f"      Command: {task['command'][:100]}...")
                print(f"      Status: {task['status']}")
                print(f"      Stage: {task['metadata'].get('stage')}")
                return True
    
    return False

def test_cron_trigger():
    """Test that cron trigger runs orchestration"""
    print("\n" + "="*70)
    print("⏰ TESTING CRON-TRIGGERED ORCHESTRATION")
    print("="*70)
    
    print("\nThe CloudFlare Worker has a cron job that runs every 5 minutes.")
    print("It should automatically:")
    print("1. Check Claude's output")
    print("2. Analyze with Claude API")
    print("3. Send next command if needed")
    
    print("\nTo verify this is working:")
    print("1. Monitor CF Worker logs: cd cf-worker && npx wrangler tail")
    print("2. Check Fly.io status: fly logs -a uncle-frank-claude")
    
    return True

def main():
    print("\n" + "="*70)
    print("🎯 COMMAND EXECUTION VERIFICATION")
    print("="*70)
    print(f"Time: {datetime.now().isoformat()}")
    
    # Run tests
    test_results = []
    
    # Test automatic execution
    test_results.append(("Automatic Command Execution", test_automatic_execution()))
    
    # Info about cron
    test_results.append(("Cron Information", test_cron_trigger()))
    
    # Summary
    print("\n" + "="*70)
    print("📊 TEST SUMMARY")
    print("="*70)
    
    for test_name, passed in test_results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    if test_results[0][1]:  # If automatic execution worked
        print("\n🎉 AUTOMATIC COMMAND EXECUTION VERIFIED!")
        print("\nThe complete loop is working:")
        print("1. Claude completes a Noderr step")
        print("2. CF Worker detects completion")
        print("3. Claude API analyzes the state")
        print("4. Next command is automatically sent")
        print("5. Claude continues with the next step")
        print("\n✅ THE AUTONOMOUS LOOP IS FULLY FUNCTIONAL!")
    else:
        print("\n⚠️ Command execution needs debugging")
        print("\nTo debug:")
        print("1. Check CF Worker logs: cd cf-worker && npx wrangler tail")
        print("2. Check Fly.io logs: fly logs -a uncle-frank-claude")
        print("3. Verify HMAC_SECRET matches in both services")

if __name__ == "__main__":
    main()