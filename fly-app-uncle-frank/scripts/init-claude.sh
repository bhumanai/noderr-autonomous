#!/bin/bash
# Initialize Claude with saved config from persistent storage

echo "Initializing Claude configuration..."

# The config should already be saved in /data from previous sessions
if [ -f "/data/.claude.json" ]; then
    echo "Restoring Claude config from persistent storage..."
    cp /data/.claude.json /home/claude-user/.claude.json
    chown claude-user:claude-user /home/claude-user/.claude.json
    echo "Claude config restored - Claude is pre-authorized!"
else
    echo "Warning: No saved Claude config found in /data/.claude.json"
    echo "You may need to authenticate Claude manually"
fi

# Also restore .claude directory if it exists
if [ -d "/data/.claude" ]; then
    echo "Restoring .claude directory..."
    cp -r /data/.claude /home/claude-user/
    chown -R claude-user:claude-user /home/claude-user/.claude
fi

# Ensure workspace permissions
mkdir -p /workspace
chown -R claude-user:claude-user /workspace

echo "Claude config initialization complete"