# Local Setup and Deployment Instructions

## 1. Get Latest Code from GitHub

```bash
# Clone the repository (if you don't have it)
git clone https://github.com/bhumanai/noderr-autonomous.git
cd noderr-autonomous

# OR pull latest changes if you already have it
git pull origin main
```

## 2. Deploy CORS-Enabled Backend to Fly.io

The backend needs CORS support for the frontend to work. Follow these steps:

### Install Fly CLI (if not already installed)
```bash
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
```

### Authenticate and Deploy
```bash
# Login to Fly.io (opens browser)
flyctl auth login

# Navigate to backend directory
cd fly-app-uncle-frank

# Deploy with CORS support
flyctl deploy --ha=false
```

### Verify Backend Works
After deployment, test the endpoints:
```bash
# Test health endpoint
curl https://uncle-frank-claude.fly.dev/health

# Test CORS headers
curl -H "Origin: https://noderr-autonomous-dfktivw49-bhuman.vercel.app" \
     -I https://uncle-frank-claude.fly.dev/health
```

You should see `Access-Control-Allow-Origin: *` in the response headers.

## 3. Verify Frontend Works

The frontend at https://noderr-autonomous-dfktivw49-bhuman.vercel.app/ should now:

✅ **Load without "BACKEND OFFLINE" error**  
✅ **Allow adding tasks**  
✅ **Show connection status**  
✅ **Require backend for all operations**  

## 4. What's Fixed

- **CORS Support**: Backend now includes proper CORS headers
- **Health Endpoint**: Frontend can check `/health` for connectivity  
- **Online-Only UI**: Application fails completely if backend is offline
- **Task Management**: Add Task functionality works properly
- **Real-time Updates**: SSE connection for live task updates

## 5. What's Still Missing

- **Brainstorming Chat UI**: Not yet implemented
- **Claude Authentication**: Backend needs Claude Code CLI authentication
- **Full Task Processing**: Backend can receive tasks but needs Claude integration

## 6. Testing the System

1. **Open the frontend**: https://noderr-autonomous-dfktivw49-bhuman.vercel.app/
2. **Check connection**: Should show green connection indicator  
3. **Add a project**: Click "+" next to project selector
4. **Add a task**: Click "Add Task" button
5. **Verify task appears**: Task should appear in BACKLOG column

## Next Steps After Deployment

Once the backend is deployed with CORS:

1. **Authenticate Claude on Backend**: The backend needs Claude Code CLI authentication
2. **Implement Task Processing**: Connect task queue to Claude Code CLI
3. **Add Brainstorming Chat**: Build the chat interface for task brainstorming
4. **Test Full E2E Flow**: From task creation to GitHub push

## File Structure

Key files updated:
- `docs/app.js` - Online-only frontend with backend health checks
- `fly-app-uncle-frank/inject_agent_cors.py` - CORS-enabled backend
- `fly-app-uncle-frank/Dockerfile` - Updated to use CORS version
- `docs/index.html` - Fixed to load correct JS file

## Troubleshooting

If you see "BACKEND OFFLINE":
1. Check backend deployment: `curl https://uncle-frank-claude.fly.dev/health`
2. Verify CORS headers are present
3. Check browser console for specific errors

If tasks don't process:
1. Backend can receive tasks but Claude CLI needs authentication
2. See authentication solutions in `SOLUTION_OAUTH_AUTH.md`