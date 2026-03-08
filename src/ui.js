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
        .view { flex: 2; border-left: 1px solid var(--border); background: #000; position: relative; }
        .label { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.8); color: var(--ok); padding: 4px 8px; font-size: 10px; border-radius: 4px; font-weight: 800; border: 1px solid var(--ok); }
        .logs { flex: 1; display: flex; flex-direction: column; background: var(--panel); border-right: 1px solid var(--border); }
        .l-head { padding: 8px 16px; background: var(--bg); border-bottom: 1px solid var(--border); font-size: 10px; font-weight: 800; color: #64748b; }
        .entries { flex: 1; overflow-y: auto; padding: 0; font-family: monospace; font-size: 12px; }
        .line { border-left: 2px solid var(--accent); padding: 6px 15px; margin: 0; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .line.err { border-left-color: var(--err); color: #fda4af; }
        img { width: 100%; height: 100%; object-fit: contain; }
        button { background: var(--accent); color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
        button:disabled { opacity: 0.5; }
        #modal { display: none; position: fixed; inset: 10%; background: var(--panel); border: 1px solid var(--accent); border-radius: 12px; z-index: 100; padding: 30px; overflow: auto; box-shadow: 0 0 50px rgba(0,0,0,0.7); }
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
    <script>
        const btn = document.getElementById('run');
        const summaryBtn = document.getElementById('viewSummary');
        const loginBtn = document.getElementById('loginBtn');
        const clearBtn = document.getElementById('clearLogs');
        const vid = document.getElementById('vid');
        const out = document.getElementById('out');
        const modal = document.getElementById('modal');
        const res = document.getElementById('res');
        const targetUrlInput = document.getElementById('targetUrl');
        const visualPauseInput = document.getElementById('visualPause');
        const maxDepthInput = document.getElementById('maxDepth');

        loginBtn.onclick = async () => {
            loginBtn.disabled = true;
            loginBtn.innerText = 'Wait, browser is open...';
            try {
                const url = encodeURIComponent(targetUrlInput.value);
                const res = await fetch(\`/login?url=\${url}\`);
                if (!res.ok) {
                    const err = await res.json();
                    alert("Login failed: " + (err.error || 'Unknown error'));
                }
            } catch (e) {
                console.error(e);
                alert("Network error: " + e.message);
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerText = 'Manual Login';
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
