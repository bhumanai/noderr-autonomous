# 🔴 REAL CLAUDE CODE CLI OAUTH SOLUTION

## THE ACTUAL PROBLEM
1. Claude CLI uses OAuth tokens, NOT API keys
2. OAuth tokens are in `~/.claude/.credentials.json`
3. Tokens EXPIRE and need refresh
4. Current deployment tries to use API keys - WON'T WORK!

## CORRECT IMPLEMENTATION

### 1. Extract REAL OAuth Credentials
```bash
#!/bin/bash
# extract-real-oauth.sh

# Get the ACTUAL OAuth file
OAUTH_FILE="$HOME/.claude/.credentials.json"

if [ ! -f "$OAUTH_FILE" ]; then
    echo "❌ No OAuth credentials found!"
    echo "Run: claude login"
    exit 1
fi

# Check if token is expired
python3 << 'EOF'
import json
from datetime import datetime

with open('$HOME/.claude/.credentials.json') as f:
    creds = json.load(f)

expires_at = creds['claudeAiOauth']['expiresAt'] / 1000
now = datetime.now().timestamp()

if now > expires_at:
    print("❌ Token is EXPIRED! Need to re-login")
    exit(1)
else:
    hours_left = (expires_at - now) / 3600
    print(f"✅ Token valid for {hours_left:.1f} hours")
EOF

# Package the OAuth credentials
mkdir -p oauth-package
cp "$OAUTH_FILE" oauth-package/.credentials.json

# Also copy config
if [ -f "$HOME/.claude.json" ]; then
    cp "$HOME/.claude.json" oauth-package/.claude.json
fi

tar -czf claude-oauth.tar.gz -C oauth-package .
echo "✅ Created claude-oauth.tar.gz"
```

### 2. Deploy OAuth (NOT API Key!)
```bash
#!/bin/bash
# deploy-real-oauth.sh

# Upload OAuth credentials to Fly.io
fly ssh console --app uncle-frank-claude << 'EOF'
mkdir -p /home/claude-user/.claude
EOF

# Transfer OAuth package
fly ssh sftp shell --app uncle-frank-claude << EOF
put claude-oauth.tar.gz /tmp/
EOF

# Extract in correct location
fly ssh console --app uncle-frank-claude << 'EOF'
cd /tmp
tar -xzf claude-oauth.tar.gz -C /home/claude-user/.claude/
chown -R claude-user:claude-user /home/claude-user/.claude
chmod 600 /home/claude-user/.claude/.credentials.json

# Verify OAuth format
python3 << 'PY'
import json
with open('/home/claude-user/.claude/.credentials.json') as f:
    creds = json.load(f)
if 'claudeAiOauth' in creds:
    print("✅ OAuth credentials deployed")
else:
    print("❌ Wrong credential format!")
PY
EOF
```

### 3. Start Claude WITHOUT API Key
```bash
#!/bin/bash
# start-with-oauth.sh

# NO API KEY NEEDED!
# Claude CLI reads OAuth from ~/.claude/.credentials.json

# Start Claude (it will use OAuth automatically)
sudo -u claude-user tmux new-session -d -s claude \
    "cd /workspace && claude --dangerously-skip-permissions"

# NO NEED FOR:
# - export ANTHROPIC_API_KEY
# - export CLAUDE_API_KEY
# These are for API, not CLI!
```

## TOKEN REFRESH STRATEGY

### The Refresh Problem
- OAuth tokens EXPIRE
- Empty refresh token means can't auto-renew
- Need to re-login periodically

### Solution: Token Monitor
```python
#!/usr/bin/env python3
# monitor-oauth-expiry.py

import json
from datetime import datetime, timedelta
import subprocess

def check_token_health():
    with open('/home/claude-user/.claude/.credentials.json') as f:
        creds = json.load(f)
    
    expires_at = datetime.fromtimestamp(creds['claudeAiOauth']['expiresAt'] / 1000)
    now = datetime.now()
    
    if now > expires_at:
        print("❌ TOKEN EXPIRED!")
        # Need manual re-login
        return False
    
    if now > expires_at - timedelta(hours=24):
        print("⚠️ Token expires in < 24 hours")
        # Alert for manual refresh
        
    return True

# Run every hour
while True:
    if not check_token_health():
        # Kill Claude session if token expired
        subprocess.run(['tmux', 'kill-session', '-t', 'claude'])
    time.sleep(3600)
```

## GITHUB ACTIONS (CORRECT WAY)

```yaml
name: Deploy with OAuth
on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * 0'  # Weekly to check token

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Check OAuth Token
        env:
          CLAUDE_OAUTH_CREDS: ${{ secrets.CLAUDE_OAUTH_CREDS }}
        run: |
          # Decode stored OAuth
          echo "$CLAUDE_OAUTH_CREDS" | base64 -d > .credentials.json
          
          # Check expiry
          python3 << 'EOF'
          import json
          from datetime import datetime
          
          with open('.credentials.json') as f:
              creds = json.load(f)
          
          expires = creds['claudeAiOauth']['expiresAt'] / 1000
          if datetime.now().timestamp() > expires:
              print("::error::OAuth token expired! Need manual refresh")
              exit(1)
          EOF
          
      - name: Deploy OAuth
        run: |
          # Deploy only if token is valid
          fly ssh sftp shell --app uncle-frank-claude << EOF
          put .credentials.json /home/claude-user/.claude/.credentials.json
          EOF
```

## WHY CURRENT SOLUTION FAILS

1. **Uses API keys** - Claude CLI doesn't use these
2. **Wrong env vars** - ANTHROPIC_API_KEY is for API, not CLI
3. **No expiry handling** - OAuth tokens expire
4. **Wrong file locations** - Looking for API config, not OAuth

## THE TRUTH

- Claude Code CLI uses **OAuth tokens only**
- Tokens are in `~/.claude/.credentials.json`
- Format is `{"claudeAiOauth": {...}}`
- Tokens EXPIRE and need manual refresh
- No API keys involved at all!

This is the REAL solution that will actually work!