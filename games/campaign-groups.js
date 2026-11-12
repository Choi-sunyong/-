/* 3차 수행평가(윤리문제 알림 캠페인) 조 폴더 — 2026-11-12
   학습지(worksheets id 32, data-ws-grade="campaign3") 맨 끝에서 <script src="/games/campaign-groups.js"> 로 불러옴.
   - 학생: 반별 1~8조 폴더 중 하나를 골라 들어감(조 옮기기 가능, 한 조 최대 5명). 들어가기 전엔 학습지 본문을 가림
   - 역할은 학습지 STEP 1 역할 카드를 눌러 고름(window.cgSetRole) — 조 안에서 중복 불가(DB 고유 인덱스), 남이 맡은 카드는 흐리게+이름
   - 모둠 이름은 학생 정보 칸의 '모둠 이름'에서 조장만 바꿈(campaign_groups). 학습지의 team 칸엔 'N조 · 이름'으로 저장(채점 도구가 앞 숫자로 모둠을 묶음)
   - 조 정보는 모둠원 표(학번·이름·역할)와 나의 역할에 자동으로 채워짐(직접 수정 불가) → 학습지 임시 저장에 같이 남음
   - 선생님 미리보기에서 학생을 고르면: 실제 조 정보를 읽어서 보여 주되, 조 들어가기·역할·이름 바꾸기는 DB에 쓰지 않음
   - 선생님 화면(teacherView)·'선생님으로 들어가기'·제출 완료 후에는 학습지 칸을 바꾸지 않음
   - 조 정보는 15~18초마다 다시 읽음(제출 뒤·화면 숨김 때는 안 읽음)
   - 서기 공유 칸(scope·place·issue·situation): 서기만 쓰고(campaign_groups.shared), 같은 조 친구들 칸엔 자동으로 채워짐(읽기 전용)
   - 선생님용 조 현황·조정: /campaign-groups.html (제출 현황의 [조 분류]) */
(function () {
  if (window.__cgOn) return; window.__cgOn = 1;
  var SB_URL = 'https://uxycuvpzsyfvsbwnrexv.supabase.co', SB_KEY = 'sb_publishable_1aMfdIKdr6sUwI0vshYKXw_e9qVrPJj';
  var ROLES = ['조장', '서기', '자료조사', '제작', '발표'], NG = 8, MAX = 5;
  var sbc = null, ID = null, ME = null, ROWS = [], GN = {}, MODE = 'off', BUSY = false, LASTSIG = '', LEAVE = false, TIMER = null, NAMET = null;
  var PV = { g: null, role: null, name: null }, GS = {}, SHT = null, SH_FIELDS = ['scope', 'place', 'issue', 'situation'], SH_INIT = false;   // 미리보기 전용(저장 안 함)
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var css = document.createElement('style');
  css.textContent = [
    '.cg-out .ws>:not(.hero):not(#cgBox){display:none!important}.cg-out .ws-bar{display:none!important}',
    '#cgBox{margin:0 0 20px}',
    '.cg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 12px;padding-top:12px}',
    '.cg-f{position:relative;background:var(--card);border:2px solid transparent;border-radius:6px 18px 18px 18px;padding:16px 16px 14px;text-align:left;font:inherit;color:var(--ink);cursor:pointer;min-height:132px;transition:border-color .15s,transform .15s}',
    '.cg-f:before{content:"";position:absolute;left:-2px;top:-12px;width:44%;height:14px;background:var(--card);border-radius:8px 12px 0 0}',
    '.cg-f:hover{border-color:var(--blue);transform:translateY(-2px)}',
    '.cg-f:disabled{cursor:default;opacity:.5;transform:none;border-color:transparent}',
    '.cg-f .no{display:block;font-size:17px;font-weight:800;color:var(--blue)}',
    '.cg-f .nm{display:block;font-size:13px;font-weight:700;margin:2px 0 8px;min-height:18px}',
    '.cg-f .mb{display:block;font-size:12.5px;color:var(--sub);line-height:1.6}',
    '.cg-f .ct{position:absolute;right:14px;top:16px;font-size:12px;font-weight:700;color:var(--faint)}',
    '.cg-in{background:var(--card);border-radius:20px;padding:16px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
    '.cg-in .no{font-size:13px;font-weight:700;color:#fff;background:var(--blue);border-radius:999px;padding:5px 12px}',
    '.cg-in .gn{font-size:18px;font-weight:700;letter-spacing:-.02em}',
    '.cg-mem{display:flex;gap:6px;flex-wrap:wrap;flex:1;min-width:0}',
    '.cg-mem span{background:var(--field);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600}',
    '.cg-mem span.me{background:var(--blueSoft)}',
    '.cg-mem small{font-size:11.5px;font-weight:700;color:var(--blue);margin-left:4px}',
    '.cg-b{font:inherit;font-size:13.5px;font-weight:600;border:0;border-radius:999px;padding:8px 14px;background:var(--field);color:var(--ink);cursor:pointer;white-space:nowrap}',
    '.cg-b.warn{background:#fff0f0;color:var(--red)}',
    '.cg-by{display:inline-block;font-size:11px;font-weight:700;color:#fff;background:var(--blue);border-radius:999px;padding:2px 8px;margin-left:6px;vertical-align:1px}',
    '.cg-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 18px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999}',
    '@media (max-width:640px){.cg-grid{grid-template-columns:1fr 1fr}}'
  ].join('\n');
  document.head.appendChild(css);

  var box = document.createElement('section'); box.id = 'cgBox'; box.hidden = true;
  var hero = document.querySelector('.ws .hero');
  if (hero) hero.parentNode.insertBefore(box, hero.nextSibling); else document.body.insertBefore(box, document.body.firstChild);

  function toast(t) { var d = document.createElement('div'); d.className = 'cg-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }
  function height() { try { if (window.parent !== window) window.parent.postMessage({ type: 'sittdartha_ws_height', height: Math.ceil(document.body.getBoundingClientRect().height) }, '*'); } catch (e) {} }
  function sb() { if (!sbc && window.supabase) sbc = window.supabase.createClient(SB_URL, SB_KEY); return sbc; }
  function loadLib(cb) { if (window.supabase) return cb(); var s = document.createElement('script'); s.src = 'https://unpkg.com/@supabase/supabase-js@2'; s.onload = cb; s.onerror = function () { box.hidden = false; box.innerHTML = '<div class="cg-in"><span class="gn">조 정보를 불러오지 못했어요</span></div>'; document.body.classList.remove('cg-out'); height(); }; document.head.appendChild(s); }
  function cls() { return String((ID.student && ID.student.class) || '').trim(); }
  function sid() { return ID.student && ID.student.id; }
  function isMe(m) { return !!m && String(m.student_id) === String(sid()); }
  function canAct() { return MODE === 'live' || MODE === 'preview'; }
  function members(g) { return ROWS.filter(function (r) { return r.group_no === g; }).sort(function (a, b) { var x = a.role ? ROLES.indexOf(a.role) : 9, y = b.role ? ROLES.indexOf(b.role) : 9; return x - y || (+a.number || 0) - (+b.number || 0); }); }
  function gname(g) { return GN[g] || ''; }

  window.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (d.type !== 'sittdartha_identity') return;
    if (d.teacherView || d.staff || !d.worksheetId || !d.student || d.student.id == null) return;
    var next = d.preview ? 'preview' : (d.readonly ? 'done' : 'live');
    if (ID && String(ID.student.id) === String(d.student.id) && MODE === next) return;
    ID = d; MODE = next; ME = null; ROWS = []; GN = {}; GS = {}; SH_INIT = false; LASTSIG = ''; PV = { g: null, role: null, name: null };
    box.hidden = false; box.innerHTML = '<div class="cg-in"><span class="gn">불러오는 중…</span></div>'; height();
    loadLib(function () {
      refresh();
      if (!TIMER) TIMER = setInterval(function () { if (document.hidden || BUSY) return; if ($('wsSend') && $('wsSend').hidden) { clearInterval(TIMER); TIMER = null; return; } refresh(); }, 15000 + Math.random() * 3000);   // 15~18초마다(무료 요금제 전송량 아끼기), 제출하면 멈춤
    });
  });

  function refresh() { return load().then(render); }
  function load() {
    var c = cls(), w = ID.worksheetId;
    return Promise.all([
      sb().from('campaign_members').select('student_id,group_no,name,role,number').eq('worksheet_id', w).eq('class_name', c),
      sb().from('campaign_groups').select('group_no,name,shared').eq('worksheet_id', w).eq('class_name', c)
    ]).then(function (res) {
      if (!res[0].error) ROWS = res[0].data || [];
      if (!res[1].error) { GN = {}; GS = {}; (res[1].data || []).forEach(function (g) { GN[g.group_no] = g.name || ''; GS[g.group_no] = g.shared || {}; }); }
      if (MODE === 'preview') {   // 미리보기에서 바꾼 것은 화면에서만 덮어씀
        var real = ROWS.filter(isMe)[0];
        if (PV.g == null && real && !PV.left) { PV.g = real.group_no; PV.role = real.role; }
        ROWS = ROWS.filter(function (r) { return !isMe(r); });
        if (PV.g != null) ROWS.push({ student_id: sid(), group_no: PV.g, name: ID.student.name || '', role: PV.role, number: ID.student.number });
        if (PV.name != null && PV.g != null) GN[PV.g] = PV.name;
        if (PV.shared && PV.g != null) GS[PV.g] = PV.shared;
      }
      ME = ROWS.filter(isMe)[0] || null;
    }).catch(function () {});
  }

  function render() {
    if (MODE === 'off') return;
    if (!ME) {
      if (MODE === 'done') { box.hidden = true; document.body.classList.remove('cg-out'); height(); return; }
      document.body.classList.add('cg-out');
      var h = '<div class="cg-grid">';
      for (var g = 1; g <= NG; g++) {
        var ms = members(g);
        h += '<button type="button" class="cg-f" data-g="' + g + '"' + (ms.length >= MAX ? ' disabled' : '') + '><span class="no">' + g + '조</span><span class="ct">' + ms.length + '/' + MAX + '</span>'
          + '<span class="nm">' + esc(gname(g)) + '</span>'
          + ms.map(function (m) { return '<span class="mb">' + esc(m.name) + (m.role ? ' · ' + esc(m.role) : '') + '</span>'; }).join('') + '</button>';
      }
      box.innerHTML = h + '</div>';
      box.querySelectorAll('.cg-f').forEach(function (b) { b.onclick = function () { join(+b.dataset.g); }; });
      height(); return;
    }
    document.body.classList.remove('cg-out');
    var g0 = ME.group_no, ms0 = members(g0);
    var t = '<div class="cg-in"><span class="no">' + g0 + '조</span><span class="gn">' + esc(gname(g0)) + '</span><div class="cg-mem">'
      + ms0.map(function (m) { return '<span class="' + (isMe(m) ? 'me' : '') + '">' + esc(m.name) + (m.role ? '<small>' + esc(m.role) + '</small>' : '') + '</span>'; }).join('') + '</div>';
    if (canAct()) t += '<button type="button" class="cg-b' + (LEAVE ? ' warn' : '') + '" id="cgOut">' + (LEAVE ? '한 번 더 누르면 조 옮기기' : '조 옮기기') + '</button>';
    box.innerHTML = t + '</div>';
    if ($('cgOut')) $('cgOut').onclick = function () { if (!LEAVE) { LEAVE = true; render(); setTimeout(function () { if (LEAVE) { LEAVE = false; render(); } }, 4000); return; } LEAVE = false; leave(); };
    apply(); height();
  }

  // 학습지 칸 채우기 — 바뀌었을 때만 입력 이벤트를 보내 학습지가 다시 계산·임시 저장하게 함
  function apply() {
    if (!canAct() || !ME) return;
    var sendBtn = $('wsSend'); if (sendBtn && sendBtn.hidden) return;   // 제출 뒤엔 학습지 칸을 건드리지 않음
    var g0 = ME.group_no, ms = members(g0).slice(0, MAX), lead = ME.role === '조장';
    nameField(g0, lead); sharedFields(g0, ME.role === '서기');
    paintCards(ms); lockSheet();
    document.querySelectorAll('.team .row:not(.head) .i').forEach(function (el, k) { var m = ms[k]; el.textContent = m && m.number != null && m.number !== '' ? m.number : ''; });
    var team = g0 + '조' + (gname(g0) ? ' · ' + gname(g0) : '');
    var sig = JSON.stringify([team, ms.map(function (m) { return [m.name, m.role, m.number]; }), ME.role]);
    if (sig === LASTSIG) return; LASTSIG = sig;
    var set = function (id, v) { var e = $(id); if (e) e.value = v == null ? '' : v; };
    set('team', team);
    for (var i = 1; i <= MAX; i++) { var m = ms[i - 1]; set('m' + i + 'n', m ? m.name : ''); set('m' + i + 'r', m ? (m.role || '') : ''); }
    set('myRole', ME.role || '');
    var trig = $('m1n'); if (trig) trig.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // 학생 정보의 '모둠 이름' 칸: 원래 team 칸은 숨기고(저장용), 조장만 고칠 수 있는 이름 칸을 그 자리에 둠
  function nameField(g0, lead) {
    var team = $('team'); if (!team) return;
    var cell = team.parentNode, inp = $('cgName');
    if (!inp) {
      team.style.display = 'none';
      inp = document.createElement('input'); inp.id = 'cgName'; inp.maxLength = 20; inp.setAttribute('aria-label', '모둠 이름');
      cell.appendChild(inp);
      inp.addEventListener('input', function () { if (inp.readOnly) return; clearTimeout(NAMET); NAMET = setTimeout(function () { rename(inp.value); }, 900); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      inp.addEventListener('blur', function () { if (inp.readOnly || !NAMET) return; clearTimeout(NAMET); rename(inp.value); });
    }
    var k = cell.querySelector('.k'); if (k) k.textContent = '모둠 이름 · ' + g0 + '조';
    inp.readOnly = !lead; inp.placeholder = lead ? '모둠 이름' : '';
    if (document.activeElement !== inp) inp.value = gname(g0);
  }

  // 서기 공유 칸: 서기는 쓰면 1초 뒤 조 전체에 저장, 나머지는 읽기 전용으로 서기 내용을 받아 채움
  function sharedFields(g0, clerk) {
    var sh = GS[g0] || {};
    SH_FIELDS.forEach(function (id) {
      var e = $(id); if (!e) return;
      var lab = e.type === 'hidden' ? (document.querySelector('.chips[data-for="' + id + '"]') || {}).parentNode : e.closest('.f');
      var fl = lab && lab.querySelector('.fl');
      if (fl && !fl.querySelector('.cg-by')) { var t = document.createElement('span'); t.className = 'cg-by'; t.textContent = '서기'; fl.appendChild(t); }
      if (e.type === 'hidden') document.querySelectorAll('.chips[data-for="' + id + '"] .chip').forEach(function (c) { c.disabled = !clerk; });
      else e.readOnly = !clerk;
      if (!e.__cgSh) {
        e.__cgSh = 1;
        var fire = function () { if (!ME || ME.role !== '서기') return; clearTimeout(SHT); SHT = setTimeout(saveShared, 1000); };
        if (e.type === 'hidden') { var g = document.querySelector('.chips[data-for="' + id + '"]'); if (g) g.addEventListener('click', function () { setTimeout(fire, 0); }); }
        else e.addEventListener('input', fire);
      }
      var v = sh[id] == null ? '' : String(sh[id]);
      if (clerk) { if (!SHT && document.activeElement !== e && !e.value && v) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } return; }   // 서기는 자기가 쓰는 중인 내용을 덮어쓰지 않음
      if (e.value !== v) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); if (e.type === 'hidden') { var gg = document.querySelector('.chips[data-for="' + id + '"]'); if (gg) gg.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); }); } }
    });
    SH_INIT = true;
  }
  function saveShared() {
    SHT = null;
    if (!ME || ME.role !== '서기') return;
    var o = {}; SH_FIELDS.forEach(function (id) { var e = $(id); if (e) o[id] = e.value; });
    if (MODE === 'preview') { PV.shared = o; GS[ME.group_no] = o; return; }
    sb().from('campaign_groups').upsert({ worksheet_id: ID.worksheetId, class_name: cls(), group_no: ME.group_no, shared: o, updated_at: new Date().toISOString() }, { onConflict: 'worksheet_id,class_name,group_no' })
      .then(function (r) { if (r && r.error) toast('저장하지 못했어요. 다시 써 보세요'); else GS[ME.group_no] = o; });
  }
  function paintCards(ms) {
    document.querySelectorAll('.roles [data-role]').forEach(function (c) {
      var r = c.dataset.role, o = ms.filter(function (m) { return m.role === r; })[0], mine = isMe(o);
      c.classList.toggle('on', mine); c.classList.toggle('taken', !!o && !mine);
      var tk = c.querySelector('.tk'); if (!tk) { tk = document.createElement('em'); tk.className = 'tk'; c.appendChild(tk); }
      tk.textContent = o && !mine ? o.name : '';
    });
  }
  function lockSheet() {
    ['m1n', 'm2n', 'm3n', 'm4n', 'm5n'].forEach(function (id) { var e = $(id); if (e) { e.readOnly = true; e.tabIndex = -1; } });
    document.querySelectorAll('.team .chips .chip, .chips[data-for="myRole"] .chip').forEach(function (c) { c.disabled = true; });
  }

  window.cgSetRole = function (r) {
    if (!canAct() || !ME || BUSY) return;
    if ($('wsSend') && $('wsSend').hidden) return;
    var o = members(ME.group_no).filter(function (m) { return m.role === r && !isMe(m); })[0];
    if (o) { toast(o.name + ' 학생이 맡은 역할이에요'); return; }
    var next = ME.role === r ? null : r;
    if (MODE === 'preview') { PV.role = next; refresh(); return; }
    act(sb().from('campaign_members').update({ role: next, updated_at: new Date().toISOString() }).eq('worksheet_id', ID.worksheetId).eq('student_id', sid()));
  };
  function act(p, okMsg) {
    BUSY = true;
    return p.then(function (r) {
      if (r && r.error) toast(r.error.code === '23505' ? '이미 다른 친구가 고른 역할이에요' : '저장하지 못했어요. 다시 해 보세요');
      else if (okMsg) toast(okMsg);
      return load();
    }).catch(function () { toast('저장하지 못했어요. 다시 해 보세요'); }).then(function () { BUSY = false; render(); });
  }
  function join(g) {
    if (members(g).length >= MAX) { toast('자리가 다 찼어요'); return; }
    LASTSIG = '';
    if (MODE === 'preview') { PV.g = g; PV.role = null; PV.name = null; refresh(); return; }
    act(sb().from('campaign_members').upsert({ worksheet_id: ID.worksheetId, student_id: sid(), class_name: cls(), group_no: g, name: ID.student.name || '', number: +ID.student.number || null, role: null, updated_at: new Date().toISOString() }, { onConflict: 'worksheet_id,student_id' }));
  }
  function leave() {
    LASTSIG = '';
    if (MODE === 'preview') { PV.g = null; PV.role = null; PV.name = null; PV.left = true; refresh(); return; }
    act(sb().from('campaign_members').delete().eq('worksheet_id', ID.worksheetId).eq('student_id', sid()));
  }
  function rename(v) {
    NAMET = null;
    if (!ME || ME.role !== '조장') return;
    v = String(v || '').trim().slice(0, 20);
    if (v === gname(ME.group_no)) return;
    if (MODE === 'preview') { PV.name = v; refresh(); return; }
    act(sb().from('campaign_groups').upsert({ worksheet_id: ID.worksheetId, class_name: cls(), group_no: ME.group_no, name: v, updated_at: new Date().toISOString() }, { onConflict: 'worksheet_id,class_name,group_no' }));
  }
})();
