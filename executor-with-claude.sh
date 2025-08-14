#!/bin/bash
# Claude CLI Executor for Noderr Tasks
# This script starts a Claude CLI session to execute a specific task

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

echo "Starting Claude executor session..."
echo "  Task: ${TASK_ID}"
echo "  Project: ${PROJECT_ID}"
echo "  Path: ${PROJECT_PATH}"
echo "  Session: ${SESSION_ID}"

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

# Create execution script
cat > "${OUTPUT_DIR}/execute_task.sh" << 'SCRIPT'
#!/bin/bash
TASK_ID="$1"
TASK_DESC="$2"
OUTPUT_DIR="$3"

# Update task status to 'working'
curl -s -X PATCH "http://localhost:3000/api/tasks/${TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{"status": "working", "progress": 10}'

# Simulate task execution (in real implementation, Claude would do the work)
echo "Executing task: ${TASK_DESC}"
echo "Working in: $(pwd)"
sleep 2

# Update progress
curl -s -X PATCH "http://localhost:3000/api/tasks/${TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{"status": "working", "progress": 50}'

# Create completion report
cat > "${OUTPUT_DIR}/completion.json" << JSON
{
  "taskId": "${TASK_ID}",
  "status": "completed",
  "filesModified": [],
  "completedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
JSON

# Update task to review
curl -s -X PATCH "http://localhost:3000/api/tasks/${TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{"status": "review", "progress": 100}'

echo "Task completed!"
SCRIPT

chmod +x "${OUTPUT_DIR}/execute_task.sh"

# Start tmux session
tmux new-session -d -s "$SESSION_ID" -c "$PROJECT_PATH"

# Send initial commands
tmux send-keys -t "$SESSION_ID" "# Claude Executor Session" Enter
tmux send-keys -t "$SESSION_ID" "# Task: ${TASK_DESCRIPTION}" Enter
tmux send-keys -t "$SESSION_ID" "cd ${PROJECT_PATH}" Enter
tmux send-keys -t "$SESSION_ID" "" Enter

# Execute the task (simplified for now)
tmux send-keys -t "$SESSION_ID" "bash ${OUTPUT_DIR}/execute_task.sh '${TASK_ID}' '${TASK_DESCRIPTION}' '${OUTPUT_DIR}'" Enter

echo ""
echo "✅ Executor session started: ${SESSION_ID}"
echo "📁 Output directory: ${OUTPUT_DIR}"
echo "👀 Monitor with: tmux attach -t ${SESSION_ID}"
echo ""

# Return session info
cat << JSON
{
  "sessionId": "${SESSION_ID}",
  "taskId": "${TASK_ID}",
  "status": "started",
  "monitorCommand": "tmux attach -t ${SESSION_ID}"
}
JSON