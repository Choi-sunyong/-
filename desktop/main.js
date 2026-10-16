// 싯다르타 PC 프로그램: 웹(rosy-phi-35.vercel.app)을 그대로 띄우고, 한글(HWP) 조종 기능만 PC 쪽에서 더해 줌.
// 한글 조종은 윈도우 PowerShell이 한글의 자동화 기능(HWPFrame.HwpObject)을 불러서 함 → hwp.ps1
const { app, BrowserWindow, ipcMain, shell, dialog, screen } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');

const SITE = 'https://rosy-phi-35.vercel.app/';
let win = null, ps = null, seq = 0, buf = '';
const waits = new Map();

function psPath() {
  const p = path.join(process.resourcesPath || __dirname, 'hwp.ps1');
  return fs.existsSync(p) ? p : path.join(__dirname, 'hwp.ps1');
}
function startPs() {
  if (ps) return ps;
  ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-STA', '-File', psPath()], { windowsHide: true });
  ps.stdout.setEncoding('utf8');
  ps.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      try { const m = JSON.parse(line), w = waits.get(m.id); if (w) { waits.delete(m.id); m.ok ? w.res(m.result) : w.rej(new Error(m.error || '한글 오류')); } } catch (e) {}
    }
  });
  ps.on('exit', () => { ps = null; waits.forEach(w => w.rej(new Error('한글 연결이 끊겼어요. 다시 시도해 주세요.'))); waits.clear(); });
  return ps;
}
function hwp(cmd, args = {}, timeout = 60000) {
  return new Promise((res, rej) => {
    const id = ++seq; waits.set(id, { res, rej });
    // 한글 쪽으로는 ASCII만 보내서 인코딩 문제를 피함 (한글 글자는 \uXXXX로)
    const json = JSON.stringify({ id, cmd, ...args }).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
    startPs().stdin.write(json + '\n');
    setTimeout(() => { if (waits.has(id)) { waits.delete(id); rej(new Error('한글이 응답하지 않아요.')); } }, timeout);
  });
}
const tmpDir = () => { const d = path.join(os.tmpdir(), 'siddhartha'); fs.mkdirSync(d, { recursive: true }); return d; };
const safe = n => String(n || '문서').replace(/[\\/:*?"<>|]/g, ' ').trim() || '문서';

// 나란히 보기: 싯다르타는 화면 왼쪽(left 비율), 한글은 오른쪽
async function tile(left = 0.4) {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  if (win.isFullScreen()) win.setFullScreen(false);
  const d = screen.getDisplayMatching(win.getBounds()), A = d.workArea, sf = d.scaleFactor || 1;
  const lw = Math.round(A.width * left);
  win.setBounds({ x: A.x, y: A.y, width: lw, height: A.height });
  // 한글 쪽은 실제 화면 픽셀로 (배율 반영)
  await hwp('place', { x: Math.round((A.x + lw) * sf), y: Math.round(A.y * sf), w: Math.round((A.width - lw) * sf), h: Math.round(A.height * sf) }, 15000);
}
ipcMain.handle('hwp', async (e, cmd, a = {}) => {
  if (cmd === 'tile') return tile(a.left);
  if (cmd === 'open' || cmd === 'reload') {
    const file = path.join(tmpDir(), safe(a.name).replace(/\.hwpx$/i, '') + '.hwpx');
    fs.writeFileSync(file, Buffer.from(a.bytes));
    return hwp(cmd, { path: file });
  }
  if (cmd === 'pick') {
    const r = await dialog.showOpenDialog(win, { title: '한글 문서 열기', properties: ['openFile'], filters: [{ name: '한글 문서', extensions: ['hwp', 'hwpx'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    await hwp('openPath', { path: r.filePaths[0] });
    try { await tile(); } catch (e) {}
    return { path: r.filePaths[0], name: path.basename(r.filePaths[0]) };
  }
  return hwp(cmd, a);
});

function create() {
  win = new BrowserWindow({
    width: 1500, height: 950, minWidth: 1000, minHeight: 640, title: '싯다르타', icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false }
  });
  win.loadURL(SITE);
  // 싯다르타 안에서 여는 새 창(인쇄 등)은 앱 안에서, 다른 사이트 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank' || url.startsWith(SITE)) return { action: 'allow' };
    shell.openExternal(url); return { action: 'deny' };
  });
}
app.whenReady().then(create);
app.on('window-all-closed', () => { try { ps && ps.kill(); } catch (e) {} app.quit(); });
