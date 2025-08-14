#!/bin/bash
# Claude CLI Executor for Noderr Tasks
# REAL implementation - Claude actually executes the task

TASK_ID=$1
PROJECT_ID=$2
TASK_DESCRIPTION=$3
SESSION_ID="executor-${TASK_ID}-$(date +%s)"

if [ -z "$TASK_ID" ] || [ -z "$PROJECT_ID" ] || [ -z "$TASK_DESCRIPTION" ]; then
    echo "Usage: $0 <task_id> <project_id> <task_description>"
    exit 1
fi

# Get project path from API
PROJECT_INFO=$(curl -s "http://localhost:3000/api/projects/${PROJECT_ID}")
PROJECT_PATH=$(echo "$PROJECT_INFO" | jq -r '.localPath')

if [ ! -d "$PROJECT_PATH" ]; then
    echo "Error: Project path not found: $PROJECT_PATH"
    exit 1
fi

# Create output directory
OUTPUT_DIR="/tmp/noderr-executors/${SESSION_ID}"
mkdir -p "$OUTPUT_DIR"

echo "Starting REAL Claude executor session..."
echo "  Task: ${TASK_ID}"
echo "  Project: ${PROJECT_ID}"
echo "  Path: ${PROJECT_PATH}"
echo "  Session: ${SESSION_ID}"

# Update task status to 'working'
curl -s -X PATCH "http://localhost:3000/api/tasks/${TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{"status": "working", "progress": 10}' > /dev/null

# Log the session
cat > "${OUTPUT_DIR}/session.json" << EOF
{
  "sessionId": "${SESSION_ID}",
  "taskId": "${TASK_ID}",
  "projectId": "${PROJECT_ID}",
  "projectPath": "${PROJECT_PATH}",  
  "taskDescription": "${TASK_DESCRIPTION}",
  "startTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "running"
}
EOF

# Start tmux session with Claude in project directory
tmux new-session -d -s "$SESSION_ID" -c "$PROJECT_PATH"

# Give Claude the ACTUAL task to implement
CLAUDE_PROMPT="You are in the project directory: ${PROJECT_PATH}

TASK TO IMPLEMENT: ${TASK_DESCRIPTION}

Please:
1. First explore the codebase to understand the structure
2. Implement the task as described
3. Make actual code changes needed
4. Test your changes if possible
5. When done, create a file at: ${OUTPUT_DIR}/completed.txt with summary

Use commands like:
- ls, find, grep to explore
- cat, less to read files
- vi, nano, or echo to edit files
- git diff to see your changes

Start by exploring the project structure."

# Send the task to Claude (REAL execution, not simulation)
tmux send-keys -t "$SESSION_ID" "# Claude Executor - REAL Implementation" Enter
tmux send-keys -t "$SESSION_ID" "cd ${PROJECT_PATH}" Enter
tmux send-keys -t "$SESSION_ID" "" Enter

# Start Claude with the task
tmux send-keys -t "$SESSION_ID" "claude" Enter
sleep 1

# Send the prompt to Claude
echo "$CLAUDE_PROMPT" | while IFS= read -r line; do
    # Escape any quotes in the line
    escaped_line=$(echo "$line" | sed "s/'/'\\\\''/g")
    tmux send-keys -t "$SESSION_ID" "$escaped_line" Enter
done

# Create a monitor script that updates task progress
cat > "${OUTPUT_DIR}/monitor.sh" << 'MONITOR'
#!/bin/bash
TASK_ID="$1"
OUTPUT_DIR="$2"
SESSION_ID="$3"

# Monitor for 5 minutes max
TIMEOUT=300
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    # Check if completed file exists
    if [ -f "${OUTPUT_DIR}/completed.txt" ]; then
        # Task completed - update status
        curl -s -X PATCH "http://localhost:3000/api/tasks/${TASK_ID}" \
          -H "Content-Type: application/json" \
          -d '{"status": "review", "progress": 100}' > /dev/null
        
        echo "Task completed by Claude!"
        break
    fi
    
    # Update progress periodically
    if [ $((ELAPSED % 30)) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
        PROGRESS=$((10 + (ELAPSED * 80 / TIMEOUT)))
        curl -s -X PATCH "http://localhost:3000/api/tasks/${TASK_ID}" \
          -H "Content-Type: application/json" \
          -d "{\"status\": \"working\", \"progress\": $PROGRESS}" > /dev/null
    fi
    
    # Check if session still exists
    if ! tmux has-session -t "$SESSION_ID" 2>/dev/null; then
        echo "Session ended"
        break
    fi
    
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

# Final status update
if [ ! -f "${OUTPUT_DIR}/completed.txt" ]; then
    curl -s -X PATCH "http://localhost:3000/api/tasks/${TASK_ID}" \
      -H "Content-Type: application/json" \
      -d '{"status": "review", "progress": 90}' > /dev/null
fi
MONITOR

chmod +x "${OUTPUT_DIR}/monitor.sh"

# Start monitor in background
"${OUTPUT_DIR}/monitor.sh" "$TASK_ID" "$OUTPUT_DIR" "$SESSION_ID" > "${OUTPUT_DIR}/monitor.log" 2>&1 &
MONITOR_PID=$!

echo ""
echo "✅ REAL Claude executor session started: ${SESSION_ID}"
echo "📁 Output directory: ${OUTPUT_DIR}"
echo "📊 Monitor PID: ${MONITOR_PID}"
echo "👀 Watch Claude work: tmux attach -t ${SESSION_ID}"
echo ""

# Return session info
cat << JSON
{
  "sessionId": "${SESSION_ID}",
  "taskId": "${TASK_ID}",
  "status": "running",
  "monitorPid": ${MONITOR_PID},
  "outputDir": "${OUTPUT_DIR}",
  "attachCommand": "tmux attach -t ${SESSION_ID}"
}
JSON