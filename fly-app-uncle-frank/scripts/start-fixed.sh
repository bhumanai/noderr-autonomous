#!/bin/bash
set -e

# Start Claude in tmux session
echo 'Starting Claude Code CLI...'

# Restore config from persistent storage
if [ -f /data/.claude.json ]; then
    cp /data/.claude.json /home/claude-user/.claude.json
    chown claude-user:claude-user /home/claude-user/.claude.json
    echo 'Config restored'
fi

# Start tmux session
sudo -u claude-user tmux new-session -d -s claude-code 'cd /workspace && claude --dangerously-skip-permissions'

# Keep the script running
while true; do
    if ! sudo -u claude-user tmux has-session -t claude-code 2>/dev/null; then
        echo 'Session lost, restarting...'
        sudo -u claude-user tmux new-session -d -s claude-code 'cd /workspace && claude --dangerously-skip-permissions'
    fi
    sleep 60
done