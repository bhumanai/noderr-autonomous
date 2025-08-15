#!/bin/bash

# Claude Code UI - Fly.io Deployment Script
# This script deploys the application to Fly.io

set -e

echo "🚀 Starting Claude Code UI deployment to Fly.io..."

# Check if Fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI is not installed."
    echo "📦 Installing Fly CLI..."
    curl -L https://fly.io/install.sh | sh
    export FLYCTL_INSTALL="/home/$USER/.fly"
    export PATH="$FLYCTL_INSTALL/bin:$PATH"
fi

# Check if user is logged in to Fly.io
if ! fly auth whoami &> /dev/null; then
    echo "🔐 Please log in to Fly.io..."
    fly auth login
fi

# Check if app exists, if not create it
if ! fly status --app claudecodeui &> /dev/null; then
    echo "📱 Creating new Fly.io app..."
    fly launch --name claudecodeui --region sjc --no-deploy --yes
    
    # Create volume for persistent storage
    echo "💾 Creating persistent volume..."
    fly volumes create claudecodeui_data --size 1 --region sjc --yes || true
else
    echo "✅ App 'claudecodeui' already exists"
fi

# Set secrets/environment variables if needed
echo "🔧 Setting environment variables..."
fly secrets set NODE_ENV=production --app claudecodeui || true

# Deploy the application
echo "🚢 Deploying to Fly.io..."
fly deploy --app claudecodeui

# Get the app URL
APP_URL=$(fly info --app claudecodeui -j | jq -r '.Hostname')

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your app is available at: https://${APP_URL}"
echo ""
echo "📝 Useful commands:"
echo "  - View logs: fly logs --app claudecodeui"
echo "  - SSH into app: fly ssh console --app claudecodeui"
echo "  - Check status: fly status --app claudecodeui"
echo "  - Scale app: fly scale count 2 --app claudecodeui"
echo ""
echo "⚠️  Note: Claude Code/Cursor CLI features require the CLI tools to be installed on the Fly.io instance."
echo "    The UI will work, but CLI integration may be limited without additional setup."