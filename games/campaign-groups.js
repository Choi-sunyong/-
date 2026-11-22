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
  var SH_FIELDS = ['scope', 'place', 'issue', 'situation',
    's1type', 's1src', 's1sum', 's2type', 's2src', 's2sum', 's3type', 's3src', 's3sum', 'cause',
    'a1who', 'a1how', 'a1eff', 'a2who', 'a2how', 'a2eff',
    'format', 'formatEtc', 'slogan', 'audience', 'message', 'action', 'sb1', 'sb2', 'sb3', 'sb4', 'product'];
  var POOL = [];
  var sbc = null, ID = null, ME = null, ROWS = [], GN = {}, GS = {}, GL = {}, MODE = 'off', BUSY = false, LASTSIG = '', LEAVE = false;
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
  });
  function tick() {
    clearTimeout(TIMER);
    if (MODE === 'off' || MODE === 'done' || submitted()) { unsub(); return; }
    TIMER = setTimeout(function () { if (!document.hidden && !BUSY) (ME && MODE === 'live' ? loadGroup().then(render) : refresh()).then(tick); else tick(); }, ME ? 30000 : 15000 + Math.random() * 3000);
  }

  function refresh() { return load().then(render); }
  // (2026-11-22) 서버 부담 줄이기: 조원이 저장했다는 신호(ref)는 2초쯤 모았다가, 반 전체가 아니라 우리 조 줄만 다시 불러옴(3초에 한 번까지). 반 전체는 30초 타이머로.
  var REFT = null, REFLAST = 0;
  function refSoon() { clearTimeout(REFT); var wait = Math.max(2000, 3000 - (Date.now() - REFLAST)); REFT = setTimeout(function () { if (BUSY || document.hidden) { refSoon(); return; } REFLAST = Date.now(); loadGroup().then(render); }, wait); }
  function loadGroup() {
    if (!ME || MODE !== 'live') return load();
    var c = cls(), w = ID.worksheetId, g = ME.group_no;
    return Promise.all([
      sb().from('campaign_members').select('student_id,group_no,name,role,pref,number,by_teacher,work,care').eq('worksheet_id', w).eq('class_name', c).eq('group_no', g),
      sb().from('campaign_groups').select('group_no,name,shared,locked').eq('worksheet_id', w).eq('class_name', c).eq('group_no', g)
    ]).then(function (res) {
      if (!res[0].error) { var mine = res[0].data || []; if (!mine.some(isMe)) return load(); ROWS = ROWS.filter(function (r) { return r.group_no !== g; }).concat(mine); }
      if (!res[1].error) (res[1].data || []).forEach(function (x) { GN[x.group_no] = x.name || ''; GS[x.group_no] = x.shared || {}; GL[x.group_no] = !!x.locked; });
      ME = ROWS.filter(isMe)[0] || null;
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
          ROWS.push({ student_id: sid(), group_no: PV.g, name: ID.student.name || '', pref: PV.pref, role: PV.role, number: ID.student.number, work: PV.work || (real && real.work) || {} });
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
      .on('broadcast', { event: 'sh' }, function (m) { var o = m.payload && m.payload.o; if (!o || !ME || typeof o !== 'object') return; var er0 = effRole(); o = Object.keys(o).reduce(function (a, k) { if (SH_FIELDS.indexOf(k) > -1 && owner(k) !== er0) a[k] = String(o[k] == null ? '' : o[k]).slice(0, 3000); return a; }, {}); GS[ME.group_no] = Object.assign({}, GS[ME.group_no] || {}, o); sharedFields(ME.group_no, effRole()); })
      .on('broadcast', { event: 'ref' }, function () { refSoon(); })
      .subscribe(function (st) { if (st === 'SUBSCRIBED') ping(); });   // 새로 들어오면 조원 화면도 다시 읽게
  }
  function ping() { if (CH && MODE === 'live') try { CH.send({ type: 'broadcast', event: 'ref', payload: {} }); } catch (e) {} }

  function render() {
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
    var chosen = ms0.filter(function (m) { return m.pref; }).length;
    var t = '<div class="cg-in"><span class="no">' + g0 + '조</span><span class="gn">' + esc(gname(g0)) + '</span><div class="cg-mem">'
      + ms0.map(function (m) { return '<span class="' + (isMe(m) ? 'me' : '') + '">' + esc(m.name) + (lk ? (m.role ? '<small>' + esc(m.role) + '</small>' : '') : (m.pref ? '<small class="pf">' + esc(m.pref) + '</small>' : '')) + progTag(m, lk) + '</span>'; }).join('') + '</div>';
    if (act && !lk) t += '<span class="cg-st">희망 ' + chosen + '/' + ms0.length + '</span><button type="button" class="cg-b pri" id="cgDraw"' + (chosen === ms0.length && (ms0.length >= 2 || MODE === 'preview') ? '' : ' disabled') + '>역할 추첨</button>';
    if (lk) t += '<span class="cg-st">역할 확정</span>';
    if (act && !lk && !ME.by_teacher) t += '<button type="button" class="cg-b' + (LEAVE ? ' warn' : '') + '" id="cgOut">' + (LEAVE ? '한 번 더 누르면 조 옮기기' : '조 옮기기') + '</button>';
    box.innerHTML = t + '</div>';
    if ($('cgOut')) $('cgOut').onclick = function () { if (!LEAVE) { LEAVE = true; render(); setTimeout(function () { if (LEAVE) { LEAVE = false; render(); } }, 4000); return; } LEAVE = false; leave(); };
    if ($('cgDraw')) $('cgDraw').onclick = draw;
    apply(); height();
    if (act && JSON.stringify(myWork()) !== JSON.stringify(ME.work || {})) queueWork();   // 불러온 답과 올려 둔 진행 상황이 다르면 맞춤
  }
  function progTag(m, lk) {
    var w = isMe(m) ? myWork() : (m.work || {}), n = +w.srcN || 0;
    return '<small class="' + (n >= 2 ? '' : 'pf') + '">자료 ' + n + '/2' + (lk ? ' · 결과물 ' + (w.role ? '✓' : '…') : '') + '</small>';
  }

  // 학습지 칸 채우기 — 바뀌었을 때만 입력 이벤트를 보내 학습지가 다시 계산·임시 저장하게 함
  function apply() {
    if (!canAct() || !ME || submitted()) return;
    var g0 = ME.group_no, ms = members(g0).slice(0, SHOWMAX), lk = !!GL[g0], myRole = lk ? (ME.role || '') : '';
    var er = effRole();
    nameField(g0, er === '조장');
    sharedFields(g0, er); renderPool(ms); renderIssues(ms);
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
      if (mine) { if (!SHT && document.activeElement !== e && !e.value && v) setVal(e, v); return; }   // 내가 맡은 칸은 쓰는 중인 내용을 덮어쓰지 않음
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
    var now = Date.now(), gap = 400;   // 0.4초에 한 번씩 조원 화면으로 보냄
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
    var w = document.querySelector('[data-role-only="' + r + '"]'); if (!w) return false;
    var ok = true; w.querySelectorAll('[data-req]').forEach(function (e) { var v = String(e.value || '').trim(); if (!v || v.length < (+e.dataset.min || 0)) ok = false; });
    return ok;
  }
  // (2026-11-22) 윤리문제·해결방안 제안은 [제안하기]를 눌렀을 때만 조원에게 올라감(쓰는 중에는 서버에 안 보냄)
  var PSUB = null;
  function psub() {
    if (PSUB) return PSUB;
    if (!ME) return { iss: '', isw: '', isc: '', sol: '' };
    var w = ME.work || {}; PSUB = { iss: w.iss || '', isw: w.isw || '', isc: w.isc || '', sol: w.sol || '' }; return PSUB;
  }
  var PROPS = [
    { id: 'cgPropIss', at: 'myIssueWhy', keys: { iss: 'myIssue', isw: 'myIssueWhy', isc: 'myScope' }, ok: function () { return val('myIssue') && val('myScope') && val('myIssueWhy').length >= 50; } },
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
      b.textContent = same && had ? '제안함' : had ? '다시 제안하기' : '제안하기';
    });
  }
  function propSend(c) {
    if (!ME || !canAct() || submitted()) return;
    if (!c.ok()) { toast('빈칸을 채워 주세요'); return; }
    var p = psub(); Object.keys(c.keys).forEach(function (k) { p[k] = val(c.keys[k]); });
    clearTimeout(WORKT); saveWork(); renderIssues(members(ME.group_no));
  }
  function myWork() {
    var src = [1, 2].map(function (k) { return { t: val('my' + k + 'type'), s: val('my' + k + 'src'), m: val('my' + k + 'sum') }; });
    var p = psub();
    return { src: src, srcN: src.filter(function (x) { return x.t && x.s && x.m.length >= 30; }).length, role: roleDone(),
      iss: p.iss, isw: p.isw, isc: p.isc, ipl: '', isi: '', vote: myVote('vote'), sol: p.sol, svote: myVote('svote') };
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
  function confirmIssue(id) {
    if (!ME || !canAct() || submitted() || effRole() !== '조장') return;
    var g = ME.group_no, cur = +((GS[g] || {}).issueOK || 0), next = cur === id ? null : id;
    var w = next ? (members(g).filter(function (m) { return +m.student_id === next; }).map(function (m) { return isMe(m) ? myWork() : (m.work || {}); })[0] || {}) : {};
    var patch = { issueOK: next };
    // 확정한 제안의 문제·범위·장소·실제 모습을 '우리 사회의 윤리문제' 공동 칸에 채움(서기가 이미 쓴 칸은 그대로)
    if (next) [['issue', w.iss], ['scope', w.isc], ['place', w.ipl], ['situation', w.isi]].forEach(function (p) { if (p[1] && !String((GS[g] || {})[p[0]] || '').trim()) patch[p[0]] = p[1]; });
    GS[g] = Object.assign({}, GS[g] || {}, patch);
    if (MODE === 'preview') { PV.shared = Object.assign({}, PV.shared || {}, patch); render(); return; }
    sb().rpc('campaign_shared_merge', { p_ws: ID.worksheetId, p_cls: cls(), p_g: g, p_patch: patch })
      .then(function (r) { if (r && r.error) toast('저장하지 못했어요'); else { ping(); render(); } });
    render();
  }
  // 범위 칩(myScope)·자료 유형 칩(my1type·my2type)은 입력 이벤트가 없어서 눌렀을 때 따로 반영
  document.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('.chips[data-for="myScope"] .chip, .chips[data-for="my1type"] .chip, .chips[data-for="my2type"] .chip'); if (c && ME) setTimeout(function () { if (c.closest('[data-for="myScope"]')) { propPaint(); return; } queueWork(); renderPool(members(ME.group_no)); }, 0); });
  // 제출할 때도 조원과 같은 자료면 막음(학습지의 제출 버튼보다 먼저 받음)
  (function () { var sb0 = document.getElementById('wsSend'); if (sb0) sb0.addEventListener('click', function (e) { if (!ME || !canAct() || submitted()) return; if (dupOf(1) || dupOf(2)) { e.stopImmediatePropagation(); e.preventDefault(); paintDup(); toast('조원과 겹치는 자료가 있어요'); try { $('my1src').scrollIntoView({ block: 'center' }); } catch (x) {} } }, true); })();
  // 학습지 쪽 넘기기(games/ws-pages.js): 윤리문제 제안 쪽은 조장이 확정해야 다음으로
  window.wsPageGate = function (i, els) {
    if (!ME || MODE !== 'live' || submitted()) return '';   // 미리보기에서는 막지 않고 모든 쪽을 넘겨 볼 수 있게
    var has = els.some(function (el) { return el.contains && el.contains($('myIssue')); });
    if (has && !(GS[ME.group_no] || {}).issueOK) return '조장이 윤리문제를 확정하기 전';
    var hasSrc = els.some(function (el) { return el.contains && el.contains($('my1src')); });
    if (hasSrc && (dupOf(1) || dupOf(2))) return '조원과 겹치는 자료가 있어요';
    return '';
  };
  function renderIssues(ms) { VOTES.forEach(function (c) { renderVote(c, ms); }); propPaint(); }
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
          + '.cg-vote .vb button.on{background:#0071E3;border-color:#0071E3;color:#fff}.cg-vote .pm.top{box-shadow:inset 0 0 0 2px #0071E3}';
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
    el.innerHTML = W.map(function (x) {
      var m = x.m, id = +m.student_id, n = cnt[id] || 0, mine = myVote(c.key) === id, A = x.w[c.a], B = c.b ? x.w[c.b] : '', ok = okId && okId === id;
      if (c.key === 'vote') B = [[x.w.isc, x.w.ipl].filter(Boolean).join(' · '), x.w.isi, x.w.isw && ('제안 이유: ' + x.w.isw)].filter(Boolean).join('\n');
      return '<div class="pm' + (ok ? ' okd' : (!okId && mx && n === mx ? ' top' : '')) + '"><b>' + (lk && m.role ? esc(m.role) + ' | ' : '') + esc(m.name) + (ok ? '<span class="ok">확정</span>' : '') + '</b>'
        + '<span class="vb"><b>' + n + '표</b>' + (act && A ? '<button type="button" data-vote="' + id + '" class="' + (mine ? 'on' : '') + '">' + (mine ? '투표함' : '투표') + '</button>' : '')
        + (chief && A ? '<button type="button" class="cf' + (ok ? ' on' : '') + '" data-confirm="' + id + '">' + (ok ? '확정 취소' : '확정') + '</button>' : '') + '</span>'
        + '<span class="iq">' + (A ? esc(A) : '<span class="none">아직 안 씀</span>') + '</span>'
        + (B ? '<span class="iw">' + esc(B) + '</span>' : '') + '</div>';
    }).join('');
  }
  function queueWork() { if (!canAct() || !ME || submitted()) return; clearTimeout(WORKT); WORKT = setTimeout(saveWork, 1500); }
  function saveWork() {
    if (!ME || submitted()) return;
    var w = myWork(); ME.work = w;
    if (MODE === 'preview') { PV.work = w; render(); return; }
    sb().from('campaign_members').update({ work: w, updated_at: new Date().toISOString() }).eq('worksheet_id', ID.worksheetId).eq('student_id', sid())
      .then(function (r) { if (r && !r.error) { ping(); render(); } });
  }
  document.addEventListener('input', function (ev) { var t = ev.target; if (!ev.isTrusted || !t || !t.id) return; if (/^myIssue|^solIdea/.test(t.id)) { propPaint(); return; } if (/^my[12]/.test(t.id) || (t.closest && t.closest('[data-role-only]'))) { queueWork(); if (/^my[12]/.test(t.id) && ME) renderPool(members(ME.group_no)); } });
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
    var picker = canAct() && !submitted() && effRole() === '자료조사', used = {};
    [1, 2, 3].forEach(function (k) { var a = val('s' + k + 'src'), b = val('s' + k + 'sum'); if (a || b) used[a + '|' + b] = k; });
    POOL = [];
    el.innerHTML = ms.map(function (m) {
      var w = isMe(m) ? myWork() : (m.work || {}), src = (w.src || []).filter(function (x) { return x && (x.t || x.s || x.m); }), n = +w.srcN || 0;
      return '<div class="pm"><b>' + (lk && m.role ? esc(m.role) + ' | ' : '') + esc(m.name) + '</b>' + (n < 2 ? '<span class="none">' + n + '/2</span>' : '')
        + src.map(function (x) {
          var k = POOL.push(x) - 1, at = used[(x.s || '') + '|' + (x.m || '')];
          return '<div class="ps"><i>' + esc(x.t || '-') + '</i>' + esc(x.s) + (x.m ? '<br>' + esc(x.m) : '')
            + (at ? '<span class="cg-used">자료 ' + at + '</span>' : (picker ? '<button type="button" class="cg-pick" data-pick="' + k + '">근거로</button>' : '')) + '</div>';
        }).join('') + '</div>';
    }).join('');
    if (!el.__pk) {
      el.__pk = 1;
      var st = document.createElement('style');
      st.textContent = '.cg-pick,.cg-used{display:inline-block;margin-left:8px;height:26px;line-height:24px;padding:0 10px;border-radius:999px;font:inherit;font-size:12px;font-weight:700;vertical-align:middle}'
        + '.cg-pick{border:1px solid #0071E3;background:#fff;color:#0071E3;cursor:pointer}.cg-used{background:#E8F1FD;color:#0071E3}';
      document.head.appendChild(st);
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pick]'); if (!b || effRole() !== '자료조사' || submitted()) return;
        var x = POOL[+b.dataset.pick]; if (!x) return;
        var k = [1, 2, 3].filter(function (i) { return !val('s' + i + 'src') && !val('s' + i + 'sum'); })[0];
        if (!k) { toast('근거 자료 칸 3개가 다 찼어요'); return; }
        [['type', x.t], ['src', x.s], ['sum', x.m]].forEach(function (p) {
          var f = $('s' + k + p[0]); if (!f) return;
          if (f.type === 'hidden') { f.value = p[1] || ''; var g = shGroup(f.id); if (g) g.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === f.value); }); f.dispatchEvent(new Event('input', { bubbles: true })); }
          else setVal(f, p[1] || '');
        });
        clerkTyped('s' + k + 'src');
        renderPool(members(ME.group_no));
      });
    }
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
