#!/bin/bash

echo "🚀 Preparing Noderr for Railway Deployment"
echo "=========================================="
echo ""

# Create railway.json configuration
cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node instant-backend.js",
    "healthcheckPath": "/api/status"
  }
}
EOF

echo "✅ Created railway.json configuration"

# Create Procfile for Railway
cat > Procfile << 'EOF'
web: node instant-backend.js
EOF

echo "✅ Created Procfile"

# Update package.json for Railway
cat > package.json << 'EOF'
{
  "name": "noderr-fullstack",
  "version": "1.0.0",
  "description": "Noderr - Autonomous Development System with Brainstorming",
  "main": "instant-backend.js",
  "scripts": {
    "start": "node instant-backend.js",
    "dev": "node instant-backend.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.2"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["ai", "development", "brainstorming", "tasks", "automation"],
  "author": "Terragon Labs",
  "license": "MIT"
}
EOF

echo "✅ Updated package.json for Railway"

# Create a simple environment file template
cat > .env.example << 'EOF'
# Railway will automatically set PORT
# PORT=3000

# Optional: Add AI API keys for enhanced features
# OPENAI_API_KEY=your_openai_key_here
# ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional: Database (Railway can provision PostgreSQL)
# DATABASE_URL=postgresql://user:pass@host:port/db

# Optional: Redis for sessions (Railway can provision Redis)
# REDIS_URL=redis://host:port
EOF

echo "✅ Created .env.example"

# Update frontend config to work with Railway
cat > docs/deploy-config.js << 'EOF'
// Production Configuration for Railway
const CONFIG = {
    // Using same domain for both frontend and API
    API_BASE_URL: window.location.origin,
    FALLBACK_API: window.location.origin,
    SSE_ENDPOINT: `${window.location.origin}/api/sse`,
    ENVIRONMENT: 'production',
    FEATURES: {
        GIT_INTEGRATION: true,
        AUTO_COMMIT: true,
        REAL_TIME_UPDATES: false
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
EOF

echo "✅ Updated frontend config for Railway"

echo ""
echo "🎯 Next Steps for Railway Deployment:"
echo "====================================="
echo ""
echo "1. 🌐 Go to https://railway.app"
echo "2. 📚 Connect your GitHub account"
echo "3. ➕ Click 'New Project'"
echo "4. 📂 Select 'Deploy from GitHub repo'"
echo "5. 🔍 Choose this repository"
echo "6. ⚡ Railway will automatically:"
echo "   - Detect Node.js"
echo "   - Install dependencies"
echo "   - Start the server"
echo "   - Assign a public URL"
echo ""
echo "🎉 Your app will be live in ~2 minutes!"
echo ""
echo "📱 After deployment:"
echo "   - Your app URL: https://your-app.railway.app"
echo "   - Frontend and backend served from same domain"
echo "   - Full brainstorming system operational"
echo ""
echo "🧠 Test the brainstorming:"
echo "   1. Go to your Railway URL"
echo "   2. Click '🧠 Brainstorm' tab"
echo "   3. Type: 'Add user authentication'"
echo "   4. Watch it generate 25+ detailed tasks!"
echo ""
echo "💰 Cost: FREE for hobby projects!"