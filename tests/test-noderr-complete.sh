#!/bin/bash

echo "🚀 NODERR COMPLETE SYSTEM TEST"
echo "=============================="
echo ""

API_URL="http://localhost:3000"
SUCCESS_COUNT=0
TOTAL_TESTS=8

test_pass() {
    echo "  ✅ $1"
    ((SUCCESS_COUNT++))
}

test_fail() {
    echo "  ❌ $1"
}

echo "1️⃣ Backend API Test"
if curl -s "$API_URL/api/status" | jq -r '.status' | grep -q "healthy"; then
    test_pass "Backend API is running"
else
    test_fail "Backend API not responding"
fi

echo ""
echo "2️⃣ Project Creation Test"
PROJECT=$(curl -s -X POST "$API_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "System Test",
    "repo": "https://github.com/tj/commander.js.git",
    "branch": "master"
  }')

PROJECT_ID=$(echo "$PROJECT" | jq -r '.id')
PROJECT_PATH=$(echo "$PROJECT" | jq -r '.localPath')

if [ -d "$PROJECT_PATH" ]; then
    test_pass "Project created and repo cloned"
    echo "     → Project: $PROJECT_ID"
    echo "     → Path: $PROJECT_PATH"
else
    test_fail "Project creation failed"
fi

echo ""
echo "3️⃣ Claude Brainstorming Test"
BRAINSTORM=$(curl -s -X POST "$API_URL/api/brainstorm/analyze" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Add logging middleware\",
    \"context\": {
      \"projectId\": \"$PROJECT_ID\"
    }
  }")

SESSION_ID=$(echo "$BRAINSTORM" | jq -r '.sessionId')
if [ "$SESSION_ID" != "null" ]; then
    test_pass "Claude brainstorm session started"
    echo "     → Session: $SESSION_ID"
else
    test_fail "Brainstorming failed"
fi

# Wait for brainstorming
sleep 3

echo ""
echo "4️⃣ Task Generation Test"
STATUS_CHECK=$(curl -s "$API_URL/api/brainstorm/sessions/$SESSION_ID/status")
STATUS=$(echo "$STATUS_CHECK" | jq -r '.status')
TASKS=$(echo "$STATUS_CHECK" | jq '.result.tasks')
TASK_COUNT=$(echo "$TASKS" | jq 'length')

if [ "$STATUS" = "completed" ] && [ "$TASK_COUNT" -gt 0 ]; then
    test_pass "Tasks generated: $TASK_COUNT tasks"
    echo "$TASKS" | jq -r '.[] | "     → " + .title + " (" + (.estimatedHours | tostring) + "h)"'
else
    test_fail "Task generation incomplete"
fi

echo ""
echo "5️⃣ Task Approval Test"
FIRST_TASK=$(echo "$TASKS" | jq '.[0]')
TASK_TITLE=$(echo "$FIRST_TASK" | jq -r '.title')
NEW_TASK=$(curl -s -X POST "$API_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"description\": \"$TASK_TITLE\",
    \"projectId\": \"$PROJECT_ID\",
    \"status\": \"backlog\"
  }")

TASK_ID=$(echo "$NEW_TASK" | jq -r '.id')
if [ "$TASK_ID" != "null" ]; then
    test_pass "Task added to backlog"
    echo "     → Task: $TASK_ID"
else
    test_fail "Task creation failed"
fi

echo ""
echo "6️⃣ Orchestrator Test"
echo "     Starting orchestrator for 5 seconds..."
timeout 5 ./orchestrator-loop.sh > /tmp/orch-test.log 2>&1 &
sleep 6

if grep -q "Found task" /tmp/orch-test.log; then
    test_pass "Orchestrator picked up task from backlog"
else
    test_fail "Orchestrator didn't pick up task"
fi

echo ""
echo "7️⃣ Executor Test"
EXECUTOR_COUNT=$(tmux list-sessions 2>/dev/null | grep -c "executor-" || echo "0")
if [ "$EXECUTOR_COUNT" -gt 0 ]; then
    test_pass "Executor spawned: $EXECUTOR_COUNT session(s)"
    tmux list-sessions 2>/dev/null | grep "executor-" | sed 's/^/     → /'
else
    test_fail "No executors spawned"
fi

echo ""
echo "8️⃣ Kanban Board Test"
TASK_STATUS=$(curl -s "$API_URL/api/tasks" | jq ".[] | select(.id == \"$TASK_ID\") | .status" -r)
if [ "$TASK_STATUS" = "review" ] || [ "$TASK_STATUS" = "working" ]; then
    test_pass "Task progressed from backlog to: $TASK_STATUS"
else
    test_fail "Task still in: $TASK_STATUS"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
tmux kill-server 2>/dev/null || true
curl -s -X DELETE "$API_URL/api/projects/$PROJECT_ID" > /dev/null
rm -f /tmp/orch-test.log

echo ""
echo "=============================="
echo "📊 TEST RESULTS"
echo "=============================="
echo ""

if [ "$SUCCESS_COUNT" -eq "$TOTAL_TESTS" ]; then
    echo "✅ ALL TESTS PASSED ($SUCCESS_COUNT/$TOTAL_TESTS)"
    echo ""
    echo "The Noderr system is FULLY OPERATIONAL!"
    echo ""
    echo "Complete flow verified:"
    echo "  1. Backend API ✓"
    echo "  2. Git cloning ✓"
    echo "  3. Claude brainstorming ✓"
    echo "  4. Task generation ✓"
    echo "  5. Task approval ✓"
    echo "  6. Orchestration ✓"
    echo "  7. Execution ✓"
    echo "  8. Status updates ✓"
else
    echo "⚠️ PARTIAL SUCCESS ($SUCCESS_COUNT/$TOTAL_TESTS)"
    echo ""
    echo "Some components may need attention."
fi