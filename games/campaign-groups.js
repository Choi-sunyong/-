/* 3차 수행평가(윤리문제 알림 캠페인) 조 폴더 — 2026-11-12
   학습지(worksheets id 32, data-ws-grade="campaign3") 맨 끝에서 <script src="/games/campaign-groups.js"> 로 불러옴.
   - 학생: 반별 조 폴더(1~8조) 중 하나를 골라 들어감 → 그 안에서 역할(조장·서기·자료조사·제작·발표)을 하나씩 고름(조 안에서 중복 불가, DB 고유 인덱스)
   - 조장은 모둠 이름을 바꿀 수 있음
   - 폴더 정보는 학습지의 모둠 이름·모둠원 표·나의 역할 칸에 자동으로 채워지고(직접 수정 불가) 학습지 임시 저장에 같이 남음
   - 저장: campaign_members(학생별 조·역할), campaign_groups(조 이름). 8초마다만 새로 읽음
   - 선생님 화면(teacherView)·미리보기·제출 완료 후에는 아무것도 바꾸지 않음 */
(function () {
  if (window.__cgOn) return; window.__cgOn = 1;
  var SB_URL = 'https://uxycuvpzsyfvsbwnrexv.supabase.co', SB_KEY = 'sb_publishable_1aMfdIKdr6sUwI0vshYKXw_e9qVrPJj';
  var ROLES = ['조장', '서기', '자료조사', '제작', '발표'], NG = 8, MAX = 5;
  var sbc = null, ID = null, ME = null, ROWS = [], GN = {}, MODE = 'off', BUSY = false, LASTSIG = '', LEAVE = false;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var css = document.createElement('style');
  css.textContent = [
    '.cg-out .ws>:not(.hero):not(#cgBox){display:none!important}.cg-out .ws-bar{display:none!important}',
    '#cgBox{margin:0 0 20px}',
    '.cg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}',
    '.cg-f{position:relative;background:var(--card);border:0;border-radius:6px 18px 18px 18px;padding:26px 16px 16px;text-align:left;font:inherit;color:var(--ink);cursor:pointer;min-height:132px;transition:transform .15s,box-shadow .15s}',
    '.cg-f:before{content:"";position:absolute;left:0;top:-10px;width:44%;height:14px;background:var(--card);border-radius:8px 12px 0 0}',
    '.cg-f:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.07)}',
    '.cg-f:disabled{cursor:default;opacity:.5;transform:none;box-shadow:none}',
    '.cg-f .no{display:block;font-size:13px;font-weight:700;color:var(--blue)}',
    '.cg-f .nm{display:block;font-size:17px;font-weight:700;letter-spacing:-.02em;margin:2px 0 10px;min-height:22px}',
    '.cg-f .mb{display:block;font-size:12.5px;color:var(--sub);line-height:1.6}',
    '.cg-f .ct{position:absolute;right:14px;top:14px;font-size:12px;font-weight:700;color:var(--faint)}',
    '.cg-in{background:var(--card);border-radius:6px 20px 20px 20px;padding:24px;position:relative;margin-top:12px}',
    '.cg-in:before{content:"";position:absolute;left:0;top:-12px;width:30%;height:16px;background:var(--card);border-radius:8px 14px 0 0}',
    '.cg-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 16px}',
    '.cg-top .no{font-size:13px;font-weight:700;color:#fff;background:var(--blue);border-radius:999px;padding:5px 12px}',
    '.cg-top h2{font-size:24px;font-weight:700;letter-spacing:-.025em;margin:0;flex:1;min-width:120px}',
    '.cg-top input{flex:1;min-width:140px;font:inherit;font-size:20px;font-weight:700;border:1px solid var(--line);border-radius:12px;padding:8px 12px;background:#fff}',
    '.cg-b{font:inherit;font-size:14px;font-weight:600;border:0;border-radius:999px;padding:9px 16px;background:var(--field);color:var(--ink);cursor:pointer}',
    '.cg-b.pri{background:var(--blue);color:#fff}.cg-b.warn{background:#fff0f0;color:var(--red)}',
    '.cg-mem{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 0 18px}',
    '.cg-mem div{background:var(--field);border-radius:12px;padding:10px 12px;font-size:14px;font-weight:600}',
    '.cg-mem div.me{background:var(--blueSoft)}',
    '.cg-mem small{display:block;font-size:12px;font-weight:600;color:var(--faint);margin-bottom:2px}',
    '.cg-mem small.r{color:var(--blue)}',
    '.cg-rl{display:flex;flex-wrap:wrap;gap:8px}',
    '.cg-rl button{font:inherit;font-size:14px;font-weight:600;padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer}',
    '.cg-rl button.on{background:var(--ink);border-color:var(--ink);color:#fff}',
    '.cg-rl button:disabled{cursor:default;opacity:.45}',
    '.cg-rl button small{font-weight:500;margin-left:4px;color:var(--faint)}',
    '.cg-lb{font-size:14px;font-weight:600;margin:0 0 8px}',
    '.cg-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 18px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999}',
    '@media (max-width:640px){.cg-grid{grid-template-columns:1fr 1fr}.cg-mem{grid-template-columns:1fr 1fr}.cg-in{padding:20px}}'
  ].join('\n');
  document.head.appendChild(css);

  var box = document.createElement('section'); box.id = 'cgBox'; box.hidden = true;
  var hero = document.querySelector('.ws .hero');
  if (hero) hero.parentNode.insertBefore(box, hero.nextSibling); else document.body.insertBefore(box, document.body.firstChild);

  function toast(t) { var d = document.createElement('div'); d.className = 'cg-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }
  function height() { try { if (window.parent !== window) window.parent.postMessage({ type: 'sittdartha_ws_height', height: Math.ceil(document.body.getBoundingClientRect().height) }, '*'); } catch (e) {} }
  function sb() { if (!sbc && window.supabase) sbc = window.supabase.createClient(SB_URL, SB_KEY); return sbc; }
  function loadLib(cb) { if (window.supabase) return cb(); var s = document.createElement('script'); s.src = 'https://unpkg.com/@supabase/supabase-js@2'; s.onload = cb; s.onerror = function () { box.hidden = false; box.innerHTML = '<div class="cg-in"><p class="cg-lb">조 정보를 불러오지 못했어요. 새로고침해 주세요.</p></div>'; height(); }; document.head.appendChild(s); }
  function cls() { return String((ID.student && ID.student.class) || '').trim(); }
  function sid() { return ID.student && ID.student.id; }
  function members(g) { return ROWS.filter(function (r) { return r.group_no === g; }).sort(function (a, b) { var x = a.role ? ROLES.indexOf(a.role) : 9, y = b.role ? ROLES.indexOf(b.role) : 9; return x - y || String(a.name).localeCompare(String(b.name)); }); }
  function gname(g) { return GN[g] || ''; }

  window.addEventListener('message', function (ev) {
    var d = ev.data || {};
    if (d.type !== 'sittdartha_identity' || MODE !== 'off') return;
    ID = d;
    if (d.teacherView || d.preview || !d.teacherId || !d.worksheetId || sid() == null) return;
    MODE = d.readonly ? 'done' : 'live';
    if (MODE === 'live') document.body.classList.add('cg-out');
    box.hidden = false; box.innerHTML = '<div class="cg-in"><p class="cg-lb">불러오는 중…</p></div>'; height();
    loadLib(function () {
      load().then(render);
      setInterval(function () { if (document.hidden || BUSY) return; load().then(render); }, 8000 + Math.random() * 2000);
    });
  });

  function load() {
    var c = cls(), w = ID.worksheetId;
    return Promise.all([
      sb().from('campaign_members').select('student_id,group_no,name,role').eq('worksheet_id', w).eq('class_name', c),
      sb().from('campaign_groups').select('group_no,name').eq('worksheet_id', w).eq('class_name', c)
    ]).then(function (res) {
      if (!res[0].error) ROWS = res[0].data || [];
      if (!res[1].error) { GN = {}; (res[1].data || []).forEach(function (g) { GN[g.group_no] = g.name || ''; }); }
      ME = ROWS.filter(function (r) { return String(r.student_id) === String(sid()); })[0] || null;
    }).catch(function () {});
  }

  function render() {
    if (MODE === 'off') return;
    var ae = document.activeElement; if (ae && ae.id === 'cgName') { apply(); return; }   // 이름 고치는 중엔 화면을 다시 그리지 않음
    if (!ME) {
      document.body.classList.toggle('cg-out', MODE === 'live');
      if (MODE === 'done') { box.hidden = true; height(); return; }
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
    var g0 = ME.group_no, ms0 = members(g0), lead = ME.role === '조장', live = MODE === 'live';
    var taken = {}; ms0.forEach(function (m) { if (m.role) taken[m.role] = m; });
    var t = '<div class="cg-in"><div class="cg-top"><span class="no">' + g0 + '조</span>';
    t += lead && live ? '<input id="cgName" maxlength="20" placeholder="모둠 이름" value="' + esc(gname(g0)) + '"><button type="button" class="cg-b pri" id="cgSave">이름 저장</button>'
      : '<h2>' + (esc(gname(g0)) || '&nbsp;') + '</h2>';
    if (live) t += '<button type="button" class="cg-b' + (LEAVE ? ' warn' : '') + '" id="cgOut">' + (LEAVE ? '한 번 더 누르면 나가기' : '조 목록') + '</button>';
    t += '</div><div class="cg-mem">' + ms0.map(function (m) { return '<div class="' + (m === ME ? 'me' : '') + '"><small class="' + (m.role ? 'r' : '') + '">' + esc(m.role || '역할 없음') + '</small>' + esc(m.name) + '</div>'; }).join('') + '</div>';
    if (live) {
      t += '<p class="cg-lb">나의 역할</p><div class="cg-rl">' + ROLES.map(function (r) {
        var o = taken[r], mine = o && o === ME;
        return '<button type="button" data-r="' + r + '" class="' + (mine ? 'on' : '') + '"' + (o && !mine ? ' disabled' : '') + '>' + r + (o && !mine ? '<small>' + esc(o.name) + '</small>' : '') + '</button>';
      }).join('') + '</div>';
    }
    box.innerHTML = t + '</div>';
    if (live) {
      box.querySelectorAll('.cg-rl button').forEach(function (b) { b.onclick = function () { setRole(b.dataset.r); }; });
      $('cgOut').onclick = function () { if (!LEAVE) { LEAVE = true; render(); setTimeout(function () { if (LEAVE) { LEAVE = false; render(); } }, 4000); return; } LEAVE = false; leave(); };
      if ($('cgSave')) $('cgSave').onclick = rename;
    }
    apply(); height();
  }

  // 학습지 칸에 조 정보 채우기 (모둠 이름 · 모둠원 표 · 나의 역할) — 바뀌었을 때만 입력 이벤트를 보내 학습지가 다시 계산·임시 저장하게 함
  function apply() {
    if (MODE !== 'live' || !ME) return;
    var g0 = ME.group_no, ms = members(g0).slice(0, MAX);
    var team = g0 + '조' + (gname(g0) ? ' · ' + gname(g0) : '');
    var sig = JSON.stringify([team, ms.map(function (m) { return [m.name, m.role]; }), ME.role]);
    lockSheet();
    if (sig === LASTSIG) return; LASTSIG = sig;
    var set = function (id, v) { var e = $(id); if (e) e.value = v == null ? '' : v; };
    set('team', team);
    for (var i = 1; i <= MAX; i++) { var m = ms[i - 1]; set('m' + i + 'n', m ? m.name : ''); set('m' + i + 'r', m ? (m.role || '') : ''); }
    set('myRole', ME.role || '');
    var trig = $('m1n'); if (trig) trig.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function lockSheet() {
    ['team', 'm1n', 'm2n', 'm3n', 'm4n', 'm5n'].forEach(function (id) { var e = $(id); if (e) { e.readOnly = true; e.tabIndex = -1; } });
    document.querySelectorAll('.team .chips .chip, .chips[data-for="myRole"] .chip').forEach(function (c) { c.disabled = true; });
  }

  function act(p, okMsg) {
    BUSY = true;
    return p.then(function (r) {
      if (r && r.error) { toast(r.error.code === '23505' ? '이미 다른 친구가 고른 역할이에요' : '저장하지 못했어요. 다시 해 보세요'); }
      else if (okMsg) toast(okMsg);
      return load();
    }).catch(function () { toast('저장하지 못했어요. 다시 해 보세요'); }).then(function () { BUSY = false; render(); });
  }
  function join(g) {
    if (members(g).length >= MAX) { toast('자리가 다 찼어요'); return; }
    act(sb().from('campaign_members').upsert({ worksheet_id: ID.worksheetId, student_id: sid(), class_name: cls(), group_no: g, name: ID.student.name || '', role: null, updated_at: new Date().toISOString() }, { onConflict: 'worksheet_id,student_id' }));
  }
  function leave() {
    LASTSIG = '';
    act(sb().from('campaign_members').delete().eq('worksheet_id', ID.worksheetId).eq('student_id', sid()));
  }
  function setRole(r) {
    var next = ME.role === r ? null : r;
    act(sb().from('campaign_members').update({ role: next, updated_at: new Date().toISOString() }).eq('worksheet_id', ID.worksheetId).eq('student_id', sid()));
  }
  function rename() {
    if (!ME || ME.role !== '조장') return;
    var v = String(($('cgName') || {}).value || '').trim().slice(0, 20);
    $('cgName').blur();
    act(sb().from('campaign_groups').upsert({ worksheet_id: ID.worksheetId, class_name: cls(), group_no: ME.group_no, name: v, updated_at: new Date().toISOString() }, { onConflict: 'worksheet_id,class_name,group_no' }), '저장됨');
  }
})();
