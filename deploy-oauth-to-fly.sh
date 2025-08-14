#!/bin/bash

# Deploy OAuth Credentials to Fly.io
# This uploads and configures Claude OAuth authentication

set -e

echo "========================================"
echo "DEPLOY OAUTH TO FLY.IO"
echo "========================================"

APP_NAME="${FLY_APP:-uncle-frank-claude}"

# Check for auth package
if [ ! -f "claude-auth.tar.gz" ]; then
    echo "❌ No claude-auth.tar.gz found!"
    echo "   Run: ./extract-claude-token.sh first"
    exit 1
fi

echo "✅ Found claude-auth.tar.gz"

# Check fly CLI
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not installed"
    echo "   Install: curl -L https://fly.io/install.sh | sh"
    exit 1
fi

echo "✅ Fly CLI available"

# Check app exists
echo ""
echo "Checking Fly.io app: $APP_NAME"
if ! fly status --app "$APP_NAME" &>/dev/null; then
    echo "❌ App $APP_NAME not found"
    echo "   Create with: fly apps create $APP_NAME"
    exit 1
fi

echo "✅ App exists"

# Create persistent volume if not exists
echo ""
echo "Ensuring persistent volume..."
if ! fly volumes list --app "$APP_NAME" | grep -q claude_data; then
    echo "Creating volume claude_data..."
    fly volumes create claude_data --size 1 --region ord --app "$APP_NAME"
else
    echo "✅ Volume claude_data exists"
fi

# Upload credentials
echo ""
echo "Uploading OAuth credentials..."

# Create directory structure
fly ssh console --app "$APP_NAME" << 'EOF'
echo "Creating directory structure..."
mkdir -p /data/.claude
mkdir -p /home/claude-user/.claude
chown -R claude-user:claude-user /data/.claude
chown -R claude-user:claude-user /home/claude-user
echo "✅ Directories created"
EOF

# Transfer auth package via SFTP
echo ""
echo "Transferring auth package..."
fly ssh sftp shell --app "$APP_NAME" << EOF
put claude-auth.tar.gz /tmp/claude-auth.tar.gz
EOF

# Extract and configure
echo ""
echo "Extracting and configuring..."
fly ssh console --app "$APP_NAME" << 'EOF'
cd /tmp
if [ -f claude-auth.tar.gz ]; then
    echo "Extracting credentials..."
    tar -xzf claude-auth.tar.gz -C /data/.claude/
    
    # Set permissions
    chown -R claude-user:claude-user /data/.claude
    chmod 600 /data/.claude/credentials.json
    chmod 644 /data/.claude/settings.json
    
    # Create symlinks for claude-user
    sudo -u claude-user ln -sf /data/.claude /home/claude-user/.claude
    
    # Verify
    echo ""
    echo "Verification:"
    ls -la /data/.claude/
    
    if [ -f /data/.claude/credentials.json ]; then
        echo "✅ Credentials deployed successfully!"
    else
        echo "❌ Credentials not found!"
        exit 1
    fi
    
    # Clean up
    rm -f /tmp/claude-auth.tar.gz
else
    echo "❌ Auth package not found in /tmp"
    exit 1
fi
EOF

# Update startup script to use OAuth
echo ""
echo "Updating startup configuration..."

fly ssh console --app "$APP_NAME" << 'STARTUP_EOF'
cat > /app/start-oauth.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting Claude with OAuth authentication..."

# Ensure claude-user exists
if ! id -u claude-user &>/dev/null; then
    useradd -m -s /bin/bash claude-user
fi

# Setup environment
export HOME=/home/claude-user
export CLAUDE_HOME=/data/.claude

# Link credentials from persistent storage
if [ -d "/data/.claude" ] && [ -f "/data/.claude/credentials.json" ]; then
    echo "✅ OAuth credentials found"
    
    # Ensure symlink exists
    rm -rf $HOME/.claude
    ln -sf /data/.claude $HOME/.claude
    chown -R claude-user:claude-user $HOME
    
    # Start Claude with OAuth
    sudo -u claude-user -E tmux new-session -d -s claude-code \
        "cd /workspace && claude --dangerously-skip-permissions"
    
    echo "✅ Claude started with OAuth authentication"
else
    echo "❌ No OAuth credentials found in /data/.claude"
    exit 1
fi

# Monitor session
while true; do
    if ! sudo -u claude-user tmux has-session -t claude-code 2>/dev/null; then
        echo "Restarting Claude..."
        sudo -u claude-user -E tmux new-session -d -s claude-code \
            "cd /workspace && claude --dangerously-skip-permissions"
    fi
    sleep 60
done
EOF

chmod +x /app/start-oauth.sh
echo "✅ Startup script updated"
STARTUP_EOF

# Restart the app with OAuth
echo ""
echo "Restarting app with OAuth authentication..."
fly apps restart "$APP_NAME"

# Wait for restart
echo "Waiting for app to restart (30 seconds)..."
sleep 30

# Test authentication
echo ""
echo "========================================"
echo "TESTING OAUTH AUTHENTICATION"
echo "========================================"

# Check health
HEALTH_URL="https://$APP_NAME.fly.dev/health"
echo "Checking $HEALTH_URL..."

if curl -s "$HEALTH_URL" | grep -q '"claude_session":true'; then
    echo ""
    echo "🎉 SUCCESS! Claude is authenticated with OAuth!"
    echo ""
    echo "The Noderr system is now FULLY OPERATIONAL with OAuth!"
    echo ""
    echo "Test with:"
    echo "  python3 test-authenticated-claude.py"
else
    echo ""
    echo "⚠️ Claude session not detected yet"
    echo ""
    echo "Check logs with:"
    echo "  fly logs --app $APP_NAME"
    echo ""
    echo "SSH to debug:"
    echo "  fly ssh console --app $APP_NAME"
    echo "  tmux attach -t claude-code"
fi

echo ""
echo "========================================"
echo "✅ OAuth deployment complete!"
echo "========================================"