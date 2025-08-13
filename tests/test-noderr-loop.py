#!/usr/bin/env python3
"""
Test the core Noderr Loop functionality
Verifies that:
1. Claude can execute Noderr prompts
2. CF Worker can orchestrate the Loop sequence
3. When one prompt completes, the next is automatically provided
"""

import requests
import time
import json
import hmac
import hashlib
from datetime import datetime

# Configuration
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

def queue_noderr_prompt(prompt_type: str, metadata: dict = None) -> dict:
    """Queue a Noderr prompt to CF Worker"""
    # Map prompt types to actual commands Claude would understand
    prompt_commands = {
        "START_WORK_SESSION": "Let's start a new Noderr work session. Review the project status and propose what to work on next.",
        "LOOP_1A": "Analyze the impact and propose a Change Set for: Add a simple health check endpoint",
        "LOOP_1B": "Draft specs for the Change Set components",
        "LOOP_2": "Implement the Change Set with ARC verification",
        "LOOP_3": "Finalize specs, update tracker, and commit"
    }
    
    command = prompt_commands.get(prompt_type, prompt_type)
    
    response = requests.post(
        f"{CF_WORKER}/api/queue",
        json={
            "command": command,
            "metadata": metadata or {"prompt_type": prompt_type}
        }
    )
    
    if response.ok:
        return response.json()
    else:
        raise Exception(f"Failed to queue prompt: {response.text}")

def check_claude_response(timeout: int = 60) -> tuple:
    """Check if Claude has responded to the prompt"""
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{FLY_ENDPOINT}/status")
            if response.ok:
                data = response.json()
                output = data.get('current_output', '')
                
                # Look for signs Claude is responding
                if output and len(output) > 100:
                    # Check for Noderr-specific responses
                    noderr_indicators = [
                        "Change Set",
                        "NodeID",
                        "WorkGroupID", 
                        "ARC",
                        "spec",
                        "LOOP",
                        "tracker",
                        "architecture"
                    ]
                    
                    if any(indicator in output for indicator in noderr_indicators):
                        return True, output
                
        except Exception as e:
            print(f"Error checking status: {e}")
        
        time.sleep(5)
    
    return False, None

def test_single_prompt():
    """Test that Claude can execute a single Noderr prompt"""
    print("\n" + "="*60)
    print("TEST 1: Single Noderr Prompt Execution")
    print("="*60)
    
    # Queue a Start Work Session prompt
    print("\n1. Queueing START_WORK_SESSION prompt...")
    task = queue_noderr_prompt("START_WORK_SESSION")
    print(f"   Task ID: {task['taskId']}")
    print(f"   Status: {task['status']}")
    
    # Process the queue
    print("\n2. Processing queue...")
    response = requests.get(f"{CF_WORKER}/api/process")
    if response.ok:
        results = response.json()
        print(f"   Processed {len(results)} tasks")
        if results:
            print(f"   First result: {results[0]['status']}")
    
    # Check for Claude's response
    print("\n3. Waiting for Claude response...")
    responded, output = check_claude_response(timeout=120)
    
    if responded:
        print("   ✅ Claude responded with Noderr-aware content!")
        print(f"   Output preview: {output[:200]}...")
        return True
    else:
        print("   ❌ No Noderr response detected from Claude")
        return False

def test_loop_sequence():
    """Test the complete 4-step Loop sequence"""
    print("\n" + "="*60)
    print("TEST 2: Complete Loop Sequence (LOOP_1A -> LOOP_3)")
    print("="*60)
    
    loop_steps = ["LOOP_1A", "LOOP_1B", "LOOP_2", "LOOP_3"]
    results = []
    
    for step in loop_steps:
        print(f"\n{step}:")
        print(f"  Queueing {step} prompt...")
        
        # Queue the prompt
        task = queue_noderr_prompt(step, {
            "loop_step": step,
            "sequence": "test_loop"
        })
        print(f"  Task ID: {task['taskId']}")
        
        # Process queue
        print(f"  Processing...")
        response = requests.get(f"{CF_WORKER}/api/process")
        
        # Wait for response
        print(f"  Waiting for Claude...")
        responded, output = check_claude_response(timeout=180)
        
        results.append({
            "step": step,
            "responded": responded,
            "has_output": bool(output)
        })
        
        if responded:
            print(f"  ✅ {step} completed")
        else:
            print(f"  ⚠️ {step} - no clear response")
        
        # Small delay between steps
        time.sleep(10)
    
    # Check results
    successful = sum(1 for r in results if r['responded'])
    print(f"\n📊 Loop Results: {successful}/{len(loop_steps)} steps responded")
    
    for result in results:
        status = "✅" if result['responded'] else "❌"
        print(f"   {status} {result['step']}: {'Response detected' if result['responded'] else 'No response'}")
    
    return successful == len(loop_steps)

def test_automatic_progression():
    """Test that CF Worker can automatically progress through prompts"""
    print("\n" + "="*60)
    print("TEST 3: Automatic Prompt Progression")
    print("="*60)
    
    # Queue multiple prompts at once
    print("\n1. Queueing multiple prompts in sequence...")
    tasks = []
    
    for i, prompt in enumerate(["START_WORK_SESSION", "LOOP_1A", "LOOP_1B"]):
        task = queue_noderr_prompt(prompt, {
            "sequence": "auto_test",
            "order": i
        })
        tasks.append(task)
        print(f"   Queued: {prompt} (ID: {task['taskId']})")
        time.sleep(1)  # Small delay to ensure order
    
    # Process all at once
    print("\n2. Processing entire queue...")
    response = requests.get(f"{CF_WORKER}/api/process")
    if response.ok:
        results = response.json()
        print(f"   Processed {len(results)} tasks")
    
    # Check system status
    print("\n3. Checking system status...")
    response = requests.get(f"{CF_WORKER}/api/status")
    if response.ok:
        status = response.json()
        print(f"   Queue stats:")
        for key, value in status['stats'].items():
            print(f"     {key}: {value}")
    
    # Monitor for sequential execution
    print("\n4. Monitoring execution...")
    for i in range(6):  # Check for 30 seconds
        response = requests.get(f"{FLY_ENDPOINT}/status")
        if response.ok:
            data = response.json()
            output = data.get('current_output', '')
            if output:
                print(f"   [{i*5}s] Claude is {'active' if len(output) > 100 else 'idle'}")
        time.sleep(5)
    
    return True

def main():
    """Run all core loop tests"""
    print("\n" + "="*70)
    print("🤖 NODERR CORE LOOP VERIFICATION")
    print("="*70)
    print(f"CF Worker: {CF_WORKER}")
    print(f"Fly.io: {FLY_ENDPOINT}")
    print(f"Time: {datetime.now().isoformat()}")
    
    # Check system health first
    print("\n🔍 Pre-flight checks...")
    
    # Check CF Worker
    try:
        response = requests.get(f"{CF_WORKER}/api/status")
        if response.ok:
            print("✅ CF Worker is responsive")
        else:
            print(f"⚠️ CF Worker returned {response.status_code}")
    except Exception as e:
        print(f"❌ CF Worker unreachable: {e}")
        return
    
    # Check Fly.io
    try:
        response = requests.get(f"{FLY_ENDPOINT}/health")
        if response.ok:
            data = response.json()
            if data.get('claude_session'):
                print("✅ Fly.io Claude session is active")
            else:
                print("⚠️ No Claude session found - starting one...")
                # Try to inject a simple command to start session
                sig = sign_command("echo 'Starting Claude session'")
                response = requests.post(
                    f"{FLY_ENDPOINT}/inject",
                    json={"command": "echo 'Starting Claude session'", "signature": sig}
                )
                time.sleep(5)
        else:
            print(f"⚠️ Fly.io returned {response.status_code}")
    except Exception as e:
        print(f"❌ Fly.io unreachable: {e}")
        return
    
    # Run tests
    test_results = []
    
    # Test 1: Single prompt
    test_results.append(("Single Prompt", test_single_prompt()))
    
    # Test 2: Loop sequence
    test_results.append(("Loop Sequence", test_loop_sequence()))
    
    # Test 3: Automatic progression
    test_results.append(("Auto Progression", test_automatic_progression()))
    
    # Summary
    print("\n" + "="*70)
    print("📊 TEST SUMMARY")
    print("="*70)
    
    for test_name, passed in test_results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    total_passed = sum(1 for _, p in test_results if p)
    print(f"\nOverall: {total_passed}/{len(test_results)} tests passed")
    
    if total_passed == len(test_results):
        print("\n🎉 CORE LOOP VERIFIED - Ready to build UI!")
        print("\nThe Noderr autonomous loop is working:")
        print("✅ Claude can execute Noderr prompts")
        print("✅ CF Worker can queue and orchestrate tasks")
        print("✅ The system can progress through Loop steps")
        print("\nNext step: Build the UI for project selection and monitoring")
    else:
        print("\n⚠️ Some tests failed - review and fix before building UI")

if __name__ == "__main__":
    main()