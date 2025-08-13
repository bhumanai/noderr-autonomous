#!/bin/bash
echo "================================"
echo "Noderr CF Worker Deployment"
echo "================================"
echo ""

export CLOUDFLARE_API_TOKEN="C06vATLERlF8SNThFWrrQ8jW4V35hInU7OcekwQD"

if ! command -v wrangler &> /dev/null; then
    echo "Installing wrangler..."
    npm install -g wrangler
fi

echo "Using API token authentication"

echo "Creating KV namespace..."
KV_OUTPUT=$(wrangler kv:namespace create TASK_QUEUE 2>&1)

if echo "$KV_OUTPUT" | grep -q "id ="; then
    KV_ID=$(echo "$KV_OUTPUT" | grep "id =" | cut -d'"' -f2)
    echo "KV Namespace created: $KV_ID"
    sed -i.bak "s/your-kv-namespace-id/$KV_ID/" wrangler.toml
else
    echo "KV namespace may already exist"
fi

echo "Setting HMAC secret..."
echo "test-secret-change-in-production" | wrangler secret put HMAC_SECRET

echo "Deploying worker..."
wrangler deploy

echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"