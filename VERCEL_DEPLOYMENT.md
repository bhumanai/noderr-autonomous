# Vercel Deployment Notice

## Important: Limited Functionality on Vercel

The claudecodeui application is a **full-stack application** that requires:
- Node.js backend server for API endpoints
- WebSocket connections for real-time communication
- Access to Claude Code or Cursor CLI binaries
- File system access for project management

**Vercel only supports static frontend hosting** for this application, which means:
- ❌ No backend API functionality
- ❌ No WebSocket connections
- ❌ No Claude/Cursor CLI integration
- ✅ Only the static UI will be visible

## Recommended Deployment Options

For full functionality, please use one of these alternatives:

### 1. **Fly.io** (Recommended)
- Full Node.js support
- WebSocket connections
- Persistent storage
- See `claudecodeui/DEPLOYMENT.md` for instructions

### 2. **Railway**
- Easy GitHub integration
- Full Node.js support
- WebSocket support
- One-click deploy from GitHub

### 3. **Render**
- Free tier available
- Full Node.js support
- WebSocket connections
- Automatic deploys from GitHub

### 4. **Docker on VPS**
- Complete control
- Use the provided `Dockerfile` and `docker-compose.yml`
- Run: `cd claudecodeui && ./deploy.sh`

### 5. **DigitalOcean App Platform**
- Full Node.js support
- Easy scaling
- Managed infrastructure

## Current Vercel Setup

The current Vercel configuration will:
1. Build the React frontend from `claudecodeui/`
2. Serve static files from `claudecodeui/dist/`
3. Display the UI (without backend functionality)

To deploy just the frontend to Vercel:
```bash
vercel --prod
```

## For Full Functionality

Please refer to `claudecodeui/DEPLOYMENT.md` for complete deployment instructions with full backend support.

The application requires:
- Node.js v20+
- Claude Code or Cursor CLI installed on the server
- WebSocket support
- Persistent storage for sessions

## Quick Docker Deployment

For a quick full-featured deployment on any VPS:
```bash
git clone https://github.com/bhumanai/noderr-autonomous.git
cd noderr-autonomous/claudecodeui
docker-compose up -d
```

Access at `http://your-server:3001`