#!/bin/bash
# Noderr Orchestrator Loop
# Pulls tasks from backlog and spawns Claude executors

API_URL="http://localhost:3000"
POLL_INTERVAL=10  # seconds

echo "🤖 Noderr Orchestrator Started"
echo "================================"
echo "Polling for backlog tasks every ${POLL_INTERVAL} seconds..."
echo ""

while true; do
    # Get tasks in backlog
    TASKS=$(curl -s "${API_URL}/api/tasks?status=backlog")
    TASK_COUNT=$(echo "$TASKS" | jq 'length')
    
    if [ "$TASK_COUNT" -gt 0 ]; then
        # Get first task
        TASK=$(echo "$TASKS" | jq '.[0]')
        TASK_ID=$(echo "$TASK" | jq -r '.id')
        TASK_DESC=$(echo "$TASK" | jq -r '.description')
        PROJECT_ID=$(echo "$TASK" | jq -r '.projectId')
        
        echo "[$(date +%H:%M:%S)] Found task: ${TASK_ID}"
        echo "  Description: ${TASK_DESC}"
        echo "  Project: ${PROJECT_ID}"
        
        # Check if executor already running for this task
        if tmux has-session -t "executor-${TASK_ID}" 2>/dev/null; then
            echo "  ⚠️  Executor already running for this task"
        else
            # Start executor
            echo "  🚀 Starting executor..."
            ./executor-with-claude.sh "$TASK_ID" "$PROJECT_ID" "$TASK_DESC"
        fi
    else
        echo "[$(date +%H:%M:%S)] No tasks in backlog"
    fi
    
    # Show active executors
    EXECUTOR_COUNT=$(tmux list-sessions 2>/dev/null | grep -c "^executor-" || echo "0")
    if [ "$EXECUTOR_COUNT" -gt 0 ]; then
        echo "  Active executors: ${EXECUTOR_COUNT}"
        tmux list-sessions 2>/dev/null | grep "^executor-" | while read session; do
            echo "    - ${session}"
        done
    fi
    
    echo ""
    sleep $POLL_INTERVAL
done