#!/bin/bash
set -e

echo "================================"
echo "Autonomous Noderr Deployment"
echo "================================"

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found. Please install it first:"
    echo "   curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Configuration
APP_NAME="noderr-claude-auto"
HMAC_SECRET="${HMAC_SECRET:-$(openssl rand -hex 32)}"

echo ""
echo "1. Creating/configuring Fly.io app..."
echo "   App name: $APP_NAME"

# Create app if it doesn't exist
if ! fly apps list | grep -q "$APP_NAME"; then
    echo "   Creating new app..."
    fly apps create "$APP_NAME" --org personal || true
else
    echo "   App already exists"
fi

# Update fly.toml with correct app name
sed -i.bak "s/app = .*/app = \"$APP_NAME\"/" fly.toml

echo ""
echo "2. Setting secrets..."
echo "   HMAC_SECRET: ${HMAC_SECRET:0:10}..."

# Set secrets
fly secrets set \
    HMAC_SECRET="$HMAC_SECRET" \
    CLAUDE_API_KEY="${CLAUDE_API_KEY:-your-api-key-here}" \
    --app "$APP_NAME"

echo ""
echo "3. Deploying Docker container..."
fly deploy --app "$APP_NAME" --ha=false

echo ""
echo "4. Checking deployment status..."
fly status --app "$APP_NAME"

echo ""
echo "================================"
echo "Deployment complete!"
echo "================================"
echo ""
echo "Your app URL: https://$APP_NAME.fly.dev"
echo "HMAC Secret: $HMAC_SECRET"
echo ""
echo "Test with:"
echo "  HMAC_SECRET='$HMAC_SECRET' python3 quick_test.py"
echo ""
echo "Or update quick_test.py with:"
echo "  FLY_APP_URL = 'https://$APP_NAME.fly.dev'"
echo "  HMAC_SECRET = '$HMAC_SECRET'"