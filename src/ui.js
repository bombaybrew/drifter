export const dashboard = `
<!DOCTYPE html>
<html>
<head>
    <title>Drifter Live Monitor</title>
    <style>
        :root { --bg: #0f172a; --panel: #1e293b; --border: #334155; --text: #f8fafc; --accent: #3b82f6; --err: #f43f5e; --ok: #10b981; }
        body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        header { background: var(--panel); padding: 1rem 2rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .main { display: flex; flex: 1; overflow: hidden; }
        .view { flex: 1; border-left: 1px solid var(--border); background: #000; position: relative; }
        .label { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.8); color: var(--ok); padding: 4px 8px; font-size: 10px; border-radius: 4px; font-weight: 800; border: 1px solid var(--ok); }
        .logs { width: 27%; flex-shrink: 0; display: flex; flex-direction: column; background: var(--panel); border-right: 1px solid var(--border); }
        .l-head { padding: 8px 16px; background: var(--bg); border-bottom: 1px solid var(--border); font-size: 10px; font-weight: 800; color: #64748b; }
        .entries { flex: 1; overflow-y: auto; padding: 0; font-family: monospace; font-size: 12px; }
        .line { border-left: 2px solid var(--accent); padding: 6px 15px; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .line.err { border-left-color: var(--err); color: #fda4af; }
        img { width: 100%; height: 100%; object-fit: contain; }
        button { background: var(--accent); color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
        button:disabled { opacity: 0.5; }
        #modal, #errModal { display: none; position: fixed; inset: 10%; background: var(--panel); border: 1px solid var(--accent); border-radius: 12px; z-index: 100; padding: 30px; overflow: auto; box-shadow: 0 0 50px rgba(0,0,0,0.7); }
        #errModal { border-color: var(--err); inset: 20%; height: fit-content; max-height: 60%; }
        .err-box { background: rgba(244, 63, 94, 0.1); border: 1px solid var(--err); padding: 15px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #fda4af; white-space: pre-wrap; word-break: break-all; user-select: text; margin-bottom: 20px; }
        #loginOverlay { display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.9); z-index: 200; backdrop-filter: blur(5px); display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .login-card { background: var(--panel); border: 1px solid var(--ok); padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width: 400px; }
    </style>
</head>
<body>
    <header>
        <div style="display:flex; align-items:center; gap:20px;">
            <div style="display:flex; align-items:center; gap:10px"><b>Drifter</b></div>
            <div style="display:flex; align-items:center; gap:10px; font-size:12px; opacity:0.8;">
                <label>URL: <input id="targetUrl" value="http://localhost:7800" style="background:#0f172a; color:#fff; border:1px solid var(--border); padding:4px 8px; border-radius:4px; width:200px;"></label>
                <label>Wait (ms): <input id="visualPause" type="number" value="2000" style="background:#0f172a; color:#fff; border:1px solid var(--border); padding:4px 8px; border-radius:4px; width:60px;"></label>
                <label>Max Depth: <input id="maxDepth" type="number" value="2" style="background:#0f172a; color:#fff; border:1px solid var(--border); padding:4px 8px; border-radius:4px; width:40px;"></label>
            </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
            <button id="loginBtn" style="background:#10b981;">Manual Login</button>
            <button id="run">Run Drift Session</button>
            <button id="viewSummary" disabled style="background:#475569;">Summary</button>
            <button id="clearLogs" style="background:#475569;">Clear</button>
        </div>
    </header>
    <div class="main">
        <div class="logs"><div class="l-head">SESSION_LOGS</div><div id="out" class="entries"></div></div>
        <div class="view"><div class="label">PREVIEW</div><img id="vid" /></div>
    </div>
    <div id="modal">
        <h2 style="color:var(--accent); margin-top:0">Session Summary</h2>
        <div id="res"></div>
        <button onclick="document.getElementById('modal').style.display='none'" style="margin-top:20px">Close</button>
    </div>
    <div id="errModal">
        <h2 style="color:var(--err); margin-top:0">System Error</h2>
        <div id="errContent" class="err-box"></div>
        <button onclick="document.getElementById('errModal').style.display='none'" style="background:var(--err)">Dismiss</button>
    </div>
    <div id="loginOverlay" style="display:none">
        <div class="login-card">
            <h1 style="color:var(--ok); margin:0 0 10px 0">Login In Progress</h1>
            <p style="opacity:0.7; margin-bottom:30px">A separate browser window is open for you to log in. Once you are finished, click the button below to resume.</p>
            <button id="finishLoginBtn" style="background:var(--ok); padding:15px 30px; font-size:16px">Finish Login & Start Drifting</button>
        </div>
    </div>
    <script>
        const btn = document.getElementById('run');
        const summaryBtn = document.getElementById('viewSummary');
        const loginBtn = document.getElementById('loginBtn');
        const clearBtn = document.getElementById('clearLogs');
        const vid = document.getElementById('vid');
        const out = document.getElementById('out');
        const modal = document.getElementById('modal');
        const errModal = document.getElementById('errModal');
        const errContent = document.getElementById('errContent');
        const res = document.getElementById('res');
        const targetUrlInput = document.getElementById('targetUrl');
        const visualPauseInput = document.getElementById('visualPause');
        const maxDepthInput = document.getElementById('maxDepth');

        const loginOverlay = document.getElementById('loginOverlay');
        const finishLoginBtn = document.getElementById('finishLoginBtn');

        const showError = (msg) => {
            errContent.innerText = msg;
            errModal.style.display = 'block';
        };

        loginBtn.onclick = async () => {
            loginBtn.disabled = true;
            loginBtn.innerText = 'Opening...';
            loginOverlay.style.display = 'flex';
            
            try {
                const url = encodeURIComponent(targetUrlInput.value);
                const res = await fetch(\`/login?url=\${url}\`);
                if (!res.ok) {
                    const err = await res.json();
                    showError("Login failed: " + (err.error || 'Unknown error'));
                    loginOverlay.style.display = 'none';
                }
            } catch (e) {
                console.error(e);
                showError("Network error: " + e.message);
                loginOverlay.style.display = 'none';
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerText = 'Manual Login';
            }
        };

        finishLoginBtn.onclick = async () => {
            finishLoginBtn.innerText = 'Closing Browser...';
            try {
                await fetch('/close-login');
                loginOverlay.style.display = 'none';
            } catch (e) {
                console.error(e);
            } finally {
                finishLoginBtn.innerText = 'Finish Login & Start Drifting';
            }
        };

        clearBtn.onclick = () => {
            out.innerHTML = '';
            vid.removeAttribute('src');
            summaryBtn.disabled = true;
            summaryBtn.style.background = '#475569';
        };

        summaryBtn.onclick = () => {
            modal.style.display = 'block';
        };

        let lastScreen = null;
        let hoverActive = false;

        btn.onclick = () => {
            btn.disabled = true;
            summaryBtn.disabled = true;
            summaryBtn.style.background = '#475569';
            out.innerHTML = '';
            vid.removeAttribute('src');
            lastScreen = null;
            hoverActive = false;
            
            const url = encodeURIComponent(targetUrlInput.value);
            const wait = visualPauseInput.value;
            const depth = maxDepthInput.value;
            const sse = new EventSource(\`/stream?url=\${url}&wait=\${wait}&depth=\${depth}\`);
            
            sse.onmessage = (e) => {
                const d = JSON.parse(e.data);
                if (d.type === 'end') {
                    sse.close();
                    btn.disabled = false;
                    summaryBtn.disabled = false;
                    summaryBtn.style.background = 'var(--accent)';
                    buildSummary(d.report);
                    return;
                }
                if (d.screenshot) {
                    lastScreen = d.screenshot;
                    if (!hoverActive) vid.src = 'data:image/webp;base64,' + d.screenshot;
                }
                if (d.msg) {
                    const l = document.createElement('div');
                    l.className = 'line' + (d.type === 'issue' ? ' err' : '');
                    l.innerText = d.msg;
                    
                    if (lastScreen) {
                        const snap = 'data:image/webp;base64,' + lastScreen;
                        l.dataset.snap = snap;
                        l.style.cursor = 'crosshair';
                        l.style.transition = 'background 0.2s';
                        l.onmouseenter = () => {
                            hoverActive = true;
                            vid.src = snap;
                            l.style.background = 'rgba(255,255,255,0.05)';
                        };
                        l.onmouseleave = () => {
                            hoverActive = false;
                            if (lastScreen) vid.src = 'data:image/webp;base64,' + lastScreen;
                            l.style.background = 'transparent';
                        };
                    }
                    
                    out.appendChild(l); out.scrollTop = out.scrollHeight;
                }
            };
        };

        function buildSummary(data) {
            const urls = Object.keys(data);
            if (!urls.length) {
                res.innerHTML = 'No Regressions Found.';
                return;
            }
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
