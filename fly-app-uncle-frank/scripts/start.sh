#!/bin/bash
set -e

# Configuration
SESSION_NAME="${SESSION_NAME:-claude-code}"
CLAUDE_API_KEY="${CLAUDE_API_KEY}"

# Function to check if tmux session exists
session_exists() {
    sudo -u claude-user tmux has-session -t "$SESSION_NAME" 2>/dev/null
}

# Function to create tmux session with Claude Code CLI
create_session() {
    echo "Creating tmux session: $SESSION_NAME"
    
    # Export API key for Claude
    export ANTHROPIC_API_KEY="$CLAUDE_API_KEY"
    
    # Create detached tmux session running Claude Code CLI as claude-user
    # Using 'claude --dangerously-skip-permissions' to bypass permission checks
    sudo -u claude-user tmux new-session -d -s "$SESSION_NAME" \
        "cd /workspace && claude --dangerously-skip-permissions"
    
    echo "Tmux session created successfully"
    
    # Give Claude time to initialize
    sleep 5
    
    # Send initial message to confirm it's working
    sudo -u claude-user tmux send-keys -t "$SESSION_NAME" \
        "# Autonomous Noderr system initialized $(date)" C-m
}

# Main execution
main() {
    echo "Starting Claude Code CLI in tmux..."
    
    # Restore Claude authentication from persistent storage
    if [ -f "/app/restore-claude-auth.sh" ]; then
        echo "Restoring Claude authentication..."
        /app/restore-claude-auth.sh
    fi
    
    # Initialize Claude config from persistent storage
    /app/init-claude.sh
    
    # Check if session already exists
    if session_exists; then
        echo "Session $SESSION_NAME already exists"
        # Kill old session and create new one for clean state
        sudo -u claude-user tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
        sleep 2
    fi
    
    # Create new session
    create_session
    
    # Keep script running to maintain supervisor process
    echo "Claude Code CLI is running in tmux session: $SESSION_NAME"
    
    # Monitor session and restart if needed, save config periodically
    while true; do
        if ! session_exists; then
            echo "Session lost, recreating..."
            create_session
        fi
        
        # Save config and auth every 5 minutes
        if [ -f "/app/save-claude-config.sh" ]; then
            /app/save-claude-config.sh >/dev/null 2>&1
        fi
        
        # Save authentication tokens
        if [ -f "/app/save-claude-auth.sh" ]; then
            /app/save-claude-auth.sh >/dev/null 2>&1
        fi
        
        sleep 300  # Check every 5 minutes
    done
}

# Run main function
main