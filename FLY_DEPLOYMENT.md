# 🚀 Deploy the Fixed API to Fly.io

## The Problem Was:
- The Fly.io backend didn't have `/api/projects` or `/api/tasks` endpoints
- This caused "Failed to add project" errors
- CORS wasn't configured for cross-origin requests from GitHub Pages

## The Solution:
I've added:
- ✅ Complete API endpoints in `api_routes.py`
- ✅ CORS support with flask-cors
- ✅ All project and task management endpoints
- ✅ Proper error handling

## To Deploy the Fix:

### Option 1: Using Fly CLI (If you have access)
```bash
cd fly-app-uncle-frank
fly deploy
```

### Option 2: Manual Deployment Steps

1. **SSH into Fly.io instance**:
```bash
fly ssh console -a uncle-frank-claude
```

2. **Update the code**:
```bash
# Pull latest changes
cd /app
git pull origin terragon/remaining-tasks

# Or manually add the files:
# - Copy api_routes.py
# - Update inject_agent.py
# - Update requirements.txt
```

3. **Install flask-cors**:
```bash
pip install flask-cors==4.0.0
```

4. **Restart the service**:
```bash
supervisorctl restart all
# Or
killall gunicorn
```

### Option 3: GitHub Actions (If configured)
Push to main branch will auto-deploy if GitHub Actions is set up.

## Testing After Deployment

1. **Test API directly**:
```bash
# Should return empty array or existing projects
curl https://uncle-frank-claude.fly.dev/api/projects

# Should return 200 OK with CORS headers
curl -I https://uncle-frank-claude.fly.dev/api/projects
```

2. **Test from UI**:
- Go to https://bhumanai.github.io/noderr-autonomous/
- Click "+" to add a project
- Should work without errors!

## Files Changed:

### New file: `fly-app-uncle-frank/api_routes.py`
- Implements all `/api/*` endpoints
- Handles projects and tasks
- Includes CORS configuration

### Updated: `fly-app-uncle-frank/inject_agent.py`
- Imports and sets up API routes
- Adds `setup_api_routes(app)`

### Updated: `fly-app-uncle-frank/requirements.txt`
- Added `flask-cors==4.0.0`

### Updated: `docs/app.js`
- Removed offline mode fallbacks
- Now uses real API endpoints

## Expected Result:
Once deployed, the UI at https://bhumanai.github.io/noderr-autonomous/ will:
- ✅ Successfully add projects
- ✅ Manage tasks
- ✅ No more "Failed to add project" errors
- ✅ Full functionality with the backend

## Current Status:
- **Code**: ✅ Complete and pushed to GitHub
- **UI**: ✅ Updated and live on GitHub Pages
- **Backend**: ⏳ Needs deployment to Fly.io

The fix is ready - just needs to be deployed to the Fly.io instance!