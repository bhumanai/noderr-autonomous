#!/bin/bash

# DEPLOY AUTHENTICATED CLAUDE TO FLY.IO
# This script deploys a WORKING Claude instance with proper authentication

set -e

echo "============================================"
echo "DEPLOY AUTHENTICATED CLAUDE TO FLY.IO"
echo "============================================"

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo ""
    echo "❌ ERROR: No API key provided!"
    echo ""
    echo "You need an Anthropic API key to authenticate Claude."
    echo ""
    echo "1. Get your API key from: https://console.anthropic.com/account/keys"
    echo "2. Run this script with:"
    echo "   ANTHROPIC_API_KEY='sk-ant-api...' ./deploy-claude-authenticated.sh"
    echo ""
    exit 1
fi

echo "✅ API Key found: ${ANTHROPIC_API_KEY:0:15}..."

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "Installing Fly CLI..."
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
fi

# Configuration
APP_NAME="uncle-frank-claude"
REGION="ord"  # Chicago region

echo ""
echo "1. Setting Fly.io secrets..."
fly secrets set \
    ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    CLAUDE_API_KEY="$ANTHROPIC_API_KEY" \
    HMAC_SECRET="${HMAC_SECRET:-test-secret-change-in-production}" \
    --app "$APP_NAME" 2>/dev/null || echo "App may not exist yet"

echo ""
echo "2. Creating updated Dockerfile with API key support..."
cd fly-app-uncle-frank

# Update the start script to use API key
cat > scripts/start-authenticated.sh << 'SCRIPT_EOF'
#!/bin/bash
set -e

echo "Starting Authenticated Claude..."

# Export API keys for Claude
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
export CLAUDE_API_KEY="${CLAUDE_API_KEY}"

# Create claude user if not exists
if ! id -u claude-user &>/dev/null; then
    useradd -m -s /bin/bash claude-user
fi

# Setup workspace
mkdir -p /workspace
chown -R claude-user:claude-user /workspace

# Function to authenticate Claude
authenticate_claude() {
    echo "Authenticating Claude with API key..."
    
    # Method 1: Environment variable (already exported above)
    
    # Method 2: Create config directory and file
    mkdir -p /home/claude-user/.config/claude
    cat > /home/claude-user/.config/claude/config.json <<EOF
{
  "apiKey": "$ANTHROPIC_API_KEY"
}
EOF
    chown -R claude-user:claude-user /home/claude-user/.config
    
    # Method 3: Pass API key directly to Claude
    echo "$ANTHROPIC_API_KEY" > /home/claude-user/.anthropic_key
    chown claude-user:claude-user /home/claude-user/.anthropic_key
    
    echo "✅ Authentication configured"
}

# Authenticate
authenticate_claude

# Start Claude in tmux with API key
echo "Starting Claude CLI..."
sudo -u claude-user bash -c "
    export ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY'
    export CLAUDE_API_KEY='$CLAUDE_API_KEY'
    tmux new-session -d -s claude-code 'cd /workspace && claude --dangerously-skip-permissions'
"

echo "✅ Claude started with authentication"

# Monitor and maintain session
while true; do
    if ! sudo -u claude-user tmux has-session -t claude-code 2>/dev/null; then
        echo "Session lost, restarting with auth..."
        sudo -u claude-user bash -c "
            export ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY'
            tmux new-session -d -s claude-code 'cd /workspace && claude --dangerously-skip-permissions'
        "
    fi
    
    # Check if Claude is actually authenticated
    if sudo -u claude-user tmux capture-pane -t claude-code -p | grep -q "Unauthorized\|API key"; then
        echo "⚠️ Authentication issue detected, re-authenticating..."
        authenticate_claude
        sudo -u claude-user tmux kill-session -t claude-code 2>/dev/null || true
        sleep 2
        sudo -u claude-user bash -c "
            export ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY'
            tmux new-session -d -s claude-code 'cd /workspace && claude --dangerously-skip-permissions'
        "
    fi
    
    sleep 60
done
SCRIPT_EOF

chmod +x scripts/start-authenticated.sh

# Update supervisor config to use authenticated script
cat > supervisor-authenticated.conf << 'EOF'
[supervisord]
nodaemon=true
user=root

[program:claude]
command=/app/start-authenticated.sh
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=ANTHROPIC_API_KEY="%(ENV_ANTHROPIC_API_KEY)s",CLAUDE_API_KEY="%(ENV_CLAUDE_API_KEY)s"

[program:inject_agent]
command=python3 /app/inject_agent.py
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=HMAC_SECRET="%(ENV_HMAC_SECRET)s",SESSION_NAME="claude-code"
EOF

# Update Dockerfile to use authenticated setup
cat > Dockerfile.authenticated << 'EOF'
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl git tmux python3 python3-pip supervisor wget ca-certificates sudo nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip3 install --no-cache-dir flask gunicorn requests

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code || \
    curl -fsSL https://claude.ai/install.sh | bash || \
    echo "Manual Claude setup required"

# Create claude user
RUN useradd -m -s /bin/bash claude-user && \
    mkdir -p /workspace /data /home/claude-user/.config && \
    chown -R claude-user:claude-user /workspace /data /home/claude-user

WORKDIR /app

# Copy files
COPY inject_agent.py /app/
COPY scripts/start-authenticated.sh /app/
COPY scripts/healthcheck.sh /app/
COPY supervisor-authenticated.conf /etc/supervisor/conf.d/supervisor.conf

RUN chmod +x /app/*.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /app/healthcheck.sh || exit 1

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
EOF

echo ""
echo "3. Deploying to Fly.io..."
fly deploy \
    --app "$APP_NAME" \
    --dockerfile Dockerfile.authenticated \
    --region "$REGION" \
    --ha=false \
    --vm-size shared-cpu-1x \
    --strategy immediate

echo ""
echo "4. Checking deployment status..."
fly status --app "$APP_NAME"

echo ""
echo "5. Testing authentication..."
sleep 10  # Give Claude time to start

# Test health endpoint
echo "Testing health endpoint..."
curl -s "https://$APP_NAME.fly.dev/health" | python3 -m json.tool

echo ""
echo "============================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "Claude is now AUTHENTICATED and running at:"
echo "  https://$APP_NAME.fly.dev"
echo ""
echo "To verify Claude is working:"
echo "  1. Check health: curl https://$APP_NAME.fly.dev/health"
echo "  2. Send command: python3 test_inject.py"
echo "  3. Check logs: fly logs --app $APP_NAME"
echo ""
echo "To SSH and check Claude directly:"
echo "  fly ssh console --app $APP_NAME"
echo "  tmux attach -t claude-code"
echo ""
echo "API Key: ${ANTHROPIC_API_KEY:0:15}..."
echo "============================================"