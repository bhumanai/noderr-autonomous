#!/bin/bash
# Brainstorm with Claude Code CLI in project directory

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

# Create the brainstorm prompt
cat > "${OUTPUT_DIR}/prompt.md" << EOF
You are a software architect helping to break down this request into actionable development tasks.

PROJECT CONTEXT:
- You are in the project directory: ${PROJECT_PATH}
- Explore the codebase to understand the structure, tech stack, and patterns
- Use grep, find, and read files to understand the project

USER REQUEST:
${USER_REQUEST}

TASK REQUIREMENTS:
1. Each task should take 2-4 hours to complete
2. Tasks should be specific and actionable (not vague like "research" or "implement")
3. Generate between 3-8 tasks depending on complexity
4. Order tasks by dependencies (foundational tasks first)
5. Include technical details in descriptions
6. Consider the actual codebase structure and existing patterns

Please:
1. First, explore the project structure and understand the codebase
2. Identify the tech stack and existing patterns
3. Break down the request into specific tasks
4. Output a JSON file with the tasks to: ${OUTPUT_DIR}/tasks.json

The JSON format should be:
{
  "analysis": "Brief analysis of what needs to be built",
  "tasks": [
    {
      "id": "task-1",
      "title": "Short task title",
      "description": "Detailed description of what to do",
      "estimatedHours": 2-4,
      "complexity": "low|medium|high",
      "dependencies": [], 
      "technicalDetails": "Specific technical implementation notes",
      "files": ["files that will be modified or created"]
    }
  ],
  "clarifyingQuestions": ["Any questions to better understand requirements"],
  "assumptions": ["Any assumptions made about the implementation"],
  "risks": ["Potential challenges or concerns"]
}

After analyzing the codebase and creating the tasks, save the JSON to the specified file.
EOF

# Start tmux session with Claude
echo "Starting Claude brainstorm session: ${SESSION_ID}"
tmux new-session -d -s "$SESSION_ID" -c "$PROJECT_PATH"

# Send the Claude command to the tmux session
tmux send-keys -t "$SESSION_ID" "claude -m '$(cat ${OUTPUT_DIR}/prompt.md)'" Enter

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

echo "Brainstorm session started: ${SESSION_ID}"
echo "Output will be saved to: ${OUTPUT_DIR}/tasks.json"
echo "Monitor with: tmux attach -t ${SESSION_ID}"