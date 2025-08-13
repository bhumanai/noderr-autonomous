#!/bin/bash

# Health check script for Fly.io
# Checks if both tmux session and injection agent are running

SESSION_NAME="${SESSION_NAME:-claude}"
HEALTH_FILE="/tmp/health_status"

# Check tmux session
tmux has-session -t "$SESSION_NAME" 2>/dev/null
TMUX_STATUS=$?

# Check injection agent
curl -f -s http://localhost:8080/health > /dev/null 2>&1
AGENT_STATUS=$?

# Create health status file for HTTP server
if [ $TMUX_STATUS -eq 0 ] && [ $AGENT_STATUS -eq 0 ]; then
    echo '{"status": "healthy", "tmux": true, "agent": true}' > "$HEALTH_FILE"
    exit 0
else
    echo '{"status": "unhealthy", "tmux": '$((TMUX_STATUS == 0))', "agent": '$((AGENT_STATUS == 0))'}' > "$HEALTH_FILE"
    exit 1
fi