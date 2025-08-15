# D3 - Document-Driven Development

A powerful web-based interface for Claude CLI that enables document-driven development workflows with authentication, project management, and multi-session support.

![D3 - Document-Driven Development](public/screenshots/desktop-main.png)

## What is D3?

D3 (Document-Driven Development) is a methodology where documentation leads the development process. This UI brings D3 principles to life by integrating Claude AI directly into your development workflow.

## Features

- 📝 **Document-Driven**: Start with documentation, let AI help implement
- 🔐 **Secure Authentication**: Single-user authentication system with JWT tokens
- 📁 **Project Management**: Organize and manage multiple Claude projects
- 💬 **Multi-Session Support**: Run multiple Claude sessions concurrently
- 🌓 **Dark/Light Mode**: Toggle between dark and light themes
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔄 **Real-time Updates**: Live streaming of Claude responses
- 🚀 **Easy Deployment**: Deploy on Fly.io, Vercel, Docker, or self-host

## Quick Start

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/D3.git
cd D3
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:3001 in your browser

### Docker

```bash
docker-compose up -d
```

### Deploy to Fly.io

1. Install Fly CLI and login:
```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
```

2. Deploy:
```bash
flyctl launch
flyctl deploy
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=your-secret-key-here
```

### Persistent Storage

The application stores data in the following locations:
- **Production**: `/app/data/` (when NODE_ENV=production)
- **Development**: User's home directory

## API Endpoints

- `POST /api/auth/register` - Register first user (setup)
- `POST /api/auth/login` - Login
- `GET /api/auth/status` - Check auth status
- `GET /api/projects` - List projects
- `POST /api/projects/add` - Add a project
- `GET /api/sessions/:project` - Get project sessions
- `POST /api/claude/start` - Start Claude session
- `POST /api/claude/send` - Send message to Claude
- `POST /api/claude/stop` - Stop Claude session

## Security

- Single-user authentication system
- JWT tokens for session management
- Passwords hashed with bcrypt
- Persistent SQLite database for auth

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Based on the original [claudecodeui](https://github.com/siteboon/claudecodeui)
- Built for use with [Claude CLI](https://claude.ai/cli)
