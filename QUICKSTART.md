# Noderr Quick Start Guide

## 🚀 Get Running in 30 Seconds

```bash
# Clone the repository
git clone https://github.com/yourusername/noderr.git
cd noderr

# Run the launcher
./start-noderr.sh

# Select option 1 for local development
# Open http://localhost:8080 in your browser
```

That's it! You now have Noderr running locally.

## 📋 What You Get

When you run Noderr locally, you get:

- **Web UI** at http://localhost:8080 - Full fleet command interface
- **API Server** at http://localhost:8081 - Mock Cloudflare Worker API
- **Agent Server** at http://localhost:8082 - Mock Fly.io agent

## 🎯 No Credentials Required!

The local development environment runs completely without:
- ❌ No Cloudflare account needed
- ❌ No Fly.io account needed  
- ❌ No API keys required
- ❌ No cloud deployment necessary

## 🔧 Installation Options

### Option 1: Python (Simplest)

**Requirements:** Python 3.6+

```bash
./start-noderr.sh
# Select option 1
```

### Option 2: Docker

**Requirements:** Docker & Docker Compose

```bash
./start-noderr.sh
# Select option 2
```

Or directly:
```bash
docker-compose up
```

### Option 3: Manual

Start each component separately:

```bash
# Terminal 1: UI Server
cd docs && python3 -m http.server 8080

# Terminal 2: API Server
python3 local-dev-server.py

# Open http://localhost:8080
```

## 🎮 Using the System

### 1. Access the UI
Open http://localhost:8080 in your browser

### 2. Create a Project
Click the "+" button next to "Select Project"

### 3. Add Tasks
- Type task description in the input field
- Press Enter or click "Add Task"

### 4. Manage Tasks
- Drag tasks between columns (Backlog → Ready → Working → Review → Done)
- Click "Approve & Push" on reviewed tasks
- Use "Request Revision" to send back for changes

### 5. Monitor Progress
- Watch real-time status updates
- View Git integration status
- Track task completion

## 🧪 Testing Features

The local environment includes mock implementations of:

- **Git Operations**: Simulated commits and pushes
- **Task Management**: Full kanban board functionality
- **Project Management**: Multiple project support
- **Status Monitoring**: Health checks and system status

## 🚢 Production Deployment

When ready for production, you have multiple options:

### GitHub Pages (UI Only)
```bash
git push origin main
# Enable GitHub Pages from /docs folder in repo settings
```

### Full Cloud Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Cloudflare Worker deployment
- Fly.io setup
- Complete production configuration

### VPS/Self-Hosted
```bash
# On your VPS
git clone https://github.com/yourusername/noderr.git
cd noderr
docker-compose up -d

# Configure nginx reverse proxy
# Point domain to VPS IP
```

## 📁 Project Structure

```
noderr/
├── docs/           # UI files (also serves GitHub Pages)
├── cloudflare-worker/  # Worker code (when deploying to Cloudflare)
├── fly-app-uncle-frank/  # Agent code (when deploying to Fly.io)
├── local-dev-server.py  # Local development server
├── docker-compose.yml   # Docker configuration
└── start-noderr.sh     # Launcher script
```

## 🛠️ Troubleshooting

### Port Already in Use
```bash
# Kill processes on ports
lsof -ti:8080 | xargs kill -9
lsof -ti:8081 | xargs kill -9
lsof -ti:8082 | xargs kill -9
```

### Python Module Not Found
```bash
pip install flask requests flask-cors
```

### Docker Issues
```bash
# Reset Docker environment
docker-compose down
docker system prune -f
docker-compose up --build
```

### UI Not Loading
- Check browser console for errors
- Ensure `docs/deploy-config.js` has correct URLs
- Try hard refresh (Ctrl+Shift+R)

## 📊 System Status

Check system status anytime:
```bash
./start-noderr.sh
# Select option 4
```

This will show:
- Local service status
- Remote service availability  
- File readiness
- Docker status

## 🔍 API Testing

Test the API directly:

```bash
# Check status
curl http://localhost:8081/api/status

# List projects
curl http://localhost:8081/api/projects

# Create a task
curl -X POST http://localhost:8081/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"description":"Test task","projectId":"demo-1"}'
```

## 📚 Learn More

- **[README.md](README.md)** - Complete system overview
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
- **[docs/git-integration.md](docs/git-integration.md)** - Git operations documentation
- **[docs/ui-spec.md](docs/ui-spec.md)** - UI specifications

## 💡 Tips

1. **Development Mode**: Use local server for development and testing
2. **Mock Data**: Local environment uses mock data - perfect for demos
3. **No Persistence**: Data resets when server restarts (by design in local mode)
4. **Customization**: Edit `local-dev-server.py` to modify mock responses

## 🤝 Contributing

1. Fork the repository
2. Run locally with `./start-noderr.sh`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🆘 Getting Help

- Check the [Troubleshooting](#-troubleshooting) section
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
- Open an issue on GitHub for bugs

---

**Ready to go autonomous?** Run `./start-noderr.sh` and start managing your AI development fleet!