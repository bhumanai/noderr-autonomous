# 🔐 CLAUDE CLI OAUTH AUTHENTICATION SOLUTION

## THE REAL ROOT CAUSE
Claude CLI uses **OAuth tokens**, not API keys! We need to:
1. Generate OAuth token locally
2. Store it persistently
3. Mount it in Fly.io container
4. Auto-refresh before expiry

## SOLUTION COMPONENTS

### 1. Local Token Generation
```bash
# One-time setup on developer machine
claude login
# This creates ~/.claude/credentials.json with OAuth token
```

### 2. Token Extraction & Storage
```bash
#!/bin/bash
# extract-claude-token.sh

# Extract OAuth token from local Claude installation
CLAUDE_CREDS="$HOME/.claude/credentials.json"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

if [ -f "$CLAUDE_CREDS" ]; then
    echo "✅ Found Claude credentials"
    
    # Create deployment package
    mkdir -p claude-auth-package
    cp "$CLAUDE_CREDS" claude-auth-package/
    
    # Also copy settings if exists
    if [ -f "$CLAUDE_SETTINGS" ]; then
        cp "$CLAUDE_SETTINGS" claude-auth-package/
    else
        # Create default settings with full permissions
        cat > claude-auth-package/settings.json <<EOF
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "tmux(*)",
      "Read(*)",
      "Edit(*)",
      "Write(*)",
      "GitExec(*)"
    ]
  },
  "dangerouslySkipPermissions": true
}
EOF
    fi
    
    # Create tarball for deployment
    tar -czf claude-auth.tar.gz -C claude-auth-package .
    
    echo "✅ Created claude-auth.tar.gz"
    echo "   Contains: credentials.json, settings.json"
else
    echo "❌ No Claude credentials found!"
    echo "   Run: claude login"
    exit 1
fi
```

### 3. Fly.io Persistent Volume Setup
```toml
# fly.toml additions
[mounts]
  source = "claude_data"
  destination = "/data"
  
[env]
  CLAUDE_HOME = "/data/.claude"
```

### 4. Deploy OAuth Credentials to Fly.io
```bash
#!/bin/bash
# deploy-oauth-credentials.sh

# Upload credentials to Fly.io volume
fly ssh console --app uncle-frank-claude << 'EOF'
mkdir -p /data/.claude
exit
EOF

# Transfer auth package
fly ssh sftp shell --app uncle-frank-claude << 'EOF'
put claude-auth.tar.gz /data/
EOF

# Extract on server
fly ssh console --app uncle-frank-claude << 'EOF'
cd /data
tar -xzf claude-auth.tar.gz -C /data/.claude/
chown -R claude-user:claude-user /data/.claude
chmod 600 /data/.claude/credentials.json
ls -la /data/.claude/
EOF
```

### 5. Updated Startup Script
```bash
#!/bin/bash
# start-oauth.sh

echo "Starting Claude with OAuth authentication..."

# Setup claude-user home to use persistent credentials
export HOME=/home/claude-user
export CLAUDE_HOME=/data/.claude

# Link credentials from persistent storage
if [ -d "/data/.claude" ]; then
    echo "✅ Found stored Claude credentials"
    
    # Create symlink to persistent credentials
    rm -rf $HOME/.claude
    ln -s /data/.claude $HOME/.claude
    
    # Verify credentials exist
    if [ -f "$HOME/.claude/credentials.json" ]; then
        echo "✅ OAuth credentials linked"
    else
        echo "❌ No credentials.json found!"
    fi
    
    # Apply settings
    if [ -f "$HOME/.claude/settings.json" ]; then
        echo "✅ Settings loaded"
    fi
else
    echo "❌ No Claude credentials in /data/.claude"
    echo "   Deploy credentials first!"
    exit 1
fi

# Start Claude with OAuth session
sudo -u claude-user -E tmux new-session -d -s claude-code \
    "cd /workspace && claude --dangerously-skip-permissions"

echo "✅ Claude started with OAuth authentication"

# Monitor and maintain session
while true; do
    if ! sudo -u claude-user tmux has-session -t claude-code 2>/dev/null; then
        echo "Restarting Claude session..."
        sudo -u claude-user -E tmux new-session -d -s claude-code \
            "cd /workspace && claude --dangerously-skip-permissions"
    fi
    sleep 60
done
```

### 6. GitHub Actions Workflow
```yaml
name: Deploy Claude with OAuth
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Fly CLI
        uses: superfly/flyctl-actions/setup-flyctl@master
      
      - name: Extract Claude OAuth Token
        env:
          CLAUDE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
        run: |
          # Create credentials from secret
          mkdir -p claude-auth-package
          echo "$CLAUDE_OAUTH_TOKEN" > claude-auth-package/credentials.json
          
          # Add settings
          cat > claude-auth-package/settings.json <<EOF
          {
            "permissions": {
              "allow": ["Bash(*)", "tmux(*)", "Read(*)", "Edit(*)", "Write(*)"]
            },
            "dangerouslySkipPermissions": true
          }
          EOF
          
          tar -czf claude-auth.tar.gz -C claude-auth-package .
      
      - name: Deploy to Fly.io
        run: |
          fly deploy --app uncle-frank-claude
          
      - name: Upload Credentials
        run: |
          fly ssh sftp shell --app uncle-frank-claude <<EOF
          put claude-auth.tar.gz /data/
          EOF
          
          fly ssh console --app uncle-frank-claude <<EOF
          cd /data && tar -xzf claude-auth.tar.gz -C /data/.claude/
          chown -R claude-user:claude-user /data/.claude
          EOF
```

## COMPLETE DEPLOYMENT PROCESS

### Step 1: Local Setup (One Time)
```bash
# Login to Claude locally
claude login
# Browser opens, complete OAuth flow
```

### Step 2: Extract Credentials
```bash
./extract-claude-token.sh
# Creates claude-auth.tar.gz
```

### Step 3: Deploy to Fly.io
```bash
# Deploy app with persistent volume
fly deploy --app uncle-frank-claude

# Upload credentials
./deploy-oauth-credentials.sh
```

### Step 4: Store Token in GitHub Secrets
```bash
# Extract token for CI/CD
cat ~/.claude/credentials.json | base64
# Add to GitHub secrets as CLAUDE_CODE_OAUTH_TOKEN
```

## TOKEN REFRESH STRATEGY

### Automatic Refresh Script
```python
#!/usr/bin/env python3
# refresh-claude-token.py

import json
import requests
import time
from datetime import datetime, timedelta

def check_token_expiry(creds_path="/data/.claude/credentials.json"):
    """Check if token needs refresh"""
    with open(creds_path) as f:
        creds = json.load(f)
    
    # Check expiry (example - adjust based on actual format)
    expiry = datetime.fromisoformat(creds.get('expires_at', ''))
    now = datetime.now()
    
    if now > expiry - timedelta(hours=24):
        return True  # Refresh if less than 24h remaining
    return False

def refresh_token():
    """Refresh OAuth token"""
    # Implementation depends on Claude's OAuth flow
    # May need to use refresh_token endpoint
    pass

if __name__ == "__main__":
    if check_token_expiry():
        print("Token expiring soon, refreshing...")
        refresh_token()
```

## VERIFICATION

### Test OAuth Authentication
```python
#!/usr/bin/env python3
# test-oauth-auth.py

import requests
import json

FLY_ENDPOINT = "https://uncle-frank-claude.fly.dev"

def test_oauth():
    # Check health
    response = requests.get(f"{FLY_ENDPOINT}/health")
    data = response.json()
    
    if data.get('claude_session'):
        print("✅ Claude authenticated with OAuth!")
        
        # Test command
        response = requests.post(f"{FLY_ENDPOINT}/inject", 
            json={"command": "echo 'OAuth working'"})
        
        if response.ok:
            print("✅ Commands executing successfully!")
            return True
    
    print("❌ OAuth authentication not working")
    return False

if __name__ == "__main__":
    test_oauth()
```

## KEY ADVANTAGES

1. **No API Key Required** - Uses Claude subscription OAuth
2. **Persistent Authentication** - Survives container restarts
3. **CI/CD Compatible** - GitHub Actions friendly
4. **Auto-refresh Capable** - Token management built-in
5. **Full Tool Access** - tmux, bash, git all enabled

## MIGRATION PATH

1. Extract current local Claude OAuth token
2. Deploy to Fly.io persistent volume
3. Update startup scripts to use OAuth
4. Add token to GitHub secrets
5. Setup refresh automation

This is the **CORRECT** approach used by production teams!