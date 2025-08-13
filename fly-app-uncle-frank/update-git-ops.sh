#!/bin/bash
# Script to update Fly.io app with Git operations module

echo "Updating Fly.io app with Git operations..."

# Check if we're in the right directory
if [ ! -f "fly.toml" ]; then
    echo "Error: fly.toml not found. Please run from fly-app-uncle-frank directory"
    exit 1
fi

# Check if git_operations.py exists
if [ ! -f "git_operations.py" ]; then
    echo "Error: git_operations.py not found"
    exit 1
fi

echo "Deploying updated Fly.io app with Git operations..."

# Deploy to Fly.io
fly deploy

if [ $? -eq 0 ]; then
    echo "✓ Successfully deployed Git operations to Fly.io"
    echo ""
    echo "Testing the deployment..."
    
    # Test the health endpoint
    curl -s https://uncle-frank-claude.fly.dev/health | jq .
    
    echo ""
    echo "Git endpoints now available:"
    echo "  - GET  /git/status - Get git status"
    echo "  - GET  /git/diff - Get git diff"
    echo "  - POST /git/add - Stage files"
    echo "  - POST /git/commit - Create commit"
    echo "  - POST /git/push - Push to remote"
    echo "  - POST /git/pull - Pull from remote"
else
    echo "✗ Deployment failed"
    exit 1
fi