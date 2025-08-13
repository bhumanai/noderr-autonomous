# Noderr Git Integration Documentation

## Overview

The Noderr system now includes full Git integration between the Cloudflare Worker orchestrator and the Fly.io Claude Code instance. This enables autonomous Git operations including commits, pushes, and repository management.

## Architecture

### Components

1. **Cloudflare Worker** (`cloudflare-worker/`)
   - Orchestrates Git operations through API endpoints
   - Manages task lifecycle with Git integration
   - Communicates with Fly.io for actual Git commands

2. **Fly.io App** (`fly-app-uncle-frank/`)
   - Executes Git commands via tmux session
   - Provides Git operation endpoints
   - Manages Claude Code session with repository access

3. **Git Operations Module** (`fly-app-uncle-frank/git_operations.py`)
   - Implements Git command execution
   - Provides Flask routes for Git operations
   - Captures and returns command output

## API Endpoints

### Cloudflare Worker Endpoints

#### Task Management with Git Integration

- **POST `/api/tasks/{id}/approve`**
  - Approves task and triggers git commit + push
  - Body: `{ "commitMessage": "Your commit message" }`
  - Automatically stages, commits, and pushes changes

- **GET `/api/tasks/{id}/changes`**
  - Gets git diff for task changes
  - Returns diff and list of changed files

#### Git Operations

- **POST `/api/git/commit`**
  - Creates a git commit
  - Body: `{ "projectId": "...", "taskId": "...", "message": "..." }`

- **POST `/api/git/push`**
  - Pushes to remote repository
  - Body: `{ "projectId": "...", "branch": "main" }`

- **GET `/api/git/status`**
  - Gets current git status
  - Query: `?projectId=...`
  - Returns branch, modified files, untracked files

### Fly.io Git Endpoints

- **GET `/git/status?path=/workspace`**
  - Returns current git status

- **GET `/git/diff?path=/workspace&staged=false`**
  - Returns git diff (staged or unstaged)

- **POST `/git/add`**
  - Stages files for commit
  - Body: `{ "path": "/workspace", "files": ["file1.js", "file2.js"] }`

- **POST `/git/commit`**
  - Creates a commit
  - Body: `{ "path": "/workspace", "message": "Commit message" }`

- **POST `/git/push`**
  - Pushes to remote
  - Body: `{ "path": "/workspace", "branch": "main", "force": false }`

- **POST `/git/pull`**
  - Pulls from remote
  - Body: `{ "path": "/workspace", "branch": "main" }`

## Task Workflow with Git

### Automated Flow

1. **Task Creation**
   ```javascript
   POST /api/tasks
   {
     "projectId": "project-1",
     "description": "Implement new feature"
   }
   ```

2. **Task Execution**
   - Agent works on task
   - Status updates to "working"
   - Progress tracked

3. **Task Review**
   - Status updates to "review"
   - Changes can be inspected via `/api/tasks/{id}/changes`

4. **Task Approval**
   ```javascript
   POST /api/tasks/{id}/approve
   {
     "commitMessage": "feat: Implement new feature"
   }
   ```
   - Automatically stages all changes
   - Creates commit with message
   - Pushes to remote repository
   - Updates task status to "pushed"

## Configuration

### Environment Variables

#### Cloudflare Worker
- `FLY_ENDPOINT`: URL of Fly.io app (set in wrangler.toml)
- `HMAC_SECRET`: Secret for command authentication
- `CLAUDE_API_KEY`: API key for Claude (if using analysis features)

#### Fly.io App
- `HMAC_SECRET`: Must match Cloudflare Worker secret
- `SESSION_NAME`: tmux session name (default: "claude-code")

### Deployment

#### Deploy Cloudflare Worker
```bash
cd cloudflare-worker
wrangler deploy
```

#### Deploy Fly.io App
```bash
cd fly-app-uncle-frank
fly deploy
```

## Testing

### Integration Test Suite
```bash
cd tests
python test-git-integration.py
```

Tests include:
- Git status retrieval
- Git diff functionality
- Commit creation
- Push operations
- Complete task approval flow
- Direct Fly.io endpoint testing

### Manual Testing

1. **Test Git Status**
   ```bash
   curl https://noderr-orchestrator.terragonlabs.workers.dev/api/git/status
   ```

2. **Create and Approve Task**
   ```bash
   # Create task
   curl -X POST https://noderr-orchestrator.terragonlabs.workers.dev/api/tasks \
     -H "Content-Type: application/json" \
     -d '{"projectId":"test","description":"Test task"}'
   
   # Approve task (replace TASK_ID)
   curl -X POST https://noderr-orchestrator.terragonlabs.workers.dev/api/tasks/TASK_ID/approve \
     -H "Content-Type: application/json" \
     -d '{"commitMessage":"Test commit"}'
   ```

## Security Considerations

1. **HMAC Authentication**
   - All commands between Worker and Fly.io are HMAC-signed
   - Prevents unauthorized command injection

2. **Rate Limiting**
   - Fly.io app implements rate limiting
   - Default: 10 commands per minute

3. **IP Allowlisting** (Optional)
   - Can restrict Fly.io to accept only from Cloudflare IPs
   - Set `ALLOWED_IPS` environment variable

## Troubleshooting

### Common Issues

1. **Git commands not executing**
   - Check tmux session is running: `tmux ls`
   - Verify Claude Code is active in session
   - Check Fly.io logs: `fly logs`

2. **Authentication failures**
   - Ensure HMAC_SECRET matches between Worker and Fly.io
   - Check signature generation in Worker

3. **Git push failures**
   - Verify SSH keys are configured in Claude session
   - Check repository permissions
   - Ensure branch protection rules allow push

### Debug Commands

```bash
# Check Fly.io health
curl https://uncle-frank-claude.fly.dev/health

# View Fly.io logs
fly logs -a uncle-frank-claude

# SSH into Fly.io instance
fly ssh console -a uncle-frank-claude

# Check tmux sessions
tmux ls

# Attach to Claude session
tmux attach -t claude-code
```

## Future Enhancements

- [ ] Branch management (create, switch, merge)
- [ ] Conflict resolution handling
- [ ] Pull request creation via GitHub API
- [ ] Commit history viewing
- [ ] Rollback functionality
- [ ] Multi-repository support
- [ ] Git hooks integration