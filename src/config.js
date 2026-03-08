export const CONFIG = {
    targetUrl: process.env.TARGET_URL || 'http://localhost:7800',
    testerPort: parseInt(process.env.TESTER_PORT || '7801'),
    viewport: { width: 1280, height: 800 },
    screenshotQuality: 15,
    heartbeatInterval: 1000,
    visualPause: 2000,
    maxPollingAttempts: 20,
    pollingInterval: 200
};
