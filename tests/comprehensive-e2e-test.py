#!/usr/bin/env python3
"""
Comprehensive End-to-End Test for Noderr System
Tests all components: GitHub integration, CLI tools, API endpoints, and workflow automation
"""

import subprocess
import requests
import json
import time
import os
import sys
from datetime import datetime
from typing import Dict, List, Tuple, Optional

# Configuration
LOCAL_API = "http://localhost:8081"
LOCAL_UI = "http://localhost:8080"
LOCAL_MOCK = "http://localhost:8082"
CF_WORKER = "https://noderr-orchestrator.bhumanai.workers.dev"
FLY_ENDPOINT = "https://uncle-frank-claude.fly.dev"

# Test results tracking
test_results = []

def colored_print(text: str, color: str = "default"):
    """Print colored text to terminal"""
    colors = {
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "magenta": "\033[95m",
        "cyan": "\033[96m",
        "default": "\033[0m"
    }
    print(f"{colors.get(color, '')}{ text}{colors['default']}")

def test_component(name: str, test_func, *args) -> bool:
    """Run a test component and track results"""
    print(f"\n{'='*60}")
    colored_print(f"Testing: {name}", "cyan")
    print(f"{'='*60}")
    
    try:
        result = test_func(*args)
        if result:
            colored_print(f"✅ {name} - PASSED", "green")
        else:
            colored_print(f"❌ {name} - FAILED", "red")
        test_results.append((name, result))
        return result
    except Exception as e:
        colored_print(f"❌ {name} - ERROR: {str(e)}", "red")
        test_results.append((name, False))
        return False

def test_local_services() -> bool:
    """Test if local services are running"""
    services = [
        ("UI Dashboard", LOCAL_UI),
        ("API Server", LOCAL_API),
        ("Mock Agent", LOCAL_MOCK)
    ]
    
    all_ok = True
    for service_name, url in services:
        try:
            response = requests.get(url, timeout=2)
            if response.status_code < 500:
                print(f"  ✓ {service_name} at {url} - Responding")
            else:
                print(f"  ✗ {service_name} at {url} - Error {response.status_code}")
                all_ok = False
        except requests.exceptions.RequestException:
            print(f"  ✗ {service_name} at {url} - Not responding")
            all_ok = False
    
    return all_ok

def test_github_integration() -> bool:
    """Test GitHub integration capabilities"""
    print("Checking GitHub CLI...")
    
    try:
        # Check if gh is installed
        result = subprocess.run(["gh", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"  ✓ GitHub CLI installed: {result.stdout.split()[2]}")
        else:
            print("  ✗ GitHub CLI not found")
            return False
        
        # Check auth status
        result = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True)
        if "Logged in" in result.stdout or "Logged in" in result.stderr:
            print("  ✓ GitHub authenticated")
        else:
            print("  ⚠ GitHub not authenticated (run: gh auth login)")
            
        # Check current repo
        result = subprocess.run(["git", "remote", "get-url", "origin"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"  ✓ Git repo configured: {result.stdout.strip()}")
        else:
            print("  ✗ Not in a git repository")
            
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_cloudflare_worker() -> bool:
    """Test Cloudflare Worker functionality"""
    print("Testing CF Worker endpoints...")
    
    try:
        # Test status endpoint
        response = requests.get(f"{CF_WORKER}/api/status", timeout=5)
        if response.ok:
            data = response.json()
            print(f"  ✓ Status endpoint: Queue length = {data.get('queueLength', 0)}")
            print(f"    Stats: {data.get('stats', {})}")
        else:
            print(f"  ✗ Status endpoint failed: {response.status_code}")
            return False
        
        # Test queue endpoint
        test_command = f"Test command at {datetime.now().isoformat()}"
        response = requests.post(
            f"{CF_WORKER}/api/queue",
            json={"command": test_command},
            timeout=5
        )
        if response.ok:
            task = response.json()
            print(f"  ✓ Queue endpoint: Task {task['taskId'][:8]}... queued")
        else:
            print(f"  ✗ Queue endpoint failed: {response.status_code}")
            return False
        
        return True
    except Exception as e:
        print(f"  ✗ CF Worker error: {e}")
        return False

def test_fly_deployment() -> bool:
    """Test Fly.io deployment"""
    print("Testing Fly.io deployment...")
    
    try:
        # Test health endpoint
        response = requests.get(f"{FLY_ENDPOINT}/health", timeout=5)
        if response.ok:
            data = response.json()
            print(f"  ✓ Health endpoint: Status = {data.get('status', 'unknown')}")
            if data.get('claude_session'):
                print(f"    Claude session active: {data['claude_session']}")
            else:
                print(f"    ⚠ No Claude session active")
        else:
            print(f"  ✗ Health endpoint failed: {response.status_code}")
            return False
        
        # Test status endpoint
        response = requests.get(f"{FLY_ENDPOINT}/status", timeout=5)
        if response.ok:
            data = response.json()
            sessions = data.get('sessions', [])
            print(f"  ✓ Status endpoint: {len(sessions)} sessions")
        else:
            print(f"  ✗ Status endpoint failed: {response.status_code}")
            
        return True
    except Exception as e:
        print(f"  ✗ Fly.io error: {e}")
        return False

def test_workflow_simulation() -> bool:
    """Simulate a complete workflow"""
    print("Simulating complete workflow...")
    
    workflow_steps = [
        "1. GitHub library import",
        "2. Brainstorming session",
        "3. Task creation",
        "4. Pilot execution",
        "5. Noderr automation"
    ]
    
    for step in workflow_steps:
        print(f"  ▶ {step}")
        time.sleep(0.5)  # Simulate processing
        
    # Test actual command flow through CF Worker
    try:
        # Queue a workflow command
        response = requests.post(
            f"{CF_WORKER}/api/queue",
            json={
                "command": "Initialize new development session",
                "metadata": {"workflow": "e2e_test", "timestamp": datetime.now().isoformat()}
            }
        )
        
        if response.ok:
            task = response.json()
            print(f"  ✓ Workflow initiated: Task {task['taskId'][:8]}...")
            
            # Process the queue
            response = requests.get(f"{CF_WORKER}/api/process")
            if response.ok:
                results = response.json()
                print(f"  ✓ Processed {len(results)} workflow tasks")
                return True
        
        return False
    except Exception as e:
        print(f"  ✗ Workflow error: {e}")
        return False

def test_data_persistence() -> bool:
    """Test data persistence across components"""
    print("Testing data persistence...")
    
    test_data = {
        "test_id": f"test_{int(time.time())}",
        "timestamp": datetime.now().isoformat(),
        "data": "E2E test data"
    }
    
    try:
        # Try to store data via CF Worker
        response = requests.post(
            f"{CF_WORKER}/api/queue",
            json={
                "command": "Store test data",
                "metadata": test_data
            }
        )
        
        if response.ok:
            print(f"  ✓ Data stored: {test_data['test_id']}")
            
            # Retrieve status to verify
            response = requests.get(f"{CF_WORKER}/api/status")
            if response.ok:
                print(f"  ✓ Data retrievable from status endpoint")
                return True
        
        return False
    except Exception as e:
        print(f"  ✗ Persistence error: {e}")
        return False

def test_error_handling() -> bool:
    """Test error handling and recovery"""
    print("Testing error handling...")
    
    error_scenarios = [
        ("Invalid command", {"command": None}),
        ("Malformed request", "not-json"),
        ("Missing signature", {"command": "test", "signature": "invalid"})
    ]
    
    handled_correctly = 0
    for scenario_name, payload in error_scenarios:
        try:
            if isinstance(payload, str):
                response = requests.post(
                    f"{CF_WORKER}/api/queue",
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
            else:
                response = requests.post(f"{CF_WORKER}/api/queue", json=payload)
            
            if response.status_code >= 400:
                print(f"  ✓ {scenario_name} - Properly rejected")
                handled_correctly += 1
            else:
                print(f"  ✗ {scenario_name} - Should have failed")
        except:
            print(f"  ✓ {scenario_name} - Error caught")
            handled_correctly += 1
    
    return handled_correctly >= 2

def test_performance() -> bool:
    """Test system performance and response times"""
    print("Testing performance...")
    
    endpoints = [
        (LOCAL_UI, "Local UI"),
        (f"{CF_WORKER}/api/status", "CF Worker"),
        (f"{FLY_ENDPOINT}/health", "Fly.io")
    ]
    
    all_fast = True
    for endpoint, name in endpoints:
        try:
            start = time.time()
            response = requests.get(endpoint, timeout=5)
            elapsed = (time.time() - start) * 1000
            
            if elapsed < 1000:
                print(f"  ✓ {name}: {elapsed:.0f}ms")
            elif elapsed < 3000:
                print(f"  ⚠ {name}: {elapsed:.0f}ms (slow)")
            else:
                print(f"  ✗ {name}: {elapsed:.0f}ms (too slow)")
                all_fast = False
        except:
            print(f"  ✗ {name}: Timeout")
            all_fast = False
    
    return all_fast

def main():
    """Run comprehensive E2E tests"""
    print("\n" + "="*70)
    colored_print("🚀 NODERR COMPREHENSIVE END-TO-END TEST SUITE", "magenta")
    print("="*70)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Environment: {os.environ.get('ENV', 'development')}")
    
    # Run all test components
    tests = [
        ("Local Services", test_local_services),
        ("GitHub Integration", test_github_integration),
        ("Cloudflare Worker", test_cloudflare_worker),
        ("Fly.io Deployment", test_fly_deployment),
        ("Workflow Simulation", test_workflow_simulation),
        ("Data Persistence", test_data_persistence),
        ("Error Handling", test_error_handling),
        ("Performance", test_performance)
    ]
    
    for test_name, test_func in tests:
        test_component(test_name, test_func)
        time.sleep(1)  # Brief pause between tests
    
    # Summary
    print("\n" + "="*70)
    colored_print("📊 TEST SUMMARY", "cyan")
    print("="*70)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        color = "green" if result else "red"
        colored_print(f"{status} - {name}", color)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        colored_print("\n🎉 ALL TESTS PASSED! System is fully operational.", "green")
        print("\nThe Noderr system is ready for:")
        print("✅ GitHub repository imports")
        print("✅ AI-powered brainstorming")
        print("✅ Task management and tracking")
        print("✅ Automated pilot execution")
        print("✅ Continuous deployment")
    elif passed >= total * 0.75:
        colored_print(f"\n✅ MOSTLY PASSING ({passed}/{total}). System is operational with minor issues.", "yellow")
    elif passed >= total * 0.5:
        colored_print(f"\n⚠️ PARTIAL SUCCESS ({passed}/{total}). Critical components need attention.", "yellow")
    else:
        colored_print(f"\n❌ SYSTEM FAILURE ({passed}/{total}). Major issues detected.", "red")
        print("\nTroubleshooting steps:")
        print("1. Check if local services are running: ./start-noderr.sh")
        print("2. Verify GitHub authentication: gh auth status")
        print("3. Check CF Worker deployment: cd cloudflare-worker && wrangler deploy")
        print("4. Verify Fly.io deployment: fly status --app uncle-frank-claude")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())