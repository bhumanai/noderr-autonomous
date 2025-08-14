#!/bin/bash

# DEPLOY REAL OAUTH CREDENTIALS TO FLY.IO
# This uses the ACTUAL OAuth tokens, not API keys

set -e

echo "========================================"
echo "DEPLOYING REAL OAUTH TO FLY.IO"
echo "========================================"

APP_NAME="uncle-frank-claude"

# Package the REAL OAuth credentials
echo "Packaging OAuth credentials..."
mkdir -p oauth-deploy
cp ~/.claude/.credentials.json oauth-deploy/.credentials.json 2>/dev/null || {
    echo "❌ No OAuth credentials found at ~/.claude/.credentials.json"
    echo "Run: claude login"
    exit 1
}

# Also copy Claude config if it exists
if [ -f ~/.claude.json ]; then
    cp ~/.claude.json oauth-deploy/.claude.json
    echo "✅ Found Claude config"
fi

# Create tarball
cd oauth-deploy
tar -czf ../claude-oauth-real.tar.gz .
cd ..
rm -rf oauth-deploy

echo "✅ Created claude-oauth-real.tar.gz"

# Upload to Fly.io
echo ""
echo "Uploading to Fly.io..."

# Create directory
fly ssh console --app "$APP_NAME" << 'EOF' || true
mkdir -p /home/claude-user/.claude
chown -R claude-user:claude-user /home/claude-user
EOF

# Transfer file
echo "Transferring OAuth package..."
fly ssh sftp shell --app "$APP_NAME" << EOF
put claude-oauth-real.tar.gz /tmp/claude-oauth-real.tar.gz
EOF

# Extract and setup
echo "Setting up OAuth on server..."
fly ssh console --app "$APP_NAME" << 'EOF'
# Extract OAuth credentials
cd /home/claude-user/.claude
tar -xzf /tmp/claude-oauth-real.tar.gz

# Set permissions
chown -R claude-user:claude-user /home/claude-user/.claude
chmod 600 /home/claude-user/.claude/.credentials.json

# Verify OAuth format
python3 << 'PYCHECK'
import json
try:
    with open('/home/claude-user/.claude/.credentials.json') as f:
        creds = json.load(f)
    if 'claudeAiOauth' in creds:
        print("✅ OAuth credentials installed correctly")
        token = creds['claudeAiOauth']['accessToken']
        print(f"   Token: {token[:20]}...")
    else:
        print("❌ Wrong credential format!")
except Exception as e:
    print(f"❌ Error: {e}")
PYCHECK

# Clean up
rm -f /tmp/claude-oauth-real.tar.gz
EOF

# Update start script to NOT use API keys
echo ""
echo "Updating startup script..."
fly ssh console --app "$APP_NAME" << 'EOF'
cat > /app/start-oauth-real.sh << 'SCRIPT'
#!/bin/bash
set -e

echo "Starting Claude with REAL OAuth..."

# NO API KEYS! Claude CLI uses OAuth from ~/.claude/.credentials.json

# Ensure claude-user exists
if ! id -u claude-user &>/dev/null; then
    useradd -m -s /bin/bash claude-user
fi

# Verify OAuth exists
if [ ! -f /home/claude-user/.claude/.credentials.json ]; then
    echo "❌ No OAuth credentials found!"
    exit 1
fi

echo "✅ OAuth credentials found"

# Start Claude - it will use OAuth automatically
sudo -u claude-user tmux new-session -d -s claude-code \
    "cd /workspace && claude --dangerously-skip-permissions"

echo "✅ Claude started with OAuth"

# Monitor
while true; do
    if ! sudo -u claude-user tmux has-session -t claude-code 2>/dev/null; then
        echo "Restarting Claude..."
        sudo -u claude-user tmux new-session -d -s claude-code \
            "cd /workspace && claude --dangerously-skip-permissions"
    fi
    sleep 60
done
SCRIPT

chmod +x /app/start-oauth-real.sh
echo "✅ Startup script updated"

# Kill old tmux sessions
tmux kill-server 2>/dev/null || true

# Start with OAuth
/app/start-oauth-real.sh &
EOF

echo ""
echo "Restarting app..."
fly apps restart "$APP_NAME"

echo ""
echo "========================================"
echo "✅ REAL OAUTH DEPLOYED!"
echo "========================================"
echo ""
echo "OAuth token deployed (expires in ~5 hours)"
echo ""
echo "Test with:"
echo "  curl https://$APP_NAME.fly.dev/health"
echo ""
echo "SSH to verify:"
echo "  fly ssh console --app $APP_NAME"
echo "  sudo -u claude-user tmux attach -t claude-code"
echo ""
echo "IMPORTANT: Token expires at 2025-08-14 20:41:16 UTC"
echo "========================================"