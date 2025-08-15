#!/bin/bash

# Claude Code UI Deployment Script
# This script builds and deploys the application using Docker

set -e

echo "🚀 Starting Claude Code UI Deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Pull latest changes (optional)
if [ "$1" = "--pull" ]; then
    echo "📥 Pulling latest changes from repository..."
    git pull
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build the application
echo "🔨 Building Docker image..."
docker-compose build --no-cache

# Start the application
echo "🎯 Starting application..."
docker-compose up -d

# Wait for health check
echo "⏳ Waiting for application to be ready..."
sleep 10

# Check if application is running
if curl -f http://localhost:3001/api/health &> /dev/null; then
    echo "✅ Application deployed successfully!"
    echo "🌐 Access the application at: http://localhost:3001"
    echo ""
    echo "📝 Useful commands:"
    echo "  - View logs: docker-compose logs -f"
    echo "  - Stop application: docker-compose down"
    echo "  - Restart application: docker-compose restart"
else
    echo "❌ Application health check failed. Check logs with: docker-compose logs"
    exit 1
fi