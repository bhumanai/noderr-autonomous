#!/bin/bash

# Deploy OAuth UI Flow to Fly.io
# This creates a web UI for users to authenticate Claude

set -e

echo "========================================"
echo "DEPLOYING OAUTH UI FLOW TO FLY.IO"
echo "========================================"

APP_NAME="uncle-frank-claude"

cd fly-app-uncle-frank

# Copy UI file
cp ../ui/oauth-auth.html .

# Deploy with OAuth handler
echo "Building and deploying..."
fly deploy \
    --app "$APP_NAME" \
    --dockerfile Dockerfile.oauth \
    --ha=false \
    --vm-size shared-cpu-1x \
    --strategy immediate

echo ""
echo "Waiting for deployment..."
sleep 15

# Test the OAuth UI
echo ""
echo "Testing OAuth UI..."
if curl -s "https://$APP_NAME.fly.dev/" | grep -q "Claude OAuth Setup"; then
    echo "✅ OAuth UI is live!"
else
    echo "⚠️ OAuth UI may still be starting..."
fi

echo ""
echo "========================================"
echo "✅ OAUTH UI DEPLOYED!"
echo "========================================"
echo ""
echo "🌐 OAuth Setup URL: https://$APP_NAME.fly.dev/"
echo ""
echo "Instructions for users:"
echo "1. Visit: https://$APP_NAME.fly.dev/"
echo "2. Click 'Start Authentication'"
echo "3. Click the OAuth URL that appears"
echo "4. Login to Claude in the new tab"
echo "5. Copy the authorization code"
echo "6. Paste it back in the UI"
echo "7. Click 'Submit Code'"
echo ""
echo "Once authenticated, Claude will be ready to use!"
echo "========================================"