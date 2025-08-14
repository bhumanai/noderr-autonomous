#!/bin/bash
# Ensure Claude Code CLI is installed and available

echo "Checking for Claude Code CLI..."

# Check if claude command exists
if command -v claude &> /dev/null; then
    echo "Claude CLI found at: $(which claude)"
    claude --version || echo "Version check failed"
    exit 0
fi

echo "Claude CLI not found, attempting to install..."

# Try npm install
if command -v npm &> /dev/null; then
    echo "Attempting npm install..."
    npm install -g @anthropic-ai/claude-code && echo "Installed via npm" && exit 0
    npm install -g claude && echo "Installed claude via npm" && exit 0
fi

# Try install script
echo "Attempting install script..."
curl -fsSL https://claude.ai/install.sh | bash && echo "Installed via script" && exit 0

# Try alternative locations
for path in /usr/local/bin/claude /root/.local/bin/claude /home/claude-user/.local/bin/claude; do
    if [ -f "$path" ]; then
        echo "Found claude at $path, creating symlink..."
        ln -sf "$path" /usr/bin/claude
        echo "Claude CLI linked successfully"
        exit 0
    fi
done

# Create a mock claude command that returns proper errors
echo "Creating mock claude command for error handling..."
cat > /usr/bin/claude << 'EOF'
#!/bin/bash
echo "Error: Claude Code CLI is not installed"
echo "Please install manually or check deployment logs"
exit 1
EOF
chmod +x /usr/bin/claude

echo "Warning: Claude CLI could not be installed automatically"
exit 1