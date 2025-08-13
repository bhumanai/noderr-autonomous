#!/usr/bin/env python3
"""
Test script for Git integration between Cloudflare Worker and Fly.io
Tests the actual Git operations through the Noderr system
"""

import requests
import json
import time
import sys

# Configuration
CLOUDFLARE_WORKER_URL = "https://noderr-orchestrator.terragonlabs.workers.dev"
FLY_APP_URL = "https://uncle-frank-claude.fly.dev"

def test_git_status():
    """Test getting git status through the API"""
    print("Testing Git Status...")
    response = requests.get(f"{CLOUDFLARE_WORKER_URL}/api/git/status")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Git Status: Branch={data.get('branch')}, Modified={len(data.get('modified', []))}, Untracked={len(data.get('untracked', []))}")
        return True
    else:
        print(f"✗ Git Status failed: {response.status_code} - {response.text}")
        return False

def test_git_diff():
    """Test getting git diff through the API"""
    print("\nTesting Git Diff...")
    
    # Create a test task to generate changes
    task_data = {
        "projectId": "test-project",
        "description": "Test task for git integration"
    }
    
    response = requests.post(f"{CLOUDFLARE_WORKER_URL}/api/tasks", json=task_data)
    if response.status_code != 201:
        print(f"✗ Failed to create test task: {response.status_code}")
        return False
    
    task = response.json()
    task_id = task['id']
    
    # Get changes for the task
    response = requests.get(f"{CLOUDFLARE_WORKER_URL}/api/tasks/{task_id}/changes")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Git Diff retrieved: {len(data.get('files', []))} files changed")
        if data.get('diff'):
            print(f"  Diff preview: {data['diff'][:100]}...")
        return True
    else:
        print(f"✗ Git Diff failed: {response.status_code} - {response.text}")
        return False

def test_git_commit():
    """Test creating a git commit through the API"""
    print("\nTesting Git Commit...")
    
    commit_data = {
        "projectId": "test-project",
        "taskId": "test-task-1",
        "message": "Test commit from Noderr integration test"
    }
    
    response = requests.post(f"{CLOUDFLARE_WORKER_URL}/api/git/commit", json=commit_data)
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print(f"✓ Git Commit created: {data.get('commit')}")
            print(f"  Message: {data.get('message')}")
            return True
        else:
            print(f"✗ Git Commit failed: {data.get('error')}")
            return False
    else:
        print(f"✗ Git Commit request failed: {response.status_code} - {response.text}")
        return False

def test_git_push():
    """Test pushing to remote through the API"""
    print("\nTesting Git Push...")
    
    push_data = {
        "projectId": "test-project",
        "branch": "main"
    }
    
    response = requests.post(f"{CLOUDFLARE_WORKER_URL}/api/git/push", json=push_data)
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print(f"✓ Git Push successful to branch: {data.get('branch')}")
            return True
        else:
            print(f"✗ Git Push failed: {data.get('error')}")
            return False
    else:
        print(f"✗ Git Push request failed: {response.status_code} - {response.text}")
        return False

def test_task_approval_flow():
    """Test the complete task approval flow with git operations"""
    print("\nTesting Complete Task Approval Flow...")
    
    # 1. Create a task
    print("  1. Creating task...")
    task_data = {
        "projectId": "test-project",
        "description": "Integration test task with git operations"
    }
    
    response = requests.post(f"{CLOUDFLARE_WORKER_URL}/api/tasks", json=task_data)
    if response.status_code != 201:
        print(f"  ✗ Failed to create task: {response.status_code}")
        return False
    
    task = response.json()
    task_id = task['id']
    print(f"  ✓ Task created: {task_id}")
    
    # 2. Update task status to review
    print("  2. Updating task to review status...")
    update_data = {
        "status": "review",
        "changes": "Added test functionality"
    }
    
    response = requests.patch(f"{CLOUDFLARE_WORKER_URL}/api/tasks/{task_id}", json=update_data)
    if response.status_code != 200:
        print(f"  ✗ Failed to update task: {response.status_code}")
        return False
    print("  ✓ Task updated to review status")
    
    # 3. Approve task (triggers commit and push)
    print("  3. Approving task (triggers git commit and push)...")
    approve_data = {
        "commitMessage": "Completed integration test task"
    }
    
    response = requests.post(f"{CLOUDFLARE_WORKER_URL}/api/tasks/{task_id}/approve", json=approve_data)
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            print(f"  ✓ Task approved and pushed!")
            print(f"    Commit: {data.get('commit')}")
            print(f"    Task status: {data.get('task', {}).get('status')}")
            return True
        else:
            print(f"  ✗ Task approval failed: {data.get('error')}")
            return False
    else:
        print(f"  ✗ Task approval request failed: {response.status_code} - {response.text}")
        return False

def test_fly_git_endpoints():
    """Test Fly.io git endpoints directly"""
    print("\nTesting Fly.io Git Endpoints Directly...")
    
    try:
        # Test git status endpoint
        response = requests.get(f"{FLY_APP_URL}/git/status?path=/workspace")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Fly.io Git Status: {data}")
        else:
            print(f"✗ Fly.io Git Status failed: {response.status_code}")
            return False
        
        return True
    except Exception as e:
        print(f"✗ Failed to connect to Fly.io: {e}")
        return False

def main():
    """Run all integration tests"""
    print("=" * 60)
    print("Noderr Git Integration Test Suite")
    print("=" * 60)
    
    tests = [
        ("Git Status", test_git_status),
        ("Git Diff", test_git_diff),
        ("Git Commit", test_git_commit),
        ("Git Push", test_git_push),
        ("Task Approval Flow", test_task_approval_flow),
        ("Fly.io Direct Endpoints", test_fly_git_endpoints)
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n✗ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())