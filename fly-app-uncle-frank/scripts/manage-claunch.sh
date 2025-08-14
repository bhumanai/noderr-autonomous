#!/bin/bash
# Manage Claude with claunch

echo "Managing Claude with claunch..."

# Set up environment
export PATH=$PATH:/root/bin
export PROJECT_NAME="fly-app-uncle-frank"
cd /app

# Check if Claude is authenticated
if claude auth status 2>/dev/null | grep -q "Authenticated"; then
    echo "Claude is already authenticated"
else
    echo "Claude needs authentication - creating auth session"
    # Create a tmux session for authentication
    tmux new-session -d -s claude-auth "claude auth login"
    echo "Authentication session created. Connect via: tmux attach -t claude-auth"
fi

# Check if we have a saved session
if [ -f /root/.claude_session_${PROJECT_NAME} ]; then
    echo "Found existing Claude session, resuming..."
    SESSION_ID=$(cat /root/.claude_session_${PROJECT_NAME})
    export CLAUDE_SESSION_ID=$SESSION_ID
fi

# Start claunch in tmux mode
echo "Starting claunch for project: $PROJECT_NAME"
/root/bin/claunch --tmux

# Keep checking if the session is alive
while true; do
    if tmux has-session -t "claude-${PROJECT_NAME}" 2>/dev/null; then
        echo "Claude session is running"
    else
        echo "Claude session not found, restarting..."
        /root/bin/claunch --tmux
    fi
    sleep 30
done