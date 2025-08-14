#!/bin/bash
set -e

echo "Deploying Claude Auth Fix to Fly.io..."

# Navigate to fly app directory
cd fly-app-uncle-frank

# Deploy to Fly.io
echo "Deploying to uncle-frank-claude..."
fly deploy --app uncle-frank-claude

echo "Deployment complete!"
echo ""
echo "Test the authentication at:"
echo "https://noderr-autonomous-bu5anov27-bhuman.vercel.app/"
echo ""
echo "Or directly at:"
echo "https://uncle-frank-claude.fly.dev/claude/auth/verify"