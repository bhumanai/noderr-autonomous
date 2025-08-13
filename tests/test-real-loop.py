#!/usr/bin/env python3
"""
Test the real Noderr loop with actual Claude commands
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

def start_claude_session():
    """Start Claude session if not running"""
    print("\n1. Starting Claude session...")
    
    # First check if session exists
    response = requests.get(f"{FLY_ENDPOINT}/health")
    if response.ok:
        data = response.json()
        if data.get('claude_session'):
            print("   ✅ Claude session already running")
            return True
    
    # Start a new session by sending a simple command
    command = "echo 'Starting Claude session'"
    signature = sign_command(command)
    
    response = requests.post(
        f"{FLY_ENDPOINT}/inject",
        json={"command": command, "signature": signature}
    )
    
    if response.ok:
        print("   ✅ Session start command sent")
        time.sleep(10)  # Wait for session to initialize
        return True
    else:
        print(f"   ❌ Failed to start session: {response.status_code}")
        return False

def inject_noderr_loop_1a():
    """Send a real Noderr LOOP_1A prompt to Claude"""
    print("\n2. Sending Noderr LOOP_1A prompt to Claude...")
    
    command = """I need you to perform Noderr LOOP_1A. Analyze and propose a Change Set for: Add a simple /ping endpoint that returns 'pong'. 

Present the Change Set with affected NodeIDs and then PAUSE for orchestrator approval."""
    
    signature = sign_command(command)
    
    response = requests.post(
        f"{FLY_ENDPOINT}/inject",
        json={"command": command, "signature": signature}
    )
    
    if response.ok:
        print("   ✅ LOOP_1A prompt sent to Claude")
        return True
    else:
        print(f"   ❌ Failed to send prompt: {response.status_code}")
        return False

def wait_for_claude_response(timeout=60):
    """Wait for Claude to respond"""
    print(f"\n3. Waiting for Claude to complete LOOP_1A (max {timeout}s)...")
    
    start_time = time.time()
    last_output_len = 0
    
    while time.time() - start_time < timeout:
        response = requests.get(f"{FLY_ENDPOINT}/status")
        if response.ok:
            data = response.json()
            output = data.get('current_output', '')
            
            if output:
                current_len = len(output)
                if current_len > last_output_len:
                    print(f"   📝 Claude is responding... (+{current_len - last_output_len} chars)")
                    last_output_len = current_len
                    
                    # Check for completion markers
                    if "PAUSE" in output or "await" in output.lower():
                        print("   ✅ Claude completed LOOP_1A and is awaiting approval!")
                        return True, output
        
        time.sleep(5)
    
    return False, None

def trigger_orchestration():
    """Manually trigger orchestration to analyze and respond"""
    print("\n4. Triggering intelligent orchestration...")
    
    response = requests.get(f"{CF_WORKER}/api/orchestrate")
    
    if response.ok:
        result = response.json()
        
        if result and result.get('current_stage'):
            print(f"   ✅ Orchestration analysis:")
            print(f"      Stage: {result['current_stage']}")
            print(f"      Awaiting: {result.get('is_awaiting_instruction', False)}")
            print(f"      Next command: {result.get('next_command', 'none')[:100]}...")
            print(f"      Reasoning: {result.get('reasoning', 'none')}")
            
            if result.get('is_awaiting_instruction'):
                print("\n   🎯 Orchestrator should have sent the next command!")
                return True
        else:
            print("   ⚠️ No action needed according to orchestrator")
    else:
        print(f"   ❌ Orchestration failed: {response.status_code}")
    
    return False

def check_command_executed():
    """Check if the approval command was executed"""
    print("\n5. Checking if approval command was executed...")
    
    time.sleep(10)  # Wait for command to be processed
    
    response = requests.get(f"{FLY_ENDPOINT}/status")
    if response.ok:
        data = response.json()
        output = data.get('current_output', '')
        
        if output:
            # Look for signs of LOOP_1B starting
            if any(marker in output for marker in ["LOOP_1B", "LOOP 1B", "specs", "Approved", "proceed"]):
                print("   ✅ Command executed! Claude is proceeding to LOOP_1B")
                print(f"\n   Latest output snippet:")
                print(f"   {output[-500:]}")
                return True
            else:
                print("   ⚠️ No clear evidence of progression to LOOP_1B")
                print(f"   Current output tail: {output[-200:] if output else 'empty'}")
    
    return False

def main():
    print("\n" + "="*70)
    print("🔄 REAL NODERR LOOP EXECUTION TEST")
    print("="*70)
    print(f"Time: {datetime.now().isoformat()}")
    print("\nThis test will:")
    print("1. Start Claude session")
    print("2. Send a real LOOP_1A prompt")
    print("3. Wait for Claude to complete")
    print("4. Trigger orchestration")
    print("5. Verify automatic command execution")
    
    # Start Claude session
    if not start_claude_session():
        print("\n❌ Failed to start Claude session")
        return
    
    # Send LOOP_1A prompt
    if not inject_noderr_loop_1a():
        print("\n❌ Failed to send Noderr prompt")
        return
    
    # Wait for Claude to complete LOOP_1A
    completed, output = wait_for_claude_response(timeout=90)
    if not completed:
        print("\n❌ Claude didn't complete LOOP_1A in time")
        print("   Check Fly.io logs: fly logs -a uncle-frank-claude")
        return
    
    # Trigger orchestration
    orchestrated = trigger_orchestration()
    
    # Check if command was executed
    executed = check_command_executed()
    
    # Final verdict
    print("\n" + "="*70)
    print("📊 FINAL RESULTS")
    print("="*70)
    
    if orchestrated and executed:
        print("\n🎉 FULL AUTONOMOUS LOOP VERIFIED!")
        print("\nThe system successfully:")
        print("✅ Claude completed LOOP_1A")
        print("✅ Orchestrator detected completion")
        print("✅ Claude API analyzed the state")
        print("✅ Approval command was sent")
        print("✅ Claude proceeded to LOOP_1B")
        print("\n🚀 The Noderr autonomous loop is FULLY OPERATIONAL!")
    elif orchestrated:
        print("\n⚠️ Orchestration worked but command execution unclear")
        print("Check CF Worker logs: cd cf-worker && npx wrangler tail")
    else:
        print("\n❌ Orchestration didn't detect the completion")
        print("Possible issues:")
        print("- Completion monitor not running on Fly.io")
        print("- CF Worker not receiving notifications")
        print("- Claude API not analyzing correctly")

if __name__ == "__main__":
    main()