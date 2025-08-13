#!/bin/bash
# Quick deployment helper

echo "Quick Deployment for Noderr"
echo ""

# Deploy Fly.io if authenticated
if fly auth whoami &>/dev/null; then
    echo "Deploying Fly.io app..."
    cd fly-app-uncle-frank && fly deploy && cd ..
fi

# Deploy Cloudflare Worker if token exists
if [[ -n "$CLOUDFLARE_API_TOKEN" ]]; then
    echo "Deploying Cloudflare Worker..."
    cd cloudflare-worker && wrangler deploy && cd ..
fi

# Suggest UI deployment
echo ""
echo "To deploy UI, run:"
echo "npx wrangler pages deploy ui/ --project-name=noderr-ui"
