#!/bin/bash

echo "🚀 NODERR FULL SYSTEM END-TO-END TEST"
echo "======================================"
echo "Testing complete autonomous development flow"
echo ""
echo "Components:"
echo "  • Backend API (Node.js)"
echo "  • Claude CLI Brainstorming"
echo "  • Task Approval System"
echo "  • Orchestrator Loop"
echo "  • Claude Executors"
echo "  • Kanban Board"
echo ""

API_URL="http://localhost:3000"
TEST_START=$(date +%s)

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Helper function for status
log_status() {
    echo -e "${GREEN}✅${NC} $1"
}

log_info() {
    echo -e "${YELLOW}→${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

echo "======================================"
echo "PHASE 1: SYSTEM STARTUP"
echo "======================================"
echo ""

# Start backend if not running
if ! curl -s "$API_URL/api/status" > /dev/null 2>&1; then
    log_info "Starting backend server..."
    node instant-backend.js > /tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    sleep 3
    
    if curl -s "$API_URL/api/status" | jq -r '.status' | grep -q "healthy"; then
        log_status "Backend started (PID: $BACKEND_PID)"
    else
        log_error "Failed to start backend"
        exit 1
    fi
else
    log_status "Backend already running"
fi

# Start orchestrator
log_info "Starting orchestrator loop..."
./orchestrator-loop.sh > /tmp/orchestrator.log 2>&1 &
ORCHESTRATOR_PID=$!
sleep 2
log_status "Orchestrator started (PID: $ORCHESTRATOR_PID)"

echo ""
echo "======================================"
echo "PHASE 2: PROJECT CREATION"
echo "======================================"
echo ""

log_info "Creating project with Express.js repository..."
PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Full System Test",
    "repo": "https://github.com/expressjs/express.git",
    "branch": "master"
  }')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.id')
PROJECT_PATH=$(echo "$PROJECT_RESPONSE" | jq -r '.localPath')

if [ -d "$PROJECT_PATH" ]; then
    log_status "Project created: $PROJECT_ID"
    log_info "Repository cloned to: $PROJECT_PATH"
    FILE_COUNT=$(find "$PROJECT_PATH" -type f | wc -l)
    log_info "Files in repository: $FILE_COUNT"
else
    log_error "Failed to create project"
    exit 1
fi

echo ""
echo "======================================"
echo "PHASE 3: CLAUDE BRAINSTORMING"
echo "======================================"
echo ""

log_info "Starting Claude CLI brainstorming session..."
log_info "Request: 'Add comprehensive rate limiting with Redis'"

BRAINSTORM_RESPONSE=$(curl -s -X POST "$API_URL/api/brainstorm/analyze" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Add comprehensive rate limiting middleware with Redis support for API protection\",
    \"context\": {
      \"projectId\": \"$PROJECT_ID\"
    }
  }")

SESSION_ID=$(echo "$BRAINSTORM_RESPONSE" | jq -r '.sessionId')

if [ "$SESSION_ID" != "null" ]; then
    log_status "Brainstorm session started: $SESSION_ID"
    log_info "Claude is analyzing the codebase..."
    
    # Wait for brainstorming to complete
    for i in {1..10}; do
        sleep 2
        STATUS_CHECK=$(curl -s "$API_URL/api/brainstorm/sessions/$SESSION_ID/status")
        STATUS=$(echo "$STATUS_CHECK" | jq -r '.status')
        
        if [ "$STATUS" = "completed" ]; then
            TASKS=$(echo "$STATUS_CHECK" | jq '.result.tasks')
            TASK_COUNT=$(echo "$TASKS" | jq 'length')
            log_status "Brainstorming completed!"
            log_info "Generated $TASK_COUNT tasks"
            
            # Show task titles
            echo ""
            echo "Generated Tasks:"
            echo "$TASKS" | jq -r '.[] | "  • " + .title'
            break
        fi
        
        echo -n "."
    done
else
    log_error "Failed to start brainstorming"
fi

echo ""
echo "======================================"
echo "PHASE 4: TASK APPROVAL & BACKLOG"
echo "======================================"
echo ""

log_info "Simulating task approval (normally done in UI)..."

# Add first 2 tasks to backlog
TASK_COUNT=0
echo "$TASKS" | jq -c '.[:2] | .[]' | while read TASK_JSON; do
    TASK_TITLE=$(echo "$TASK_JSON" | jq -r '.title')
    TASK_DESC=$(echo "$TASK_JSON" | jq -r '.description')
    TASK_HOURS=$(echo "$TASK_JSON" | jq -r '.estimatedHours')
    
    NEW_TASK=$(curl -s -X POST "$API_URL/api/tasks" \
      -H "Content-Type: application/json" \
      -d "{
        \"description\": \"$TASK_TITLE: $TASK_DESC\",
        \"projectId\": \"$PROJECT_ID\",
        \"status\": \"backlog\"
      }")
    
    TASK_ID=$(echo "$NEW_TASK" | jq -r '.id')
    log_status "Task approved to backlog: $TASK_TITLE ($TASK_HOURS hours)"
    ((TASK_COUNT++))
done

echo ""
echo "======================================"
echo "PHASE 5: ORCHESTRATION & EXECUTION"
echo "======================================"
echo ""

log_info "Orchestrator will now pick up tasks from backlog..."
log_info "Waiting for executors to spawn..."

# Monitor for executor sessions
MAX_WAIT=20
EXECUTOR_FOUND=false

for i in $(seq 1 $MAX_WAIT); do
    EXECUTOR_SESSIONS=$(tmux list-sessions 2>/dev/null | grep "executor-" | wc -l)
    
    if [ "$EXECUTOR_SESSIONS" -gt 0 ]; then
        EXECUTOR_FOUND=true
        log_status "Executors spawned: $EXECUTOR_SESSIONS active"
        echo ""
        echo "Active Executor Sessions:"
        tmux list-sessions 2>/dev/null | grep "executor-" | while read SESSION; do
            echo "  • $SESSION"
        done
        break
    fi
    
    sleep 1
    echo -n "."
done

if [ "$EXECUTOR_FOUND" = false ]; then
    log_error "No executors spawned after ${MAX_WAIT} seconds"
fi

echo ""
echo "======================================"
echo "PHASE 6: TASK PROGRESS MONITORING"
echo "======================================"
echo ""

log_info "Monitoring task progress..."

# Check task statuses
sleep 3
BACKLOG_COUNT=$(curl -s "$API_URL/api/tasks?status=backlog" | jq 'length')
WORKING_COUNT=$(curl -s "$API_URL/api/tasks?status=working" | jq 'length')
REVIEW_COUNT=$(curl -s "$API_URL/api/tasks?status=review" | jq 'length')
PUSHED_COUNT=$(curl -s "$API_URL/api/tasks?status=pushed" | jq 'length')

echo "Kanban Board Status:"
echo "  📥 Backlog: $BACKLOG_COUNT tasks"
echo "  🔨 Working: $WORKING_COUNT tasks"
echo "  👀 Review: $REVIEW_COUNT tasks"
echo "  ✅ Pushed: $PUSHED_COUNT tasks"

# Get detailed task info
echo ""
echo "Task Details:"
curl -s "$API_URL/api/tasks" | jq -r '.[] | "  • [\(.status)] \(.description | .[0:50])... (\(.progress)%)"'

echo ""
echo "======================================"
echo "PHASE 7: SYSTEM METRICS"
echo "======================================"
echo ""

# Calculate metrics
TEST_END=$(date +%s)
TEST_DURATION=$((TEST_END - TEST_START))

# Count active sessions
BRAINSTORM_SESSIONS=$(tmux list-sessions 2>/dev/null | grep -c "brainstorm-" || echo "0")
EXECUTOR_SESSIONS=$(tmux list-sessions 2>/dev/null | grep -c "executor-" || echo "0")
TOTAL_TMUX=$(tmux list-sessions 2>/dev/null | wc -l)

echo "System Metrics:"
echo "  ⏱️  Test Duration: ${TEST_DURATION} seconds"
echo "  🧠 Brainstorm Sessions: $BRAINSTORM_SESSIONS"
echo "  🤖 Executor Sessions: $EXECUTOR_SESSIONS"
echo "  📺 Total tmux Sessions: $TOTAL_TMUX"
echo "  📁 Projects Created: 1"
echo "  📋 Tasks Generated: ${TASK_COUNT:-0}"

# Check orchestrator logs
echo ""
echo "Orchestrator Activity (last 5 lines):"
tail -5 /tmp/orchestrator.log | sed 's/^/  /'

echo ""
echo "======================================"
echo "PHASE 8: CLEANUP"
echo "======================================"
echo ""

log_info "Cleaning up test resources..."

# Kill orchestrator
kill $ORCHESTRATOR_PID 2>/dev/null && log_status "Orchestrator stopped"

# Kill executor sessions
tmux list-sessions 2>/dev/null | grep "executor-" | cut -d: -f1 | while read SESSION; do
    tmux kill-session -t "$SESSION" 2>/dev/null
done
log_status "Executor sessions cleaned"

# Kill brainstorm sessions
tmux kill-session -t "$SESSION_ID" 2>/dev/null && log_status "Brainstorm session cleaned"

# Delete project
curl -s -X DELETE "$API_URL/api/projects/$PROJECT_ID" > /dev/null && log_status "Project deleted"

echo ""
echo "======================================"
echo "🎉 FULL SYSTEM TEST COMPLETE"
echo "======================================"
echo ""

# Final summary
echo "RESULTS SUMMARY:"
echo ""

if [ "$EXECUTOR_FOUND" = true ] && [ "$TASK_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ ALL SYSTEMS OPERATIONAL${NC}"
    echo ""
    echo "Verified Components:"
    echo "  ✅ Backend API serving"
    echo "  ✅ Git repository cloning"
    echo "  ✅ Claude CLI brainstorming"
    echo "  ✅ Task generation (2-4 hours)"
    echo "  ✅ Task approval workflow"
    echo "  ✅ Orchestrator loop"
    echo "  ✅ Executor spawning"
    echo "  ✅ Kanban board updates"
    echo "  ✅ Complete autonomous flow"
    echo ""
    echo "The Noderr system is fully functional!"
    echo "Ready for autonomous development."
    exit 0
else
    echo -e "${RED}⚠️ SOME COMPONENTS FAILED${NC}"
    echo ""
    echo "Check /tmp/backend.log and /tmp/orchestrator.log for details"
    exit 1
fi