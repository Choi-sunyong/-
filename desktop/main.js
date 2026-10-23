// 싯다르타 PC 프로그램: 웹(rosy-phi-35.vercel.app)을 그대로 띄우고, 한글(HWP) 조종 기능만 PC 쪽에서 더해 줌.
// 이 파일은 거의 바뀌지 않게 '기본 통로'만 둠. 한글 조종 명령(hwp.ps1)과 창 배치 같은 동작은
// 웹에서 받아 오므로, 고쳐도 프로그램을 다시 받을 필요 없이 새로고침(Ctrl+R)이면 반영됨.
const { app, BrowserWindow, ipcMain, shell, dialog, screen, net, Menu } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { spawn } = require('child_process');

const SITE = 'https://rosy-phi-35.vercel.app/';
let win = null, ps = null, psFile = null, psHash = '', seq = 0, buf = '';
const waits = new Map();

const bundled = () => { const p = path.join(process.resourcesPath || __dirname, 'hwp.ps1'); return fs.existsSync(p) ? p : path.join(__dirname, 'hwp.ps1'); };
// 웹에 올라가 있는 최신 hwp.ps1을 받아 둠 (못 받으면 프로그램에 들어 있는 것 사용)
async function syncHelper() {
  try {
    const r = await net.fetch(SITE + 'desktop/hwp.ps1?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length < 200 || !b.toString('utf8').includes('Reply')) throw new Error('bad');
    const h = crypto.createHash('sha1').update(b).digest('hex');
    const f = path.join(app.getPath('userData'), 'hwp.ps1');
    if (h !== psHash) { fs.writeFileSync(f, b); psHash = h; psFile = f; if (ps) { try { ps.kill(); } catch (e) {} ps = null; } }
  } catch (e) { if (!psFile) psFile = bundled(); }
}
function startPs() {
  if (ps) return ps;
  ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-STA', '-File', psFile || bundled()], { windowsHide: true });
  ps.stdout.setEncoding('utf8');
  ps.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      try { const m = JSON.parse(line), w = waits.get(m.id); if (w) { waits.delete(m.id); m.ok ? w.res(m.result) : w.rej(new Error(m.error || '한글 오류')); } } catch (e) {}
    }
  });
  const me = ps;
  ps.on('exit', () => { if (ps === me) ps = null; waits.forEach(w => w.rej(new Error('한글 연결이 끊겼어요. 다시 시도해 주세요.'))); waits.clear(); });
  return ps;
}
function hwp(cmd, args = {}, timeout = 60000) {
  return new Promise((res, rej) => {
    const id = ++seq; waits.set(id, { res, rej });
    const json = JSON.stringify({ ...args, id, cmd }).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
    startPs().stdin.write(json + '\n');
    setTimeout(() => { if (waits.has(id)) { waits.delete(id); rej(new Error('한글이 응답하지 않아요.')); } }, timeout);
  });
}
const tmpDir = () => { const d = path.join(os.tmpdir(), 'siddhartha'); fs.mkdirSync(d, { recursive: true }); return d; };
const safe = n => String(n || '문서').replace(/[\\/:*?"<>|]/g, ' ').trim() || '문서';

// 한글 명령: 대부분 hwp.ps1로 그대로 넘김. 파일 쓰기·파일 고르기만 여기서 처리
ipcMain.handle('hwp', async (e, cmd, a = {}) => {
  if (cmd === 'open' || cmd === 'reload') {
    const file = path.join(tmpDir(), safe(a.name).replace(/\.hwpx$/i, '') + '.hwpx');
    fs.writeFileSync(file, Buffer.from(a.bytes));
    return hwp(cmd, { path: file });
  }
  if (cmd === 'pick') {
    const r = await dialog.showOpenDialog(win, { title: '한글 문서 열기', properties: ['openFile'], filters: [{ name: '한글 문서', extensions: ['hwp', 'hwpx'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    await hwp('openPath', { path: r.filePaths[0] });
    return { path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
  }
  if (cmd === 'tile') { // 예전 웹과의 호환용
    const d = screen.getDisplayMatching(win.getBounds()), A = d.workArea, sf = d.scaleFactor || 1, lw = Math.round(A.width * (a.left || 0.4));
    if (win.isMaximized()) win.unmaximize();
    win.setBounds({ x: A.x, y: A.y, width: lw, height: A.height });
    return hwp('place', { x: Math.round((A.x + lw) * sf), y: Math.round(A.y * sf), w: Math.round((A.width - lw) * sf), h: Math.round(A.height * sf) }, 15000);
  }
  return hwp(cmd, a, a.timeout || 60000);
});
// 창 다루기: 웹에서 배치를 정함
ipcMain.handle('win', async (e, cmd, a = {}) => {
  if (!win) return null;
  if (cmd === 'screen') { const d = screen.getDisplayMatching(win.getBounds()); return { workArea: d.workArea, scaleFactor: d.scaleFactor || 1, bounds: win.getBounds(), maximized: win.isMaximized() }; }
  if (cmd === 'setBounds') { if (win.isMaximized()) win.unmaximize(); if (win.isFullScreen()) win.setFullScreen(false); win.setBounds(a); return true; }
  if (cmd === 'maximize') { win.maximize(); return true; }
  if (cmd === 'focus') { win.focus(); return true; }
  return null;
});
// 구독 AI 연결: PC에 설치해 로그인해 둔 Claude Code(claude) 또는 Codex(codex)를 실행해 답을 받아 옴 (API 키 불필요, 구독 한도에서 차감)
const aiEnv = () => {
  const h = os.homedir(), extra = [path.join(h, '.local', 'bin'), path.join(process.env.APPDATA || path.join(h, 'AppData', 'Roaming'), 'npm'), path.join(h, '.claude', 'local'), path.join(h, 'AppData', 'Local', 'Programs', 'claude'), '/usr/local/bin', '/opt/homebrew/bin'];
  const k = Object.keys(process.env).find(x => x.toLowerCase() === 'path') || 'PATH';
  return { ...process.env, [k]: [process.env[k] || '', ...extra].join(path.delimiter), NO_COLOR: '1' };
};
function runCli(bin, args, input, cwd, timeout) {
  return new Promise((res, rej) => {
    let out = '', err = '', done = false;
    const p = spawn(bin, args, { cwd, env: aiEnv(), shell: process.platform === 'win32', windowsHide: true });
    const t = setTimeout(() => { if (!done) { done = true; try { p.kill(); } catch (e) {} rej(new Error('AI가 너무 오래 걸려서 멈췄어요.')); } }, timeout || 600000);
    const ob = [], eb = [];
    p.stdout.on('data', d => ob.push(d)); p.stderr.on('data', d => eb.push(d));
    const dec = b => { const buf = Buffer.concat(b); const u = buf.toString('utf8'); if (!u.includes('\ufffd') || process.platform !== 'win32') return u; try { return new TextDecoder('euc-kr').decode(buf); } catch (e) { return u; } };
    p.on('error', e => { if (!done) { done = true; clearTimeout(t); rej(e); } });
    p.on('close', code => { if (done) return; done = true; clearTimeout(t); out = dec(ob); err = dec(eb); res({ code, out, err }); });
    if (input != null) { p.stdin.write(input); }
    p.stdin.end();
  });
}
const q = s => process.platform === 'win32' ? '"' + String(s).replace(/"/g, '\\"') + '"' : String(s);
ipcMain.handle('ai', async (e, cmd, a = {}) => {
  if (cmd === 'check') {
    const r = {};
    for (const [k, bin] of [['claude', 'claude'], ['codex', 'codex']]) {
      try { const o = await runCli(bin, ['--version'], null, os.homedir(), 20000); r[k] = o.code === 0 ? (o.out.trim().split('\n')[0] || 'ok') : null; } catch (er) { r[k] = null; }
    }
    return r;
  }
  if (cmd === 'usage') { // Claude 구독 남은 한도(5시간·주간). Claude Code가 로그인해 둔 토큰으로 조회
    let tok = '';
    try { tok = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), 'utf8')).claudeAiOauth.accessToken; } catch (er) { return { error: 'nologin' }; }
    try {
      const r = await net.fetch('https://api.anthropic.com/api/oauth/usage', { headers: { Authorization: 'Bearer ' + tok, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'oauth-2025-04-20' } });
      if (!r.ok) return { error: r.status === 401 ? 'expired' : 'http' + r.status };
      return await r.json();
    } catch (er) { return { error: 'net' }; }
  }
  if (cmd !== 'ask') return null;
  const dir = fs.mkdtempSync(path.join(tmpDir(), 'ai-'));
  try {
    const files = (a.files || []).map((f, i) => { const n = 'file' + (i + 1) + '.' + (f.ext || 'bin'); fs.writeFileSync(path.join(dir, n), Buffer.from(f.b64, 'base64')); return n; });
    let prompt = a.prompt || '';
    if (files.length) prompt += '\n\n[첨부 파일 — 이 폴더에 있어요. 반드시 열어서 내용을 보고 답하세요]\n' + files.map(n => './' + n).join('\n');
    if (a.engine === 'codex') {
      const outF = path.join(dir, 'answer.txt');
      const args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '-o', q(outF)];
      if (a.model) args.push('-m', q(a.model));
      files.filter(n => /\.(png|jpe?g|gif|webp)$/i.test(n)).forEach(n => args.push('-i', q(path.join(dir, n))));
      args.push('-');
      const o = await runCli('codex', args, prompt, dir, a.timeout);
      let txt = ''; try { txt = fs.readFileSync(outF, 'utf8'); } catch (er) {}
      if (!txt.trim()) throw new Error(((o.err || o.out).trim().split('\n').slice(-3).join(' ') || 'Codex가 답하지 않았어요.').slice(0, 400));
      return { text: txt };
    }
    const args = ['-p', '--output-format', 'json', '--max-turns', '8', '--allowedTools', q('Read,Glob,WebSearch,WebFetch'), '--disallowedTools', q('Bash,Edit,Write,NotebookEdit')];
    if (a.model) args.push('--model', q(a.model));
    const o = await runCli('claude', args, prompt, dir, a.timeout);
    let j = null; try { j = JSON.parse(o.out.trim().split('\n').filter(Boolean).pop()); } catch (er) {}
    if (!j) throw new Error(((o.err || o.out).trim().slice(-400)) || 'Claude Code가 답하지 않았어요. 설치·로그인을 확인해 주세요.');
    if (j.is_error || j.subtype !== 'success') {
      const m = String(j.result || j.subtype || '오류'), lim = m.match(/limit[^|]*\|(\d{9,})/i);
      if (lim) throw new Error('구독 사용 한도가 다 찼어요. ' + new Date(+lim[1] * 1000).toLocaleString('ko-KR') + '부터 다시 쓸 수 있어요.');
      throw new Error(m.slice(0, 400));
    }
    return { text: j.result || '' };
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (er) {} }
});
ipcMain.handle('helper', async () => { await syncHelper(); return { hash: psHash.slice(0, 8), version: app.getVersion() }; });

function create() {
  win = new BrowserWindow({
    width: 1500, height: 950, minWidth: 600, minHeight: 500, title: '싯다르타', icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false }
  });
  // 화면 크기에 맞춰 자동 배율 (노트북처럼 좁은 화면에서도 잘리지 않게). Ctrl +/-/0 으로 직접 조절한 값은 기억
  const zf = path.join(app.getPath('userData'), 'zoom.json');
  let userZ = 1; try { userZ = JSON.parse(fs.readFileSync(zf, 'utf8')).z || 1; } catch (e) {}
  const fit = () => { if (!win) return; const w = win.getContentBounds().width; const z = Math.max(0.6, Math.min(1, w / 1700)) * userZ; win.webContents.setZoomFactor(Math.round(z * 100) / 100); };
  win.on('resize', fit); win.webContents.on('did-finish-load', fit);
  const setUser = z => { userZ = Math.round(Math.max(0.5, Math.min(2, z)) * 100) / 100; try { fs.writeFileSync(zf, JSON.stringify({ z: userZ })); } catch (er) {} fit(); };
  // Ctrl + 마우스 휠
  win.webContents.on('zoom-changed', (e, dir) => setUser(userZ + (dir === 'in' ? 0.1 : -0.1)));
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown' || !(i.control || i.meta)) return;
    const k = i.key;
    if (k === '-' || k === '=' || k === '+' || k === '0') {
      e.preventDefault();
      setUser(k === '0' ? 1 : userZ + (k === '-' ? -0.1 : 0.1));
    }
  });
  // 우클릭 메뉴 (잘라내기·복사·붙여넣기)
  win.webContents.on('context-menu', (e, p) => {
    const t = [];
    if (p.isEditable) t.push({ role: 'cut', label: '잘라내기', enabled: p.editFlags.canCut }, { role: 'copy', label: '복사', enabled: p.editFlags.canCopy }, { role: 'paste', label: '붙여넣기', enabled: p.editFlags.canPaste }, { type: 'separator' }, { role: 'selectAll', label: '모두 선택' });
    else if (p.selectionText && p.selectionText.trim()) t.push({ role: 'copy', label: '복사' });
    if (t.length) Menu.buildFromTemplate(t).popup({ window: win });
  });
  // 예전 화면이 남지 않게: 켤 때 웹 캐시를 비우고, 페이지는 늘 새로 받아 옴
  win.webContents.session.clearCache().catch(() => {}).finally(() => win.loadURL(SITE, { extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n' }));
  // 새로고침할 때마다 최신 한글 조종 명령도 받아 옴
  win.webContents.on('did-start-loading', () => { syncHelper(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank' || url.startsWith(SITE)) return { action: 'allow' };
    shell.openExternal(url); return { action: 'deny' };
  });
}
// 하나만 켜지게: 이미 켜져 있으면 그 창을 앞으로
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.whenReady().then(async () => {
  // 컴퓨터를 켜면 자동으로 실행 (끄려면 작업 관리자 → 시작 앱에서 '사용 안 함')
  try { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true }); } catch (e) {}
  await syncHelper(); create();
});
app.on('window-all-closed', () => { try { ps && ps.kill(); } catch (e) {} app.quit(); });
