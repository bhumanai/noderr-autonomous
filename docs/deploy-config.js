// Production Configuration for GitHub Pages
const CONFIG = {
    // Using the live Fly.io endpoint as API
    API_BASE_URL: 'https://uncle-frank-claude.fly.dev',
    FALLBACK_API: 'https://uncle-frank-claude.fly.dev',
    SSE_ENDPOINT: 'https://uncle-frank-claude.fly.dev/api/sse',
    ENVIRONMENT: 'production',
    FEATURES: {
        GIT_INTEGRATION: true,
        AUTO_COMMIT: true,
        REAL_TIME_UPDATES: true
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
