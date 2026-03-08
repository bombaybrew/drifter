import http from 'http';
import { CONFIG } from './config.js';
import { drift, openBrowserForLogin } from './crawler.js';
import { dashboard } from './ui.js';

/**
 * WEB SERVER
 */
const server = http.createServer(async (req, res) => {
    const path = req.url.split('?')[0];

    if (path === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(dashboard);
    } else if (path === '/stream') {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const targetUrl = urlObj.searchParams.get('url');
        const waitTime = urlObj.searchParams.get('wait');
        const depth = urlObj.searchParams.get('depth');

        const options = {};
        if (targetUrl) options.targetUrl = targetUrl;
        if (waitTime) options.visualPause = parseInt(waitTime);
        if (depth) options.maxDepth = parseInt(depth);

        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        try {
            const results = await drift(data => res.write(`data: ${JSON.stringify(data)}\n\n`), options);
            res.write(`data: ${JSON.stringify({ type: 'end', report: results })}\n\n`);
        } catch (e) {
            res.write(`data: ${JSON.stringify({ type: 'issue', msg: e.message })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: 'end', report: { error: e.message } })}\n\n`);
        }
        res.end();
    } else if (path === '/login') {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const targetUrl = urlObj.searchParams.get('url') || CONFIG.targetUrl;

        try {
            await openBrowserForLogin(targetUrl);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    } else {
        res.writeHead(404).end();
    }
});

server.listen(CONFIG.testerPort, () => {
    console.log(`\nDrifter active: http://localhost:${CONFIG.testerPort}`);
    console.log(`Targeting:      ${CONFIG.targetUrl}\n`);
});
