import puppeteer from 'puppeteer';
import http from 'http';

/**
 * --- DRIFTER CONFIGURATION ---
 * Modify these values to target different apps or adjust timing.
 */
const CONFIG = {
    targetUrl: process.env.TARGET_URL || 'http://localhost:7800',
    testerPort: parseInt(process.env.TESTER_PORT || '7801'),
    viewport: { width: 1280, height: 800 },
    screenshotQuality: 15,
    heartbeatInterval: 1000,
    visualPause: 2000,
    maxPollingAttempts: 20,
    pollingInterval: 200
};

/**
 * THE DRIFT ENGINE
 * Recursively crawls the target URL and captures console/network issues.
 */
async function drift(onProgress) {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);

    const visited = new Set();
    const queue = [CONFIG.targetUrl];
    const report = {};

    const update = (msg, type = 'log') => onProgress({ msg, type });

    let isCapturing = false;
    const capture = async (q = CONFIG.screenshotQuality) => {
        if (isCapturing) return;
        isCapturing = true;
        try {
            const screenshot = await page.screenshot({ encoding: 'base64', type: 'webp', quality: q });
            onProgress({ screenshot });
        } catch (e) { } finally { isCapturing = false; }
    };

    const logIssue = (url, type, text) => {
        if (!report[url]) report[url] = [];
        report[url].push({ type, text });
        update(`[${type.toUpperCase()}] ${text}`, 'issue');
    };

    const heartbeat = setInterval(() => capture(), CONFIG.heartbeatInterval);

    page.on('console', msg => {
        const t = msg.type();
        if (t === 'error' || t === 'warning') {
            const loc = msg.location()?.url ? ` (${msg.location().url})` : '';
            logIssue(page.url(), t, msg.text() + loc);
        }
    });

    page.on('response', res => {
        if (!res.ok() && res.status() >= 400 && res.url() !== page.url()) {
            logIssue(page.url(), 'network', `${res.url()} [${res.status()}]`);
        }
    });

    page.on('pageerror', err => logIssue(page.url(), 'exception', err.message));

    while (queue.length > 0) {
        const url = queue.pop();
        if (visited.has(url)) continue;
        visited.add(url);

        update(`Navigating: ${url}`);

        try {
            const nav = page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
            let ready = false;

            for (let i = 0; i < CONFIG.maxPollingAttempts; i++) {
                await new Promise(r => setTimeout(r, CONFIG.pollingInterval));
                const state = await page.evaluate(() => ({
                    ok: window.location.href.startsWith(window.location.origin),
                    body: document.body?.innerText.length > 100
                })).catch(() => ({}));

                if (state.ok && state.body) { ready = true; break; }
            }

            if (!ready) await nav;

            await new Promise(r => setTimeout(r, CONFIG.visualPause));
            update(`Scanned: ${url}`);

            const links = await page.evaluate(() =>
                Array.from(document.querySelectorAll('a'))
                    .map(a => a.href)
                    .filter(h => h.startsWith(window.location.origin))
            );

            links.forEach(l => {
                if (l.startsWith(CONFIG.targetUrl) && !visited.has(l) && !queue.includes(l)) queue.push(l);
            });

        } catch (e) {
            logIssue(url, 'nav error', e.message);
        }
    }

    clearInterval(heartbeat);
    await browser.close();
    return report;
}

/**
 * MONITOR DASHBOARD (UI)
 */
const dashboard = `
<!DOCTYPE html>
<html>
<head>
    <title>Drifter Live Monitor</title>
    <style>
        :root { --bg: #0f172a; --panel: #1e293b; --border: #334155; --text: #f8fafc; --accent: #3b82f6; --err: #f43f5e; --ok: #10b981; }
        body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        header { background: var(--panel); padding: 1rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .main { display: flex; flex: 1; overflow: hidden; }
        .view { flex: 2; border-right: 1px solid var(--border); background: #000; position: relative; }
        .label { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.8); color: var(--ok); padding: 4px 8px; font-size: 10px; border-radius: 4px; font-weight: 800; border: 1px solid var(--ok); }
        .logs { flex: 1; display: flex; flex-direction: column; background: var(--panel); border-left: 1px solid var(--border); }
        .l-head { padding: 8px 16px; background: var(--bg); border-bottom: 1px solid var(--border); font-size: 10px; font-weight: 800; color: #64748b; }
        .entries { flex: 1; overflow-y: auto; padding: 15px; font-family: monospace; font-size: 12px; }
        .line { border-left: 2px solid var(--accent); padding-left: 10px; margin-bottom: 8px; }
        .line.err { border-color: var(--err); color: #fda4af; }
        img { width: 100%; height: 100%; object-fit: contain; }
        button { background: var(--accent); color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
        button:disabled { opacity: 0.5; }
        #modal { display: none; position: fixed; inset: 10%; background: var(--panel); border: 1px solid var(--accent); border-radius: 12px; z-index: 100; padding: 30px; overflow: auto; box-shadow: 0 0 50px rgba(0,0,0,0.7); }
    </style>
</head>
<body>
    <header>
        <div style="display:flex; align-items:center; gap:10px"><span>🧭</span> <b>Drifter</b></div>
        <button id="run">Run Drift Session</button>
    </header>
    <div class="main">
        <div class="view"><div class="label">LIVE_PREVIEW</div><img id="vid" /></div>
        <div class="logs"><div class="l-head">SESSION_LOGS</div><div id="out" class="entries"></div></div>
    </div>
    <div id="modal">
        <h2 style="color:var(--accent); margin-top:0">Session Summary</h2>
        <div id="res"></div>
        <button onclick="location.reload()" style="margin-top:20px">Close & Reset</button>
    </div>
    <script>
        const btn = document.getElementById('run');
        const vid = document.getElementById('vid');
        const out = document.getElementById('out');
        const modal = document.getElementById('modal');
        const res = document.getElementById('res');

        btn.onclick = () => {
            btn.disabled = true; out.innerHTML = '';
            const sse = new EventSource('/stream');
            sse.onmessage = (e) => {
                const d = JSON.parse(e.data);
                if (d.type === 'end') {
                    sse.close(); btn.disabled = false;
                    show(d.report); return;
                }
                if (d.screenshot) vid.src = 'data:image/webp;base64,' + d.screenshot;
                if (d.msg) {
                    const l = document.createElement('div');
                    l.className = 'line' + (d.type === 'issue' ? ' err' : '');
                    l.innerText = d.msg;
                    out.appendChild(l); out.scrollTop = out.scrollHeight;
                }
            };
        };

        function show(data) {
            modal.style.display = 'block';
            const urls = Object.keys(data);
            if (!urls.length) return res.innerHTML = '✅ No Regressions Found.';
            res.innerHTML = urls.map(u => \`
                <div style="margin-bottom:15px">
                    <b style="color:var(--accent)">\${u}</b>
                    \${data[u].map(i => \`<div style="font-size:12px; margin-left:15px; opacity:0.7">[\${i.type}] \${i.text}</div>\`).join('')}
                </div>
            \`).join('');
        }
    </script>
</body>
</html>
`;

/**
 * WEB SERVER
 */
const server = http.createServer(async (req, res) => {
    const path = req.url.split('?')[0];

    if (path === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(dashboard);
    } else if (path === '/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        try {
            const results = await drift(data => res.write(`data: ${JSON.stringify(data)}\n\n`));
            res.write(`data: ${JSON.stringify({ type: 'end', report: results })}\n\n`);
        } catch (e) {
            res.write(`data: ${JSON.stringify({ type: 'issue', msg: e.message })}\n\n`);
        }
        res.end();
    } else {
        res.writeHead(404).end();
    }
});

server.listen(CONFIG.testerPort, () => {
    console.log(`\n🧭 Drifter active: http://localhost:${CONFIG.testerPort}`);
    console.log(`🎯 Targeting:      ${CONFIG.targetUrl}\n`);
});
