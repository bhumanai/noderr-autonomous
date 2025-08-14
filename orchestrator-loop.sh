#!/bin/bash
# Noderr Orchestrator Loop - REAL implementation
# Pulls tasks from backlog and spawns REAL Claude executors

API_URL="http://localhost:3000"
POLL_INTERVAL=10  # seconds
MAX_CONCURRENT_EXECUTORS=3

echo "🤖 Noderr Orchestrator Started (REAL Implementation)"
echo "=================================================="
echo "Configuration:"
echo "  • API: ${API_URL}"
echo "  • Poll interval: ${POLL_INTERVAL}s"
echo "  • Max concurrent executors: ${MAX_CONCURRENT_EXECUTORS}"
echo ""
echo "Starting orchestration loop..."
echo ""

while true; do
    # Count active executors
    ACTIVE_EXECUTORS=$(tmux list-sessions 2>/dev/null | grep -c "^executor-" || echo "0")
    
    if [ "$ACTIVE_EXECUTORS" -ge "$MAX_CONCURRENT_EXECUTORS" ]; then
        echo "[$(date +%H:%M:%S)] Max executors running ($ACTIVE_EXECUTORS/$MAX_CONCURRENT_EXECUTORS)"
    else
        # Get tasks in backlog
        TASKS=$(curl -s "${API_URL}/api/tasks?status=backlog")
        TASK_COUNT=$(echo "$TASKS" | jq 'length')
        
        if [ "$TASK_COUNT" -gt 0 ]; then
            # Get first task
            TASK=$(echo "$TASKS" | jq '.[0]')
            TASK_ID=$(echo "$TASK" | jq -r '.id')
            TASK_DESC=$(echo "$TASK" | jq -r '.description')
            PROJECT_ID=$(echo "$TASK" | jq -r '.projectId')
            
            echo "[$(date +%H:%M:%S)] Found task in backlog"
            echo "  📋 Task: ${TASK_ID}"
            echo "  📝 Description: ${TASK_DESC:0:50}..."
            echo "  📁 Project: ${PROJECT_ID}"
            
            # Check if executor already running for this task
            EXISTING_SESSION=$(tmux list-sessions 2>/dev/null | grep "executor-${TASK_ID}" | head -1)
            if [ -n "$EXISTING_SESSION" ]; then
                echo "  ⚠️  Executor already exists for this task"
            else
                # Start REAL executor with Claude
                echo "  🚀 Starting REAL Claude executor..."
                
                EXECUTOR_OUTPUT=$(./executor-with-claude.sh "$TASK_ID" "$PROJECT_ID" "$TASK_DESC" 2>&1)
                EXECUTOR_EXIT=$?
                
                if [ $EXECUTOR_EXIT -eq 0 ]; then
                    # Parse the JSON output to get session ID
                    SESSION_ID=$(echo "$EXECUTOR_OUTPUT" | tail -1 | jq -r '.sessionId' 2>/dev/null)
                    
                    if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
                        # Verify the session actually started
                        sleep 1
                        if tmux has-session -t "$SESSION_ID" 2>/dev/null; then
                            echo "  ✅ Claude executor started successfully"
                            echo "     Session: ${SESSION_ID}"
                            echo "     Watch: tmux attach -t ${SESSION_ID}"
                        else
                            echo "  ❌ Executor session failed to start"
                            # Revert task to backlog
                            curl -s -X PATCH "${API_URL}/api/tasks/${TASK_ID}" \
                              -H "Content-Type: application/json" \
                              -d '{"status": "backlog", "progress": 0}' > /dev/null
                        fi
                    else
                        echo "  ❌ Failed to get session ID from executor"
                        echo "     Output: ${EXECUTOR_OUTPUT}"
                    fi
                else
                    echo "  ❌ Executor script failed with code: $EXECUTOR_EXIT"
                    echo "     Error: ${EXECUTOR_OUTPUT}"
                fi
            fi
        else
            echo "[$(date +%H:%M:%S)] No tasks in backlog (checked: $(date))"
        fi
    fi
    
    # Show status summary
    if [ "$ACTIVE_EXECUTORS" -gt 0 ]; then
        echo ""
        echo "  📊 Active Executors: ${ACTIVE_EXECUTORS}"
        tmux list-sessions 2>/dev/null | grep "^executor-" | while read session; do
            SESSION_NAME=$(echo "$session" | cut -d: -f1)
            TASK_ID=$(echo "$SESSION_NAME" | sed 's/executor-\(task-[^-]*\).*/\1/')
            echo "     • ${SESSION_NAME} (${TASK_ID})"
        done
    fi
    
    # Check for completed executors
    for executor_dir in /tmp/noderr-executors/executor-*/; do
        if [ -f "${executor_dir}completed.txt" ]; then
            SESSION_NAME=$(basename "$executor_dir")
            echo ""
            echo "  🎉 Task completed by Claude!"
            echo "     Session: ${SESSION_NAME}"
            echo "     Summary: $(head -1 ${executor_dir}completed.txt)"
            
            # Clean up completed session
            tmux kill-session -t "$SESSION_NAME" 2>/dev/null
            mv "${executor_dir}" "${executor_dir}.completed.$(date +%s)"
        fi
    done
    
    echo ""
    sleep $POLL_INTERVAL
done