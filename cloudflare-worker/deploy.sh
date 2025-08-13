#!/bin/bash

echo "================================"
echo "Noderr CF Worker Deployment"
echo "================================"
echo ""

# Set Cloudflare API token
export CLOUDFLARE_API_TOKEN="C06vATLERlF8SNThFWrrQ8jW4V35hInU7OcekwQD"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found!"
    echo "Install with: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"
echo "✅ Using API token authentication"

# Create KV namespace if needed
echo ""
echo "Creating KV namespace..."
KV_OUTPUT=$(wrangler kv:namespace create TASK_QUEUE 2>&1)

if echo "$KV_OUTPUT" | grep -q "id ="; then
    KV_ID=$(echo "$KV_OUTPUT" | grep "id =" | cut -d'"' -f2)
    echo "✅ KV Namespace created: $KV_ID"
    echo ""
    echo "Updating wrangler.toml with KV ID..."
    sed -i.bak "s/your-kv-namespace-id/$KV_ID/" wrangler.toml
else
    echo "⚠️  KV namespace may already exist or error occurred"
    echo "$KV_OUTPUT"
fi

# Set secret
echo ""
echo "Setting HMAC secret..."
echo "test-secret-change-in-production" | wrangler secret put HMAC_SECRET

# Deploy worker
echo ""
echo "Deploying worker..."
wrangler deploy

echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"
echo ""
echo "Your worker should now be available at:"
echo "https://noderr-orchestrator.<your-subdomain>.workers.dev"
echo ""
echo "Next steps:"
echo "1. Visit the dashboard URL shown above"
echo "2. Queue a test command"
echo "3. Monitor execution in the dashboard"