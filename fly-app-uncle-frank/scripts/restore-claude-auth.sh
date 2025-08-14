#!/bin/bash
# Restore Claude authentication from persistent storage

echo "Restoring Claude authentication from persistent storage..."

# Check if backup exists
if [ ! -d "/data/claude-auth-backup" ]; then
    echo "No authentication backup found in /data/claude-auth-backup"
    exit 1
fi

# Ensure claude-user directories exist
mkdir -p /home/claude-user/.config
chown -R claude-user:claude-user /home/claude-user

# Restore .anthropic directory if it exists
if [ -d "/data/claude-auth-backup/.anthropic" ]; then
    cp -r /data/claude-auth-backup/.anthropic /home/claude-user/
    chown -R claude-user:claude-user /home/claude-user/.anthropic
    echo "Restored .anthropic directory"
fi

# Restore any .claude* files/directories
for item in /data/claude-auth-backup/.claude*; do
    if [ -e "$item" ]; then
        cp -r "$item" /home/claude-user/
        chown -R claude-user:claude-user "/home/claude-user/$(basename $item)"
        echo "Restored $(basename $item)"
    fi
done

# Restore config files (excluding .anthropic if already restored)
if [ -d "/data/claude-auth-backup" ]; then
    for item in /data/claude-auth-backup/*; do
        # Skip directories we've already handled
        basename_item=$(basename "$item")
        if [[ ! "$basename_item" =~ ^\.claude ]] && [[ "$basename_item" != ".anthropic" ]] && [[ "$basename_item" != "root" ]]; then
            if [ -e "$item" ]; then
                cp -r "$item" /home/claude-user/.config/
                echo "Restored .config/$basename_item"
            fi
        fi
    done
    chown -R claude-user:claude-user /home/claude-user/.config
fi

echo "Claude authentication restored successfully"

# Verify by checking auth status
echo "Verifying authentication..."
sudo -u claude-user claude auth status || echo "Auth status check failed - may need manual authentication"