#!/bin/bash
# Deploy Noderr Fleet Command UI to CloudFlare

echo "🚀 Deploying Noderr Fleet Command UI"
echo "===================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler is not installed. Installing..."
    npm install -g wrangler
fi

# Check if logged in
echo "📝 Checking CloudFlare authentication..."
wrangler whoami || wrangler login

# Create KV namespace if needed
echo "📦 Setting up KV namespace..."
KV_ID=$(wrangler kv:namespace create TASK_QUEUE --preview false 2>/dev/null | grep -oP 'id = "\K[^"]+' || echo "")
if [ -n "$KV_ID" ]; then
    echo "Created KV namespace: $KV_ID"
    echo "Update wrangler.toml with this ID"
fi

# Deploy Worker with UI
echo "🔧 Deploying Worker and UI..."
wrangler deploy

# Get deployment URL
WORKER_URL=$(wrangler deployments list | grep -oP 'https://[^\s]+' | head -1)
echo ""
echo "✅ Deployment complete!"
echo "================================"
echo "🌐 UI URL: $WORKER_URL"
echo "📱 Mobile URL: $WORKER_URL"
echo ""
echo "Next steps:"
echo "1. Set secrets:"
echo "   wrangler secret put CLAUDE_API_KEY"
echo "   wrangler secret put HMAC_SECRET"
echo "2. Update Fly.io with CF_WORKER_URL=$WORKER_URL"
echo "3. Visit $WORKER_URL to start using the UI"