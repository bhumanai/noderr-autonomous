#!/bin/bash
# Start both Claude Pilot and Executor sessions

echo "Starting Claude Relay System..."

# Function to create a Claude session
create_claude_session() {
    local session_name=$1
    local session_desc=$2
    
    echo "Creating $session_desc session: $session_name"
    
    # Kill any existing session
    sudo -u claude-user tmux kill-session -t "$session_name" 2>/dev/null || true
    sleep 1
    
    # Create new session
    sudo -u claude-user tmux new-session -d -s "$session_name" \
        "cd /workspace && claude --dangerously-skip-permissions"
    
    echo "Waiting for Claude to start..."
    sleep 5
    
    # Accept bypass permissions (send "2")
    sudo -u claude-user tmux send-keys -t "$session_name" "2"
    
    sleep 3
    
    # Check if session is ready
    if sudo -u claude-user tmux capture-pane -t "$session_name" -p | grep -q "bypass permissions on"; then
        echo "$session_desc is ready!"
        return 0
    else
        echo "Warning: $session_desc may not be ready"
        return 1
    fi
}

# Restore authentication if available
if [ -f "/app/restore-claude-auth.sh" ]; then
    echo "Restoring Claude authentication..."
    /app/restore-claude-auth.sh
fi

# Create both sessions
create_claude_session "claude-pilot" "Claude Pilot (reformatter)"
create_claude_session "claude-executor" "Claude Executor (worker)"

echo "Claude Relay System started successfully!"
echo "Pilot session: claude-pilot"
echo "Executor session: claude-executor"

# Keep the script running
while true; do
    # Check if sessions are still alive
    if ! sudo -u claude-user tmux has-session -t "claude-pilot" 2>/dev/null; then
        echo "Pilot session died, restarting..."
        create_claude_session "claude-pilot" "Claude Pilot (reformatter)"
    fi
    
    if ! sudo -u claude-user tmux has-session -t "claude-executor" 2>/dev/null; then
        echo "Executor session died, restarting..."
        create_claude_session "claude-executor" "Claude Executor (worker)"
    fi
    
    # Save auth periodically
    if [ -f "/app/save-claude-auth.sh" ]; then
        /app/save-claude-auth.sh >/dev/null 2>&1
    fi
    
    sleep 300  # Check every 5 minutes
done