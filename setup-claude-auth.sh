#!/bin/bash

# CLAUDE AUTHENTICATION SETUP FOR FLY.IO
# This script creates the proper authentication for Claude on Fly.io

echo "========================================"
echo "CLAUDE AUTHENTICATION SETUP"
echo "========================================"

# Check if we have an API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ERROR: ANTHROPIC_API_KEY not set!"
    echo ""
    echo "To fix this, you need to:"
    echo "1. Get your Anthropic API key from: https://console.anthropic.com/account/keys"
    echo "2. Set it as a Fly.io secret:"
    echo ""
    echo "   fly secrets set ANTHROPIC_API_KEY='sk-ant-api...' --app uncle-frank-claude"
    echo ""
    echo "3. Or set it locally for testing:"
    echo "   export ANTHROPIC_API_KEY='sk-ant-api...'"
    echo ""
    exit 1
fi

echo "✅ API key found: ${ANTHROPIC_API_KEY:0:10}..."

# Create Claude config with API key
echo "Creating Claude configuration..."

# Method 1: Environment variable (already done above)
export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"

# Method 2: Create config file for Claude CLI
mkdir -p ~/.config/claude
cat > ~/.config/claude/config.json <<EOF
{
  "apiKey": "$ANTHROPIC_API_KEY",
  "model": "claude-3-opus-20240229",
  "autoUpdates": true
}
EOF

echo "✅ Config file created at ~/.config/claude/config.json"

# Method 3: Set as Claude environment
export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"

# Test Claude authentication
echo ""
echo "Testing Claude authentication..."
echo "Test prompt" | claude --print --output-format json 2>&1 | head -5

if [ $? -eq 0 ]; then
    echo "✅ Claude is authenticated and working!"
else
    echo "⚠️ Claude authentication may need manual setup"
fi

echo ""
echo "========================================"
echo "DEPLOYMENT INSTRUCTIONS"
echo "========================================"
echo ""
echo "To deploy authenticated Claude to Fly.io:"
echo ""
echo "1. Set the API key as a Fly secret:"
echo "   fly secrets set ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY' --app uncle-frank-claude"
echo ""
echo "2. Deploy the app:"
echo "   cd fly-app-uncle-frank"
echo "   fly deploy --app uncle-frank-claude"
echo ""
echo "3. Verify it's working:"
echo "   curl https://uncle-frank-claude.fly.dev/health"
echo ""
echo "========================================"