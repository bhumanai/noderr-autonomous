#!/bin/bash
# Quick setup script for Noderr Autonomous System

echo "🚀 Noderr Autonomous System Setup"
echo "================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

if ! command -v fly &> /dev/null; then
    echo "❌ Fly.io CLI is not installed. Please install it from https://fly.io/docs/getting-started/installing-flyctl/"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo "❌ npx is not installed. Please install it with: npm install -g npx"
    exit 1
fi

echo "✅ All prerequisites met!"
echo ""

# Setup CloudFlare Worker
echo "☁️  Setting up CloudFlare Worker..."
cd cloudflare-worker
npm install

echo ""
echo "📝 CloudFlare Worker setup:"
echo "1. Run: npx wrangler login"
echo "2. Set your Claude API key: npx wrangler secret put CLAUDE_API_KEY --name noderr-orchestrator"
echo "3. Set HMAC secret: npx wrangler secret put HMAC_SECRET --name noderr-orchestrator"
echo "4. Deploy: npx wrangler deploy"
echo ""

# Setup Fly.io
cd ../fly-app-uncle-frank
echo "🚁 Fly.io setup:"
echo "1. Run: fly auth login"
echo "2. Launch app: fly launch"
echo "3. Create volume: fly volumes create claude_data --size 1"
echo "4. Set secret: fly secrets set HMAC_SECRET='your-secret-here'"
echo "5. Deploy: fly deploy"
echo "6. Authenticate Claude manually (see README)"
echo ""

cd ..
echo "✅ Setup preparation complete!"
echo ""
echo "📚 Next steps:"
echo "1. Complete CloudFlare Worker setup (see above)"
echo "2. Complete Fly.io setup (see above)"
echo "3. Run tests in the tests/ directory"
echo "4. Visit your CloudFlare Worker URL to see the dashboard"
echo ""
echo "For detailed instructions, see README.md"