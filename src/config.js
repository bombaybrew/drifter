export const CONFIG = {
    targetUrl: process.env.TARGET_URL || 'http://localhost:7800',
    testerPort: parseInt(process.env.TESTER_PORT || '7801'),
    viewport: { width: 1280, height: 800 },
    userDataDir: process.env.USER_DATA_DIR || './.drifter_profile',
    screenshotQuality: 40,
    heartbeatInterval: 1000,
    visualPause: 2000,
    maxPollingAttempts: 20,
    pollingInterval: 200,
    maxDepth: 2,

    // SECURITY LIMITS
    allowInternalUrls: process.env.ALLOW_INTERNAL !== 'false', // Defaults to true. Set ALLOW_INTERNAL=false to block local/private IPs.
    maxTotalLinks: parseInt(process.env.MAX_TOTAL_LINKS || '100'),
    sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '300000') // 5 minutes max per session
};
