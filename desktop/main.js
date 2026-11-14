// 싯다르타 PC 프로그램: 웹(rosy-phi-35.vercel.app)을 그대로 띄우고, 한글(HWP) 조종 기능만 PC 쪽에서 더해 줌.
// 이 파일은 거의 바뀌지 않게 '기본 통로'만 둠. 한글 조종 명령(hwp.ps1)과 창 배치 같은 동작은
// 웹에서 받아 오므로, 고쳐도 프로그램을 다시 받을 필요 없이 새로고침(Ctrl+R)이면 반영됨.
const { app, BrowserWindow, ipcMain, shell, dialog, screen, net, Menu } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto'), { spawn } = require('child_process');

const SITE = 'https://rosy-phi-35.vercel.app/';
// 작업 표시줄에서 바로가기와 켜진 창이 한 아이콘으로 묶이게: 설치 프로그램이 바로가기에 붙인 앱 ID(appId)와 똑같이 맞춤
if (process.platform === 'win32') app.setAppUserModelId('kr.hyangnam.siddhartha');
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
// 구독 계정 여러 개: 계정 1은 원래 Claude Code 설정 폴더(~/.claude), 계정 2·3은 따로 둔 폴더(~/.claude-sdt2 …)를 CLAUDE_CONFIG_DIR로 지정해 각자 로그인 상태를 유지
const aiProfFile = () => path.join(app.getPath('userData'), 'ai-profile.json');
const aiProfN = () => { try { const n = +JSON.parse(fs.readFileSync(aiProfFile(), 'utf8')).n; return n >= 1 && n <= 3 ? n : 1; } catch (e) { return 1; } };
const aiProfDir = n => n > 1 ? path.join(os.homedir(), '.claude-sdt' + n) : null;
const aiCredFile = n => path.join(aiProfDir(n) || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), '.credentials.json');
const aiEnv = (n = aiProfN()) => {
  const h = os.homedir(), extra = [path.join(h, '.local', 'bin'), path.join(process.env.APPDATA || path.join(h, 'AppData', 'Roaming'), 'npm'), path.join(h, '.claude', 'local'), path.join(h, 'AppData', 'Local', 'Programs', 'claude'), '/usr/local/bin', '/opt/homebrew/bin'];
  const k = Object.keys(process.env).find(x => x.toLowerCase() === 'path') || 'PATH';
  const env = { ...process.env, [k]: [process.env[k] || '', ...extra].join(path.delimiter), NO_COLOR: '1' };
  const d = aiProfDir(n); if (d) { fs.mkdirSync(d, { recursive: true }); env.CLAUDE_CONFIG_DIR = d; }
  return env;
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
    try { tok = JSON.parse(fs.readFileSync(aiCredFile(aiProfN()), 'utf8')).claudeAiOauth.accessToken; } catch (er) { return { error: 'nologin' }; }
    try {
      const r = await net.fetch('https://api.anthropic.com/api/oauth/usage', { headers: { Authorization: 'Bearer ' + tok, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'oauth-2025-04-20' } });
      if (!r.ok) return { error: r.status === 401 ? 'expired' : 'http' + r.status };
      return await r.json();
    } catch (er) { return { error: 'net' }; }
  }
  // 구독 계정 고르기: profile(지금 계정·로그인 여부) / setProfile(계정 바꾸기) / login(그 계정으로 로그인할 창 열기)
  if (cmd === 'profile') { const r = { n: aiProfN(), login: {} }; for (const i of [1, 2, 3]) r.login[i] = fs.existsSync(aiCredFile(i)); return r; }
  if (cmd === 'setProfile') { const n = +a.n; if (!(n >= 1 && n <= 3)) return false; fs.writeFileSync(aiProfFile(), JSON.stringify({ n })); return true; }
  if (cmd === 'login') {
    const n = +a.n >= 1 && +a.n <= 3 ? +a.n : 1;
    if (process.platform !== 'win32') return { manual: (aiProfDir(n) ? 'CLAUDE_CONFIG_DIR=' + aiProfDir(n) + ' ' : '') + 'claude' };
    spawn('cmd.exe', ['/c', 'start', 'Claude 계정 ' + n + ' 로그인', 'cmd', '/k', 'echo Claude 계정 ' + n + ' 로그인: 브라우저에서 로그인한 뒤, 끝나면 /exit 를 입력하고 이 창을 닫으세요.&& claude'], { env: aiEnv(n), detached: true, windowsHide: false }).unref();
    return { opened: true };
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
// ===== 싯다르타 고치기(비서 → PC의 Claude Code) =====
// GitHub의 싯다르타 코드를 PC에 받아 두고, Claude Code가 고친 뒤, 사용자가 '반영'을 누르면 한 커밋으로 GitHub에 올림(→ 자동 배포)
const { safeStorage } = require('electron');
const GH_REPO = 'Choi-sunyong/-', GH_BRANCH = 'main';
const devDir = () => { const d = path.join(app.getPath('userData'), 'repo'); fs.mkdirSync(d, { recursive: true }); return d; };
const tokFile = () => path.join(app.getPath('userData'), 'gh.bin');
function ghToken() { try { const b = fs.readFileSync(tokFile()); return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString('utf8'); } catch (e) { return ''; } }
async function gh(pathname, opt = {}) {
  const r = await net.fetch('https://api.github.com' + pathname, { ...opt, headers: { Authorization: 'Bearer ' + ghToken(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'siddhartha-desktop', ...(opt.headers || {}) } });
  if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (e) {} throw new Error('GitHub ' + r.status + (m ? ': ' + m : '')); }
  return r.status === 204 ? null : r.json();
}
const DEV_OK = p => /\.(html|js|json|ps1|md|css)$/i.test(p) && !/^desktop\/(node_modules|dist)\//.test(p) && !/package-lock\.json$/.test(p);
let devBase = null; // { commit, files: { path: { sha, text } } }
const gitSha = buf => crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf])).digest('hex');
async function devSync() {
  const ref = await gh(`/repos/${GH_REPO}/git/ref/heads/${GH_BRANCH}`);
  const commit = ref.object.sha;
  const tree = await gh(`/repos/${GH_REPO}/git/trees/${commit}?recursive=1`);
  const files = {};
  const dir = devDir();
  // 예전 작업 파일은 비움
  const wipe = d => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) { wipe(f); try { fs.rmdirSync(f); } catch (e) {} } else fs.unlinkSync(f); } };
  try { wipe(dir); } catch (e) {}
  for (const t of tree.tree) {
    if (t.type !== 'blob' || !DEV_OK(t.path) || t.size > 5e6) continue;
    const b = await gh(`/repos/${GH_REPO}/git/blobs/${t.sha}`);
    const buf = Buffer.from(b.content, 'base64');
    const f = path.join(dir, ...t.path.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf);
    files[t.path] = { sha: t.sha, mode: t.mode };
  }
  devBase = { commit, files };
  return { commit, n: Object.keys(files).length };
}
function devChanged() {
  if (!devBase) return [];
  const out = [], dir = devDir();
  const walk = (d, rel) => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n), r = rel ? rel + '/' + n : n; if (fs.statSync(f).isDirectory()) walk(f, r); else if (DEV_OK(r)) { const buf = fs.readFileSync(f), sha = gitSha(buf), old = devBase.files[r]; if (!old || old.sha !== sha) out.push({ path: r, sha, isNew: !old }); } } };
  walk(dir, '');
  for (const p of Object.keys(devBase.files)) if (!fs.existsSync(path.join(dir, ...p.split('/')))) out.push({ path: p, deleted: true });
  return out;
}
ipcMain.handle('dev', async (e, cmd, a = {}) => {
  if (cmd === 'setToken') { const t = String(a.token || '').trim(); if (!t) { try { fs.unlinkSync(tokFile()); } catch (er) {} return true; } fs.writeFileSync(tokFile(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(t) : Buffer.from(t)); return true; }
  if (cmd === 'status') {
    if (!ghToken()) return { token: false };
    try { const r = await gh(`/repos/${GH_REPO}`); return { token: true, push: !!(r.permissions && r.permissions.push) }; } catch (er) { return { token: true, error: er.message }; }
  }
  if (cmd === 'run') {
    // 최신 코드를 받아 놓고 Claude Code로 고침 (파일 읽기·고치기만, 명령 실행은 막음)
    if (!ghToken()) throw new Error('GitHub 토큰이 없어요. 설정에서 넣어 주세요.');
    if (!devBase || !devChanged().length) { await devSync(); devBase.at = Date.now(); } // 아직 반영 안 한 수정이 있으면 그 위에 이어서 고침
    const sys = '너는 교사용 웹앱 "싯다르타"의 코드를 고치는 개발자다. 이 폴더가 저장소다: index.html(교사용 앱 전체, 매우 큼 — Grep으로 찾아서 필요한 부분만 Read), student.html(학생용), desktop/(PC 프로그램), api/(서버 함수). 요청을 정확히 구현하되 관련 없는 곳은 건드리지 않는다. 기존 코드 스타일(한 파일 안 인라인 JS/CSS, 한국어 주석)을 따른다. 끝나면 무엇을 바꿨는지 한국어로 짧게(사용자에게 보여줄 말투로) 정리한다.';
    const prompt = `<지침>\n${sys}\n</지침>\n\n[요청]\n${a.request || ''}`;
    const args = ['-p', '--output-format', 'json', '--max-turns', '60', '--permission-mode', 'acceptEdits', '--allowedTools', q('Read,Edit,Write,Glob,Grep,MultiEdit'), '--disallowedTools', q('Bash,WebFetch,WebSearch,NotebookEdit')];
    const o = await runCli('claude', args, prompt, devDir(), 1800000);
    let j = null; try { j = JSON.parse(o.out.trim().split('\n').filter(Boolean).pop()); } catch (er) {}
    if (!j) throw new Error(((o.err || o.out).trim().slice(-400)) || 'Claude Code가 답하지 않았어요.');
    const changed = devChanged();
    return { text: j.result || '', changed: changed.map(c => ({ path: c.path, isNew: !!c.isNew, deleted: !!c.deleted })), base: devBase && devBase.commit };
  }
  if (cmd === 'apply') {
    // 받은 뒤 GitHub에서 같은 파일이 바뀌었으면 덮어쓰지 않고 멈춤
    const ch = devChanged(); if (!ch.length) return { commit: null };
    const ref = await gh(`/repos/${GH_REPO}/git/ref/heads/${GH_BRANCH}`), head = ref.object.sha;
    const headCommit = await gh(`/repos/${GH_REPO}/git/commits/${head}`);
    if (head !== devBase.commit) {
      const cur = await gh(`/repos/${GH_REPO}/git/trees/${head}?recursive=1`), m = {}; cur.tree.forEach(t => m[t.path] = t.sha);
      const clash = ch.filter(c => devBase.files[c.path] && m[c.path] !== devBase.files[c.path].sha).map(c => c.path);
      if (clash.length) throw new Error('그 사이 다른 곳에서 ' + clash.join(', ') + ' 파일이 바뀌었어요. 다시 시켜 주세요.');
    }
    const tree = [];
    for (const c of ch) {
      if (c.deleted) { tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null }); continue; }
      const buf = fs.readFileSync(path.join(devDir(), ...c.path.split('/')));
      const b = await gh(`/repos/${GH_REPO}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' }) });
      tree.push({ path: c.path, mode: (devBase.files[c.path] && devBase.files[c.path].mode) || '100644', type: 'blob', sha: b.sha });
    }
    const nt = await gh(`/repos/${GH_REPO}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }) });
    const msg = String(a.message || '비서로 고침').slice(0, 300) + '\n\n(싯다르타 AI 비서 → Claude Code)';
    const nc = await gh(`/repos/${GH_REPO}/git/commits`, { method: 'POST', body: JSON.stringify({ message: msg, tree: nt.sha, parents: [head] }) });
    await gh(`/repos/${GH_REPO}/git/refs/heads/${GH_BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: nc.sha }) });
    devBase = null;
    return { commit: nc.sha, files: ch.map(c => c.path) };
  }
  if (cmd === 'discard') { devBase = null; try { await devSync(); devBase.at = Date.now(); } catch (er) {} return true; }
  if (cmd === 'ask') {
    // 싯다르타 기능을 대신 실행하는 코드를 만들어 달라고 함 (코드는 읽기만)
    if (ghToken() && (!devBase || (Date.now() - (devBase.at || 0) > 600000 && !devChanged().length))) { await devSync(); devBase.at = Date.now(); }
    const args = ['-p', '--output-format', 'json', '--max-turns', '30', '--allowedTools', q('Read,Glob,Grep'), '--disallowedTools', q('Bash,Edit,Write,MultiEdit,NotebookEdit,WebFetch,WebSearch')];
    if (!devBase) throw new Error('싯다르타 코드를 받지 못했어요. 설정에서 GitHub 토큰을 확인해 주세요.'); // 홈 폴더에서 엉뚱한 앱 코드를 읽지 않게
    const o = await runCli('claude', args, a.prompt || '', devDir(), 900000);
    let j = null; try { j = JSON.parse(o.out.trim().split('\n').filter(Boolean).pop()); } catch (er) {}
    if (!j || j.is_error) throw new Error((j && j.result) || ((o.err || o.out).trim().slice(-400)) || 'Claude Code가 답하지 않았어요.');
    return { text: j.result || '' };
  }
  return null;
});
// ===== 웹 창 조종 (물품 신청: 지마켓·11번가 장바구니·견적서, 에듀파인) =====
// 여기는 '창 열기·스크립트 실행·PDF 저장' 통로만 — 어느 상품을 어떻게 담는지는 웹(purchase-admin.html)이 보냄 → 고쳐도 다시 설치할 필요 없음
// 로그인은 이 창(persist:sdtweb)에 한 번 해 두면 계속 유지됨. 허용한 사이트에서만 스크립트를 돌림
const WEB_OK = /^https:\/\/([\w-]+\.)*(gmarket\.co\.kr|gmkt\.kr|11st\.co\.kr|goe\.go\.kr)(:\d+)?(\/|$)/i;
const webWins = new Map();
// 쇼핑몰이 Electron·싯다르타가 들어간 브라우저 정보를 보면 빈 화면을 주는 경우가 있어 일반 크롬처럼 보냄
const WEB_UA = () => app.userAgentFallback.replace(/\s(Electron|siddhartha-desktop|싯다르타)\/\S+/gi, '');
function webWin(key, show) {
  let w = webWins.get(key);
  if (w && !w.isDestroyed()) { if (show && !w.isVisible()) w.show(); return w; }
  w = new BrowserWindow({ width: 1300, height: 900, show: !!show, title: '싯다르타', icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { partition: 'persist:sdtweb', contextIsolation: true, sandbox: true } });
  const hook = c => c.on('dom-ready', () => c.executeJavaScript("window.__sdtAlerts=[];window.alert=function(m){window.__sdtAlerts.push(String(m))};window.confirm=function(m){window.__sdtAlerts.push(String(m));return true};window.print=function(){};", true).catch(() => {}));
  w.webContents.setUserAgent(WEB_UA());
  hook(w.webContents);
  w.webContents.setWindowOpenHandler(() => ({ action: 'allow', overrideBrowserWindowOptions: { show: true, autoHideMenuBar: true } })); // webPreferences를 덮어쓰면 부모 창과의 연결이 끊겨 견적서(폼 전송) 창이 500 오류가 남
  w.webContents.on('did-create-window', child => { child.webContents.setUserAgent(WEB_UA()); hook(child.webContents); webWins.set(key + ':popup', child); child.on('closed', () => { if (webWins.get(key + ':popup') === child) webWins.delete(key + ':popup'); }); });
  w.on('closed', () => { if (webWins.get(key) === w) webWins.delete(key); });
  webWins.set(key, w); return w;
}
// 쇼핑몰 계정: 이 PC에만 Windows 암호화(safeStorage)로 저장. 웹 화면은 비밀번호를 다시 읽을 수 없고, 로그인 창에 넣을 때만 씀
const credFile = () => path.join(app.getPath('userData'), 'shop-cred.json');
const credAll = () => { try { return JSON.parse(fs.readFileSync(credFile(), 'utf8')); } catch (e) { return {}; } };
const LOGIN = {
  gm: { url: 'https://signinssl.gmarket.co.kr/login/login', host: /(^|\.)gmarket\.co\.kr$/, id: '#typeMemberInputId', pw: '#typeMemberInputPassword', keep: null, btn: '#btn_memberLogin' },
  st: { url: 'https://login.11st.co.kr/auth/front/login.tmall', host: /(^|\.)11st\.co\.kr$/, id: '#memId', pw: '#memPwd', keep: '#lbAutoLogin', btn: '#loginButton' }
};
ipcMain.handle('web', async (e, cmd, a = {}) => {
  const key = String(a.key || 'shop');
  if (cmd === 'credSet') {
    const site = a.site === 'gm' ? 'gm' : a.site === 'st' ? 'st' : null; if (!site) return false;
    const all = credAll(), id = String(a.id || '').trim(), pw = String(a.pw || '');
    if (!id) delete all[site];
    else all[site] = { id, pw: pw ? (safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(pw).toString('base64') : null) : (all[site] && all[site].pw) || null };
    fs.writeFileSync(credFile(), JSON.stringify(all)); return true;
  }
  if (cmd === 'credGet') { const c = credAll(); return { gm: c.gm ? { id: c.gm.id, has: !!c.gm.pw } : null, st: c.st ? { id: c.st.id, has: !!c.st.pw } : null }; }
  if (cmd === 'open') {
    if (!WEB_OK.test(String(a.url || ''))) throw new Error('허용되지 않은 주소예요.');
    const w = webWin(key, a.show);
    try { await w.loadURL(a.url); } catch (er) { if (!/ERR_ABORTED/.test(String(er))) throw er; }
    if (a.wait) await new Promise(r => setTimeout(r, +a.wait));
    return { url: w.webContents.getURL(), title: w.getTitle() };
  }
  const w = webWins.get(key);
  if (!w || w.isDestroyed()) { if (cmd === 'close' || cmd === 'has') return false; throw new Error('창이 닫혔어요.'); }
  if (cmd === 'has') return true;
  if (cmd === 'info') return { url: w.webContents.getURL(), title: w.getTitle(), popup: !!(webWins.get(key + ':popup') && !webWins.get(key + ':popup').isDestroyed()) };
  if (cmd === 'exec') {
    if (!WEB_OK.test(w.webContents.getURL())) throw new Error('허용되지 않은 주소예요.');
    // 로그인·주문·결제 화면에서는 웹이 코드를 못 돌리게 (비밀번호 가로채기·결제 진행 차단)
    { const u = new URL(w.webContents.getURL()); if (/^(signin|login|pay|order|checkout|settle)/i.test(u.hostname) || /(^|[\/_.=&?-])(login|signin|order|pay|checkout|settle)/i.test(u.pathname + u.search.replace(/method=getCart\w*/i, ''))) throw new Error('이 화면에서는 실행할 수 없어요.'); }
    return w.webContents.executeJavaScript(String(a.js || ''), true);
  }
  if (cmd === 'url') return w.webContents.getURL();
  if (cmd === 'show') { w.show(); w.focus(); return true; }
  if (cmd === 'hide') { w.hide(); return true; }
  if (cmd === 'close') { w.destroy(); webWins.delete(key); return true; }
  if (cmd === 'pdf') {
    if (a.wait) await new Promise(r => setTimeout(r, +a.wait));
    const buf = await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true });
    const dir = a.dir === 'desktop' ? app.getPath('desktop') : path.join(app.getPath('documents'), '싯다르타 견적서'); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, safe(a.name || '견적서') + '.pdf'); fs.writeFileSync(f, buf);
    return { path: f, b64: a.b64 ? buf.toString('base64') : undefined };
  }
  if (cmd === 'login') {
    const L = LOGIN[a.site], c = credAll()[a.site]; if (!L || !c || !c.pw) return { ok: false, err: 'no-cred' };
    let pw = ''; try { pw = safeStorage.decryptString(Buffer.from(c.pw, 'base64')); } catch (er) { return { ok: false, err: 'decrypt' }; }
    try { await w.loadURL(L.url); } catch (er) { if (!/ERR_ABORTED/.test(String(er))) throw er; }
    if (!L.host.test(new URL(w.webContents.getURL()).hostname)) return { ok: false, err: 'host' };
    const js = `(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));for(let t=0;t<30&&!document.querySelector(${JSON.stringify(L.id)});t++)await S(300);
      const set=(sel,v)=>{const i=document.querySelector(sel);if(!i)return false;i.focus();i.click();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,v);for(const k of ['keydown','keypress','input','keyup','change'])i.dispatchEvent(k==='input'||k==='change'?new Event(k,{bubbles:true}):new KeyboardEvent(k,{bubbles:true,key:'a'}));i.blur();return true;};
      if(!set(${JSON.stringify(L.id)},${JSON.stringify(c.id)})||!set(${JSON.stringify(L.pw)},${JSON.stringify(pw)}))return false;
      ${L.keep ? `{const k=document.querySelector(${JSON.stringify(L.keep)});if(k&&!k.checked){const l=document.querySelector('label[for="'+k.id+'"]');(l||k).click();}}` : ''}
      await S(300);const b=document.querySelector(${JSON.stringify(L.btn)});if(!b)return false;b.click();return true;})()`;
    pw = '';
    const ok = await w.webContents.executeJavaScript(js, true).catch(() => false);
    if (!ok) return { ok: false, err: 'form' };
    for (let t = 0; t < 30; t++) { await new Promise(r => setTimeout(r, 500)); const u = w.webContents.getURL(); if (!/login|signin/i.test(u)) return { ok: true, url: u }; }
    const info = await w.webContents.executeJavaScript("({t:document.body?document.body.innerText.slice(0,400):'',a:window.__sdtAlerts||[]})", true).catch(() => ({}));
    return { ok: false, err: 'stay', url: w.webContents.getURL(), msg: info.t, alerts: info.a };
  }
  if (cmd === 'reveal') { if (a.path) shell.showItemInFolder(String(a.path)); return true; }
  return null;
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
  // 메인 창을 닫으면 숨은 쇼핑몰 창도 같이 닫고 프로그램 종료 (숨은 창 때문에 프로그램이 남아 있던 문제)
  win.on('closed', () => { for (const w of webWins.values()) { try { if (!w.isDestroyed()) w.destroy(); } catch (e) {} } webWins.clear(); app.quit(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank' || url.startsWith(SITE)) return { action: 'allow' };
    shell.openExternal(url); return { action: 'deny' };
  });
}
// 하나만 켜지게: 이미 켜져 있으면 그 창을 앞으로
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } else create(); });
app.whenReady().then(async () => {
  // 컴퓨터를 켜면 자동으로 실행 (끄려면 작업 관리자 → 시작 앱에서 '사용 안 함')
  try { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true }); } catch (e) {}
  await syncHelper(); create();
});
app.on('window-all-closed', () => { try { ps && ps.kill(); } catch (e) {} app.quit(); });
