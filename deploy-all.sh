#!/bin/bash

echo "========================================="
echo "Noderr Complete System Deployment Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Setup environment
export FLYCTL_INSTALL="/root/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

echo "Step 1: Environment Setup"
echo "-------------------------"

# Check for fly CLI
if command -v fly &> /dev/null; then
    print_status "Fly CLI installed: $(fly version)"
else
    print_error "Fly CLI not found. Installing..."
    curl -L https://fly.io/install.sh | sh
    export FLYCTL_INSTALL="/root/.fly"
    export PATH="$FLYCTL_INSTALL/bin:$PATH"
fi

# Check for wrangler CLI
if command -v wrangler &> /dev/null; then
    print_status "Wrangler CLI installed: $(wrangler --version)"
else
    print_warning "Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

echo ""
echo "Step 2: Fly.io Deployment Status"
echo "---------------------------------"

# Check Fly.io app status
FLY_STATUS=$(curl -s https://uncle-frank-claude.fly.dev/health)
if [[ $FLY_STATUS == *"healthy"* ]]; then
    print_status "Fly.io app is running at https://uncle-frank-claude.fly.dev"
    echo "  Health check: $FLY_STATUS"
else
    print_error "Fly.io app is not responding properly"
fi

# Check if Git endpoints exist
GIT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://uncle-frank-claude.fly.dev/git/status)
if [[ $GIT_STATUS == "200" ]]; then
    print_status "Git endpoints are deployed"
else
    print_warning "Git endpoints not found (HTTP $GIT_STATUS)"
    echo "  To deploy: cd fly-app-uncle-frank && fly deploy"
fi

echo ""
echo "Step 3: Cloudflare Worker Status"
echo "---------------------------------"

# Check if Cloudflare Worker is deployed
CF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://noderr-orchestrator.terragonlabs.workers.dev/api/status 2>/dev/null)
if [[ $CF_STATUS == "200" ]]; then
    print_status "Cloudflare Worker is deployed"
else
    print_warning "Cloudflare Worker not accessible (may need deployment)"
    echo "  To deploy: cd cloudflare-worker && wrangler deploy"
    echo "  Note: Requires valid CLOUDFLARE_API_TOKEN"
fi

echo ""
echo "Step 4: UI Frontend"
echo "--------------------"

if [ -d "ui" ]; then
    print_status "UI files found in ./ui/"
    echo "  Files: index.html, app.js, style.css, manifest.json"
    print_warning "UI needs to be deployed to a hosting service"
    echo ""
    echo "  Option 1: Deploy to GitHub Pages"
    echo "    - Push to GitHub repository"
    echo "    - Enable GitHub Pages in repository settings"
    echo "    - URL: https://<username>.github.io/<repo>/"
    echo ""
    echo "  Option 2: Deploy to Cloudflare Pages"
    echo "    - Run: npx wrangler pages deploy ui/ --project-name=noderr-ui"
    echo "    - URL: https://noderr-ui.pages.dev"
    echo ""
    echo "  Option 3: Deploy to Vercel"
    echo "    - Install: npm i -g vercel"
    echo "    - Run: cd ui && vercel"
    echo "    - Follow prompts for deployment"
else
    print_error "UI directory not found"
fi

echo ""
echo "Step 5: Required Credentials"
echo "-----------------------------"

# Check for Fly.io auth
if fly auth whoami &>/dev/null; then
    FLY_USER=$(fly auth whoami 2>/dev/null | grep -oE '[^ ]+@[^ ]+')
    print_status "Fly.io authenticated as: $FLY_USER"
else
    print_warning "Fly.io not authenticated"
    echo "  Run: fly auth login"
fi

# Check for Cloudflare auth
if [[ -n "$CLOUDFLARE_API_TOKEN" ]]; then
    print_status "Cloudflare API token is set"
else
    print_warning "Cloudflare API token not set"
    echo "  Export: export CLOUDFLARE_API_TOKEN='your-token'"
fi

echo ""
echo "========================================="
echo "Deployment Commands Summary"
echo "========================================="
echo ""
echo "1. Deploy Fly.io app with Git operations:"
echo "   cd fly-app-uncle-frank"
echo "   fly deploy"
echo ""
echo "2. Deploy Cloudflare Worker:"
echo "   cd cloudflare-worker"
echo "   export CLOUDFLARE_API_TOKEN='your-token'"
echo "   wrangler deploy"
echo ""
echo "3. Deploy UI to Cloudflare Pages:"
echo "   npx wrangler pages deploy ui/ --project-name=noderr-ui"
echo ""
echo "4. Test the system:"
echo "   python tests/test-git-integration.py"
echo ""

# Create quick deploy script
cat > quick-deploy.sh << 'EOF'
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
EOF

chmod +x quick-deploy.sh

echo "========================================="
echo "Created quick-deploy.sh for easy deployment"
echo "========================================="

# Test endpoints if they exist
echo ""
echo "Testing Available Endpoints:"
echo "----------------------------"

# Test Fly.io
echo -n "Fly.io health: "
curl -s https://uncle-frank-claude.fly.dev/health | head -c 50
echo ""

# Test theoretical Worker endpoint
echo -n "Worker (if deployed): "
curl -s --max-time 2 https://noderr-orchestrator.terragonlabs.workers.dev/api/status 2>/dev/null || echo "Not accessible"

echo ""
echo "========================================="
echo "Deployment status check complete!"
echo "========================================="