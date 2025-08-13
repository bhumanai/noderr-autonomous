#!/usr/bin/env python3
"""
Simple test to verify the autonomous loop is working
"""

import requests
import time
import json

print("\n" + "="*60)
print("SIMPLE AUTONOMOUS LOOP TEST")
print("="*60)

# 1. Check CF Worker status
print("\n1. Checking CF Worker status...")
cf_status = requests.get("https://noderr-orchestrator.bhumanai.workers.dev/api/status", verify=False).json()
print(f"   Queue: {cf_status['queueLength']} tasks")
print(f"   Stats: {cf_status['stats']}")

# 2. Start a Noderr session
print("\n2. Starting Noderr session...")
response = requests.post("https://noderr-orchestrator.bhumanai.workers.dev/api/start-noderr", verify=False)
print(f"   Response: {response.json()['status']}")

# 3. Wait for activity
print("\n3. Waiting 30 seconds for autonomous activity...")
time.sleep(30)

# 4. Check for new tasks (triggered by completion monitor)
print("\n4. Checking for autonomous orchestration...")
new_status = requests.get("https://noderr-orchestrator.bhumanai.workers.dev/api/status", verify=False).json()

# Compare task counts
new_tasks = len([t for t in new_status['tasks'] if t.get('metadata', {}).get('triggered_by') == 'orchestrator'])
print(f"   Tasks triggered by orchestrator: {new_tasks}")

# Check the most recent tasks
print("\n5. Recent task activity:")
for task in new_status['tasks'][:5]:
    triggered_by = task.get('metadata', {}).get('triggered_by', 'manual')
    print(f"   - {task['status']} ({triggered_by}): {task['command'][:60]}...")

# Conclusion
if new_tasks > 0:
    print("\n✅ AUTONOMOUS LOOP IS WORKING!")
    print("   The system is automatically orchestrating based on Claude's output")
else:
    print("\n⚠️  No autonomous orchestration detected")
    print("   The completion monitor may not be triggering webhooks")

print("\n" + "="*60)