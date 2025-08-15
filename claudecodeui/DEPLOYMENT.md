# Claude Code UI - Remote Deployment Guide

## Overview
This guide explains how to deploy Claude Code UI to a remote server for accessing your Claude Code/Cursor sessions from anywhere.

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

#### Prerequisites
- Docker and Docker Compose installed on your server
- A domain name (optional but recommended for HTTPS)
- Claude Code or Cursor CLI installed on the server

#### Steps

1. **Clone the repository on your server:**
```bash
git clone https://github.com/siteboon/claudecodeui.git
cd claudecodeui
```

2. **Configure environment:**
```bash
cp .env.production .env
# Edit .env file with your settings
nano .env
```

3. **Build and run with Docker Compose:**
```bash
docker-compose up -d
```

4. **Access the application:**
- Open `http://your-server-ip:3001` in your browser
- The UI will be available on port 3001

### Method 2: Direct Node.js Deployment

#### Prerequisites
- Node.js v20+ installed
- PM2 (for process management)
- nginx (for reverse proxy)

#### Steps

1. **Clone and setup:**
```bash
git clone https://github.com/siteboon/claudecodeui.git
cd claudecodeui
npm install
npm run build
```

2. **Configure environment:**
```bash
cp .env.production .env
nano .env
```

3. **Start with PM2:**
```bash
npm install -g pm2
pm2 start server/index.js --name claudecodeui
pm2 save
pm2 startup
```

4. **Configure nginx reverse proxy:**
Create `/etc/nginx/sites-available/claudecodeui`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /shell {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

5. **Enable nginx site:**
```bash
sudo ln -s /etc/nginx/sites-available/claudecodeui /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Method 3: Cloud Platform Deployment

#### Deploy to Fly.io

1. **Install Fly CLI:**
```bash
curl -L https://fly.io/install.sh | sh
```

2. **Initialize Fly app:**
```bash
fly auth login
fly launch --name your-app-name
```

3. **Create fly.toml:**
```toml
app = "your-app-name"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3001"
  NODE_ENV = "production"

[[services]]
  http_checks = []
  internal_port = 3001
  protocol = "tcp"
  script_checks = []

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

4. **Deploy:**
```bash
fly deploy
fly open
```

#### Deploy to Railway

1. **Connect GitHub repository to Railway**
2. **Add environment variables in Railway dashboard:**
   - `PORT=3001`
   - `NODE_ENV=production`
3. **Deploy automatically on push**

#### Deploy to Render

1. **Create a new Web Service on Render**
2. **Connect your GitHub repository**
3. **Configure build settings:**
   - Build Command: `npm install && npm run build`
   - Start Command: `node server/index.js`
4. **Add environment variables**
5. **Deploy**

## Security Considerations

### 1. Enable HTTPS
Always use HTTPS in production. Use Let's Encrypt for free SSL certificates:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 2. Authentication
The app includes built-in authentication. Configure it in the `.env` file:
```env
JWT_SECRET=your-secure-secret-key
```

### 3. Firewall Rules
Configure firewall to only allow necessary ports:
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 4. Environment Variables
Never commit sensitive data. Use environment variables for:
- JWT secrets
- API keys
- Database credentials

## Monitoring

### Health Check
The application provides a health endpoint at `/api/health`

### Logs
- **Docker:** `docker-compose logs -f claudecodeui`
- **PM2:** `pm2 logs claudecodeui`
- **System:** Check `/var/log/nginx/` for nginx logs

## Updating

### Docker:
```bash
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

### PM2:
```bash
git pull
npm install
npm run build
pm2 restart claudecodeui
```

## Troubleshooting

### Port Already in Use
Change the PORT in `.env` file and update your reverse proxy configuration.

### WebSocket Connection Issues
Ensure your reverse proxy is configured to handle WebSocket upgrades.

### Permission Errors
Ensure the application has write permissions to the data directory:
```bash
chmod -R 755 ./data
```

### Claude/Cursor CLI Not Found
Install Claude Code or Cursor CLI on the server:
- [Claude Code Installation](https://docs.anthropic.com/en/docs/claude-code)
- [Cursor CLI Installation](https://docs.cursor.com/en/cli/overview)

## Support

For issues and questions, please check:
- [GitHub Issues](https://github.com/siteboon/claudecodeui/issues)
- [Documentation](https://github.com/siteboon/claudecodeui#readme)