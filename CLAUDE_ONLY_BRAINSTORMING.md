# 🧠 Noderr: Claude CLI Brainstorming (No API, No Fallbacks)

## The Real Deal - Claude Code CLI Only

Noderr now uses **ONLY** Claude Code CLI for brainstorming. No API keys, no fallbacks, no half measures.

## How It Works

1. **User creates a project** → Repository is cloned locally
2. **User requests brainstorming** → Claude CLI session spawned in repo directory
3. **Claude analyzes actual code** → Full codebase access, no token limits
4. **Tasks generated** → Proper 2-4 hour tasks with dependencies
5. **Ready for execution** → Tasks can be sent to executor Claude sessions

## Requirements

✅ **Claude CLI** (`/usr/bin/claude`) - INSTALLED
✅ **tmux** - INSTALLED  
✅ **Git** - For cloning repositories
✅ **Node.js** - For backend server

## NO MORE:
- ❌ OpenAI API keys
- ❌ GPT-5 or GPT-4 API calls
- ❌ Fallback keyword matching
- ❌ Token limits
- ❌ API costs

## API Endpoints

### Start Brainstorming
```bash
POST /api/brainstorm/analyze
{
  "message": "Your request here",
  "context": {
    "projectId": "project-id"  # REQUIRED
  }
}
```

Returns:
```json
{
  "sessionId": "brainstorm-xxx",
  "status": "started",
  "message": "Claude is analyzing your codebase...",
  "checkUrl": "/api/brainstorm/sessions/xxx/status"
}
```

### Check Status
```bash
GET /api/brainstorm/sessions/{sessionId}/status
```

Returns tasks when complete:
```json
{
  "status": "completed",
  "result": {
    "tasks": [...],
    "analysis": "...",
    "risks": [...]
  }
}
```

## Architecture

```
User Request
     ↓
Project Must Exist (with cloned repo)
     ↓
Claude CLI Session (tmux)
     ↓
Full Codebase Analysis
     ↓
Tasks JSON Generated
     ↓
Ready for Orchestration
```

## Testing Results

✅ **WORKING**: Just tested with Express.js repository
- Repository cloned successfully
- Claude session started in tmux
- Tasks generated and saved
- Session status tracking works
- No API keys needed

## Example Session

```bash
# 1. Create project (clones repo)
curl -X POST http://localhost:3000/api/projects \
  -d '{"name": "Test", "repo": "https://github.com/expressjs/express.git"}'

# 2. Start brainstorming (Claude CLI)
curl -X POST http://localhost:3000/api/brainstorm/analyze \
  -d '{"message": "Add JWT auth", "context": {"projectId": "project-xxx"}}'

# 3. Check status
curl http://localhost:3000/api/brainstorm/sessions/brainstorm-xxx/status

# 4. Monitor live
tmux attach -t brainstorm-xxx
```

## Why This Approach?

**Traditional API approach:**
- Limited context window
- Expensive tokens
- Can't explore naturally
- Loses context

**Claude CLI approach:**
- Unlimited file access
- Natural exploration
- Full context maintained
- Real understanding

## The Bottom Line

This is the real thing. Claude Code CLI analyzing real codebases in real repositories. No shortcuts, no fallbacks, no API nonsense.

**If Claude CLI isn't available, it fails. As it should.**