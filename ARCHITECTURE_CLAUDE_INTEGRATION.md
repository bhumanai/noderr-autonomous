# 🏗️ Noderr Architecture with Claude Code CLI Integration

## Overview

Noderr now uses Claude Code CLI directly for brainstorming, providing full codebase context and unlimited analysis capabilities.

## Architecture Components

### 1. **Brainstorming Layer** (Claude Code CLI)
- When user requests brainstorming for a project
- Claude CLI session spawned in the cloned repo directory
- Full codebase access for intelligent task generation
- Runs in tmux session for monitoring

### 2. **Orchestration Layer** (CF Worker)
- Receives approved tasks from brainstorming
- Distributes tasks to executor agents
- Manages task dependencies and flow

### 3. **Execution Layer** (Claude Code CLI Executors)
- Multiple Claude CLI sessions for parallel task execution
- Each executor works on assigned tasks
- Direct code modification capabilities

## Workflow

```
User Request → Clone Repo → Claude Brainstorm (tmux) → Task Approval
                                   ↓
                            Generate tasks.json
                                   ↓
                         CF Worker Orchestrator
                                   ↓
                    Claude Executors (tmux sessions)
                                   ↓
                            Git commit & push
```

## Benefits of Claude CLI Approach

1. **Full Context**: Claude can explore entire codebase naturally
2. **No Token Limits**: Direct file access, not API constrained
3. **Intelligent Analysis**: Can grep, search, read as needed
4. **Consistent Pattern**: Same executor pattern for brainstorm & execution
5. **Real Understanding**: Claude understands actual code structure

## Session Management

### Brainstorm Sessions
```bash
# Start: ./brainstorm-with-claude.sh <project_id> <path> <request>
# Monitor: tmux attach -t brainstorm-<project_id>-<timestamp>
# Output: /tmp/noderr-brainstorms/<session_id>/tasks.json
```

### Executor Sessions
```bash
# Start: Via CF Worker orchestrator
# Monitor: tmux attach -t noderr-executor-<id>
# Status: Check via API endpoints
```

## API Endpoints

### Brainstorming
- `POST /api/brainstorm/analyze` - Start Claude brainstorm session
- `GET /api/brainstorm/sessions/:id/status` - Check session status
- `GET /api/brainstorm/sessions/:id/output` - Get tmux output
- `DELETE /api/brainstorm/sessions/:id` - Kill session

### Projects
- `POST /api/projects` - Create project (clones repo)
- `POST /api/projects/:id/sync` - Git pull latest changes
- `GET /api/projects/:id/files` - Browse project files
- `GET /api/projects/:id/tree` - Get file tree

## File Structure

```
/tmp/
├── noderr-repos/           # Cloned repositories
│   └── project-<id>/       # Each project's code
├── noderr-brainstorms/     # Brainstorm sessions
│   └── brainstorm-<id>/
│       ├── session.json    # Session metadata
│       ├── prompt.md       # Claude prompt
│       └── tasks.json      # Generated tasks
└── noderr-executors/       # Executor workspaces
    └── executor-<id>/      # Each executor's work
```

## Why This Approach?

Traditional API approach:
- Limited context window
- Expensive token usage
- Can't explore codebase naturally
- Loses context between calls

Claude CLI approach:
- Unlimited file access
- Natural code exploration
- Maintains full context
- Can use all CLI tools (grep, find, etc.)
- Same pattern as executors

## Implementation Status

✅ Git clone/pull on project creation
✅ Claude CLI brainstorm script
✅ Tmux session management
✅ Session status tracking
✅ Output retrieval endpoints
🔄 Frontend integration (pending)
🔄 Executor orchestration (existing)

## Next Steps

1. Update frontend to show brainstorm progress
2. Add WebSocket for real-time updates
3. Integrate with existing executor system
4. Add session persistence/resume