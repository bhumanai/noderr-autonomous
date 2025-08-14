#!/bin/bash

# Extract Claude OAuth Token for Deployment
# This gets the OAuth credentials from local Claude installation

set -e

echo "========================================"
echo "CLAUDE OAUTH TOKEN EXTRACTOR"
echo "========================================"

# Check for Claude CLI
if ! command -v claude &> /dev/null; then
    echo "❌ Claude CLI not installed"
    echo "Install with: npm install -g @anthropic-ai/claude-code"
    exit 1
fi

# Possible credential locations
CRED_LOCATIONS=(
    "$HOME/.claude/credentials.json"
    "$HOME/.config/claude/credentials.json"
    "$HOME/.claude-code/credentials.json"
    "$HOME/.config/claude-code/auth.json"
)

CLAUDE_CREDS=""
for loc in "${CRED_LOCATIONS[@]}"; do
    if [ -f "$loc" ]; then
        CLAUDE_CREDS="$loc"
        echo "✅ Found credentials at: $loc"
        break
    fi
done

if [ -z "$CLAUDE_CREDS" ]; then
    echo "❌ No Claude credentials found!"
    echo ""
    echo "You need to login first:"
    echo "  claude login"
    echo ""
    echo "This will open a browser for OAuth authentication"
    exit 1
fi

# Check for settings
SETTINGS_LOCATIONS=(
    "$HOME/.claude/settings.json"
    "$HOME/.config/claude/settings.json"
    "$HOME/.claude-code/settings.json"
)

CLAUDE_SETTINGS=""
for loc in "${SETTINGS_LOCATIONS[@]}"; do
    if [ -f "$loc" ]; then
        CLAUDE_SETTINGS="$loc"
        echo "✅ Found settings at: $loc"
        break
    fi
done

# Create deployment package
echo ""
echo "Creating deployment package..."
rm -rf claude-auth-package
mkdir -p claude-auth-package

# Copy credentials
cp "$CLAUDE_CREDS" claude-auth-package/credentials.json
echo "  ✓ Copied credentials.json"

# Copy or create settings
if [ -n "$CLAUDE_SETTINGS" ]; then
    cp "$CLAUDE_SETTINGS" claude-auth-package/settings.json
    echo "  ✓ Copied existing settings.json"
else
    echo "  Creating default settings with full permissions..."
    cat > claude-auth-package/settings.json <<'EOF'
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "tmux(*)",
      "Read(*)",
      "Edit(*)",
      "Write(*)",
      "GitExec(*)",
      "GitAuth(*)"
    ]
  },
  "dangerouslySkipPermissions": true,
  "autoCompactEnabled": true,
  "verbose": false
}
EOF
    echo "  ✓ Created settings.json"
fi

# Add config file for complete setup
cat > claude-auth-package/config.json <<'EOF'
{
  "version": "1.0",
  "extracted_at": "TIMESTAMP",
  "includes": ["credentials.json", "settings.json"],
  "deployment": "fly.io"
}
EOF

# Update timestamp
sed -i "s/TIMESTAMP/$(date -Iseconds)/" claude-auth-package/config.json

# Create tarball
tar -czf claude-auth.tar.gz -C claude-auth-package .
echo ""
echo "✅ Created claude-auth.tar.gz"

# Show package contents
echo ""
echo "Package contents:"
tar -tzf claude-auth.tar.gz | sed 's/^/  /'

# Extract token for GitHub secrets (optional)
echo ""
echo "========================================"
echo "FOR GITHUB SECRETS (Optional)"
echo "========================================"
echo ""
echo "To add to GitHub secrets:"
echo "1. Run: base64 claude-auth.tar.gz | pbcopy  # (Mac)"
echo "   Or:  base64 claude-auth.tar.gz | xclip   # (Linux)"
echo ""
echo "2. Add to GitHub repo secrets as: CLAUDE_AUTH_PACKAGE"
echo ""
echo "3. In GitHub Actions, decode with:"
echo "   echo \"\${{ secrets.CLAUDE_AUTH_PACKAGE }}\" | base64 -d > claude-auth.tar.gz"
echo ""

# Show next steps
echo "========================================"
echo "NEXT STEPS"
echo "========================================"
echo ""
echo "1. Deploy this package to Fly.io:"
echo "   ./deploy-oauth-to-fly.sh"
echo ""
echo "2. Or manually upload:"
echo "   fly ssh sftp shell --app uncle-frank-claude"
echo "   put claude-auth.tar.gz /data/"
echo ""
echo "✅ Token extraction complete!"