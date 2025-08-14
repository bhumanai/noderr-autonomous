#!/bin/bash
# Claude Relay Session Manager
# Manages persistent pilot and executor Claude sessions using claunch approach

VERSION="1.0.0"
SESSION_DIR="/root/.claude_sessions"
PILOT_SESSION_FILE="$SESSION_DIR/pilot_session"
EXECUTOR_SESSION_FILE="$SESSION_DIR/executor_session"

# Ensure session directory exists
mkdir -p "$SESSION_DIR"

# Function to start or resume a Claude session
start_claude_session() {
    local session_name=$1
    local session_file=$2
    local session_desc=$3
    
    echo "🚀 Starting $session_desc..."
    
    # Check if tmux session exists
    if tmux has-session -t "$session_name" 2>/dev/null; then
        echo "✅ Session $session_name already exists"
        
        # Check if Claude is actually running in the session
        if tmux capture-pane -t "$session_name" -p | grep -q "claude>"; then
            echo "✅ Claude is running in $session_name"
            return 0
        else
            echo "⚠️ Session exists but Claude not running, killing session..."
            tmux kill-session -t "$session_name"
        fi
    fi
    
    # Check if we have a saved session ID
    if [ -f "$session_file" ]; then
        SESSION_ID=$(cat "$session_file")
        if [[ "$SESSION_ID" =~ ^sess-[a-zA-Z0-9]+$ ]]; then
            echo "🔄 Resuming session: $SESSION_ID"
            tmux new-session -d -s "$session_name" \
                "claude code --resume $SESSION_ID --dangerously-skip-permissions"
        else
            echo "⚠️ Invalid session ID in $session_file, starting fresh"
            tmux new-session -d -s "$session_name" \
                "claude code --dangerously-skip-permissions"
        fi
    else
        echo "🆕 Starting new Claude session"
        tmux new-session -d -s "$session_name" \
            "claude code --dangerously-skip-permissions"
    fi
    
    # Wait for Claude to start
    sleep 5
    
    # Check if we need to handle authentication or initial setup
    local output=$(tmux capture-pane -t "$session_name" -p)
    
    # Handle bypass permissions prompt
    if echo "$output" | grep -q "bypass permissions"; then
        echo "📝 Accepting bypass permissions..."
        tmux send-keys -t "$session_name" "2" Enter
        sleep 3
        output=$(tmux capture-pane -t "$session_name" -p)
    fi
    
    # Handle theme selection
    if echo "$output" | grep -q "Choose the text style"; then
        echo "🎨 Selecting dark theme..."
        tmux send-keys -t "$session_name" "1" Enter
        sleep 3
        output=$(tmux capture-pane -t "$session_name" -p)
    fi
    
    # Handle authentication prompt
    if echo "$output" | grep -q "Select login method"; then
        echo "🔐 Claude needs authentication"
        echo "⚠️ Please authenticate Claude manually:"
        echo "   1. tmux attach -t $session_name"
        echo "   2. Follow the authentication prompts"
        echo "   3. Save the session ID once authenticated"
        return 1
    fi
    
    # Try to extract session ID if it's a new session
    if [ ! -f "$session_file" ]; then
        local new_session_id=$(echo "$output" | grep -o "sess-[a-zA-Z0-9]\+" | head -1)
        if [ ! -z "$new_session_id" ]; then
            echo "$new_session_id" > "$session_file"
            echo "💾 Saved session ID: $new_session_id"
        fi
    fi
    
    echo "✅ $session_desc is ready!"
    return 0
}

# Function to save session IDs from running sessions
save_session_ids() {
    echo "💾 Saving session IDs..."
    
    for session_info in "claude-pilot:$PILOT_SESSION_FILE:Pilot" "claude-executor:$EXECUTOR_SESSION_FILE:Executor"; do
        IFS=':' read -r session_name session_file desc <<< "$session_info"
        
        if tmux has-session -t "$session_name" 2>/dev/null; then
            local output=$(tmux capture-pane -t "$session_name" -p)
            local session_id=$(echo "$output" | grep -o "sess-[a-zA-Z0-9]\+" | head -1)
            
            if [ ! -z "$session_id" ]; then
                echo "$session_id" > "$session_file"
                echo "  ✅ Saved $desc session ID: $session_id"
            fi
        fi
    done
}

# Function to check session status
check_status() {
    echo "📊 Claude Relay Session Status"
    echo "================================"
    
    for session_info in "claude-pilot:$PILOT_SESSION_FILE:Pilot" "claude-executor:$EXECUTOR_SESSION_FILE:Executor"; do
        IFS=':' read -r session_name session_file desc <<< "$session_info"
        
        echo ""
        echo "🔍 $desc Session ($session_name):"
        
        # Check tmux session
        if tmux has-session -t "$session_name" 2>/dev/null; then
            echo "  ✅ tmux session exists"
            
            # Check if Claude is running
            if tmux capture-pane -t "$session_name" -p | grep -q "claude>"; then
                echo "  ✅ Claude is running"
            else
                echo "  ⚠️ Claude not responding"
            fi
        else
            echo "  ❌ tmux session not found"
        fi
        
        # Check session file
        if [ -f "$session_file" ]; then
            local session_id=$(cat "$session_file")
            echo "  📄 Session ID: $session_id"
        else
            echo "  ❌ No saved session ID"
        fi
    done
}

# Main command handling
case "$1" in
    start)
        echo "🚀 Starting Claude Relay System..."
        start_claude_session "claude-pilot" "$PILOT_SESSION_FILE" "Pilot (reformatter)"
        start_claude_session "claude-executor" "$EXECUTOR_SESSION_FILE" "Executor (worker)"
        echo ""
        echo "✅ Claude Relay System started!"
        echo "Use 'tmux attach -t claude-pilot' or 'tmux attach -t claude-executor' to connect"
        ;;
    
    stop)
        echo "🛑 Stopping Claude Relay System..."
        tmux kill-session -t "claude-pilot" 2>/dev/null && echo "  ✅ Stopped pilot session"
        tmux kill-session -t "claude-executor" 2>/dev/null && echo "  ✅ Stopped executor session"
        ;;
    
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    
    status)
        check_status
        ;;
    
    save)
        save_session_ids
        ;;
    
    attach-pilot)
        tmux attach -t "claude-pilot"
        ;;
    
    attach-executor)
        tmux attach -t "claude-executor"
        ;;
    
    *)
        echo "Claude Relay Session Manager v$VERSION"
        echo ""
        echo "Usage:"
        echo "  $0 start          - Start both pilot and executor sessions"
        echo "  $0 stop           - Stop all sessions"
        echo "  $0 restart        - Restart all sessions"
        echo "  $0 status         - Check session status"
        echo "  $0 save           - Save current session IDs"
        echo "  $0 attach-pilot   - Attach to pilot session"
        echo "  $0 attach-executor - Attach to executor session"
        echo ""
        echo "Session files stored in: $SESSION_DIR"
        ;;
esac