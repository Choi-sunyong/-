/* 3차 수행평가(윤리문제 알림 캠페인) 조 폴더 — 2026-11-12
   학습지(worksheets id 32, data-ws-grade="campaign3") 맨 끝에서 <script src="/games/campaign-groups.js"> 로 불러옴.
   - 학생: 반별 1~8조 폴더 중 하나를 골라 들어감(조 옮기기 가능, 한 조 최대 5명). 들어가기 전엔 학습지 본문을 가림
   - 역할: 선착순·추첨 아님. 모둠 표에서 각자 희망 역할을 고르고, 겹치면 모둠원끼리 얘기해서 바꿈 → 모두 다르게 고르면 [역할 확정]
     → DB 함수 campaign_confirm_roles 가 겹침·조장·서기를 확인하고 희망 그대로 확정(campaign_groups.locked, 통합반은 겹쳐도 됨)
     → 다시 뽑기는 선생님 조 분류 화면(/campaign-groups.html)에서
   - 모둠 이름은 학생 정보 칸의 '모둠 이름'에서 조장만 바꿈. 학습지 team 칸엔 'N조 · 이름'(채점 도구가 앞 숫자로 모둠을 묶음)
   - 모둠 공통 칸(SH_FIELDS: 문제·자료·원인·해결방안·캠페인 기획)은 서기만 씀 → 같은 조 화면에 실시간(Supabase broadcast, 조별 채널)으로 채워짐,
     DB(campaign_groups.shared)엔 1.5초 모아서 저장. 나머지 학생 칸은 읽기 전용
   - 조 정보는 조에 들어간 뒤엔 실시간 알림 + 30초마다 확인, 들어가기 전(폴더 고르는 중)엔 15~18초마다 확인, 제출 뒤엔 멈춤
   - 선생님 미리보기에서 학생을 고르면 실제 조 정보를 보여 주되 아무것도 저장·전송하지 않음
   - (2026-11-17) 근거 자료 칸(s1~s3)은 자료조사 담당, 나머지 공통 칸은 서기 담당 → 칸마다 담당 역할만 쓰고, 저장은 campaign_shared_merge(맡은 칸만 합침)
   - 모두 '내가 찾은 자료' 2개(my1·my2)를 쓰고 → campaign_members.work 에 올려 '모둠원이 찾은 자료'(cgPool)에 같이 보임, 자료조사가 이걸 취합
   - 역할 결과물(학습지 [data-role-only])을 다 채웠는지와 내 자료 개수를 work 에 남겨 조원 머리말에 진행 상황 표시
   - 선생님이 자동 편성한 조(by_teacher)는 학생이 옮길 수 없음
   - 선생님 화면(teacherView)·'선생님으로 들어가기'·제출 완료 후에는 학습지 칸을 바꾸지 않음 */
(function () {
  if (window.__cgOn) return; window.__cgOn = 1;
  var SB_URL = 'https://uxycuvpzsyfvsbwnrexv.supabase.co', SB_KEY = 'sb_publishable_1aMfdIKdr6sUwI0vshYKXw_e9qVrPJj';
  var ROLES = ['조장', '서기', '자료조사', '제작', '실천'], NG = 10, MAX = 5, SHOWMAX = 6;   // (2026-11-22) 통합반 학생은 다른 학생과 역할을 같이 맡아 6명 조 가능(스스로 들어갈 땐 5명까지)
  var SH_SRC = ['s1type', 's1src', 's1sum', 's2type', 's2src', 's2sum', 's3type', 's3src', 's3sum'];
  // (2026-11-22) 캠페인 형식·제목·메시지·장면·결과물은 제작, 보여 줄 대상·행동 제안은 실천 담당(발표 역할은 없앰)
  var SH_MAKE = ['format', 'formatEtc', 'slogan', 'message', 'sb1', 'sb2', 'sb3', 'sb4', 'product'], SH_PRES = ['audience', 'action'];
  // 4명 조처럼 그 역할이 없으면: 자료조사 칸은 조장, 제작·실천 칸은 서기가 씀
  function owner(id) {
    var r = SH_SRC.indexOf(id) > -1 ? '자료조사' : SH_MAKE.indexOf(id) > -1 ? '제작' : SH_PRES.indexOf(id) > -1 ? '실천' : '서기';
    if (r !== '서기' && ME) { var lk = locked(); if (!members(ME.group_no).some(function (m) { return (lk ? m.role : (m.role || m.pref)) === r; })) r = r === '자료조사' ? '조장' : '서기'; }
    return r;
  }
  var SH_FIELDS = ['scope', 'place', 'issue', 'situation', 'valA', 'valB',
    's1type', 's1src', 's1sum', 's2type', 's2src', 's2sum', 's3type', 's3src', 's3sum', 'cause',
    'a1who', 'a1how', 'a1eff', 'a1val', 'a2who', 'a2how', 'a2eff',
    'format', 'formatEtc', 'slogan', 'audience', 'message', 'action', 'sb1', 'sb2', 'sb3', 'sb4', 'product'];
  var POOL = [];
  var sbc = null, ID = null, ME = null, ROWS = [], GN = {}, GS = {}, GL = {}, MODE = 'off', BUSY = false, LASTSIG = '';
  var TIMER = null, NAMET = null, SHT = null, BCT = null, BCLAST = 0, CH = null, CHKEY = '';
  var PV = { g: null, pref: null, role: null, name: null, shared: null, lock: false, left: false }, WORKT = null;
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
    '.cg-in{background:var(--card);border-radius:20px;padding:16px 20px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}',
    '.cg-in .cg-act{display:flex;align-items:center;gap:10px;justify-self:end}',
    '.cg-in .no{font-size:13px;font-weight:700;color:#fff;background:var(--blue);border-radius:999px;padding:5px 12px}',
    '.cg-in .gn{font-size:18px;font-weight:700;letter-spacing:-.02em}',
    '.cg-mem{grid-column:1/-1;display:flex;gap:6px;flex-wrap:nowrap;min-width:0}',
    '.cg-mem>span{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--field);border-radius:14px;padding:8px 6px;font-size:13.5px;font-weight:700;text-align:center}',
    '.cg-mem>span small{margin:0!important;font-size:11.5px;line-height:1.3}',
    '.cg-mem>span.me{background:var(--blueSoft)}',
    '.cg-mem>span.ab{opacity:.4}',
    '.cg-mem small{font-size:11.5px;font-weight:700;color:var(--blue);margin-left:4px}',
    '.cg-mem small.pf{color:var(--faint)}',
    '.cg-b{font:inherit;font-size:13.5px;font-weight:600;border:0;border-radius:999px;padding:8px 14px;background:var(--field);color:var(--ink);cursor:pointer;white-space:nowrap}',
    '.cg-b.pri{background:var(--blue);color:#fff}.cg-b.pri.off{background:#C7C7CC}.cg-b:disabled{opacity:.45;cursor:default}',
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
  // 보안(2026-11-14): 학생은 student.html이 준 출입증(x-sdt-tok)을 모든 요청에 붙임, 선생님 미리보기는 로그인 세션으로 통과
  function sdtFetch(u, o) { o = o || {}; try { var h = null; try { h = window.parent && window.parent !== window && window.parent.__sdtHdr; } catch (e) {} h = h || window.__sdtHdr; if (h && h.tok) { var H = new Headers(o.headers || {}); H.set('x-sdt-tok', String(h.tok)); o = Object.assign({}, o, { headers: H }); } } catch (e) {} return fetch(u, o); }
  function sb() { if (!sbc && window.supabase) sbc = window.supabase.createClient(SB_URL, SB_KEY, { global: { fetch: sdtFetch } }); return sbc; }
  function loadLib(cb) { if (window.supabase) return cb(); var s = document.createElement('script'); s.src = 'https://unpkg.com/@supabase/supabase-js@2'; s.onload = cb; s.onerror = function () { box.hidden = false; box.innerHTML = '<div class="cg-in"><span class="gn">조 정보를 불러오지 못했어요</span></div>'; document.body.classList.remove('cg-out'); height(); }; document.head.appendChild(s); }
  function cls() { return String((ID.student && ID.student.class) || '').trim(); }
  function sid() { return ID.student && ID.student.id; }
  function isMe(m) { return !!m && String(m.student_id) === String(sid()); }
  function canAct() { return MODE === 'live' || MODE === 'preview'; }
  function submitted() { var b = $('wsSend'); return !!(b && b.hidden); }
  function members(g) { return ROWS.filter(function (r) { return r.group_no === g; }).sort(function (a, b) { var x = a.role ? ROLES.indexOf(a.role) : 9, y = b.role ? ROLES.indexOf(b.role) : 9; return (a.care === '통합반') - (b.care === '통합반') || x - y || (+a.number || 0) - (+b.number || 0); }); }
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
    PV = { g: null, pref: null, role: null, name: null, shared: null, lock: false, left: false, work: null };
    box.hidden = false; box.innerHTML = '<div class="cg-in"><span class="gn">불러오는 중…</span></div>'; height();
    loadLib(function () { refresh(); tick(); });
    if (MODE === 'live') setTimeout(actMark, 2000);
  });
  // (2026-11-22) 출석: 학습지에서 무언가 할 때마다 5분 단위 시각을 숨은 칸(cgAct)에 남김 → 학습지 임시 저장에 같이 실려 선생님 출석표에 쓰임
  var ACTLAST = 0;
  function actMark() {
    if (MODE !== 'live' || submitted()) return;
    var e = $('cgAct'); if (!e) return;
    var b = Math.floor(Date.now() / 300000) * 300000; if (b === ACTLAST) return; ACTLAST = b;
    var L = String(e.value || '').split(',').filter(Boolean).map(Number);
    if (L[L.length - 1] === b) return;
    L.push(b); if (L.length > 300) L = L.slice(-300);
    e.value = L.join(','); try { e.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {}
  }
  document.addEventListener('input', function (ev) { if (ev.isTrusted) actMark(); }, true);
  document.addEventListener('click', function (ev) { if (ev.isTrusted) actMark(); }, true);
  // (2026-11-22) 차시 열기: 선생님이 반마다 campaign_groups 0번 줄(shared)에 저장 — open2·open3(직접 열기), auto(시간표 따라 순서대로), sched·times·start
  var TT0 = { 1: ['09:00', '09:50'], 2: ['10:00', '10:50'], 3: ['11:00', '11:50'], 4: ['12:00', '12:50'], 5: ['13:50', '14:40'], 6: ['14:50', '15:40'], 7: ['15:50', '16:40'] };
  function autoLesson(c, now) {
    if (!c || !c.auto || !(c.sched || []).length || !c.start) return 0;
    var tt = c.times || TT0, tm = function (x) { var a = String(x || '').split(':').map(Number); return a[0] * 60 + (a[1] || 0); };
    var n = 0, d0 = new Date(c.start); d0.setHours(0, 0, 0, 0);
    for (var d = new Date(d0); d <= now && n < 9; d.setDate(d.getDate() + 1)) {
      c.sched.filter(function (o) { return +o.d === d.getDay() && tt[o.p]; }).sort(function (a, b) { return a.p - b.p; }).forEach(function (o) {
        var s0 = new Date(d), e0 = new Date(d); s0.setHours(0, tm(tt[o.p][0]) - 5, 0, 0); e0.setHours(0, tm(tt[o.p][1]), 0, 0);
        if (e0.getTime() > c.start && s0 <= now) n++;
      });
    }
    return n;
  }
  // (2026-11-22) 시간표 자동을 켜면 2차 수행평가처럼 그 반 수업 시간(시작 5분 전 ~ 끝)에만 학습지가 열림, 그 밖에는 덮개로 막음
  function inClass(c, now) {
    var tt = c.times || TT0, tm = function (x) { var a = String(x || '').split(':').map(Number); return a[0] * 60 + (a[1] || 0); };
    var m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    return (c.sched || []).some(function (o) { return +o.d === now.getDay() && tt[o.p] && m >= tm(tt[o.p][0]) - 5 && m < tm(tt[o.p][1]); });
  }
  function gatePaint() {
    var c = GS[0] || {}, shut = MODE === 'live' && !submitted() && !!c.auto && (c.sched || []).length > 0 && !inClass(c, new Date()) && !(c.solo || {})[String(sid())];
    var g = $('cgGate');
    if (shut && !g) {
      g = document.createElement('div'); g.id = 'cgGate';
      g.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(245,245,247,.97);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#1D1D1F';
      g.textContent = '지금은 열리지 않았어요'; document.body.appendChild(g);
    } else if (!shut && g) g.remove();
  }
  setInterval(function () { if (ID) { gatePaint(); if (window.wsPagesRepaint) window.wsPagesRepaint(); } }, 30000);
  window.wsLessonLock = function (li) {
    if (MODE !== 'live' || !ID) return '';
    var c = GS[0] || {}, k = li + 1;
    if (c['open' + k] || autoLesson(c, new Date()) >= k) return '';
    return k + '차시는 아직 열리지 않았어요';
  };
  function tick() {
    clearTimeout(TIMER);
    if (MODE === 'off' || MODE === 'done' || submitted()) { unsub(); return; }
    TIMER = setTimeout(function () { if (!document.hidden && !BUSY) (ME && MODE === 'live' ? loadGroup().then(render) : refresh()).then(tick); else tick(); }, ME ? 30000 : 15000 + Math.random() * 3000);
  }

  function refresh() { return load().then(render).then(function () { gatePaint(); if (window.wsPagesRepaint) window.wsPagesRepaint(); }); }
  // (2026-11-22) 서버 부담 줄이기: 조원이 저장했다는 신호(ref)는 2초쯤 모았다가, 반 전체가 아니라 우리 조 줄만 다시 불러옴(3초에 한 번까지). 반 전체는 30초 타이머로.
  var REFT = null, REFLAST = 0;
  function refSoon() { clearTimeout(REFT); var wait = Math.max(2000, 3000 - (Date.now() - REFLAST)); REFT = setTimeout(function () { if (BUSY || document.hidden) { refSoon(); return; } REFLAST = Date.now(); loadGroup().then(render); }, wait); }
  function loadGroup() {
    if (!ME || MODE !== 'live') return load();
    var c = cls(), w = ID.worksheetId, g = ME.group_no;
    return Promise.all([
      sb().from('campaign_members').select('student_id,group_no,name,role,pref,number,by_teacher,work,care').eq('worksheet_id', w).eq('class_name', c).eq('group_no', g),
      sb().from('campaign_groups').select('group_no,name,shared,locked').eq('worksheet_id', w).eq('class_name', c).in('group_no', [g, 0])
    ]).then(function (res) {
      if (!res[0].error) { var mine = res[0].data || []; if (!mine.some(isMe)) return load(); ROWS = ROWS.filter(function (r) { return r.group_no !== g; }).concat(mine); }
      if (!res[1].error) (res[1].data || []).forEach(function (x) { GN[x.group_no] = x.name || ''; GS[x.group_no] = x.shared || {}; GL[x.group_no] = !!x.locked; });
      ME = ROWS.filter(isMe)[0] || null;
      gatePaint(); if (window.wsPagesRepaint) window.wsPagesRepaint();
    }).catch(function () {});
  }
  function load() {
    var c = cls(), w = ID.worksheetId;
    return Promise.all([
      sb().from('campaign_members').select('student_id,group_no,name,role,pref,number,by_teacher,work,care').eq('worksheet_id', w).eq('class_name', c),
      sb().from('campaign_groups').select('group_no,name,shared,locked').eq('worksheet_id', w).eq('class_name', c)
    ]).then(function (res) {
      if (!res[0].error) ROWS = res[0].data || [];
      if (!res[1].error) { GN = {}; GS = {}; GL = {}; (res[1].data || []).forEach(function (g) { GN[g.group_no] = g.name || ''; GS[g.group_no] = g.shared || {}; GL[g.group_no] = !!g.locked; }); }
      if (MODE === 'preview') {   // 미리보기에서 바꾼 것은 화면에서만 덮어씀
        var real = ROWS.filter(isMe)[0];
        if (PV.g == null && real && !PV.left) { PV.g = real.group_no; PV.pref = real.pref; PV.role = real.role; }
        ROWS = ROWS.filter(function (r) { return !isMe(r); });
        if (PV.g != null) {
          ROWS.push({ student_id: sid(), group_no: PV.g, name: ID.student.name || '', pref: PV.pref, role: PV.role, number: ID.student.number, care: real ? real.care : null, work: PV.work || (real && real.work) || {} });
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
      .on('broadcast', { event: 'sh' }, function (m) { var o = m.payload && m.payload.o; if (!o || !ME || typeof o !== 'object') return; var er0 = effRole(); o = Object.keys(o).reduce(function (a, k) { if (SH_FIELDS.indexOf(k) > -1 && owner(k) !== er0) a[k] = String(o[k] == null ? '' : o[k]).slice(0, 3000); return a; }, {}); GS[ME.group_no] = Object.assign({}, GS[ME.group_no] || {}, o); sharedFields(ME.group_no, effRole()); if (o.cause !== undefined) renderSolAid(members(ME.group_no)); })
      .on('broadcast', { event: 'ref' }, function () { refSoon(); })
      .subscribe(function (st) { if (st === 'SUBSCRIBED') ping(); });   // 새로 들어오면 조원 화면도 다시 읽게
  }
  function ping() { if (CH && MODE === 'live') try { CH.send({ type: 'broadcast', event: 'ref', payload: {} }); } catch (e) {} }

  // (2026-11-23) 오늘 들어왔는지: work.seen = 오늘 날짜(한국). 결석한 조원은 역할·윤리문제 확정 조건에서 뺌
  function today() { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
  function here(m) { return isMe(m) || ((m.work || {}).seen === today()); }
  var SEENAT = '';
  function markSeen() {
    if (MODE !== 'live' || !ME || submitted() || SEENAT === today() || (ME.work || {}).seen === today()) return;
    SEENAT = today(); var w = Object.assign({}, ME.work || {}, { seen: today() }); ME.work = w;
    sb().from('campaign_members').update({ work: w }).eq('worksheet_id', ID.worksheetId).eq('student_id', sid()).then(function (r) { if (r && !r.error) ping(); else SEENAT = ''; });
  }
  function render() { markSeen();
    if (MODE === 'off') return;
    if (!ME) {
      unsub();
      if (MODE === 'done') { box.hidden = true; document.body.classList.remove('cg-out'); height(); return; }
      document.body.classList.add('cg-out');
      if (canAct()) lockSharedOut();
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
    var ms1 = ms0.filter(function (m) { return m.care !== '통합반'; }), chosen = ms1.filter(function (m) { return m.pref; }).length;
    // 맨 위: 조 번호·이름 | 오른쪽 희망 수·역할 확정 상태, 아래 한 줄: 조원 (조 옮기기 없음: 조는 선생님이 정함)
    var t = '<div class="cg-in"><span class="no">' + esc(gname(g0) || (g0 + '조')) + '</span><span></span><span class="cg-act">';
    if (act && !lk) t += '<span class="cg-st">희망 ' + chosen + '/' + ms1.length + '</span>';
    if (lk) t += '<span class="cg-st">역할 확정</span>';
    t += '</span><div class="cg-mem">'
      + ms0.map(function (m) { return '<span class="' + (isMe(m) ? 'me' : '') + '">' + esc(m.name) + (lk ? (m.role ? '<small>' + esc(m.role) + '</small>' : '') : (m.pref ? '<small class="pf">' + esc(m.pref) + '</small>' : '')) + progTag(m, lk) + '</span>'; }).join('') + '</div>';
    box.innerHTML = t + '</div>';
    apply(); confirmUI(lk, act); height();
    if (act && JSON.stringify(myWork()) !== JSON.stringify(ME.work || {})) queueWork();   // 불러온 답과 올려 둔 진행 상황이 다르면 맞춤
  }
  function progTag(m, lk) {
    var w = isMe(m) ? myWork() : (m.work || {}), n = +w.srcN || 0;
    return '<small class="' + (n >= 2 ? '' : 'pf') + '">자료 ' + n + '/2</small>' + (lk ? '<small class="' + (w.role ? '' : 'pf') + '">결과물 ' + (w.role ? 1 : 0) + '/1</small>' : '');
  }

  // 학습지 칸 채우기 — 바뀌었을 때만 입력 이벤트를 보내 학습지가 다시 계산·임시 저장하게 함
  function apply() {
    if (!canAct() || !ME || submitted()) return;
    var g0 = ME.group_no, ms = members(g0).slice(0, SHOWMAX), lk = !!GL[g0], myRole = lk ? (ME.role || '') : '';
    var er = effRole();
    nameField(g0, er === '조장');
    sharedFields(g0, er); renderPool(ms); renderIssues(ms); renderRev(ms);
    paintCards(ms, lk); lockSheet();
    document.querySelectorAll('.team .row:not(.head) .i').forEach(function (el, k) { var m = ms[k]; el.textContent = m && m.number != null && m.number !== '' ? m.number : ''; });
    var team = g0 + '조' + (gname(g0) ? ' · ' + gname(g0) : '');
    var sig = JSON.stringify([team, ms.map(function (m) { return [m.name, lk ? m.role : m.pref, m.number]; }), myRole, lk]);
    if (sig === LASTSIG) return; LASTSIG = sig;
    var set = function (id, v) { var e = $(id); if (e) e.value = v == null ? '' : v; };
    set('team', team);   // 모둠원 표 역할 칸: 확정 전엔 희망을 보여 줌(겹치면 빨간 테두리)
    for (var i = 1; i <= SHOWMAX; i++) { var m = ms[i - 1]; set('m' + i + 'n', m ? m.name : ''); set('m' + i + 'r', m ? ((lk ? m.role : m.pref) || '') : '');
      var hr = $('m' + i + 'r'); if (hr) hr.dataset.share = m && m.care === '통합반' ? '1' : '';
      var rw = $('m' + i + 'n') && $('m' + i + 'n').closest('.row'); if (rw && i > MAX) rw.hidden = !m; }
    set('myRole', myRole);
    var trig = $('m1n'); if (trig) trig.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // 학생 정보의 '모둠 이름' 칸: 원래 team 칸은 숨기고(저장용), 조장만 고칠 수 있는 이름 칸을 그 자리에 둠
  function nameField(g0, lead) {
    var team = $('team'); if (!team) return;
    var cell = team.parentNode, inp = $('cgName');
    if (!inp) {
      team.style.display = 'none';
      inp = document.createElement('input'); inp.id = 'cgName'; inp.maxLength = 20; inp.placeholder = '조장만 쓸 수 있어요.'; inp.setAttribute('aria-label', '모둠 이름');
      cell.appendChild(inp);
      inp.addEventListener('input', function () { if (inp.readOnly) return; clearTimeout(NAMET); NAMET = setTimeout(function () { rename(inp.value); }, 900); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      inp.addEventListener('blur', function () { if (inp.readOnly || !NAMET) return; clearTimeout(NAMET); rename(inp.value); });
    }
    var k = cell.querySelector('.k'); if (k) k.textContent = '모둠 이름';
    inp.readOnly = !lead;
    if (document.activeElement !== inp) inp.value = gname(g0);
  }

  // 모둠 공통 칸: 서기는 쓰면 실시간 전송 + 1.5초 뒤 DB 저장, 나머지는 읽기 전용으로 받아 채움
  // 공동 칸 이름 옆에 '서기'·'자료조사' 표시
  function shBadge(id, e) {
    var hid = e.type === 'hidden', bx = e.closest('.box'), host = bx ? bx.querySelector('.box-h') : (hid ? (shGroup(id) || {}).parentNode : e.closest('.f'));
    var fl = host && (bx ? host : host.querySelector('.fl'));
    if (!fl) return; var t = fl.querySelector('.cg-by');
    if (!t) { t = document.createElement('span'); t.className = 'cg-by'; fl.appendChild(t); }
    var o = owner(id); if (t.textContent !== o) t.textContent = o;
  }
  // 아직 조에 안 들어간 학생: 공동 칸은 표시만 하고 못 쓰게(조에 들어가면 서기·자료조사만 씀)
  function lockSharedOut() {
    SH_FIELDS.forEach(function (id) {
      var e = $(id); if (!e) return; shBadge(id, e); e.dataset.cgOther = '1';
      if (e.type === 'hidden') { var g = shGroup(id); if (g) g.querySelectorAll('.chip').forEach(function (c) { c.disabled = true; }); }
      else e.readOnly = true;
    });
  }
  function shGroup(id) { return document.querySelector('.chips[data-for="' + id + '"]'); }
  var SHLAST = {};
  function sharedFields(g0, er) {
    var sh = GS[g0] || {};
    SH_FIELDS.forEach(function (id) {
      var e = $(id); if (!e) return;
      var hid = e.type === 'hidden', mine = owner(id) === er;
      e.dataset.cgOther = mine ? '' : '1';   // 남이 맡은 공동 칸은 내 제출의 필수 검사에서 뺌(담당자만 필수)
      if (!e.__cgSh) {
        e.__cgSh = 1;
        if (hid) { var g = shGroup(id); if (g) g.addEventListener('click', function () { setTimeout(function () { clerkTyped(id); }, 0); }); }
        else e.addEventListener('input', function (ev) { if (ev.isTrusted) clerkTyped(id); });
      }
      shBadge(id, e);
      if (hid) { var gg = shGroup(id); if (gg) gg.querySelectorAll('.chip').forEach(function (c) { c.disabled = !mine; }); }
      else e.readOnly = !mine;
      var v = sh[id] == null ? '' : String(sh[id]);
      // 내가 맡은 칸은 쓰는 중인 내용을 덮어쓰지 않음. 다만 공동 칸 값이 다른 데서 바뀌었으면(윤리문제 다시 확정·선생님 수정) 내 칸도 따라 바꿈(2026-11-23)
      if (mine) {
        var last = SHLAST[id];
        if (!SHT && document.activeElement !== e && v && e.value !== v && (last === undefined || e.value === last || !e.value)) setVal(e, v);
        SHLAST[id] = v; return;
      }
      if (e.value !== v) setVal(e, v);
    });
    var fw = $('formatEtcWrap'); if (fw && $('format')) fw.hidden = $('format').value !== '기타';
  }
  function setVal(e, v) {
    e.value = v; e.dispatchEvent(new Event('input', { bubbles: true }));
    if (e.type === 'hidden') { var g = shGroup(e.id); if (g) { g.style.outline = ''; g.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); }); } }
  }
  function shObj() { var o = {}, er = effRole(); SH_FIELDS.forEach(function (id) { var e = $(id); if (e && owner(id) === er) o[id] = e.value; }); return o; }   // 내가 맡은 칸만
  function clerkTyped(id) {
    if (!ME || owner(id) !== effRole() || submitted()) return;
    var o = shObj(); GS[ME.group_no] = Object.assign({}, GS[ME.group_no] || {}, o);
    if (MODE === 'preview') { PV.shared = Object.assign({}, PV.shared || {}, o); return; }
    var now = Date.now(), gap = 1000;   // 1초에 한 번씩 조원 화면으로 보냄(실시간 메시지 한도 여유 있게)
    clearTimeout(BCT);
    if (now - BCLAST >= gap) sendSh(); else BCT = setTimeout(sendSh, gap - (now - BCLAST));
    clearTimeout(SHT); SHT = setTimeout(saveShared, 1500);
  }
  function sendSh() { BCLAST = Date.now(); if (CH) try { CH.send({ type: 'broadcast', event: 'sh', payload: { o: shObj() } }); } catch (e) {} }
  function saveShared() {
    SHT = null;
    if (!ME || MODE !== 'live') return;
    var o = shObj(); if (!Object.keys(o).length) return;
    sb().rpc('campaign_shared_merge', { p_ws: ID.worksheetId, p_cls: cls(), p_g: ME.group_no, p_patch: o })
      .then(function (r) { if (r && r.error) toast('저장하지 못했어요. 다시 써 보세요'); });
  }

  // ---------- 내가 찾은 자료 · 역할 결과물 진행 상황 ----------
  function val(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  function roleDone() {
    var r = locked() ? (ME.role || '') : ''; if (!r) return false;
    var ws0 = document.querySelectorAll('[data-role-only="' + r + '"]'); if (!ws0.length) return false;
    var ok = true; Array.prototype.forEach.call(ws0, function (w) { w.querySelectorAll('[data-req]').forEach(function (e) { var v = String(e.value || '').trim(); if (!v || v.length < (+e.dataset.min || 0)) ok = false; }); });
    return ok;
  }
  // (2026-11-22) 윤리문제·해결방안 제안은 [제안하기]를 눌렀을 때만 조원에게 올라감(쓰는 중에는 서버에 안 보냄)
  var PSUB = null;
  function psub() {
    if (PSUB) return PSUB;
    if (!ME) return { iss: '', isw: '', isc: '', iva: '', ivb: '', sol: '', cau: '' };
    var w = ME.work || {}; PSUB = { iss: w.iss || '', isw: w.isw || '', isc: w.isc || '', iva: w.iva || '', ivb: w.ivb || '', sol: w.sol || '', cau: w.cau || '' }; return PSUB;
  }
  var PROPS = [
    { id: 'cgPropIss', at: 'myIssueWhy', keys: { iss: 'myIssue', isw: 'myIssueWhy', isc: 'myScope', iva: 'myValA', ivb: 'myValB' }, ok: function () { return val('myIssue') && val('myScope') && val('myValA') && val('myValB') && val('myIssueWhy').length >= 50; },
      why: function () { return !val('myIssue') ? ['myIssue', '윤리문제를 써 주세요'] : !val('myScope') ? ['myScope', '발생 범위를 골라 주세요'] : !val('myValA') || !val('myValB') ? [val('myValA') ? 'myValB' : 'myValA', '충돌하는 가치 두 개를 모두 써 주세요'] : ['myIssueWhy', '제안 이유를 50자 이상 써 주세요 (지금 ' + val('myIssueWhy').length + '자)']; } },
    // (2026-11-23) 2차시 원인 제안: 각자 내 자료로 본 원인 → 서기 원인 분석 위에 카드로 모임
    { id: 'cgPropCau', at: 'causeIdea', keys: { cau: 'causeIdea' }, ok: function () { return val('causeIdea').length >= 50; }, why: function () { return ['causeIdea', '원인을 50자 이상 써 주세요 (지금 ' + val('causeIdea').length + '자)']; } },
    { id: 'cgPropSol', at: 'solIdea', keys: { sol: 'solIdea' }, ok: function () { var e = $('solIdea'); return !!val('solIdea') && val('solIdea').length >= (+(e && e.dataset.min) || 1); } }
  ];
  function propSame(c) { var p = psub(); return Object.keys(c.keys).every(function (k) { return (p[k] || '') === val(c.keys[k]); }); }
  function propPaint() {
    PROPS.forEach(function (c) {
      var at = $(c.at); if (!at) return;
      var b = $(c.id);
      if (!b) {
        var host = at.closest('.box') || at.closest('label') || at.parentNode;
        var wrap = document.createElement('div'); wrap.className = 'cg-prop'; wrap.style.cssText = 'display:flex;justify-content:flex-end;margin-top:12px';
        b = document.createElement('button'); b.type = 'button'; b.id = c.id; b.className = 'cg-b pri';
        b.addEventListener('click', function (e) { e.preventDefault(); propSend(c); });
        wrap.appendChild(b); host.appendChild(wrap);
      }
      var act = !!ME && canAct() && !submitted(), had = Object.keys(c.keys).some(function (k) { return psub()[k]; }), same = propSame(c);
      b.parentNode.hidden = !ME;
      b.disabled = !act || (same && had);
      b.classList.toggle('off', act && !(same && had) && !c.ok());
      var hn = $(c.id + 'N'); if (!hn) { hn = document.createElement('span'); hn.id = c.id + 'N'; hn.style.cssText = 'align-self:center;margin-right:12px;font-size:13px;font-weight:700;color:#D70015'; b.parentNode.insertBefore(hn, b); }
      var wy = act && !(same && had) && !c.ok() && c.why ? c.why()[1] : ''; if (hn.textContent !== wy) hn.textContent = wy;
      b.textContent = same && had ? '제안함' : had ? '다시 제안하기' : '제안하기';
    });
  }
  function propSend(c) {
    if (!ME || !canAct() || submitted()) return;
    if (!c.ok()) {
      var w = c.why ? c.why() : null; toast(w ? w[1] : '빈칸을 채워 주세요');
      var f = w && ($(w[0]) && $(w[0]).type === 'hidden' ? document.querySelector('.chips[data-for="' + w[0] + '"]') : $(w[0]));
      if (f) { try { f.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (f.focus) f.focus(); } catch (x) {} }
      return;
    }
    var p = psub(); Object.keys(c.keys).forEach(function (k) { p[k] = val(c.keys[k]); });
    clearTimeout(WORKT); saveWork(); renderIssues(members(ME.group_no));
  }
  function myWork() {
    var src = [1, 2].map(function (k) { var t = val('my' + k + 'type'); if (t === '기타' && val('my' + k + 'typeEtc')) t = val('my' + k + 'typeEtc'); return { t: t, n: val('my' + k + 'title'), s: val('my' + k + 'src'), m: val('my' + k + 'sum') }; });
    var p = psub();
    return { src: src, srcN: src.filter(function (x) { return x.t && x.n && x.s && x.m.length >= 30; }).length, role: roleDone(),
      seen: today(), iss: p.iss, isw: p.isw, isc: p.isc, iva: p.iva, ivb: p.ivb, ipl: '', isi: '', vote: myVote('vote'), sol: p.sol, cau: p.cau, svote: myVote('svote') };
  }
  // 각자 제안 → 모둠원 제안을 같이 보며 하나에 투표 (2026-11-21)
  //  - 윤리문제(1차시 STEP 1): myIssue·myIssueWhy → work.iss·isw, 표 work.vote
  //  - 해결방안(2차시 STEP 4): solIdea → work.sol, 표 work.svote
  var VOTES = [
    { box: 'cgIss', after: 'myIssueWhy', a: 'iss', b: 'isw', key: 'vote' },
    { box: 'cgSol', after: 'solIdea', a: 'sol', b: '', key: 'svote' }];
  var VOTE = {};   // 이 화면에서 누른 표(없으면 올려 둔 표)
  function myVote(k) { return VOTE[k] !== undefined ? VOTE[k] : (ME && ME.work && ME.work[k]) || null; }
  // 조장이 윤리문제 확정 → 모둠 공동 기록(campaign_groups.shared.issueOK)에 남김, '우리가 고른 윤리문제'가 비어 있으면 그 내용으로 채움
  // (2026-11-22) 확정 조건 — 통합반을 뺀 모둠원 모두 제안하고 투표해야 하고, 표가 가장 많은 제안만 확정할 수 있음
  function issueNeed(ms) {
    var W = ms.filter(function (m) { return m.care !== '통합반'; }).map(function (m) { return isMe(m) ? myWork() : (m.work || {}); });
    var cnt = {}; ms.forEach(function (m) { var v = (isMe(m) ? myWork() : (m.work || {})).vote; if (v) cnt[v] = (cnt[v] || 0) + 1; });
    var mx = Math.max.apply(null, [0].concat(Object.keys(cnt).map(function (k) { return cnt[k]; })));
    var p = W.filter(function (w) { return w.iss; }).length, v = W.filter(function (w) { return w.vote; }).length;
    return { n: W.length, p: p, v: v, ready: mx > 0, cnt: cnt, mx: mx };
  }
  function confirmIssue(id) {
    if (!ME || !canAct() || submitted() || effRole() !== '조장') return;
    var g = ME.group_no, cur = +((GS[g] || {}).issueOK || 0), next = cur === id ? null : id;
    if (next) { var nd = issueNeed(members(g)); if (!nd.ready) { toast('투표가 1표 이상 있어야 확정할 수 있어요'); return; } if ((nd.cnt[next] || 0) !== nd.mx) { toast('표가 가장 많은 제안만 확정할 수 있어요'); return; } }
    var w = next ? (members(g).filter(function (m) { return +m.student_id === next; }).map(function (m) { return isMe(m) ? myWork() : (m.work || {}); })[0] || {}) : {};
    var patch = { issueOK: next };
    // 확정한 제안의 문제·범위·장소·실제 모습을 '우리 사회의 윤리문제' 공동 칸에 채움(서기가 이미 쓴 칸은 그대로)
    // (2026-11-23) 다른 제안으로 바꾸거나 취소하면, 이전 확정 제안 내용이 그대로 남은 칸은 새 제안으로 바꾸거나 비움(서기가 고친 칸은 그대로)
    var pw = cur ? (members(g).filter(function (m) { return +m.student_id === cur; }).map(function (m) { return isMe(m) ? myWork() : (m.work || {}); })[0] || {}) : {};
    [['issue', 'iss'], ['scope', 'isc'], ['valA', 'iva'], ['valB', 'ivb']].forEach(function (p) {
      var now = String((GS[g] || {})[p[0]] || '').trim(), old = String(pw[p[1]] || '').trim(), nv = next ? (w[p[1]] || '') : '';
      if (!now || (old && now === old)) { if (nv || now) patch[p[0]] = nv; }
    });
    GS[g] = Object.assign({}, GS[g] || {}, patch);
    if (MODE === 'preview') { PV.shared = Object.assign({}, PV.shared || {}, patch); render(); return; }
    sb().rpc('campaign_shared_merge', { p_ws: ID.worksheetId, p_cls: cls(), p_g: g, p_patch: patch })
      .then(function (r) { if (r && r.error) toast('저장하지 못했어요'); else { ping(); render(); } });
    render();
  }
  // 범위 칩(myScope)·자료 유형 칩(my1type·my2type)은 입력 이벤트가 없어서 눌렀을 때 따로 반영
  document.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('.chips[data-for="myScope"] .chip, .chips[data-for="my1type"] .chip, .chips[data-for="my2type"] .chip'); if (c && ME) setTimeout(function () { if (c.closest('[data-for="myScope"]')) { propPaint(); return; } queueWork(); renderPool(members(ME.group_no)); }, 0); });
  // 제출할 때도 조원과 같은 자료면 막음(학습지의 제출 버튼보다 먼저 받음)
  (function () { var sb0 = document.getElementById('wsSend'); if (sb0) sb0.addEventListener('click', function (e) { if (!ME || !canAct() || submitted()) return; var why = dupOf(1) || dupOf(2) ? '조원과 겹치는 자료가 있어요' : revFixMine() ? '보완 요청 받은 자료 ' + revFixMine() + '를 고쳐야 해요' : revLeft() ? '검토하지 않은 모둠원 자료가 ' + revLeft() + '개 있어요' : ''; if (why) { e.stopImmediatePropagation(); e.preventDefault(); paintDup(); toast(why); try { (revLeft() ? $('cgRev') : $('my1src')).scrollIntoView({ block: 'center' }); } catch (x) {} } }, true); })();
  // 학습지 쪽 넘기기(games/ws-pages.js): 윤리문제 제안 쪽은 조장이 확정해야 다음으로
  window.wsPageGate = function (i, els) {
    if (!ME || MODE !== 'live' || submitted()) return '';   // 미리보기에서는 막지 않고 모든 쪽을 넘겨 볼 수 있게
    var has = els.some(function (el) { return el.contains && el.contains($('myIssue')); });
    if (has && !(GS[ME.group_no] || {}).issueOK) return '조장이 윤리문제를 확정하기 전';
    var hasSrc = els.some(function (el) { return el.contains && el.contains($('my1src')); });
    if (hasSrc && (dupOf(1) || dupOf(2))) return '조원과 겹치는 자료가 있어요';
    if (hasSrc && [1, 2].some(function (k) { var v = val('my' + k + 'src'); return v && val('my' + k + 'type') !== '직접 조사' && !/^https?:\/\/\S+$/.test(v); })) return '출처에는 링크만 붙여 넣어요';
    if (hasSrc && revFixMine()) return '보완 요청 받은 자료 ' + revFixMine() + '를 고쳐야 해요';
    if (hasSrc && revLeft()) return '검토하지 않은 모둠원 자료가 ' + revLeft() + '개 있어요';
    return '';
  };
  function renderIssues(ms) { VOTES.forEach(function (c) { renderVote(c, ms); }); renderCau(ms); renderSolAid(ms); propPaint(); }
  function renderCau(ms) {
    var el = $('cgCauList'); if (!el || !ME) return;
    var h = ms.filter(function (m) { return !(GL[ME.group_no] && m.role === '서기'); }).map(function (m) { var w = isMe(m) ? myWork() : (m.work || {}); return '<div class="pm"><b>' + esc(m.name) + '</b><span class="iq' + (w.cau ? '' : ' none') + '" style="font-size:14px;font-weight:600">' + (w.cau ? esc(w.cau) : '아직 안 씀') + '</span></div>'; }).join('');
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  // (2026-11-23) 해결방안 쪽: 모둠 원인 정리를 위에 보여 주고, 해결방안 1 위에 투표 1위 제안을 보여 줌(서기가 그걸 정리하도록)
  function renderSolAid(ms) {
    var box = 'background:#F5F5F7;border-radius:14px;padding:12px 14px;margin:0 0 16px;display:grid;gap:4px';
    var cs = $('cgCauShow');
    if (cs && ME) { var c = String((GS[ME.group_no] || {}).cause || '').trim();
      var h1 = '<div style="' + box + '"><b style="font-size:13px;color:#6E6E73">모둠 원인 정리</b><span style="font-size:14px;font-weight:600;white-space:pre-wrap;color:' + (c ? '#1D1D1F' : '#AEAEB2') + '">' + (c ? esc(c) : '아직 안 씀') + '</span></div>';
      if (cs.innerHTML !== h1) cs.innerHTML = h1; }
    var st = $('cgSolTop');
    if (st && ME) {
      var W = ms.map(function (m) { return { m: m, w: isMe(m) ? myWork() : (m.work || {}) }; }), cnt = {};
      W.forEach(function (x) { var v = x.w.svote; if (v) cnt[v] = (cnt[v] || 0) + 1; });
      var mx = Math.max.apply(null, [0].concat(Object.keys(cnt).map(function (k) { return cnt[k]; })));
      var tops = mx ? W.filter(function (x) { return x.w.sol && cnt[x.m.student_id] === mx; }) : [];
      var h2 = tops.length ? tops.map(function (x) { return '<div style="' + box + ';box-shadow:inset 0 0 0 2px #0071E3"><b style="font-size:13px;color:#0071E3">투표 1위 · ' + esc(x.m.name) + ' · ' + mx + '표</b><span style="font-size:14px;font-weight:600;white-space:pre-wrap">' + esc(x.w.sol) + '</span></div>'; }).join('') : '';
      if (st.innerHTML !== h2) st.innerHTML = h2;
    }
    var vs = $('cgValShow');
    if (vs && ME) { var g0 = GS[ME.group_no] || {}, va = String(g0.valA || '').trim(), vb = String(g0.valB || '').trim();
      var h3 = va || vb ? '<span style="display:inline-block;margin:0 0 8px;padding:4px 10px;border-radius:999px;background:#EEF5FF;color:#0071E3;font-size:13px;font-weight:700">' + esc(va || '-') + ' vs ' + esc(vb || '-') + '</span>' : '';
      if (vs.innerHTML !== h3) vs.innerHTML = h3; }
  }
  function renderVote(c, ms) {
    var w0 = $(c.after); if (!w0 || !ME) return;
    var el = $(c.box);
    if (!el) {
      el = document.createElement('div'); el.id = c.box; el.className = 'cg-vote';
      var lb = w0.closest('.box') || w0.closest('label') || w0; lb.parentNode.insertBefore(el, lb.nextSibling);   // 제안 칸 묶음(.box) 바로 아래
      if (!$('cgVoteCss')) {
        var st = document.createElement('style'); st.id = 'cgVoteCss';
        st.textContent = '.cg-vote{display:grid;gap:8px;margin:12px 0 4px}.cg-vote .pm{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;background:#F5F5F7;border-radius:14px;padding:12px 14px}'
          + '.cg-vote .pm>b{font-size:13px;color:#6E6E73}.cg-vote .none{color:#AEAEB2;font-weight:600}.cg-vote .ok{display:inline-block;margin-left:6px;font-size:11.5px;font-weight:800;color:#fff;background:#34C759;border-radius:999px;padding:2px 8px;vertical-align:1px}'
          + '.cg-vote .vb button.cf{border-color:#34C759;color:#1E8E3E}.cg-vote .vb button.cf.on{background:#34C759;border-color:#34C759;color:#fff}.cg-vote .pm.okd{box-shadow:inset 0 0 0 2px #34C759;background:#F0FBF3}'
          + '.cg-vote .pm .iq{font-size:15px;font-weight:700;white-space:pre-wrap}.cg-vote .pm .iw{grid-column:1;font-size:13.5px;color:#6E6E73;line-height:1.5;white-space:pre-wrap}'
          + '.cg-vote .vb{grid-row:1/span 3;grid-column:2;display:flex;flex-direction:column;align-items:center;gap:4px}.cg-vote .vb b{font-size:13px;color:#0071E3}'
          + '.cg-vote .vb button{height:32px;min-width:64px;border-radius:999px;border:1px solid #D2D2D7;background:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer}'
          + '.cg-vote .vb button:disabled{opacity:.35;cursor:default}.cg-vote>.st{text-align:center;font-size:13px;font-weight:700;color:#6E6E73;padding:4px 0}.cg-vote .vb button.on{background:#0071E3;border-color:#0071E3;color:#fff}.cg-vote .pm.top{box-shadow:inset 0 0 0 2px #0071E3}';
        document.head.appendChild(st);
      }
      el.addEventListener('click', function (e) {
        var cf = e.target.closest('[data-confirm]'); if (cf) { confirmIssue(+cf.dataset.confirm); return; }
        var bt = e.target.closest('[data-vote]'); if (!bt || !canAct() || submitted()) return;
        var v = +bt.dataset.vote; VOTE[c.key] = myVote(c.key) === v ? null : v; queueWork(); renderVote(c, members(ME.group_no));
      });
    }
    var lk = !!GL[ME.group_no], act = canAct() && !submitted();
    var W = ms.map(function (m) { return { m: m, w: isMe(m) ? myWork() : (m.work || {}) }; });
    var cnt = {}; W.forEach(function (x) { var v = x.w[c.key]; if (v) cnt[v] = (cnt[v] || 0) + 1; });
    var mx = Math.max.apply(null, [0].concat(Object.keys(cnt).map(function (k) { return cnt[k]; })));
    var okId = c.key === 'vote' ? +((GS[ME.group_no] || {}).issueOK || 0) : 0, chief = act && c.key === 'vote' && effRole() === '조장';
    var nd = c.key === 'vote' ? issueNeed(ms) : null;
    el.innerHTML = W.map(function (x) {
      var m = x.m, id = +m.student_id, n = cnt[id] || 0, mine = myVote(c.key) === id, A = x.w[c.a], B = c.b ? x.w[c.b] : '', ok = okId && okId === id;
      if (c.key === 'vote') B = [x.w.isc, (x.w.iva || x.w.ivb) && ('충돌하는 가치: ' + (x.w.iva || '') + ' vs ' + (x.w.ivb || '')), x.w.isw && ('제안 이유: ' + x.w.isw)].filter(Boolean).join('\n');
      return '<div class="pm' + (ok ? ' okd' : (!okId && mx && n === mx ? ' top' : '')) + '"><b>' + (lk && m.role ? esc(m.role) + ' | ' : '') + esc(m.name) + (ok ? '<span class="ok">확정</span>' : '') + '</b>'
        + '<span class="vb"><b>' + n + '표</b>' + (act && A ? '<button type="button" data-vote="' + id + '" class="' + (mine ? 'on' : '') + '">' + (mine ? '투표함' : '투표') + '</button>' : '')
        + (chief && A ? '<button type="button" class="cf' + (ok ? ' on' : '') + '" data-confirm="' + id + '"' + (ok || (nd.ready && n === nd.mx) ? '' : ' disabled') + '>' + (ok ? '확정 취소' : '확정') + '</button>' : '') + '</span>'
        + '<span class="iq">' + (A ? esc(A) : '<span class="none">아직 안 씀</span>') + '</span>'
        + (B ? '<span class="iw">' + esc(B) + '</span>' : '') + '</div>';
    }).join('') + (nd && !okId ? '<div class="st">제안 ' + nd.p + '/' + nd.n + ' · 투표 ' + nd.v + '/' + nd.n + '</div>' : '');
  }
  function queueWork() { if (!canAct() || !ME || submitted()) return; clearTimeout(WORKT); WORKT = setTimeout(saveWork, 1500); }
  function saveWork() {
    if (!ME || submitted()) return;
    var w = myWork(); ME.work = w;
    if (MODE === 'preview') { PV.work = w; render(); return; }
    sb().from('campaign_members').update({ work: w, updated_at: new Date().toISOString() }).eq('worksheet_id', ID.worksheetId).eq('student_id', sid())
      .then(function (r) { if (r && !r.error) { ping(); render(); } });
  }
  document.addEventListener('input', function (ev) { var t = ev.target; if (!ev.isTrusted || !t || !t.id) return; if (/^myIssue|^myVal|^solIdea|^causeIdea/.test(t.id)) { propPaint(); return; } if (/^my[12]/.test(t.id) || (t.closest && t.closest('[data-role-only]'))) { queueWork(); if (/^my[12]/.test(t.id) && ME) renderPool(members(ME.group_no)); } });
  // 내 자료가 조원 자료(또는 내 A·B끼리)와 같은 출처인지 — 띄어쓰기·문장부호·대소문자 무시, 주소면 주소끼리 비교
  function srcKey(t) { t = String(t || '').trim().toLowerCase(); var u = t.match(/https?:\/\/[^\s]+/); if (u) return u[0].replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, ''); return t.replace(/[\s·.,'"‘’“”()\[\]\-_/:<>]/g, ''); }
  function dupOf(k) {
    if (!ME) return ''; var mine = srcKey(val('my' + k + 'src')); if (mine.length < 4) return '';
    if (srcKey(val('my' + (3 - k) + 'src')) === mine) return '내 자료 ' + (k === 1 ? 'B' : 'A');
    var hit = members(ME.group_no).filter(function (m) { return !isMe(m) && ((m.work || {}).src || []).some(function (x) { return x && srcKey(x.s) === mine; }); })[0];
    return hit ? hit.name : '';
  }
  function paintDup() {
    [1, 2].forEach(function (k) {
      var e = $('my' + k + 'src'); if (!e) return; var who = dupOf(k), f = e.closest('.f'), fl = f && f.querySelector('.fl');
      e.classList.toggle('miss', !!who);
      var t = fl && fl.querySelector('.cg-dup'); if (!t && fl && who) { t = document.createElement('span'); t.className = 'cg-dup'; t.style.cssText = 'margin-left:6px;font-size:12px;font-weight:700;color:#D70015'; fl.appendChild(t); }
      if (t) t.textContent = who ? '겹침 · ' + who : '';
    });
  }
  // 모둠원이 찾은 자료(모두에게 보임, 자료조사가 취합)
  function renderPool(ms) {
    paintDup();
    var el = $('cgPool'); if (!el || !ME) return;
    var lk = !!GL[ME.group_no];
    // 자료조사는 [근거로]를 누르면 그 자료가 '근거 자료 · 모둠 최종' 빈 칸에 그대로 들어감(다시 안 써도 됨) — 2026-11-21
    var picker = canAct() && !submitted() && effRole() === owner('s1type'), used = {};
    [1, 2, 3].forEach(function (k) { var a = val('s' + k + 'src'), b = val('s' + k + 'sum'); if (a || b) used[a + '|' + b] = k; });
    POOL = [];
    el.innerHTML = ms.map(function (m) {
      var w = isMe(m) ? myWork() : (m.work || {}), src = (w.src || []).filter(function (x) { return x && (x.t || x.s || x.m); }), n = +w.srcN || 0;
      return '<div class="pm"><b>' + (lk && m.role ? esc(m.role) + ' | ' : '') + esc(m.name) + '</b>' + (n < 2 ? '<span class="none">' + n + '/2</span>' : '')
        + src.map(function (x) {
          var k = POOL.push(x) - 1, at = used[(x.n ? x.n + ' ' : '') + (x.s || '') + '|' + (x.m || '')] || used[(x.s || '') + '|' + (x.m || '')];
          var rv = ((GS[ME.group_no] || {}).rev || {})[m.student_id + '_' + ((w.src || []).indexOf(x) + 1)], rvOk = rv && rv.sig === revSig(x);
          return '<div class="ps"><i>' + esc(x.t || '-') + '</i>' + (x.n ? '<b>' + esc(x.n) + '</b> ' : '') + esc(x.s) + (x.m ? '<br>' + esc(x.m) : '') + (rvOk ? '<span class="cg-used" style="' + (rv.s === 'ok' ? 'background:#E8F7EC;color:#1E8E3E' : 'background:#FFF0F0;color:#D70015') + '">' + (rv.s === 'ok' ? '확인' : '보완 요청') + '</span>' : '')
            + (at ? '<span class="cg-used">근거 자료 ' + at + '</span>' : (picker ? '<button type="button" class="cg-pick" data-pick="' + k + '">선택</button>' : '')) + '</div>';
        }).join('') + '</div>';
    }).join('');
    if (!el.__pk) {
      el.__pk = 1;
      var st = document.createElement('style');
      st.textContent = '.cg-pick,.cg-used{display:inline-block;margin-left:8px;height:26px;line-height:24px;padding:0 10px;border-radius:999px;font:inherit;font-size:12px;font-weight:700;vertical-align:middle}'
        + '.cg-pick{border:1px solid #0071E3;background:#fff;color:#0071E3;cursor:pointer}.cg-used{background:#E8F1FD;color:#0071E3}';
      document.head.appendChild(st);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pick]'); if (!b || effRole() !== owner('s1type') || submitted()) return;
        var x = POOL[+b.dataset.pick]; if (!x) return;
        var k = [1, 2, 3].filter(function (i) { return !val('s' + i + 'src') && !val('s' + i + 'sum'); })[0];
        if (!k) { toast('근거 자료 칸 3개가 다 찼어요'); return; }
        [['type', x.t], ['src', (x.n ? x.n + ' ' : '') + (x.s || '')], ['sum', x.m]].forEach(function (p) {
          var f = $('s' + k + p[0]); if (!f) return;
          if (f.type === 'hidden') { f.value = p[1] || ''; var g = shGroup(f.id); if (g) g.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === f.value); }); f.dispatchEvent(new Event('input', { bubbles: true })); }
          else setVal(f, p[1] || '');
        });
        clerkTyped('s' + k + 'src');
        renderPool(members(ME.group_no));
      });
    }
  }

  // (2026-11-22) 자료 검토: 1차시에 자료조사 담당(없으면 조장)이 모둠원 자료마다 기준을 체크해 [확인]·[보완 요청]
  //  - campaign_groups.shared.rev = { '학생id_1': { s:'ok'|'fix', miss:[빠진 기준], sig:자료 내용, by, at } } — 자료를 고치면 sig가 달라져 다시 검토
  //  - 학생 '내 자료' 칸 아래에 결과, 검토 기록은 검토자 학습지 숨은 칸 cgRevLog에 남김(채점용)
  var REV_Y = new Date().getFullYear() - 2;   // 최근 자료 = 올해 포함 3년 안
  var REVOPEN = {};
  var REV_C = ['출처와 날짜', REV_Y + '년 이후 자료', '우리나라 자료', '내용이 자료와 같음', '우리 문제와 관련'], REVCHK = {};
  var REV_FIX = ['링크가 열리는지와 자료에 날짜가 나와 있는지 확인해요.', REV_Y + '년 이후에 나온 자료로 바꿔요.', '우리나라 자료로 바꿔요.', '핵심 내용을 자료에 나온 사실대로 고쳐요.', '우리 모둠 윤리문제와 관련된 자료로 바꿔요.'];
  function revFix(miss) { return (miss || []).map(function (c) { var i = REV_C.indexOf(c); return i > -1 ? REV_FIX[i] : c; }); }
  function revSig(x) { return String((x.t || '') + '|' + (x.n || '') + '|' + (x.s || '') + '|' + (x.m || '')).slice(0, 300); }
  function revOwner() { var lk = locked(); return members(ME.group_no).some(function (m) { return (lk ? m.role : (m.role || m.pref)) === '자료조사'; }) ? '자료조사' : '조장'; }
  function revWho() { return ME && canAct() && !submitted() && effRole() === revOwner(); }
  function revMap() { return (GS[ME.group_no] || {}).rev || {}; }
  function revFixMine() { if (!ME) return ''; var R0 = revMap(), out = ''; [1, 2].forEach(function (k) { var r = R0[sid() + '_' + k], x = (myWork().src || [])[k - 1] || {}; if (!out && r && r.s === 'fix' && r.sig === revSig(x)) out = k === 1 ? 'A' : 'B'; }); return out; }
  function revLeft() {
    if (!revWho() || ME.care === '통합반') return 0;
    var R0 = revMap(), n = 0;
    members(ME.group_no).forEach(function (m) { if (isMe(m)) return; ((m.work || {}).src || []).forEach(function (x, j) { if (!x || !(x.s || x.m)) return; var r = R0[m.student_id + '_' + (j + 1)]; if (!(r && r.sig === revSig(x))) n++; }); });
    return n;
  }
  function revTotal() { var n = 0; members(ME.group_no).forEach(function (m) { if (!isMe(m)) ((m.work || {}).src || []).forEach(function (x) { if (x && (x.s || x.m)) n++; }); }); return n; }
  function renderRev(ms) {
    if (!ME) return;
    var R0 = revMap();
    [1, 2].forEach(function (k) {   // 내 자료 칸 아래 결과
      var sm = $('my' + k + 'sum'); if (!sm) return;
      var host = sm.closest('.box') || sm.parentNode, el = host.querySelector('.cg-rv');
      if (!el) { el = document.createElement('div'); el.className = 'cg-rv'; host.appendChild(el); }
      var mine = (myWork().src || [])[k - 1] || {}, r = R0[sid() + '_' + k];
      var ok = r && r.sig === revSig(mine);
      el.style.cssText = 'margin-top:10px;font-size:13px;font-weight:700;line-height:1.6;white-space:pre-wrap;' + (ok ? (r.s === 'ok' ? 'color:#1E8E3E' : 'color:#D70015') : 'display:none');
      el.textContent = ok ? (r.s === 'ok' ? '자료 검토 · 확인' : '자료 검토 · 보완 요청\n' + revFix(r.miss).join('\n')) : '';
    });
    var anchor = $('my2sum'); anchor = anchor && (anchor.closest('.box') || anchor.parentNode);
    var box = $('cgRev');
    if (!revWho() || !anchor) { if (box) box.hidden = true; return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'cgRev'; anchor.parentNode.insertBefore(box, anchor.nextSibling);
      var st = document.createElement('style');
      st.textContent = '#cgRev{margin-top:18px;display:grid;gap:8px}#cgRev .rh{font-size:15px;font-weight:800}#cgRev .rc{background:#F5F5F7;border-radius:14px;padding:12px 14px;display:grid;gap:8px}'
        + '#cgRev .rc b{font-size:13px;color:#6E6E73}#cgRev .rs{font-size:14px;font-weight:600;white-space:pre-wrap}#cgRev .rk{display:flex;flex-wrap:wrap;gap:6px;align-items:center}'
        + '#cgRev .rk button{height:28px;padding:0 10px;border-radius:999px;border:1px solid #D2D2D7;background:#fff;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}'
        + '#cgRev .rk button.bad{background:#D70015;border-color:#D70015;color:#fff}#cgRev .rk .sp{flex:1}#cgRev .rk .go{border-color:#1D1D1F;background:#1D1D1F;color:#fff}#cgRev .rk .go.ok{border-color:#1E8E3E;background:#1E8E3E}#cgRev .rk .go:disabled{opacity:.35}'
        + '#cgRev .st{font-size:12.5px;font-weight:800}#cgRev .st.ok{color:#1E8E3E}#cgRev .st.fix{color:#D70015}';
      document.head.appendChild(st);
      box.addEventListener('click', function (e) {
        var c = e.target.closest('[data-rc]'); if (c) { var key = c.dataset.rc, i = +c.dataset.i, A = REVCHK[key] = REVCHK[key] || []; A[i] = !A[i]; renderRev(members(ME.group_no)); return; }
        var o = e.target.closest('[data-rok]'); if (o) { revSend(o.dataset.rok, true); return; }
        var q = e.target.closest('[data-rask]'); if (q) { REVOPEN[q.dataset.rask] = !REVOPEN[q.dataset.rask]; REVCHK[q.dataset.rask] = []; renderRev(members(ME.group_no)); return; }
        var g = e.target.closest('[data-rgo]'); if (g) revSend(g.dataset.rgo, false);
      });
    }
    box.hidden = false;
    var cards = [];
    ms.forEach(function (m) {
      if (isMe(m)) return;
      ((m.work || {}).src || []).forEach(function (x, j) {
        if (!x || !(x.s || x.m)) return;
        var key = m.student_id + '_' + (j + 1), r = R0[key], cur = r && r.sig === revSig(x);
        var A = REVCHK[key] || [], open = !!REVOPEN[key], any = REV_C.some(function (c, i) { return A[i]; });
        cards.push('<div class="rc"><b>' + esc(m.name) + ' · 자료 ' + (j === 0 ? 'A' : 'B') + (cur ? ' <span class="st ' + r.s + '">' + (r.s === 'ok' ? '확인함' : '보완 요청함') + '</span>' : '') + '</b>'
          + '<span class="rs">' + esc(x.t || '-') + ' · ' + esc(x.n || '') + '\n' + esc(x.s || '') + (x.m ? '\n' + esc(x.m) : '') + '</span>'
          + (open
            ? '<span class="rk">' + REV_C.map(function (c, i) { return '<button type="button" data-rc="' + key + '" data-i="' + i + '" class="' + (A[i] ? 'bad' : '') + '">' + c + '</button>'; }).join('')
              + '<span class="sp"></span><button type="button" data-rask="' + key + '">취소</button><button type="button" class="go" data-rgo="' + key + '"' + (any ? '' : ' disabled') + '>보내기</button></span>'
            : '<span class="rk"><span class="sp"></span><button type="button" data-rask="' + key + '">보완 요청</button><button type="button" class="go ok" data-rok="' + key + '">확인</button></span>')
          + '</div>');
      });
    });
    var tot = revTotal();
    box.innerHTML = '<div class="rh">자료 검토' + (tot ? ' <span style="font-size:13px;color:' + (revLeft() ? '#D70015' : '#1E8E3E') + '">' + (tot - revLeft()) + '/' + tot + '</span>' : '') + '</div><div style="font-size:13.5px;color:#6E6E73;line-height:1.6">모둠원 자료를 보고 문제가 없으면 확인을 눌러요. 고칠 점이 있으면 보완 요청을 누르고, 맞지 않는 기준을 골라 보내요. 최근 자료는 ' + REV_Y + '년 이후에 나온 자료예요.</div>' + (cards.join('') || '<div class="rc"><span class="rs" style="color:#AEAEB2">모둠원 자료 0개</span></div>');
  }
  function revSend(key, okNow) {
    if (!revWho()) return;
    var g = ME.group_no, p = key.split('_'), m = members(g).filter(function (x) { return String(x.student_id) === p[0]; })[0]; if (!m) return;
    var x = ((m.work || {}).src || [])[+p[1] - 1]; if (!x) return;
    var A = REVCHK[key] || [], miss = okNow ? [] : REV_C.filter(function (c, i) { return A[i]; });
    if (!okNow && !miss.length) return;
    REVOPEN[key] = false; REVCHK[key] = [];
    var rev = Object.assign({}, revMap()); rev[key] = { s: miss.length ? 'fix' : 'ok', miss: miss, sig: revSig(x), by: ID.student.name || '', at: Date.now() };
    GS[g] = Object.assign({}, GS[g] || {}, { rev: rev });
    var lg = $('cgRevLog');
    if (lg) { lg.value = Object.keys(rev).map(function (k2) { var q = k2.split('_'), mm = members(g).filter(function (y) { return String(y.student_id) === q[0]; })[0], r = rev[k2]; return (mm ? mm.name : q[0]) + ' 자료' + (q[1] === '1' ? 'A' : 'B') + ': ' + (r.s === 'ok' ? '확인' : '보완 요청(' + r.miss.join(', ') + ')'); }).join('\n'); try { lg.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
    toast(miss.length ? '보완 요청을 보냈어요' : '확인했어요');
    renderRev(members(g));
    if (MODE === 'preview') { PV.shared = Object.assign({}, PV.shared || {}, { rev: rev }); return; }
    sb().rpc('campaign_shared_merge', { p_ws: ID.worksheetId, p_cls: cls(), p_g: g, p_patch: { rev: rev } }).then(function (r) { if (r && r.error) toast('저장하지 못했어요'); else ping(); });
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
  // (2026-11-22) 역할 추첨 없앰: 모둠원이 희망 역할을 서로 겹치지 않게 고른 뒤 모둠 표 아래 [역할 확정]
  function confirmUI(lk, can) {
    var tb = document.querySelector('.rows.team'); if (!tb) return;
    var w = $('cgConfirmW');
    if (!w) {
      w = document.createElement('div'); w.id = 'cgConfirmW'; w.style.cssText = 'display:flex;justify-content:flex-end;margin-top:12px';
      w.innerHTML = '<button type="button" class="cg-b pri" id="cgConfirm">역할 확정</button>';
      tb.parentNode.insertBefore(w, tb.nextSibling);
      $('cgConfirm').onclick = confirmRoles;
    }
    w.hidden = !ME || lk || !can;
  }
  function confirmRoles() {
    if (!ME || locked() || BUSY) return;
    LASTSIG = '';
    if (MODE === 'preview') { PV.role = PV.pref; PV.lock = true; refresh(); return; }
    BUSY = true;
    sb().rpc('campaign_confirm_roles', { p_ws: ID.worksheetId, p_cls: cls(), p_g: ME.group_no }).then(function (r) {
      var c = r && !r.error ? r.data : 'err';
      var M = { ok: '역할이 확정됐어요', not_all: '모두 희망 역할을 골라야 해요', dup: '겹치는 역할이 있어요', need_lc: '조장과 서기가 있어야 해요', need_two: '조원이 2명 이상이어야 해요', locked: '이미 확정됐어요', err: '저장하지 못했어요. 다시 해 보세요' };
      toast(M[c] || M.err); if (c === 'ok') ping();
    }).then(function () { BUSY = false; return refresh(); }, function () { BUSY = false; toast('저장하지 못했어요. 다시 해 보세요'); });
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
  function rename(v) {
    NAMET = null;
    if (effRole() !== '조장' || submitted()) return;
    v = String(v || '').trim().slice(0, 20);
    if (v === gname(ME.group_no)) return;
    if (MODE === 'preview') { PV.name = v; refresh(); return; }
    act(sb().from('campaign_groups').upsert({ worksheet_id: ID.worksheetId, class_name: cls(), group_no: ME.group_no, name: v, updated_at: new Date().toISOString() }, { onConflict: 'worksheet_id,class_name,group_no' }), null, true);
  }
})();
