// Deployment Configuration for Noderr Fleet Command UI
// Update these URLs based on your actual deployment

const CONFIG = {
    // API Endpoints
    API_BASE_URL: 'https://noderr-orchestrator.terragonlabs.workers.dev',
    
    // Alternative API endpoints (fallback)
    FALLBACK_API: 'https://uncle-frank-claude.fly.dev',
    
    // WebSocket/SSE endpoint for real-time updates
    SSE_ENDPOINT: 'https://noderr-orchestrator.terragonlabs.workers.dev/api/sse',
    
    // Environment
    ENVIRONMENT: 'production',
    
    // Features
    FEATURES: {
        GIT_INTEGRATION: true,
        AUTO_COMMIT: true,
        REAL_TIME_UPDATES: true
    }
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}