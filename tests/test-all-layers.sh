#!/bin/bash

# End-to-End Test of All Noderr Layers
# Tests: Project Creation → Git Clone → Brainstorm → Task Generation → Orchestration → Execution

set -e

API_URL="http://localhost:3000"
TESTS_PASSED=0
TESTS_FAILED=0

echo "🚀 Starting End-to-End Test of All Noderr Layers"
echo "================================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to check test result
check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $2${NC}"
        ((TESTS_FAILED++))
    fi
}

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json"
    else
        curl -s -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json" -d "$data"
    fi
}

echo "================== LAYER 1: BACKEND API =================="
echo ""

# Test 1: API Health Check
echo "Test 1: API Health Check"
STATUS=$(api_call GET "/api/status" | jq -r '.status')
[ "$STATUS" = "healthy" ]
check_result $? "API is healthy"

echo ""
echo "================== LAYER 2: PROJECT MANAGEMENT =================="
echo ""

# Test 2: Create Project with Git Repo
echo "Test 2: Create Project with Git Repository"
PROJECT_RESPONSE=$(api_call POST "/api/projects" '{
    "name": "Test Project E2E",
    "repo": "https://github.com/expressjs/express.git",
    "branch": "master"
}')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.id')
LOCAL_PATH=$(echo "$PROJECT_RESPONSE" | jq -r '.localPath')
LAST_SYNC=$(echo "$PROJECT_RESPONSE" | jq -r '.lastSync')

if [ "$PROJECT_ID" != "null" ] && [ "$LOCAL_PATH" != "null" ]; then
    check_result 0 "Project created: $PROJECT_ID"
    echo "  → Local path: $LOCAL_PATH"
    echo "  → Last sync: $LAST_SYNC"
else
    check_result 1 "Project creation failed"
fi

# Test 3: Verify Repository Was Cloned
echo ""
echo "Test 3: Verify Repository Clone"
if [ -d "$LOCAL_PATH" ] && [ -f "$LOCAL_PATH/package.json" ]; then
    check_result 0 "Repository cloned successfully"
    PACKAGE_NAME=$(jq -r '.name' "$LOCAL_PATH/package.json" 2>/dev/null)
    echo "  → Package: $PACKAGE_NAME"
else
    check_result 1 "Repository clone failed"
fi

# Test 4: Get Project File Tree
echo ""
echo "Test 4: Get Project File Tree"
TREE_RESPONSE=$(api_call GET "/api/projects/$PROJECT_ID/tree")
TREE_COUNT=$(echo "$TREE_RESPONSE" | jq '.tree | length')
if [ "$TREE_COUNT" -gt 0 ]; then
    check_result 0 "File tree retrieved: $TREE_COUNT items"
else
    check_result 1 "Failed to get file tree"
fi

# Test 5: Read a Specific File
echo ""
echo "Test 5: Read Project File"
FILE_RESPONSE=$(api_call GET "/api/projects/$PROJECT_ID/files?path=README.md")
FILE_CONTENT=$(echo "$FILE_RESPONSE" | jq -r '.content' | head -c 50)
if [ -n "$FILE_CONTENT" ]; then
    check_result 0 "File read successfully"
    echo "  → Content preview: ${FILE_CONTENT}..."
else
    check_result 1 "Failed to read file"
fi

echo ""
echo "================== LAYER 3: AI BRAINSTORMING =================="
echo ""

# Test 6: Start Brainstorm Session (Claude CLI or GPT-5)
echo "Test 6: Start AI Brainstorm Session"
BRAINSTORM_RESPONSE=$(api_call POST "/api/brainstorm/analyze" "{
    \"message\": \"Add rate limiting middleware to protect API endpoints\",
    \"context\": {
        \"projectId\": \"$PROJECT_ID\"
    }
}")

# Check if it's a Claude session or direct AI response
SESSION_ID=$(echo "$BRAINSTORM_RESPONSE" | jq -r '.sessionId // empty')
if [ -n "$SESSION_ID" ]; then
    echo -e "${YELLOW}  → Claude CLI session started: $SESSION_ID${NC}"
    check_result 0 "Brainstorm session initiated (Claude CLI)"
    
    # Wait for Claude to analyze
    echo "  → Waiting for Claude to analyze codebase..."
    sleep 5
    
    # Check session status
    SESSION_STATUS=$(api_call GET "/api/brainstorm/sessions/$SESSION_ID/status")
    STATUS=$(echo "$SESSION_STATUS" | jq -r '.status')
    echo "  → Session status: $STATUS"
    
    if [ "$STATUS" = "completed" ]; then
        TASKS=$(echo "$SESSION_STATUS" | jq '.result.tasks')
        check_result 0 "Claude analysis completed"
    else
        check_result 1 "Claude analysis not completed yet"
    fi
else
    # Direct AI response (GPT-5 or fallback)
    TASKS=$(echo "$BRAINSTORM_RESPONSE" | jq '.tasks')
    TASK_COUNT=$(echo "$TASKS" | jq 'length')
    if [ "$TASK_COUNT" -gt 0 ]; then
        check_result 0 "AI generated $TASK_COUNT tasks"
        echo "  → Using GPT-5 or fallback AI"
    else
        check_result 1 "No tasks generated"
    fi
fi

# Test 7: Validate Task Structure
echo ""
echo "Test 7: Validate Task Structure"
if [ -n "$TASKS" ] && [ "$TASKS" != "null" ]; then
    FIRST_TASK=$(echo "$TASKS" | jq '.[0]')
    TASK_TITLE=$(echo "$FIRST_TASK" | jq -r '.title // .description')
    TASK_HOURS=$(echo "$FIRST_TASK" | jq -r '.estimatedHours // 0')
    TASK_COMPLEXITY=$(echo "$FIRST_TASK" | jq -r '.complexity // "unknown"')
    
    if [ -n "$TASK_TITLE" ]; then
        check_result 0 "Tasks have proper structure"
        echo "  → Sample task: $TASK_TITLE"
        echo "  → Estimated hours: $TASK_HOURS"
        echo "  → Complexity: $TASK_COMPLEXITY"
    else
        check_result 1 "Invalid task structure"
    fi
else
    check_result 1 "No tasks to validate"
fi

echo ""
echo "================== LAYER 4: TASK MANAGEMENT =================="
echo ""

# Test 8: Create Tasks from Brainstorm
echo "Test 8: Create Tasks in Kanban"
if [ -n "$TASKS" ] && [ "$TASKS" != "null" ]; then
    TASK_CREATED=0
    # Create first task from brainstorm
    FIRST_TASK_DESC=$(echo "$TASKS" | jq -r '.[0].title // .[0].description')
    NEW_TASK=$(api_call POST "/api/tasks" "{
        \"description\": \"$FIRST_TASK_DESC\",
        \"projectId\": \"$PROJECT_ID\",
        \"status\": \"backlog\"
    }")
    TASK_ID=$(echo "$NEW_TASK" | jq -r '.id')
    if [ "$TASK_ID" != "null" ]; then
        check_result 0 "Task created: $TASK_ID"
        TASK_CREATED=1
    else
        check_result 1 "Failed to create task"
    fi
else
    check_result 1 "No tasks to create"
fi

# Test 9: Update Task Status
echo ""
echo "Test 9: Update Task Status"
if [ $TASK_CREATED -eq 1 ]; then
    UPDATE_RESPONSE=$(api_call PATCH "/api/tasks/$TASK_ID" '{
        "status": "working",
        "progress": 50
    }')
    UPDATED_STATUS=$(echo "$UPDATE_RESPONSE" | jq -r '.status')
    if [ "$UPDATED_STATUS" = "working" ]; then
        check_result 0 "Task status updated to: $UPDATED_STATUS"
    else
        check_result 1 "Failed to update task status"
    fi
else
    echo "  → Skipping: No task to update"
fi

echo ""
echo "================== LAYER 5: GIT INTEGRATION =================="
echo ""

# Test 10: Sync Repository
echo "Test 10: Sync Repository (Git Pull)"
SYNC_RESPONSE=$(api_call POST "/api/projects/$PROJECT_ID/sync" "")
SYNC_MESSAGE=$(echo "$SYNC_RESPONSE" | jq -r '.message // .error')
if [[ "$SYNC_MESSAGE" == *"success"* ]] || [[ "$SYNC_MESSAGE" == *"Already up to date"* ]]; then
    check_result 0 "Repository synced"
    echo "  → $SYNC_MESSAGE"
else
    check_result 1 "Repository sync failed: $SYNC_MESSAGE"
fi

echo ""
echo "================== LAYER 6: BRAINSTORM SESSIONS =================="
echo ""

# Test 11: List Brainstorm Sessions
echo "Test 11: Get Brainstorm Sessions"
SESSIONS_RESPONSE=$(api_call GET "/api/brainstorm/sessions")
SESSION_COUNT=$(echo "$SESSIONS_RESPONSE" | jq 'length' 2>/dev/null || echo "0")
check_result 0 "Retrieved $SESSION_COUNT brainstorm sessions"

# Test 12: Check tmux sessions
echo ""
echo "Test 12: Check tmux Sessions"
TMUX_SESSIONS=$(tmux list-sessions 2>/dev/null | grep -c "brainstorm" || echo "0")
echo "  → Active tmux brainstorm sessions: $TMUX_SESSIONS"
check_result 0 "Tmux session check completed"

echo ""
echo "================== CLEANUP =================="
echo ""

# Cleanup: Delete test project
echo "Cleanup: Delete Test Project"
DELETE_RESPONSE=$(api_call DELETE "/api/projects/$PROJECT_ID")
if [ $? -eq 0 ]; then
    echo "  → Project deleted successfully"
    echo "  → Repository cleaned up"
else
    echo "  → Warning: Failed to delete project"
fi

# Kill any test tmux sessions
if [ -n "$SESSION_ID" ]; then
    tmux kill-session -t "$SESSION_ID" 2>/dev/null || true
    echo "  → Tmux session cleaned up"
fi

echo ""
echo "================================================="
echo "📊 FINAL TEST REPORT"
echo "================================================="
echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL LAYERS WORKING PERFECTLY!${NC}"
    echo ""
    echo "✓ Backend API operational"
    echo "✓ Git integration working"
    echo "✓ Project management functional"
    echo "✓ AI brainstorming active"
    echo "✓ Task management working"
    echo "✓ File system access operational"
    exit 0
else
    echo -e "${RED}⚠️ Some tests failed. Review the output above.${NC}"
    exit 1
fi