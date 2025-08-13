// Local Development Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:8081',
    FALLBACK_API: 'http://localhost:8082',
    SSE_ENDPOINT: 'http://localhost:8081/api/sse',
    ENVIRONMENT: 'local',
    FEATURES: {
        GIT_INTEGRATION: true,
        AUTO_COMMIT: false,  // Disabled in local mode
        REAL_TIME_UPDATES: false  // SSE disabled in local mode
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
