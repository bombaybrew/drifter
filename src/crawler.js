import puppeteer from 'puppeteer';
import { CONFIG } from './config.js';

/**
 * THE DRIFT ENGINE
 * Recursively crawls the target URL and captures console/network issues.
 */
export async function drift(onProgress, options = {}) {
    const targetUrl = options.targetUrl || CONFIG.targetUrl;
    const visualPause = options.visualPause !== undefined ? options.visualPause : CONFIG.visualPause;

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);

    const visited = new Set();
    const queue = [targetUrl];
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

            await new Promise(r => setTimeout(r, visualPause));
            update(`Scanned: ${url}`);

            const links = await page.evaluate(() =>
                Array.from(document.querySelectorAll('a'))
                    .map(a => a.href)
                    .filter(h => h.startsWith(window.location.origin))
            );

            links.forEach(l => {
                if (l.startsWith(targetUrl) && !visited.has(l) && !queue.includes(l)) queue.push(l);
            });

        } catch (e) {
            logIssue(url, 'nav error', e.message);
        }
    }

    clearInterval(heartbeat);
    await browser.close();
    return report;
}
