#!/bin/bash
# Save Claude config to persistent storage

echo "Saving Claude config to persistent storage..."

# Save .claude directory
if [ -d "/home/claude-user/.claude" ]; then
    rm -rf /data/.claude
    cp -r /home/claude-user/.claude /data/
    echo "Saved .claude directory"
fi

# Save .claude.json files
if [ -f "/home/claude-user/.claude.json" ]; then
    cp /home/claude-user/.claude.json /data/
    echo "Saved .claude.json"
fi

if [ -f "/home/claude-user/.claude.json.backup" ]; then
    cp /home/claude-user/.claude.json.backup /data/
    echo "Saved .claude.json.backup"
fi

# Set proper ownership
chown -R claude-user:claude-user /data/.claude* 2>/dev/null || true

echo "Claude config saved successfully"