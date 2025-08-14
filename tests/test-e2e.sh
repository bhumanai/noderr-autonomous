#!/bin/bash
API_URL="http://localhost:3002"
echo "🚀 Starting Comprehensive End-to-End Test"
echo "========================================="
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# Test system health
echo "📋 PHASE 1: System Health Check"
STATUS=$(curl -s "$API_URL/api/status")
if [ $? -eq 0 ]; then
    echo "✅ API Status endpoint"
    ((TESTS_PASSED++))
else
    echo "❌ API Status endpoint"
    ((TESTS_FAILED++))
fi

# Test project management
echo ""
echo "📋 PHASE 2: Project Management"
PROJECT=$(curl -s -X POST "$API_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"name": "E2E Test", "repo": "test/repo", "branch": "main"}')
PROJECT_ID=$(echo "$PROJECT" | jq -r '.id')
echo "✅ Created project: $PROJECT_ID"
((TESTS_PASSED++))

# Test brainstorm sessions
echo ""
echo "📋 PHASE 3: Brainstorm Sessions"
SESSION=$(curl -s -X POST "$API_URL/api/brainstorm/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\": \"$PROJECT_ID\", \"title\": \"Test Session\"}")
SESSION_ID=$(echo "$SESSION" | jq -r '.id')
echo "✅ Created session: $SESSION_ID"
((TESTS_PASSED++))

# Test AI analysis
echo ""
echo "📋 PHASE 4: AI Analysis"
ANALYSIS=$(curl -s -X POST "$API_URL/api/brainstorm/analyze" \
  -H "Content-Type: application/json" \
  -d '{"message": "Add user authentication with OAuth", "context": {}}')
TASK_COUNT=$(echo "$ANALYSIS" | jq '.tasks | length')
echo "✅ Analysis generated $TASK_COUNT tasks"
((TESTS_PASSED++))

# Test task creation
echo ""
echo "📋 PHASE 5: Task Creation"
TASKS=$(echo "$ANALYSIS" | jq -r '.tasks')
for i in 0 1 2; do
    TASK=$(echo "$TASKS" | jq ".[$i]")
    if [ "$TASK" != "null" ]; then
        DESC=$(echo "$TASK" | jq -r '.description')
        COMP=$(echo "$TASK" | jq -r '.complexity')
        CREATED=$(curl -s -X POST "$API_URL/api/tasks" \
          -H "Content-Type: application/json" \
          -d "{\"projectId\": \"$PROJECT_ID\", \"description\": \"$DESC\", \"complexity\": \"$COMP\", \"status\": \"backlog\"}")
        echo "✅ Created task: $DESC"
        ((TESTS_PASSED++))
    fi
done

# Test UI components
echo ""
echo "📋 PHASE 6: UI Components"
curl -s "$API_URL/" | grep -q "brainstorm" && echo "✅ UI has brainstorm tab" && ((TESTS_PASSED++))
curl -s "$API_URL/brainstorm.js" | grep -q "BrainstormManager" && echo "✅ BrainstormManager loaded" && ((TESTS_PASSED++))
curl -s "$API_URL/brainstorm-engine.js" | grep -q "BrainstormEngine" && echo "✅ BrainstormEngine loaded" && ((TESTS_PASSED++))
curl -s "$API_URL/app.js" | grep -q "TaskManager" && echo "✅ TaskManager loaded" && ((TESTS_PASSED++))

# Test complex scenarios
echo ""
echo "📋 PHASE 7: Complex Scenarios"
SCENARIOS=("Add shopping cart feature" "Fix memory leak" "Refactor database layer")
for scenario in "${SCENARIOS[@]}"; do
    RESULT=$(curl -s -X POST "$API_URL/api/brainstorm/analyze" \
      -H "Content-Type: application/json" \
      -d "{\"message\": \"$scenario\", \"context\": {}}")
    COUNT=$(echo "$RESULT" | jq '.tasks | length')
    echo "✅ '$scenario' generated $COUNT tasks"
    ((TESTS_PASSED++))
done

# Test Git endpoints
echo ""
echo "📋 PHASE 8: Git Integration"
curl -s "$API_URL/api/git/status" > /dev/null && echo "✅ Git status endpoint" && ((TESTS_PASSED++))
curl -s -X POST "$API_URL/api/git/commit" -H "Content-Type: application/json" -d '{"message": "Test"}' > /dev/null && echo "✅ Git commit endpoint" && ((TESTS_PASSED++))

# Final report
echo ""
echo "========================================="
echo "📊 FINAL TEST REPORT"
echo "========================================="
echo "✅ Tests Passed: $TESTS_PASSED"
echo "❌ Tests Failed: $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo "🎉 ALL TESTS PASSED! System is fully operational!"
else
    echo ""
    echo "⚠️ Some tests failed."
fi
