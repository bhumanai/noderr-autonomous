# Complete Claude CLI Integration Guide

## Key Learnings from Implementation

### 1. Claude CLI Authentication Process

#### Manual Authentication Flow (Working Method)
```bash
# 1. SSH into Fly.io machine
fly ssh console -a uncle-frank-claude

# 2. Switch to claude-user (IMPORTANT: Claude must run as this user)
sudo -u claude-user -i

# 3. Run authentication
claude auth login
# This provides a URL to visit in browser for OAuth authentication

# 4. Verify authentication
claude auth status
```

#### Critical Discovery: Bypass Permissions Mode
After authentication, Claude CLI must be run with `--dangerously-skip-permissions` flag in containerized environments:
```bash
claude --dangerously-skip-permissions
```

### 2. Claude CLI Onboarding Process

#### First Launch Behavior
When Claude CLI starts with `--dangerously-skip-permissions`, it shows:
1. **Warning Screen**: A dialog with two options
   - Option 1: "No, exit"  
   - Option 2: "Yes, I accept"
2. **Input Method**: Send just "2" (no Enter needed during onboarding)
3. **Welcome Screen**: Shows after accepting, with tips and command prompt

#### Interactive Elements
- Claude CLI uses an interactive TUI (Text User Interface)
- Arrow keys navigate options
- Number keys select options directly
- Enter executes commands (after onboarding)

### 3. Tmux Session Management

#### Creating Claude Session
```bash
# Kill any existing session
sudo -u claude-user tmux kill-session -t claude-code 2>/dev/null

# Create new session with Claude
sudo -u claude-user tmux new-session -d -s claude-code \
  "cd /workspace && claude --dangerously-skip-permissions"
```

#### Sending Commands to Claude

##### During Onboarding (No Enter needed)
```bash
# Send "2" to accept bypass permissions
sudo -u claude-user tmux send-keys -t claude-code "2"
```

##### After Onboarding (Enter required)
```bash
# Send command
sudo -u claude-user tmux send-keys -t claude-code "echo Hello" C-m
# Note: C-m sends Enter/Return key
```

#### Capturing Output
```bash
# Get current pane content
sudo -u claude-user tmux capture-pane -t claude-code -p

# Get last 20 lines
sudo -u claude-user tmux capture-pane -t claude-code -p | tail -20
```

### 4. Common Issues and Solutions

#### Issue: Timeout Errors
**Problem**: Commands timing out after 5 seconds
**Solution**: Increase timeout to 30 seconds for all Claude commands
```python
subprocess.run(['claude', 'auth', 'status'], timeout=30)
```

#### Issue: Permission Denied
**Problem**: Claude fails to run or authenticate
**Solution**: Always run as `claude-user` with sudo:
```bash
sudo -u claude-user claude auth status
```

#### Issue: Interactive Authentication in Headless Environment
**Problem**: Can't open browser on remote server
**Solution**: 
1. Use OAuth Device Flow (if available)
2. Manual URL copying from tmux output
3. Complete auth on local machine, then return

#### Issue: Exclamation Mark in Commands
**Problem**: Bash interprets `!` as history expansion
**Solution**: Use double quotes or escape special characters
```bash
# Bad
tmux send-keys "echo Hello!"  # Fails

# Good
tmux send-keys "echo \"Hello world\""  # Works
tmux send-keys "echo Hello"  # Works
```

### 5. Authentication Detection Patterns

#### Successful Authentication Indicators
Look for these patterns in output:
- "Authenticated"
- "logged in" (case insensitive)
- "successfully"

#### URL Extraction Patterns
```python
url_patterns = [
    r'https://claude\.ai/auth/[^\s]+',
    r'https://[^\s]*claude[^\s]*auth[^\s]+',
    r'Visit:\s*(https://[^\s]+)',
    r'Open.*browser.*:\s*(https://[^\s]+)'
]
```

#### Device Code Pattern
```python
device_code_match = re.search(r'code:\s*([A-Z0-9-]+)', output, re.IGNORECASE)
```

### 6. Service Architecture

#### Supervisor Configuration
- **claude-auth**: Runs on port 8083 (handles auth endpoints)
- **noderr-api**: Runs on port 8080 (proxies to 8083 for auth)
- **tmux-claude**: Manages Claude CLI session

#### Port Configuration
- 8080: Main API (exposed externally)
- 8081: Health check server  
- 8082: Inject agent
- 8083: Claude auth handler (internal only)

### 7. File Paths and Storage

#### Important Directories
- `/workspace`: Working directory for Claude
- `/home/claude-user/.config/`: Claude configuration
- `/data`: Persistent volume for storing auth tokens
- `/var/log/supervisor/`: Service logs

### 8. API Endpoints

#### Authentication Endpoints
- `POST /claude/auth/start`: Initiate authentication
- `GET /claude/auth/status/<session_id>`: Check auth progress
- `GET /claude/auth/verify`: Verify current auth state
- `POST /claude/auth/logout`: Logout from Claude
- `GET /claude/debug`: Debug Claude installation

### 9. Environment Requirements

#### System Requirements
- Ubuntu 22.04 or similar Linux
- tmux installed
- Python 3 with Flask
- Node.js for Claude CLI
- Supervisor for process management

#### User Setup
```bash
# Create claude-user
useradd -m -s /bin/bash claude-user
mkdir -p /workspace
chown -R claude-user:claude-user /workspace
```

### 10. Testing Claude Integration

#### Manual Test in SSH
```bash
# Send test command
sudo -u claude-user tmux send-keys -t claude-code "echo test" C-m
sleep 2
sudo -u claude-user tmux capture-pane -t claude-code -p
```

#### API Test
```bash
curl -X POST http://localhost:8080/brainstorm \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test", "message": "Create hello world"}'
```

### 11. Debugging Commands

#### Check Claude Installation
```bash
which claude
claude --version
sudo -u claude-user claude auth status
```

#### Check Tmux Sessions
```bash
sudo -u claude-user tmux list-sessions
sudo -u claude-user tmux capture-pane -t claude-code -p
```

#### Check Service Status
```bash
supervisorctl status
tail -f /var/log/supervisor/claude-auth.err.log
tail -f /var/log/supervisor/tmux-claude.err.log
```

### 12. Known Limitations

1. **No Browser Access**: Remote servers can't open browsers for OAuth
2. **Interactive Prompts**: Claude CLI expects interactive input
3. **Permission Mode**: Must use bypass permissions in containers
4. **Session Persistence**: Tmux sessions may die and need restart
5. **Timeout Issues**: Claude commands can be slow to respond

### 13. Future Improvements

1. **Automated Device Flow**: Implement device code authentication
2. **Token Persistence**: Save auth tokens to /data volume
3. **Session Recovery**: Auto-restart dead tmux sessions
4. **Health Monitoring**: Better health checks for Claude status
5. **Error Recovery**: Automatic retry on timeout/failure

## Quick Reference Commands

```bash
# SSH to server
fly ssh console -a uncle-frank-claude

# Check Claude status
sudo -u claude-user claude auth status

# View Claude session
sudo -u claude-user tmux attach -t claude-code

# Restart all services
supervisorctl restart all

# Check logs
tail -f /var/log/supervisor/*.log
```

## Important Notes

- Always run Claude commands as `claude-user`
- Use `--dangerously-skip-permissions` in containers
- Increase timeouts for all Claude operations
- Monitor tmux sessions for crashes
- Keep auth tokens persistent across restarts