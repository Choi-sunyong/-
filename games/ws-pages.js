/* 긴 입력칸 학습지를 네이버 폼처럼 쪽으로 나눠 보여 줌 (2026-11-21, 3차 수행평가에서 씀)
   - 학습지 HTML 맨 끝에 <script src="/games/ws-pages.js"></script> 만 넣으면 됨
   - .ws 안에서 STEP 카드(section.card + .sec-k)마다 한 쪽. 차시 머리(.lesson)는 다음 카드와 같은 쪽,
     첫 카드 앞(제목·학생 정보)은 첫 쪽, #roleCard·카드 아닌 끝부분은 앞 쪽에 붙음
   - 숨긴 쪽은 display:none(속성 hidden 아님) → 학습지의 빈칸 검사는 모든 쪽을 그대로 셈.
     빈칸으로 스크롤할 때(scrollIntoView) 그 칸이 있는 쪽으로 먼저 넘어감
   - 선생님 화면·읽기 전용(제출 뒤)은 쪽을 나누지 않고 전부 보여 줌 */
(function () {
  var ws = document.querySelector('.ws'); if (!ws) return;
  var KEY = 'wsp_' + (document.title || '') + '_' + location.pathname;
  var pages = [], cur = [], hasStep = false;
  Array.prototype.slice.call(ws.children).forEach(function (el) {
    var isStep = el.matches('section.card') && el.querySelector('.sec-k') && el.id !== 'roleCard';
    var isLesson = el.classList.contains('lesson');
    if ((isLesson && hasStep) || (isStep && hasStep && !(cur.length && cur[cur.length - 1].classList.contains('lesson')))) {
      pages.push(cur); cur = []; hasStep = false;
    }
    cur.push(el); if (isStep) hasStep = true;
  });
  if (cur.length) pages.push(cur);
  if (pages.length < 2) return;
  var labelOf = function (pg) { for (var i = 0; i < pg.length; i++) { var n = pg[i].querySelector && pg[i].querySelector('.sec-k .num'); if (n) return n.textContent.trim(); } return ''; };
  var LB = pages.map(labelOf);
  // 차시 묶음: .lesson(차시 머리)이 있는 쪽부터 새 차시 — 진행 표시는 그 차시 안에서만 셈 (하루에 다 해야 하는 것처럼 보이지 않게)
  var LS = [], cur2 = -1;
  pages.forEach(function (pg, k) { var ls = null; pg.forEach(function (el) { if (!ls && el.classList && el.classList.contains('lesson')) ls = el; });
    if (ls || cur2 < 0) { var t = ls && ls.querySelector('.tag'); LS.push({ name: t ? t.textContent.trim() : '', start: k, end: k }); cur2 = LS.length - 1; } else LS[cur2].end = k; });
  var lsOf = function (k) { for (var i = 0; i < LS.length; i++) if (k >= LS[i].start && k <= LS[i].end) return i; return 0; };

  var st = document.createElement('style');
  st.textContent = '.pg-off{display:none!important}'
    + '.pg-top{position:sticky;top:0;z-index:30;background:rgba(245,245,247,.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);margin:0 -4px 14px;padding:10px 4px 10px}'
    + '.pg-top .pg-row{display:flex;align-items:center;justify-content:center;gap:10px;font-size:13.5px;font-weight:700;color:#6E6E73}'
    + '.pg-top .pg-ls{display:flex;justify-content:center;gap:6px;margin-bottom:8px}'
    + '.pg-top .pg-ls button{height:30px;padding:0 14px;border-radius:999px;border:0;background:#E3E3E8;color:#6E6E73;font:inherit;font-size:13px;font-weight:700;cursor:pointer}'
    + '.pg-top .pg-ls button.on{background:#0071E3;color:#fff}'
    + '.pg-top .pg-row b{color:#1D1D1F}'
    + '.pg-top .pg-bar{height:4px;background:#E3E3E8;border-radius:999px;overflow:hidden;margin-top:8px}'
    + '.pg-top .pg-bar i{display:block;height:100%;background:#0071E3;border-radius:999px;transition:width .2s}'
    + '.pg-nav{display:flex;justify-content:center;gap:10px;margin:22px 0 8px}'
    + '.pg-nav button{min-width:120px;height:46px;border-radius:12px;font:inherit;font-size:15.5px;font-weight:700;cursor:pointer;border:1px solid #D2D2D7;background:#fff;color:#1D1D1F}'
    + '.pg-nav button.nx{background:#0071E3;border-color:#0071E3;color:#fff}'
    + '.pg-nav button[hidden]{display:none}';
  document.head.appendChild(st);
  var top = document.createElement('div'); top.className = 'pg-top';
  top.innerHTML = (LS.length > 1 ? '<div class="pg-ls">' + LS.map(function (l, i) { return '<button type="button" data-ls="' + i + '">' + (l.name || (i + 1) + '차시') + '</button>'; }).join('') + '</div>' : '') + '<div class="pg-row"><span class="pg-lb"></span><b class="pg-n"></b></div><div class="pg-bar"><i></i></div>';
  var nav = document.createElement('div'); nav.className = 'pg-nav';
  nav.innerHTML = '<button type="button" class="pv">이전</button><button type="button" class="nx">다음</button>';
  ws.insertBefore(top, ws.firstChild); ws.appendChild(nav);

  var I = 0, ALL = false;
  try { I = Math.min(pages.length - 1, Math.max(0, +sessionStorage.getItem(KEY) || 0)); } catch (e) {}
  function paint(scroll) {
    pages.forEach(function (pg, k) { pg.forEach(function (el) { el.classList.toggle('pg-off', !ALL && k !== I); }); });
    top.hidden = ALL; nav.hidden = ALL;
    top.querySelector('.pg-lb').textContent = LB[I] || '';
    var L = LS[lsOf(I)], n = L.end - L.start + 1, at = I - L.start + 1;
    top.querySelector('.pg-n').textContent = at + ' / ' + n;
    top.querySelector('.pg-bar i').style.width = (at * 100 / n) + '%';
    top.querySelectorAll('[data-ls]').forEach(function (b) { b.classList.toggle('on', +b.dataset.ls === lsOf(I)); });
    nav.querySelector('.pv').hidden = I === 0; nav.querySelector('.nx').hidden = I === pages.length - 1;
    try { sessionStorage.setItem(KEY, I); } catch (e) {}
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}   // 학습지가 칸 높이를 다시 맞추고 높이를 부모에게 알림
    if (scroll) { try { window.scrollTo(0, 0); } catch (e) {} try { if (window.frameElement) window.frameElement.scrollIntoView({ block: 'start' }); } catch (e) {} }
  }
  function go(k, scroll) { k = Math.max(0, Math.min(pages.length - 1, k)); if (k === I && !ALL) return; I = k; paint(scroll !== false); }
  nav.querySelector('.pv').onclick = function () { go(I - 1); };
  nav.querySelector('.nx').onclick = function () { go(I + 1); };
  top.addEventListener('click', function (e) { var b = e.target.closest('[data-ls]'); if (b) go(LS[+b.dataset.ls].start); });
  // 빈칸 검사 뒤 그 칸으로 스크롤할 때: 그 칸이 있는 쪽을 먼저 엶
  var orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function () {
    var el = this, args = arguments;
    if (!ALL && ws.contains(el)) for (var k = 0; k < pages.length; k++) if (pages[k].some(function (p) { return p === el || p.contains(el); })) { if (k !== I) { I = k; paint(false); } break; }
    return orig.apply(el, args);
  };
  // 선생님 화면·읽기 전용은 전부 보여 줌
  window.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (d.type === 'sittdartha_identity') { ALL = !!(d.readonly || d.teacherView || d.staff); paint(false); }
    if (d.type === 'sittdartha_ws_submit_result' && d.ok) { ALL = true; paint(false); }
  });
  paint(false);
})();
