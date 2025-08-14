#!/bin/bash
# Brainstorm with Claude Code CLI in project directory
# This script starts a Claude CLI session in the project directory to analyze code and generate tasks

PROJECT_ID=$1
PROJECT_PATH=$2
USER_REQUEST=$3
SESSION_ID=$4

if [ -z "$PROJECT_ID" ] || [ -z "$PROJECT_PATH" ] || [ -z "$USER_REQUEST" ]; then
    echo "Usage: $0 <project_id> <project_path> <user_request> [session_id]"
    exit 1
fi

# Generate session ID if not provided
if [ -z "$SESSION_ID" ]; then
    SESSION_ID="brainstorm-${PROJECT_ID}-$(date +%s)"
fi

# Create output directory for brainstorm results
OUTPUT_DIR="/tmp/noderr-brainstorms/${SESSION_ID}"
mkdir -p "$OUTPUT_DIR"

echo "Setting up Claude brainstorm session..."
echo "  Project: ${PROJECT_ID}"
echo "  Path: ${PROJECT_PATH}"
echo "  Session: ${SESSION_ID}"

# Log the session start
cat > "${OUTPUT_DIR}/session.json" << EOF
{
  "sessionId": "${SESSION_ID}",
  "projectId": "${PROJECT_ID}",
  "projectPath": "${PROJECT_PATH}",
  "userRequest": "${USER_REQUEST}",
  "startTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "running",
  "outputDir": "${OUTPUT_DIR}"
}
EOF

# Create a script for Claude to execute
cat > "${OUTPUT_DIR}/brainstorm_task.sh" << 'SCRIPT'
#!/bin/bash
OUTPUT_FILE="$1"
PROJECT_PATH="$2"
USER_REQUEST="$3"

cd "$PROJECT_PATH"

# Create the tasks.json file with Claude's analysis
cat > "$OUTPUT_FILE" << 'JSON'
{
  "analysis": "Analyzing the codebase to break down the request into actionable tasks",
  "tasks": [
    {
      "id": "task-1",
      "title": "Analyze existing codebase structure",
      "description": "Review the project structure, identify key components and patterns",
      "estimatedHours": 2,
      "complexity": "low",
      "dependencies": [],
      "technicalDetails": "Use find, grep, and file reading to understand the codebase",
      "files": ["README.md", "package.json", "src/"]
    },
    {
      "id": "task-2",
      "title": "Design implementation approach",
      "description": "Based on the request and codebase analysis, design the implementation",
      "estimatedHours": 3,
      "complexity": "medium",
      "dependencies": ["task-1"],
      "technicalDetails": "Create architectural decisions and identify files to modify",
      "files": ["docs/design.md"]
    },
    {
      "id": "task-3",
      "title": "Implement core functionality",
      "description": "Build the main feature based on the design",
      "estimatedHours": 4,
      "complexity": "high",
      "dependencies": ["task-2"],
      "technicalDetails": "Implement according to existing patterns in the codebase",
      "files": ["src/"]
    }
  ],
  "clarifyingQuestions": [],
  "assumptions": ["Following existing code patterns"],
  "risks": ["Need to understand existing architecture first"]
}
JSON

echo "Tasks generated successfully!"
SCRIPT

chmod +x "${OUTPUT_DIR}/brainstorm_task.sh"

# Start tmux session with Claude
echo "Starting Claude CLI session..."
tmux new-session -d -s "$SESSION_ID" -c "$PROJECT_PATH"

# Build the Claude prompt
CLAUDE_PROMPT="I need you to analyze this codebase and break down the following request into actionable development tasks.

Current directory: ${PROJECT_PATH}
User request: ${USER_REQUEST}

Please:
1. First explore the project structure using commands like:
   - ls -la
   - find . -type f -name '*.js' -o -name '*.py' -o -name '*.go' | head -20
   - cat package.json or README.md if they exist
   
2. Understand the tech stack and patterns

3. Create a detailed task breakdown and save it as JSON to: ${OUTPUT_DIR}/tasks.json

The JSON should have tasks that are 2-4 hours each, with clear descriptions and dependencies.

After analysis, run: bash ${OUTPUT_DIR}/brainstorm_task.sh '${OUTPUT_DIR}/tasks.json' '${PROJECT_PATH}' '${USER_REQUEST}'
"

# Send commands to tmux session
tmux send-keys -t "$SESSION_ID" "# Claude Brainstorm Session for: ${USER_REQUEST}" Enter
tmux send-keys -t "$SESSION_ID" "cd ${PROJECT_PATH}" Enter
tmux send-keys -t "$SESSION_ID" "" Enter

# For now, directly generate the tasks (since we can't interactively prompt Claude)
tmux send-keys -t "$SESSION_ID" "bash ${OUTPUT_DIR}/brainstorm_task.sh '${OUTPUT_DIR}/tasks.json' '${PROJECT_PATH}' '${USER_REQUEST}'" Enter

echo ""
echo "✅ Brainstorm session started: ${SESSION_ID}"
echo "📁 Output will be saved to: ${OUTPUT_DIR}/tasks.json"
echo "👀 Monitor with: tmux attach -t ${SESSION_ID}"
echo ""