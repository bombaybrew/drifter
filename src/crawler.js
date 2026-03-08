import puppeteer from 'puppeteer';
import { CONFIG } from './config.js';

/**
 * THE DRIFT ENGINE
 * Recursively crawls the target URL and captures console/network issues.
 */
export async function drift(onProgress, options = {}) {
    const targetUrl = options.targetUrl || CONFIG.targetUrl;
    const visualPause = options.visualPause !== undefined ? options.visualPause : CONFIG.visualPause;
    const maxDepth = options.maxDepth !== undefined ? options.maxDepth : CONFIG.maxDepth;

    try {
        const u = new URL(targetUrl);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            onProgress({ msg: `[SECURITY] Blocked non-web protocol: ${u.protocol}`, type: 'issue' });
            return { [targetUrl]: [{ type: 'security', text: 'Only http and https protocols are allowed' }] };
        }

        const isInternal = u.hostname === 'localhost' || u.hostname.startsWith('127.') ||
            u.hostname.startsWith('10.') || u.hostname.startsWith('192.168.') ||
            u.hostname.startsWith('169.254.') || u.hostname.match(/^172\.(1[6-9]|2\d|3[0-1])\./);
        if (!CONFIG.allowInternalUrls && isInternal) {
            onProgress({ msg: `[SECURITY] Blocked internal URL: ${targetUrl}`, type: 'issue' });
            return { [targetUrl]: [{ type: 'security', text: 'Blocked by internal network policy' }] };
        }
    } catch (e) {
        onProgress({ msg: `[SECURITY] Invalid URL: ${targetUrl}`, type: 'issue' });
        return { [targetUrl]: [{ type: 'error', text: 'Invalid format' }] };
    }

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);

    const visited = new Set();
    const queue = [{ url: targetUrl, depth: 0 }];
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
    const sessionStart = Date.now();
    let totalScanned = 0;

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
        if (Date.now() - sessionStart > CONFIG.sessionTimeoutMs) {
            update(`[SECURITY] Session timeout of ${CONFIG.sessionTimeoutMs}ms exceeded.`, 'issue');
            break;
        }
        if (totalScanned >= CONFIG.maxTotalLinks) {
            update(`[SECURITY] Max link limit of ${CONFIG.maxTotalLinks} exceeded.`, 'issue');
            break;
        }

        const { url, depth } = queue.pop();
        if (visited.has(url)) continue;
        visited.add(url);
        totalScanned++;

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

            if (depth < maxDepth) {
                links.forEach(l => {
                    if (l.startsWith(targetUrl) && !visited.has(l) && !queue.find(q => q.url === l)) queue.push({ url: l, depth: depth + 1 });
                });
            }

            const safeSelectors = await page.evaluate(() => {
                let sId = 0;
                // Grab up to 15 interactable elements on the page that might behave like buttons or tabs
                const els = Array.from(document.querySelectorAll('button:not([type="submit"]), [role="tab"], [role="button"], .button, .btn'));
                const elements = [];
                els.forEach(el => {
                    const text = (el.innerText || el.getAttribute('aria-label') || 'Icon/Element').replace(/\n/g, ' ').trim().slice(0, 20);
                    if (el.closest('form')) return;
                    if (['delete', 'remove', 'submit', 'save', 'clear', 'logout', 'buy', 'sell'].some(w => text.toLowerCase().includes(w))) return;

                    el.dataset.drifterId = sId;
                    elements.push({ sel: '[data-drifter-id="' + sId + '"]', text });
                    sId++;
                });
                return elements;
            });

            for (const item of safeSelectors.slice(0, 15)) {
                try {
                    const currentUrl = page.url();
                    update(`Interacting: ${item.text}`);
                    await page.click(item.sel);

                    // Small delay to allow Javascript frameworks (like Vue) to render UI updates or throw logical errors.
                    await new Promise(r => setTimeout(r, 1000));

                    if (page.url() !== currentUrl) {
                        const newUrl = page.url();
                        if (depth < maxDepth && newUrl.startsWith(targetUrl) && !visited.has(newUrl)) {
                            queue.push({ url: newUrl, depth: depth + 1 });
                        }
                        break;
                    } else {
                        // The URL didn't change, but a modal or tab might have opened! Take a quick manual snapshot so the log tracks the view.
                        await capture();
                    }
                } catch (e) { }
            }

        } catch (e) {
            logIssue(url, 'nav error', e.message);
        }
    }

    clearInterval(heartbeat);
    await browser.close();
    return report;
}
