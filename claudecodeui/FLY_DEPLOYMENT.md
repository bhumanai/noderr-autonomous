# Deploy Claude Code UI to Fly.io - Quick Guide

## One-Command Deploy

```bash
cd claudecodeui
./deploy-fly.sh
```

That's it! The script will:
1. Install Fly CLI if needed
2. Log you in to Fly.io
3. Create the app
4. Deploy it
5. Give you the public URL

## Manual Steps (if you prefer)

### 1. Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Login to Fly.io
```bash
fly auth login
```

### 3. Launch the app
```bash
cd claudecodeui
fly launch --name claudecodeui
```

### 4. Deploy
```bash
fly deploy
```

### 5. Open in browser
```bash
fly open
```

## Your Public URL

After deployment, your app will be available at:
```
https://claudecodeui.fly.dev
```

## Monitor Your App

- **View logs:** `fly logs`
- **Check status:** `fly status`
- **SSH into container:** `fly ssh console`
- **View in dashboard:** `fly dashboard`

## Important Notes

1. **Free Tier:** Fly.io offers a free tier that should be sufficient for personal use
2. **Automatic HTTPS:** SSL certificate is automatically provisioned
3. **Global CDN:** Your app is served from edge locations worldwide
4. **WebSocket Support:** Full WebSocket support is included
5. **Persistent Storage:** Data persists across deployments

## Limitations

- Claude Code/Cursor CLI tools are not pre-installed in the container
- For full CLI functionality, you'd need to SSH into the container and install them
- File system access is limited to the container's environment

## Quick Test

After deployment, visit your app URL and you should see the Claude Code UI interface ready to use!