#!/bin/bash
# Save Claude authentication to persistent storage

echo "Saving Claude authentication to persistent storage..."

# Create backup directory
mkdir -p /data/claude-auth-backup

# Save all Claude/Anthropic configuration
if [ -d "/home/claude-user/.config" ]; then
    cp -r /home/claude-user/.config/* /data/claude-auth-backup/ 2>/dev/null || true
    echo "Saved .config directory"
fi

if [ -d "/home/claude-user/.anthropic" ]; then
    cp -r /home/claude-user/.anthropic /data/claude-auth-backup/
    echo "Saved .anthropic directory"
fi

# Save any .claude* files/directories
for item in /home/claude-user/.claude*; do
    if [ -e "$item" ]; then
        cp -r "$item" /data/claude-auth-backup/
        echo "Saved $(basename $item)"
    fi
done

# Also check root user directory (in case auth was done as root)
if [ -d "/root/.anthropic" ]; then
    mkdir -p /data/claude-auth-backup/root
    cp -r /root/.anthropic /data/claude-auth-backup/root/
    echo "Saved root .anthropic directory"
fi

echo "Claude authentication saved successfully"
ls -la /data/claude-auth-backup/