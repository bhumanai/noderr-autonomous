// Configuration for Replit/Local Development
const CONFIG = {
    // Using the current server for both frontend and API
    API_BASE_URL: window.location.origin,
    FALLBACK_API: window.location.origin,
    SSE_ENDPOINT: `${window.location.origin}/api/sse`,
    ENVIRONMENT: 'development',
    FEATURES: {
        GIT_INTEGRATION: true,
        AUTO_COMMIT: true,
        REAL_TIME_UPDATES: false // No SSE in instant backend
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
