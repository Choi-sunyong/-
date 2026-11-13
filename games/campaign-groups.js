/* 3차 수행평가(윤리문제 알림 캠페인) 조 폴더 — 2026-11-12
   학습지(worksheets id 32, data-ws-grade="campaign3") 맨 끝에서 <script src="/games/campaign-groups.js"> 로 불러옴.
   - 학생: 반별 1~8조 폴더 중 하나를 골라 들어감(조 옮기기 가능, 한 조 최대 5명). 들어가기 전엔 학습지 본문을 가림
   - 역할: 선착순이 아님. STEP 1 역할 카드를 눌러 '희망'만 고름(겹쳐도 됨) → 조원 모두 고르면 [역할 추첨]
     → DB 함수 campaign_assign_roles 가 희망 겹치는 사람끼리 추첨, 조장·서기는 반드시 채움, 한 번만 확정(campaign_groups.locked)
     → 다시 뽑기는 선생님 조 분류 화면(/campaign-groups.html)에서
   - 모둠 이름은 학생 정보 칸의 '모둠 이름'에서 조장만 바꿈. 학습지 team 칸엔 'N조 · 이름'(채점 도구가 앞 숫자로 모둠을 묶음)
   - 모둠 공통 칸(SH_FIELDS: 문제·자료·원인·해결방안·캠페인 기획)은 서기만 씀 → 같은 조 화면에 실시간(Supabase broadcast, 조별 채널)으로 채워짐,
     DB(campaign_groups.shared)엔 1.5초 모아서 저장. 나머지 학생 칸은 읽기 전용
   - 조 정보는 조에 들어간 뒤엔 실시간 알림 + 30초마다 확인, 들어가기 전(폴더 고르는 중)엔 15~18초마다 확인, 제출 뒤엔 멈춤
   - 선생님 미리보기에서 학생을 고르면 실제 조 정보를 보여 주되 아무것도 저장·전송하지 않음
   - 선생님 화면(teacherView)·'선생님으로 들어가기'·제출 완료 후에는 학습지 칸을 바꾸지 않음 */
(function () {
  if (window.__cgOn) return; window.__cgOn = 1;
  var SB_URL = 'https://uxycuvpzsyfvsbwnrexv.supabase.co', SB_KEY = 'sb_publishable_1aMfdIKdr6sUwI0vshYKXw_e9qVrPJj';
  var ROLES = ['조장', '서기', '자료조사', '제작', '발표'], NG = 8, MAX = 5;
  var SH_FIELDS = ['scope', 'place', 'issue', 'situation', 'valA', 'valB',
    's1type', 's1src', 's1sum', 's2type', 's2src', 's2sum', 's3type', 's3src', 's3sum', 'cause',
    'a1who', 'a1how', 'a1eff', 'a2who', 'a2how', 'a2eff',
    'format', 'formatEtc', 'slogan', 'audience', 'message', 'action', 'sb1', 'sb2', 'sb3', 'sb4'];
  var sbc = null, ID = null, ME = null, ROWS = [], GN = {}, GS = {}, GL = {}, MODE = 'off', BUSY = false, LASTSIG = '', LEAVE = false;
  var TIMER = null, NAMET = null, SHT = null, BCT = null, BCLAST = 0, CH = null, CHKEY = '';
  var PV = { g: null, pref: null, role: null, name: null, shared: null, lock: false, left: false };
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
    '.cg-mem small.pf{color:var(--faint)}',
    '.cg-b{font:inherit;font-size:13.5px;font-weight:600;border:0;border-radius:999px;padding:8px 14px;background:var(--field);color:var(--ink);cursor:pointer;white-space:nowrap}',
    '.cg-b.pri{background:var(--blue);color:#fff}.cg-b:disabled{opacity:.45;cursor:default}',
    '.cg-b.warn{background:#fff0f0;color:var(--red)}',
    '.cg-st{font-size:13px;font-weight:700;color:var(--sub)}',
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
  function submitted() { var b = $('wsSend'); return !!(b && b.hidden); }
  function members(g) { return ROWS.filter(function (r) { return r.group_no === g; }).sort(function (a, b) { var x = a.role ? ROLES.indexOf(a.role) : 9, y = b.role ? ROLES.indexOf(b.role) : 9; return x - y || (+a.number || 0) - (+b.number || 0); }); }
  function gname(g) { return GN[g] || ''; }
  function locked() { return !!(ME && GL[ME.group_no]); }
  // 실제로 쓸 수 있는 역할: 확정 뒤엔 뽑힌 역할, 확정 전엔 그 역할을 혼자 희망하고 있으면 그 역할(서기 칸 쓰기·조장 이름 바꾸기를 추첨 전에도 시작할 수 있게)
  function effRole() {
    if (!ME) return '';
    if (locked()) return ME.role || '';
    if (ME.pref && members(ME.group_no).filter(function (m) { return m.pref === ME.pref; }).length === 1) return ME.pref;
    return '';
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (d.type !== 'sittdartha_identity') return;
    if (d.teacherView || d.staff || !d.worksheetId || !d.student || d.student.id == null) return;
    var next = d.preview ? 'preview' : (d.readonly ? 'done' : 'live');
    if (ID && String(ID.student.id) === String(d.student.id) && MODE === next) return;
    ID = d; MODE = next; ME = null; ROWS = []; GN = {}; GS = {}; GL = {}; LASTSIG = '';
    PV = { g: null, pref: null, role: null, name: null, shared: null, lock: false, left: false };
    box.hidden = false; box.innerHTML = '<div class="cg-in"><span class="gn">불러오는 중…</span></div>'; height();
    loadLib(function () { refresh(); tick(); });
  });
  function tick() {
    clearTimeout(TIMER);
    if (MODE === 'off' || MODE === 'done' || submitted()) { unsub(); return; }
    TIMER = setTimeout(function () { if (!document.hidden && !BUSY) refresh().then(tick); else tick(); }, ME ? 30000 : 15000 + Math.random() * 3000);
  }

  function refresh() { return load().then(render); }
  function load() {
    var c = cls(), w = ID.worksheetId;
    return Promise.all([
      sb().from('campaign_members').select('student_id,group_no,name,role,pref,number').eq('worksheet_id', w).eq('class_name', c),
      sb().from('campaign_groups').select('group_no,name,shared,locked').eq('worksheet_id', w).eq('class_name', c)
    ]).then(function (res) {
      if (!res[0].error) ROWS = res[0].data || [];
      if (!res[1].error) { GN = {}; GS = {}; GL = {}; (res[1].data || []).forEach(function (g) { GN[g.group_no] = g.name || ''; GS[g.group_no] = g.shared || {}; GL[g.group_no] = !!g.locked; }); }
      if (MODE === 'preview') {   // 미리보기에서 바꾼 것은 화면에서만 덮어씀
        var real = ROWS.filter(isMe)[0];
        if (PV.g == null && real && !PV.left) { PV.g = real.group_no; PV.pref = real.pref; PV.role = real.role; }
        ROWS = ROWS.filter(function (r) { return !isMe(r); });
        if (PV.g != null) {
          ROWS.push({ student_id: sid(), group_no: PV.g, name: ID.student.name || '', pref: PV.pref, role: PV.role, number: ID.student.number });
          if (PV.name != null) GN[PV.g] = PV.name;
          if (PV.shared) GS[PV.g] = PV.shared;
          if (PV.lock) GL[PV.g] = true;
        }
      }
      ME = ROWS.filter(isMe)[0] || null;
    }).catch(function () {});
  }

  // ---------- 실시간: 조별 broadcast 채널 ----------
  function chanKey() { if (!ME || MODE !== 'live') return ''; var h = ''; var c = cls(); for (var i = 0; i < c.length; i++) h += c.charCodeAt(i).toString(16); return 'cg' + ID.worksheetId + '_' + h + '_' + ME.group_no; }
  function unsub() { if (CH) { try { sb().removeChannel(CH); } catch (e) {} } CH = null; CHKEY = ''; }
  function ensureChan() {
    var k = chanKey(); if (k === CHKEY) return;
    unsub(); if (!k) return;
    CHKEY = k;
    CH = sb().channel(k, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'sh' }, function (m) { var o = m.payload && m.payload.o; if (!o || !ME) return; GS[ME.group_no] = o; if (effRole() !== '서기') sharedFields(ME.group_no, false); })
      .on('broadcast', { event: 'ref' }, function () { if (!BUSY) refresh(); })
      .subscribe(function (st) { if (st === 'SUBSCRIBED') ping(); });   // 새로 들어오면 조원 화면도 다시 읽게
  }
  function ping() { if (CH && MODE === 'live') try { CH.send({ type: 'broadcast', event: 'ref', payload: {} }); } catch (e) {} }

  function render() {
    if (MODE === 'off') return;
    if (!ME) {
      unsub();
      if (MODE === 'done') { box.hidden = true; document.body.classList.remove('cg-out'); height(); return; }
      document.body.classList.add('cg-out');
      var h = '<div class="cg-grid">';
      for (var g = 1; g <= NG; g++) {
        var ms = members(g);
        h += '<button type="button" class="cg-f" data-g="' + g + '"' + (ms.length >= MAX || GL[g] ? ' disabled' : '') + '><span class="no">' + g + '조</span><span class="ct">' + ms.length + '/' + MAX + '</span>'
          + '<span class="nm">' + esc(gname(g)) + '</span>'
          + ms.map(function (m) { return '<span class="mb">' + esc(m.name) + (m.role ? ' · ' + esc(m.role) : '') + '</span>'; }).join('') + '</button>';
      }
      box.innerHTML = h + '</div>';
      box.querySelectorAll('.cg-f').forEach(function (b) { b.onclick = function () { join(+b.dataset.g); }; });
      height(); return;
    }
    document.body.classList.remove('cg-out');
    if (MODE === 'live' && !submitted()) ensureChan();
    var g0 = ME.group_no, ms0 = members(g0), lk = !!GL[g0], act = canAct() && !submitted();
    var chosen = ms0.filter(function (m) { return m.pref; }).length;
    var t = '<div class="cg-in"><span class="no">' + g0 + '조</span><span class="gn">' + esc(gname(g0)) + '</span><div class="cg-mem">'
      + ms0.map(function (m) { return '<span class="' + (isMe(m) ? 'me' : '') + '">' + esc(m.name) + (lk ? (m.role ? '<small>' + esc(m.role) + '</small>' : '') : (m.pref ? '<small class="pf">' + esc(m.pref) + '</small>' : '')) + '</span>'; }).join('') + '</div>';
    if (act && !lk) t += '<span class="cg-st">희망 ' + chosen + '/' + ms0.length + '</span><button type="button" class="cg-b pri" id="cgDraw"' + (chosen === ms0.length && (ms0.length >= 2 || MODE === 'preview') ? '' : ' disabled') + '>역할 추첨</button>';
    if (lk) t += '<span class="cg-st">역할 확정</span>';
    if (act && !lk) t += '<button type="button" class="cg-b' + (LEAVE ? ' warn' : '') + '" id="cgOut">' + (LEAVE ? '한 번 더 누르면 조 옮기기' : '조 옮기기') + '</button>';
    box.innerHTML = t + '</div>';
    if ($('cgOut')) $('cgOut').onclick = function () { if (!LEAVE) { LEAVE = true; render(); setTimeout(function () { if (LEAVE) { LEAVE = false; render(); } }, 4000); return; } LEAVE = false; leave(); };
    if ($('cgDraw')) $('cgDraw').onclick = draw;
    apply(); height();
  }

  // 학습지 칸 채우기 — 바뀌었을 때만 입력 이벤트를 보내 학습지가 다시 계산·임시 저장하게 함
  function apply() {
    if (!canAct() || !ME || submitted()) return;
    var g0 = ME.group_no, ms = members(g0).slice(0, MAX), lk = !!GL[g0], myRole = lk ? (ME.role || '') : '';
    var er = effRole();
    nameField(g0, er === '조장');
    sharedFields(g0, er === '서기');
    paintCards(ms, lk); lockSheet();
    document.querySelectorAll('.team .row:not(.head) .i').forEach(function (el, k) { var m = ms[k]; el.textContent = m && m.number != null && m.number !== '' ? m.number : ''; });
    var team = g0 + '조' + (gname(g0) ? ' · ' + gname(g0) : '');
    var sig = JSON.stringify([team, ms.map(function (m) { return [m.name, lk ? m.role : m.pref, m.number]; }), myRole, lk]);
    if (sig === LASTSIG) return; LASTSIG = sig;
    var set = function (id, v) { var e = $(id); if (e) e.value = v == null ? '' : v; };
    set('team', team);   // 모둠원 표 역할 칸: 확정 전엔 희망을 보여 줌(겹치면 빨간 테두리)
    for (var i = 1; i <= MAX; i++) { var m = ms[i - 1]; set('m' + i + 'n', m ? m.name : ''); set('m' + i + 'r', m ? ((lk ? m.role : m.pref) || '') : ''); }
    set('myRole', myRole);
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
    inp.readOnly = !lead;
    if (document.activeElement !== inp) inp.value = gname(g0);
  }

  // 모둠 공통 칸: 서기는 쓰면 실시간 전송 + 1.5초 뒤 DB 저장, 나머지는 읽기 전용으로 받아 채움
  function shGroup(id) { return document.querySelector('.chips[data-for="' + id + '"]'); }
  function sharedFields(g0, clerk) {
    var sh = GS[g0] || {};
    SH_FIELDS.forEach(function (id) {
      var e = $(id); if (!e) return;
      var hid = e.type === 'hidden';
      if (!e.__cgSh) {
        e.__cgSh = 1;
        var bx = e.closest('.box'), host = bx ? bx.querySelector('.box-h') : (hid ? (shGroup(id) || {}).parentNode : e.closest('.f'));
        var fl = host && (bx ? host : host.querySelector('.fl'));
        if (fl && !fl.querySelector('.cg-by')) { var t = document.createElement('span'); t.className = 'cg-by'; t.textContent = '서기'; fl.appendChild(t); }
        if (hid) { var g = shGroup(id); if (g) g.addEventListener('click', function () { setTimeout(clerkTyped, 0); }); }
        else e.addEventListener('input', function (ev) { if (ev.isTrusted) clerkTyped(); });
      }
      if (hid) { var gg = shGroup(id); if (gg) gg.querySelectorAll('.chip').forEach(function (c) { c.disabled = !clerk; }); }
      else e.readOnly = !clerk;
      var v = sh[id] == null ? '' : String(sh[id]);
      if (clerk) { if (!SHT && document.activeElement !== e && !e.value && v) setVal(e, v); return; }   // 서기는 쓰는 중인 내용을 덮어쓰지 않음
      if (e.value !== v) setVal(e, v);
    });
    var fw = $('formatEtcWrap'); if (fw && $('format')) fw.hidden = $('format').value !== '기타';
  }
  function setVal(e, v) {
    e.value = v; e.dispatchEvent(new Event('input', { bubbles: true }));
    if (e.type === 'hidden') { var g = shGroup(e.id); if (g) { g.style.outline = ''; g.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); }); } }
  }
  function shObj() { var o = {}; SH_FIELDS.forEach(function (id) { var e = $(id); if (e) o[id] = e.value; }); return o; }
  function clerkTyped() {
    if (effRole() !== '서기' || submitted()) return;
    var o = shObj(); GS[ME.group_no] = o;
    if (MODE === 'preview') { PV.shared = o; return; }
    var now = Date.now(), gap = 400;   // 0.4초에 한 번씩 조원 화면으로 보냄
    clearTimeout(BCT);
    if (now - BCLAST >= gap) sendSh(); else BCT = setTimeout(sendSh, gap - (now - BCLAST));
    clearTimeout(SHT); SHT = setTimeout(saveShared, 1500);
  }
  function sendSh() { BCLAST = Date.now(); if (CH) try { CH.send({ type: 'broadcast', event: 'sh', payload: { o: shObj() } }); } catch (e) {} }
  function saveShared() {
    SHT = null;
    if (effRole() !== '서기' || MODE !== 'live') return;
    sb().from('campaign_groups').upsert({ worksheet_id: ID.worksheetId, class_name: cls(), group_no: ME.group_no, shared: shObj(), updated_at: new Date().toISOString() }, { onConflict: 'worksheet_id,class_name,group_no' })
      .then(function (r) { if (r && r.error) toast('저장하지 못했어요. 다시 써 보세요'); });
  }

  function paintCards(ms, lk) {
    document.querySelectorAll('.roles [data-role]').forEach(function (c) {
      var r = c.dataset.role, tk = c.querySelector('.tk');
      if (!tk) { tk = document.createElement('em'); tk.className = 'tk'; c.appendChild(tk); }
      if (lk) {
        var o = ms.filter(function (m) { return m.role === r; })[0], mine = isMe(o);
        c.classList.toggle('on', mine); c.classList.toggle('taken', !!o && !mine);
        tk.textContent = o && !mine ? o.name : '';
      } else {
        var who = ms.filter(function (m) { return m.pref === r; });
        c.classList.toggle('on', ME.pref === r); c.classList.remove('taken');
        tk.textContent = who.length ? '희망 ' + who.map(function (m) { return m.name; }).join('·') : '';
      }
    });
  }
  function lockSheet() {
    ['m1n', 'm2n', 'm3n', 'm4n', 'm5n', 'p1n', 'p2n', 'p3n', 'p4n'].forEach(function (id) { var e = $(id); if (e) { e.readOnly = true; e.tabIndex = -1; } });
    document.querySelectorAll('.team .chips .chip, .chips[data-for="myRole"] .chip').forEach(function (c) { c.disabled = true; });
  }

  // 역할 카드 클릭: 확정 전엔 희망 고르기(겹쳐도 됨), 확정 뒤엔 바꿀 수 없음
  window.cgSetRole = function (r) {
    if (!canAct() || !ME || BUSY || submitted()) return;
    if (locked()) { toast('역할이 확정됐어요'); return; }
    var next = ME.pref === r ? null : r;
    if (MODE === 'preview') { PV.pref = next; refresh(); return; }
    act(sb().from('campaign_members').update({ pref: next, updated_at: new Date().toISOString() }).eq('worksheet_id', ID.worksheetId).eq('student_id', sid()), null, true);
  };
  function draw() {
    if (!ME || locked()) return;
    LASTSIG = '';
    if (MODE === 'preview') { PV.role = PV.pref; PV.lock = true; refresh(); return; }
    act(sb().rpc('campaign_assign_roles', { p_ws: ID.worksheetId, p_cls: cls(), p_g: ME.group_no }), '역할이 정해졌어요', true);
  }
  function act(p, okMsg, tell) {
    BUSY = true;
    return p.then(function (r) {
      if (r && r.error) toast(r.error.code === '23505' ? '이미 다른 친구가 고른 역할이에요' : '저장하지 못했어요. 다시 해 보세요');
      else { if (okMsg) toast(okMsg); if (tell) ping(); }
      return load();
    }).catch(function () { toast('저장하지 못했어요. 다시 해 보세요'); }).then(function () { BUSY = false; render(); tick(); });
  }
  function join(g) {
    if (members(g).length >= MAX) { toast('자리가 다 찼어요'); return; }
    if (GL[g]) { toast('역할이 이미 확정된 조예요'); return; }
    LASTSIG = '';
    if (MODE === 'preview') { PV.g = g; PV.pref = null; PV.role = null; PV.name = null; PV.lock = false; refresh(); return; }
    act(sb().from('campaign_members').upsert({ worksheet_id: ID.worksheetId, student_id: sid(), class_name: cls(), group_no: g, name: ID.student.name || '', number: +ID.student.number || null, role: null, pref: null, updated_at: new Date().toISOString() }, { onConflict: 'worksheet_id,student_id' }));
  }
  function leave() {
    LASTSIG = ''; ping();
    if (MODE === 'preview') { PV.g = null; PV.pref = null; PV.role = null; PV.left = true; refresh(); return; }
    act(sb().from('campaign_members').delete().eq('worksheet_id', ID.worksheetId).eq('student_id', sid()));
  }
  function rename(v) {
    NAMET = null;
    if (effRole() !== '조장' || submitted()) return;
    v = String(v || '').trim().slice(0, 20);
    if (v === gname(ME.group_no)) return;
    if (MODE === 'preview') { PV.name = v; refresh(); return; }
    act(sb().from('campaign_groups').upsert({ worksheet_id: ID.worksheetId, class_name: cls(), group_no: ME.group_no, name: v, updated_at: new Date().toISOString() }, { onConflict: 'worksheet_id,class_name,group_no' }), null, true);
  }
})();
