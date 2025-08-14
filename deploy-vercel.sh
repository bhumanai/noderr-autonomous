#!/bin/bash

echo "🚀 Deploying Noderr to Vercel (Frontend + Backend)"
echo "================================================="
echo ""

# Check if vercel is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Create vercel.json for full-stack deployment
cat > vercel.json << 'EOF'
{
  "version": 2,
  "builds": [
    {
      "src": "instant-backend.js",
      "use": "@vercel/node"
    },
    {
      "src": "docs/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/instant-backend.js"
    },
    {
      "src": "/(.*)",
      "dest": "/docs/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
EOF

echo "✅ Created vercel.json for full-stack deployment"

# Update the frontend config to use relative API URLs
cat > docs/deploy-config.js << 'EOF'
// Production Configuration for Vercel
const CONFIG = {
    // Using same domain for both frontend and API
    API_BASE_URL: window.location.origin,
    FALLBACK_API: window.location.origin,
    SSE_ENDPOINT: `${window.location.origin}/api/sse`,
    ENVIRONMENT: 'production',
    FEATURES: {
        GIT_INTEGRATION: true,
        AUTO_COMMIT: true,
        REAL_TIME_UPDATES: false // No SSE in serverless
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
EOF

echo "✅ Updated frontend config for Vercel deployment"

# Deploy to Vercel
echo ""
echo "🚀 Deploying to Vercel..."
echo "Follow the prompts to configure your deployment"
echo ""

vercel --prod

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Your Noderr app is now live!"
echo "- Access your app at the URL shown above"
echo "- Frontend and backend are both served from the same domain"
echo "- All brainstorming features are fully functional"
echo ""
echo "🧠 Test it out:"
echo "1. Go to your deployed URL"
echo "2. Click the '🧠 Brainstorm' tab"
echo "3. Type a feature request"
echo "4. Watch it generate detailed tasks!"