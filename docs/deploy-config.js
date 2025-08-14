// Production Configuration - Auto-detects deployment environment
const CONFIG = {
    // Automatically use the current origin for API calls
    API_BASE_URL: window.location.origin,
    FALLBACK_API: window.location.origin,
    SSE_ENDPOINT: `${window.location.origin}/api/sse`,
    ENVIRONMENT: 'production',
    FEATURES: {
        GIT_INTEGRATION: true,
        AUTO_COMMIT: true,
        REAL_TIME_UPDATES: false // SSE not supported in serverless
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
