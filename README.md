# Noderr Autonomous Execution System

An intelligent autonomous development system that orchestrates Claude Code CLI to execute Noderr methodology automatically. The system uses CloudFlare Workers for orchestration and Fly.io for running Claude Code CLI instances.

## 🚀 Overview

This system enables fully autonomous software development using the Noderr methodology by:
- Running Claude Code CLI on Fly.io containers with persistent sessions
- Using CloudFlare Workers with Claude API for intelligent orchestration
- Automatically progressing through the Noderr 4-step Loop
- Maintaining context and state across development cycles

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│     CloudFlare Worker               │
│  (Intelligent Orchestrator)         │
│                                     │
│  • Uses Claude Opus 4.1 API        │
│  • Analyzes agent output           │
│  • Determines next Noderr step     │
│  • Queues and executes tasks       │
└──────────────┬──────────────────────┘
               │
               │ HMAC-authenticated
               │ commands
               ▼
┌─────────────────────────────────────┐
│         Fly.io Container            │
│    (Claude Code CLI Instance)       │
│                                     │
│  • Runs Claude with --dangerously-  │
│    skip-permissions flag            │
│  • Persistent tmux sessions         │
│  • Pre-authorized via config        │
│  • Executes Noderr prompts          │
└─────────────────────────────────────┘
```

## 📁 Project Structure

```
noderr-autonomous/
├── cloudflare-worker/     # CloudFlare Worker for orchestration
│   ├── worker.js          # Main worker with API endpoints
│   ├── orchestrator.js    # Intelligent orchestration using Claude API
│   ├── wrangler.toml      # CloudFlare Worker configuration
│   └── package.json       # Node.js dependencies
│
├── fly-app-uncle-frank/   # Fly.io application
│   ├── Dockerfile         # Container definition
│   ├── fly.toml          # Fly.io configuration
│   ├── inject_agent.py   # HMAC-authenticated command injection
│   ├── completion_monitor.py # Monitors Claude output changes
│   ├── supervisor.conf   # Process management
│   └── scripts/          # Initialization and management scripts
│       ├── init-claude.sh
│       ├── start.sh
│       └── save-claude-config.sh
│
└── tests/                # Test scripts
    ├── noderr-test.py
    ├── test-auto-loop.py
    ├── test-command-execution.py
    ├── test-intelligent-orchestration.py
    └── test-real-loop.py
```

## 🔧 Setup Instructions

### Prerequisites

- CloudFlare account with Workers enabled
- Fly.io account
- Claude API key (Anthropic)
- Claude Code CLI subscription or API access
- Node.js and npm installed locally
- Python 3.x for running tests

### 1. CloudFlare Worker Setup

```bash
cd cloudflare-worker

# Install dependencies
npm install

# Configure secrets
npx wrangler secret put CLAUDE_API_KEY --name noderr-orchestrator
# Enter your Claude API key when prompted

npx wrangler secret put HMAC_SECRET --name noderr-orchestrator
# Enter a secure secret for HMAC authentication

# Deploy the worker
npx wrangler deploy
```

### 2. Fly.io Application Setup

```bash
cd fly-app-uncle-frank

# Create a new Fly.io app
fly launch --name your-app-name

# Set secrets
fly secrets set HMAC_SECRET="same-secret-as-cloudflare"

# Create persistent volume for Claude config
fly volumes create claude_data --size 1 --region ord

# Deploy the application
fly deploy

# Scale to ensure the volume is attached
fly scale count 1
```

### 3. Authenticate Claude Code CLI

You need to authenticate Claude once. This can be done by:

1. SSH into the Fly.io instance:
```bash
fly ssh console
```

2. Start Claude manually and follow authentication:
```bash
sudo -u claude-user tmux new-session -s claude-code
claude --dangerously-skip-permissions
# Follow the authentication prompts
```

3. Save the config:
```bash
/app/save-claude-config.sh
```

The authentication will persist across deployments.

### 4. Update CloudFlare Worker Configuration

Edit `cloudflare-worker/wrangler.toml` to set your Fly.io endpoint:

```toml
[vars]
FLY_ENDPOINT = "https://your-app-name.fly.dev"
```

Deploy the update:
```bash
cd cloudflare-worker
npx wrangler deploy
```

## 🎯 Usage

### Starting a Noderr Session

The system can automatically start Noderr sessions:

```bash
curl https://your-worker.workers.dev/api/start-noderr
```

### Manual Orchestration

Trigger orchestration to analyze state and send next command:

```bash
curl https://your-worker.workers.dev/api/orchestrate
```

### Queue a Task

Queue a specific Noderr prompt:

```bash
curl -X POST https://your-worker.workers.dev/api/queue \
  -H "Content-Type: application/json" \
  -d '{"command": "Start a Noderr work session and review the project status"}'
```

### Check Status

View system status and recent tasks:

```bash
curl https://your-worker.workers.dev/api/status
```

### View Dashboard

Open the web dashboard:

```
https://your-worker.workers.dev/
```

## 🔄 The Noderr Loop

The system automatically progresses through the 4-step Noderr Loop:

1. **LOOP_1A**: Propose Change Set
   - Analyzes request and identifies affected NodeIDs
   - Pauses for approval

2. **LOOP_1B**: Draft Specifications
   - Creates detailed specs for each NodeID
   - Pauses for approval

3. **LOOP_2**: Implement Change Set
   - Builds all components
   - Performs ARC verification
   - Pauses for authorization

4. **LOOP_3**: Finalize and Commit
   - Updates specs to "as-built" state
   - Updates tracker and logs
   - Creates git commit

The CloudFlare Worker uses Claude API to:
- Detect which Loop step is complete
- Generate appropriate approval/continuation commands
- Maintain context across the entire cycle

## 🧪 Testing

Run the test suite to verify functionality:

```bash
cd tests

# Test basic connectivity
python3 noderr-test.py

# Test intelligent orchestration
python3 test-intelligent-orchestration.py

# Test automatic loop continuation
python3 test-auto-loop.py

# Test command execution
python3 test-command-execution.py

# Test real Noderr loop
python3 test-real-loop.py
```

## 🔐 Security

- All communication uses HMAC-SHA256 authentication
- Claude runs with `--dangerously-skip-permissions` flag (required for autonomous operation)
- Secrets are stored in CloudFlare and Fly.io secret stores
- Persistent storage is isolated per instance

## 📊 Monitoring

### CloudFlare Worker Logs
```bash
cd cloudflare-worker
npx wrangler tail
```

### Fly.io Logs
```bash
fly logs -a your-app-name
```

### SSH into Fly.io Instance
```bash
fly ssh console -a your-app-name
```

## 🚨 Troubleshooting

### Claude Not Starting

1. Check supervisor status:
```bash
fly ssh console --command "supervisorctl status"
```

2. Check error logs:
```bash
fly ssh console --command "tail -50 /var/log/supervisor/tmux-claude.err.log"
```

3. Fix line endings if needed:
```bash
fly ssh console --command "tr -d '\r' < /app/start.sh > /tmp/start.sh && mv /tmp/start.sh /app/start.sh && chmod +x /app/start.sh"
```

### Authentication Issues

1. Ensure Claude config exists:
```bash
fly ssh console --command "ls -la /data/.claude.json"
```

2. Restore config:
```bash
fly ssh console --command "/app/init-claude.sh"
```

### Orchestration Not Working

1. Check CloudFlare Worker logs for errors
2. Verify CLAUDE_API_KEY is set correctly
3. Ensure HMAC_SECRET matches between services

## 📝 Environment Variables

### CloudFlare Worker

- `CLAUDE_API_KEY`: Anthropic API key for Claude Opus 4.1
- `HMAC_SECRET`: Shared secret for command authentication
- `FLY_ENDPOINT`: URL of your Fly.io application

### Fly.io Application

- `HMAC_SECRET`: Same secret as CloudFlare Worker
- `SESSION_NAME`: tmux session name (default: claude-code)
- `CF_WORKER_URL`: CloudFlare Worker URL for callbacks

## 🤝 Contributing

This is an experimental system for autonomous development. Contributions are welcome!

## 📄 License

MIT

## 🙏 Acknowledgments

- Built using Claude Code CLI by Anthropic
- Orchestrated with Claude Opus 4.1 API
- Based on the Noderr development methodology
- Deployed on CloudFlare Workers and Fly.io

---

**Note**: This system enables fully autonomous code execution. Use with appropriate caution and monitoring.