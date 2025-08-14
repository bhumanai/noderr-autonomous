# Deploy CORS-Enabled Backend to Fly.io

The backend needs to be redeployed with CORS support to allow the Vercel frontend to communicate with it.

## What Changed

1. Updated `Dockerfile` to use `inject_agent_cors.py` which includes:
   - CORS headers on all endpoints
   - `/health` endpoint for frontend connectivity checks
   - Proper OPTIONS request handling

2. Added `flask-cors` dependency

## Deploy Steps

1. Install Fly CLI if not already installed:
```bash
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
```

2. Authenticate with Fly.io:
```bash
flyctl auth login
```

3. Deploy the updated backend:
```bash
cd fly-app-uncle-frank
flyctl deploy --ha=false
```

## Verify Deployment

After deployment, test CORS is working:

```bash
# Check health endpoint
curl https://uncle-frank-claude.fly.dev/health

# Check CORS headers
curl -H "Origin: https://noderr-autonomous-dfktivw49-bhuman.vercel.app" \
     -I https://uncle-frank-claude.fly.dev/health
```

You should see `Access-Control-Allow-Origin` headers in the response.