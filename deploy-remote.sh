#!/bin/bash

# Deploy Noderr UI for Remote Access
# This script deploys the UI to various free hosting services

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Noderr Remote Deployment Helper${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

echo "Choose deployment method:"
echo "1) Deploy to Vercel (Recommended - Instant)"
echo "2) Deploy to Netlify (Drag & Drop)"
echo "3) Deploy to Surge.sh (Simple CLI)"
echo "4) Deploy to Render (Free tier)"
echo "5) Setup instructions for manual deployment"

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo -e "\n${BLUE}Deploying to Vercel...${NC}"
        echo "Installing Vercel CLI..."
        npm i -g vercel
        
        echo "Deploying..."
        cd docs
        vercel --prod --yes
        
        echo -e "\n${GREEN}✓ Deployed to Vercel!${NC}"
        echo "Your app will be available at the URL shown above"
        ;;
        
    2)
        echo -e "\n${BLUE}Deploy to Netlify${NC}"
        echo "1. Go to https://app.netlify.com/drop"
        echo "2. Drag the 'docs' folder to the browser window"
        echo "3. Your site will be live immediately!"
        echo ""
        echo "Or use Netlify CLI:"
        echo "  npm i -g netlify-cli"
        echo "  netlify deploy --dir=docs --prod"
        ;;
        
    3)
        echo -e "\n${BLUE}Deploying to Surge.sh...${NC}"
        npm i -g surge
        
        echo "Enter a subdomain (e.g., noderr-app):"
        read subdomain
        
        surge docs "$subdomain.surge.sh"
        
        echo -e "\n${GREEN}✓ Deployed to https://$subdomain.surge.sh${NC}"
        ;;
        
    4)
        echo -e "\n${BLUE}Deploy to Render${NC}"
        echo "1. Go to https://render.com"
        echo "2. Connect your GitHub repository"
        echo "3. Create a new Static Site"
        echo "4. Set:"
        echo "   - Build Command: (leave empty)"
        echo "   - Publish Directory: docs"
        echo "5. Deploy!"
        ;;
        
    5)
        echo -e "\n${BLUE}Manual Deployment Options${NC}"
        echo ""
        echo -e "${YELLOW}Option A: GitHub Pages (from main branch)${NC}"
        echo "1. Merge this branch to main:"
        echo "   git checkout main"
        echo "   git merge terragon/remaining-tasks"
        echo "   git push origin main"
        echo "2. Go to repo Settings > Pages"
        echo "3. Source: Deploy from branch"
        echo "4. Branch: main, Folder: /docs"
        echo "5. Save"
        echo "URL: https://bhumanai.github.io/noderr-autonomous/"
        echo ""
        echo -e "${YELLOW}Option B: Cloudflare Pages${NC}"
        echo "1. Go to https://pages.cloudflare.com"
        echo "2. Connect GitHub repository"
        echo "3. Build settings:"
        echo "   - Build command: (leave empty)"
        echo "   - Build output directory: docs"
        echo "4. Deploy"
        echo ""
        echo -e "${YELLOW}Option C: Firebase Hosting${NC}"
        echo "1. Install Firebase CLI: npm i -g firebase-tools"
        echo "2. Run: firebase init hosting"
        echo "3. Public directory: docs"
        echo "4. Run: firebase deploy"
        ;;
esac

echo -e "\n${BLUE}================================${NC}"
echo -e "${GREEN}Deployment Configuration${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo "The UI is configured to connect to:"
echo "  API: https://uncle-frank-claude.fly.dev"
echo ""
echo "Once deployed, you can access from:"
echo "  - Mobile phones"
echo "  - Tablets"
echo "  - Any device with internet"
echo ""
echo -e "${YELLOW}Note: The Fly.io backend at uncle-frank-claude.fly.dev${NC}"
echo -e "${YELLOW}needs to be updated with Git operations for full functionality.${NC}"