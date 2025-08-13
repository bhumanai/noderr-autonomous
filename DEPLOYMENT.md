# Noderr System Deployment Guide

## System Overview

Noderr is an autonomous development system consisting of three main components:

1. **Fly.io Agent** - Runs Claude Code in tmux sessions with Git operations
2. **Cloudflare Worker** - Orchestrates tasks and manages the queue
3. **Web UI** - Fleet command interface for managing tasks and projects

## Current Deployment Status

### ✅ Completed
- **Code Implementation**: All features are fully implemented
- **Git Integration**: Complete integration between Worker and Fly.io
- **UI Development**: Full-featured responsive UI ready for deployment
- **Test Suite**: Comprehensive tests for all components

### 🚀 Ready for Deployment
- **Fly.io App**: Running at `https://uncle-frank-claude.fly.dev` (needs Git module update)
- **UI Files**: Ready in `/docs/` directory for GitHub Pages
- **Cloudflare Worker**: Ready to deploy (needs API token)

## Quick Start Deployment

### Option 1: GitHub Pages (Easiest for UI)

1. **Push to GitHub**:
   ```bash
   git add -A
   git commit -m "Deploy Noderr system"
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from branch
   - Branch: main, folder: /docs
   - Save

3. **Access UI**:
   - URL: `https://[username].github.io/[repo]/`

### Option 2: Full System Deployment

#### Prerequisites
```bash
# Install required CLIs
npm install -g wrangler
curl -L https://fly.io/install.sh | sh
export PATH="/root/.fly/bin:$PATH"
```

#### Step 1: Deploy Fly.io App
```bash
cd fly-app-uncle-frank

# Login to Fly.io
fly auth login

# Deploy the app with Git operations
fly deploy

# Verify deployment
curl https://uncle-frank-claude.fly.dev/health
```

#### Step 2: Deploy Cloudflare Worker
```bash
cd cloudflare-worker

# Set your Cloudflare API token
export CLOUDFLARE_API_TOKEN='your-token-here'

# Deploy the worker
wrangler deploy

# The worker will be available at:
# https://noderr-orchestrator.[your-subdomain].workers.dev
```

#### Step 3: Deploy UI

**Option A: Cloudflare Pages**
```bash
npx wrangler pages deploy docs/ --project-name=noderr-ui
# URL: https://noderr-ui.pages.dev
```

**Option B: Vercel**
```bash
npm i -g vercel
cd docs
vercel
# Follow prompts
```

**Option C: Netlify**
```bash
# Drag and drop the docs/ folder to netlify.com
# Or use CLI:
npm i -g netlify-cli
netlify deploy --dir=docs
```

## Configuration

### Environment Variables

#### Fly.io App
```bash
fly secrets set HMAC_SECRET='your-secret-here' --app uncle-frank-claude
fly secrets set SESSION_NAME='claude-code' --app uncle-frank-claude
```

#### Cloudflare Worker
```bash
# Set via wrangler
wrangler secret put HMAC_SECRET
wrangler secret put CLAUDE_API_KEY  # Optional for AI features
```

### Update API Endpoints

Edit `/docs/deploy-config.js`:
```javascript
const CONFIG = {
    API_BASE_URL: 'https://your-worker.workers.dev',
    FALLBACK_API: 'https://uncle-frank-claude.fly.dev',
    SSE_ENDPOINT: 'https://your-worker.workers.dev/api/sse'
};
```

## Testing the Deployment

### 1. Test Fly.io Health
```bash
curl https://uncle-frank-claude.fly.dev/health
# Expected: {"status":"healthy","claude_session":true,...}
```

### 2. Test Git Endpoints
```bash
curl https://uncle-frank-claude.fly.dev/git/status
# Expected: Git status response
```

### 3. Test Cloudflare Worker
```bash
curl https://your-worker.workers.dev/api/status
# Expected: System status with queue info
```

### 4. Run Integration Tests
```bash
python tests/test-git-integration.py
```

## Public URLs (When Deployed)

| Component | URL | Status |
|-----------|-----|--------|
| Fly.io App | https://uncle-frank-claude.fly.dev | ✅ Running (needs update) |
| Cloudflare Worker | https://noderr-orchestrator.terragonlabs.workers.dev | ⏳ Needs deployment |
| UI (GitHub Pages) | https://[user].github.io/[repo]/ | ⏳ Needs push to GitHub |
| UI (Cloudflare Pages) | https://noderr-ui.pages.dev | ⏳ Needs deployment |

## Architecture Flow

```
User → UI (GitHub Pages/Cloudflare Pages)
         ↓
     Cloudflare Worker (API/Orchestration)
         ↓
     Fly.io App (Claude Code + Git)
         ↓
     GitHub Repository (Code Changes)
```

## Troubleshooting

### Common Issues

1. **Cloudflare Worker not deploying**
   - Ensure valid API token
   - Check account permissions
   - Verify KV namespace is created

2. **Fly.io Git endpoints 404**
   - Deploy the latest code: `fly deploy`
   - Check logs: `fly logs`
   - SSH and verify: `fly ssh console`

3. **UI not connecting to API**
   - Update `deploy-config.js` with correct URLs
   - Check CORS headers in Worker
   - Verify API endpoints are accessible

### Debug Commands

```bash
# Check Fly.io logs
fly logs -a uncle-frank-claude

# SSH into Fly.io
fly ssh console -a uncle-frank-claude

# Check tmux sessions
tmux ls

# Test Worker locally
cd cloudflare-worker
wrangler dev

# Test UI locally
cd docs
python -m http.server 8000
# Visit http://localhost:8000
```

## Security Considerations

1. **HMAC Authentication**: All commands between Worker and Fly.io are signed
2. **API Keys**: Store as secrets, never commit to repository
3. **CORS**: Configure appropriate origins in production
4. **Rate Limiting**: Implemented in Fly.io app (10 req/min default)

## Next Steps After Deployment

1. **Configure GitHub Integration**:
   - Add SSH keys to Fly.io for repository access
   - Set up webhook for automated deployments

2. **Monitor System**:
   - Set up alerts for failures
   - Monitor queue length and processing times
   - Track Git operation success rates

3. **Scale as Needed**:
   - Add more Fly.io instances for parallel processing
   - Increase Cloudflare Worker limits if needed
   - Consider database for persistent task storage

## Support & Documentation

- **Git Integration Guide**: `/docs/git-integration.md`
- **UI Specification**: `/docs/ui-spec.md`
- **API Documentation**: See code comments in `api-extensions.js`
- **Test Suite**: `/tests/` directory

## Quick Deployment Script

Run the deployment helper:
```bash
./deploy-all.sh
```

This will:
- Check all prerequisites
- Show current deployment status
- Provide deployment commands
- Test available endpoints

---

## Summary

The Noderr system is **fully implemented** and ready for deployment. The main requirement is obtaining deployment credentials:

1. **Cloudflare API Token** for Worker deployment
2. **Fly.io Authentication** for app updates
3. **GitHub Repository** for UI hosting via GitHub Pages

Once deployed, the system provides a complete autonomous development workflow with Git integration, task management, and real-time updates.