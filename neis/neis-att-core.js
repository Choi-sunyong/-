/* 나이스 출결 자동입력 최신 코드 (확장 프로그램이 불러씀) */
window.__NA_REMOTE={v:49,run:function(__NA_CFG){
(function(){
var CFG=__NA_CFG||{url:"",key:""};
var __cfgSig=JSON.stringify(CFG);
if(window.__NEIS_ATT__&&window.__NEIS_ATT__.v===49&&window.__NEIS_ATT__.cfg===__cfgSig){window.__NEIS_ATT__.show();return;}
if(window.__NEIS_ATT__&&window.__NEIS_ATT__.iv)clearInterval(window.__NEIS_ATT__.iv);
var __old=document.getElementById('neis-att-panel');if(__old)__old.remove();
if(location.host.indexOf('neis.go.kr')<0){alert('나이스 출결관리 화면에서 눌러 주세요.');return;}
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
var norm=function(s){return String(s||'').replace(/\s+/g,' ').trim()};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
function vis(e){if(!e)return false;var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'}
function leaves(root,t){return Array.prototype.filter.call((root||document).querySelectorAll('div,span,a,label'),function(e){return e.childElementCount===0&&norm(e.textContent)===t&&vis(e)})}
async function waitFor(fn,ms){var end=Date.now()+(ms||3000);while(Date.now()<end){var v=fn();if(v)return v;await sleep(100)}return null}

/* ---------- 엑셀/구글시트 붙여넣기 파싱 ---------- */
function parseTSV(text){var rows=[],row=[],cell='',q=false;for(var i=0;i<text.length;i++){var c=text[i];
 if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
 else{if(c==='"'&&cell==='')q=true;else if(c==='\t'){row.push(cell);cell=''}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}}
 if(cell!==''||row.length){row.push(cell);rows.push(row)}return rows}
function parseKind(line){var k=line.replace(/\s/g,'');var t=(k.match(/결석|지각|조퇴|결과/)||[])[0];var c=null;
 if(/미인정/.test(k))c='미인정';else if(/인정/.test(k))c='출석인정';else if(/질병/.test(k))c='질병';else if(/기타/.test(k))c='기타';return {type:t,cat:c}}
var DEFAULT_SYM={'♡':'질병결석','♥':'미인정결석','▲':'기타결석','△':'출석인정결석','#':'질병지각','X':'미인정지각','x':'미인정지각','×':'미인정지각','✕':'미인정지각','≠':'기타지각','◁':'출석인정지각','@':'질병조퇴','◎':'미인정조퇴','∞':'기타조퇴','∽':'기타조퇴','▷':'출석인정조퇴','☆':'질병결과','◇':'미인정결과','=':'기타결과','〓':'기타결과','▽':'출석인정결과'};
function kindOf(line){var pk=parseKind(line);return pk.type&&pk.cat?pk.cat+pk.type:null}
function splitKind(k){var m=k.match(/^(질병|미인정|기타|출석인정)(결석|지각|조퇴|결과)$/);return m?{cat:m[1],type:m[2]}:null}
function parseNoteLine(line){var m=norm(line).match(/^([\d\s,~\-–]+?)\s*[.)]\s*(.*)$/);if(!m||!/\d/.test(m[1]))return null;
 var days=[];m[1].replace(/\s/g,'').split(',').forEach(function(p){var r=p.split(/[~\-–]/).filter(Boolean).map(Number);if(r.length===2){for(var d=r[0];d<=r[1];d++)days.push(d)}else if(r.length===1)days.push(r[0])});
 var rest=m[2],pm=rest.match(/\(([^)]*)\)\s*$/);
 return {days:days,periods:pm?pm[1].trim():'',reason:rest.replace(/\s*\([^)]*\)\s*$/,'').trim(),raw:line}}
function parseSheet(text){
 var rows=parseTSV(text),out=[],mo=text.match(/\((\d{1,2})월\)/);
 var h=-1,nameCol=-1;for(var i=0;i<rows.length&&h<0;i++)for(var j=0;j<rows[i].length;j++)if(norm(rows[i][j])==='성명'){h=i;nameCol=j;break}
 if(h<0)throw new Error('"성명" 머리글을 찾지 못했습니다. 시트 전체(Ctrl+A)를 복사해 붙여넣으세요.');
 var col=function(t){for(var i=Math.max(0,h-3);i<=Math.min(rows.length-1,h+1);i++)for(var j=0;j<rows[i].length;j++)if(norm(rows[i][j]).replace(/\(.*\)/,'').trim()===t)return j;return -1};
 var noCol=col('번호'),bCol=col('비고'),kCol=col('결석일수');
 if(bCol<0)throw new Error('"비고" 머리글을 찾지 못했습니다.');
 var dayCols={},best=-1;for(var r=Math.max(0,h-2);r<=Math.min(rows.length-1,h+1);r++){var cnt={},n=0;
  for(var c=nameCol+1;c<bCol;c++){var v=norm(rows[r][c]);if(/^\d{1,2}$/.test(v)&&+v>=1&&+v<=31){cnt[c]=+v;n++}}
  if(n>best){best=n;dayCols=cnt}}
 if(best<1)throw new Error('날짜(1~31) 머리글 행을 찾지 못했습니다.');
 var studs=[];
 for(var r2=h+1;r2<rows.length;r2++){var row=rows[r2],name=norm(row[nameCol]);if(!name||name==='성명'||/^(계|합계)$/.test(name))continue;
  if(/^(TRUE|FALSE)$/i.test(name))continue;
  var st={name:name,no:noCol>=0?norm(row[noCol]):'',syms:{},notes:[],kinds:[],bad:[]};
  for(var c2 in dayCols){var sv=norm(row[c2]);if(sv&&!/^(TRUE|FALSE)$/i.test(sv))st.syms[dayCols[c2]]=sv}
  String(row[bCol]||'').split('\n').map(norm).filter(Boolean).forEach(function(l){var p=parseNoteLine(l);if(p)st.notes.push(p);else st.bad.push(l)});
  if(kCol>=0)String(row[kCol]||'').split('\n').map(norm).filter(Boolean).forEach(function(l){var k=kindOf(l);if(k&&st.kinds.indexOf(k)<0)st.kinds.push(k)});
  studs.push(st)}
 /* 기호 학습: 기호 1종 + 결석일수 1종인 학생 */
 var votes={};studs.forEach(function(st){var u={};for(var d in st.syms)u[st.syms[d].replace(/\?/g,'')]=1;var us=Object.keys(u);
  if(us.length===1&&st.kinds.length===1&&us[0]){var k=us[0];votes[k]=votes[k]||{};votes[k][st.kinds[0]]=(votes[k][st.kinds[0]]||0)+1}});
 var SYM=Object.assign({},DEFAULT_SYM);for(var sy in votes){var bk=null,bn=0;for(var kk in votes[sy])if(votes[sy][kk]>bn){bn=votes[sy][kk];bk=kk}if(bk)SYM[sy]=bk}
 studs.forEach(function(st){
  var days={};for(var d in st.syms)days[d]=1;st.notes.forEach(function(nt){nt.days.forEach(function(x){days[x]=1})});
  Object.keys(days).map(Number).sort(function(a,b){return a-b}).forEach(function(d){
   var sym=st.syms[d]||'',note=null;st.notes.forEach(function(nt){if(nt.days.indexOf(d)>=0)note=nt});
   var rec={name:st.name,no:st.no,day:d,sym:sym,reason:note?note.reason:'',periods:note?note.periods:'',flag:''};
   var kind=SYM[sym.replace(/\?/g,'')]||null;
   if(!kind&&st.kinds.length===1)kind=st.kinds[0];
   if(kind){var sk=splitKind(kind);rec.cat=sk.cat;rec.type=sk.type}
   if(/\?/.test(sym+(note?note.raw:'')))rec.flag='시트 미확정(?)';
   else if(!sym)rec.flag='날짜 칸 기호 없음';
   else if(!kind)rec.flag='기호 "'+sym+'" 뜻을 모름';
   else if(!note)rec.flag='사유 없음';
   out.push(rec)})});
 return {month:mo?+mo[1]:null,recs:out,sym:SYM,nStud:studs.length,days:Object.keys(dayCols).map(function(k){return dayCols[k]}).sort(function(a,b){return a-b})}}

/* ---------- 나이스 내부 데이터 ---------- */
function screenDate(){try{var g=getGrid(),ds=g&&g.dataSet;if(ds&&ds.getRowCount()>0){var ymd=String(ds.getValue(0,'atteYmd')||'');if(/^\d{8}$/.test(ymd)){var y=+ymd.slice(0,4),m=+ymd.slice(4,6),d=+ymd.slice(6,8);var w='일월화수목금토'.charAt(new Date(y,m-1,d).getDay());return {y:y,m:m,d:d,s:ymd.slice(0,4)+'.'+ymd.slice(4,6)+'.'+ymd.slice(6,8)+'.('+w+')'}}}}catch(e){}
 var m=(document.body.innerText||'').match(/(\d{4})\.(\d{2})\.(\d{2})\.\(([월화수목금토일])\)/);return m?{y:+m[1],m:+m[2],d:+m[3],s:m[0]}:null}
function screenClass(){var m=(document.body.innerText||'').match(/(\d)학년\s*(\d{1,2})반\s*\d{4}\./);return m?m[1]+'-'+(+m[2]):null}
function apiLoad(month,tab,action){return new Promise(function(res,rej){var u=CFG.url+(CFG.url.indexOf('?')<0?'?':'&')+'key='+encodeURIComponent(CFG.key)+'&month='+month+'&tab='+encodeURIComponent(tab)+(action?'&action='+action:'')+'&t='+Date.now();
 function jsonp(){var cb='__naCb'+Date.now(),sc=document.createElement('script'),tm=setTimeout(function(){done();rej(new Error('연결 시간 초과'))},20000);
  function done(){clearTimeout(tm);try{delete window[cb]}catch(e){window[cb]=undefined}sc.remove()}
  window[cb]=function(d){done();res(d)};sc.onerror=function(){done();rej(new Error('시트 연결 실패 — 나이스에서 외부 접속이 막혔을 수 있습니다'))};sc.src=u+'&callback='+cb;document.head.appendChild(sc)}
 try{fetch(u,{credentials:'omit'}).then(function(r){return r.json()}).then(res).catch(jsonp)}catch(e){jsonp()}})}
function isAtt(c){try{var ds=c.dataSet;if(!ds)return false;if(typeof ds.getColumnNames!=='function')return true;var n=ds.getColumnNames();return n.indexOf('chulgyulGb')>=0&&n.indexOf('atteYmd')>=0}catch(e){return false}}
var __G=null,__GT=0;function getGrid(){if(typeof cpr==='undefined')return null;if(__G&&!__G.disposed&&Date.now()-__GT<3000)return __G;var g=null;
 var A=null,walk=function(c){try{if(c.type==='grid'&&c.id==='grdMain'&&isAtt(c)){g=c;try{g.__app=A}catch(e){}}(c.getChildren?c.getChildren():[]).forEach(walk)}catch(e){}};
 cpr.core.Platform.INSTANCE.getAllRunningAppInstances().forEach(function(a){try{A=a;walk(a.getContainer())}catch(e){}});__G=g;__GT=Date.now();return g}
function findSave(){var hit=null,walk=function(c){try{if(!hit&&c.type==='button'&&norm(c.value||c.text||'')==='저장')hit=c;(c.getChildren?c.getChildren():[]).forEach(walk)}catch(e){}};
 var apps=cpr.core.Platform.INSTANCE.getAllRunningAppInstances();
 apps.forEach(function(a){try{if(a.app&&/his_srgaa02_m02/.test(a.app.id))walk(a.getContainer())}catch(e){}});
 if(!hit)apps.forEach(function(a){try{walk(a.getContainer())}catch(e){}});return hit}
function doSave(){var b=findSave();if(!b)return '저장 버튼을 못 찾음';
 try{if(typeof b.click==='function'){b.click();return 'OK'}}catch(e){}
 try{b.dispatchEvent(new cpr.events.CMouseEvent('click',{}));return 'OK'}catch(e){return '저장 실행 실패: '+e.message}}
function periodList(rec,max,has){var p=String(rec.periods||'').replace(/\s|교시/g,''),out=[],i;
 if(rec.type==='결석'){for(i=1;i<=max;i++)out.push(i)}
 else if(/^\d+~$/.test(p)){for(i=+p.slice(0,-1);i<=max;i++)out.push(i)}
 else if(/^~\d+$/.test(p)){for(i=1;i<=+p.slice(1);i++)out.push(i)}
 else if(/^\d+[-~]\d+$/.test(p)){var a=p.split(/[-~]/);for(i=+a[0];i<=+a[1];i++)out.push(i)}
 else if(/^\d+(,\d+)*$/.test(p)){out=p.split(',').map(Number)}
 else return null;
 return out.filter(function(n){return n>=1&&n<=max&&has(n)})}
var OPT={slashOnly:false};try{OPT.slashOnly=localStorage.getItem('neisAttSlash')==='1'}catch(e){}
function findIdx(ds,rec){var idx=-1,nm=function(i){return norm(ds.getValue(i,'stuFlnm')).replace(/\(.*\)$/,'')};
 if(rec.no){for(var i=0;i<ds.getRowCount();i++){if(String(ds.getValue(i,'clsNo'))===String(+rec.no)){idx=i;break}}
  if(idx>=0&&nm(idx)!==rec.name)return '번호, 이름 불일치(나이스 '+rec.no+'번 '+nm(idx)+')'}
 if(idx<0){for(var j=0;j<ds.getRowCount();j++){if(nm(j)===rec.name){idx=j;break}}if(idx>=0&&rec.no)return '번호 불일치(나이스 '+ds.getValue(idx,'clsNo')+'번)'}
 if(idx<0)return '나이스에서 학생을 못 찾음';
 return idx}
function planOne(ds,rec){var idx=findIdx(ds,rec);if(typeof idx==='string')return idx;
 var max=+ds.getValue(idx,'totMax')||7;
 var has=function(n){return String(ds.getValue(idx,'g'+n))!=='N'};
 var ps=periodList(rec,max,has);
 if(!ps||(!ps.length&&rec.type!=='결석'))return '교시 표시 없음/인식 불가 — 직접 입력';
 var mark=(rec.cat==='출석인정'&&!OPT.slashOnly)?'Ø':'/';
 var v={chulgyulGb:rec.cat+rec.type,atteRmkCn:rec.reason};
 for(var n=1;n<=12;n++)v['gyo'+n]=ps.indexOf(n)>=0?mark:'';
 var jo=rec.type==='결석'||rec.type==='지각'||(rec.type==='결과'&&ps.indexOf(1)>=0),jong=rec.type==='결석'||rec.type==='조퇴';
 v.jo=jo?mark:'';v.jong=jong?mark:'';
 return {idx:idx,v:v,ps:ps,max:max}}
function descMarks(get,max,kind){var on=[];for(var n=1;n<=max;n++)if(norm(get('gyo'+n)))on.push(n);
 if(!on.length)return '교시 없음';if(on.length>=max&&/결석/.test(kind))return '전일';
 var run=on.length>1&&on[on.length-1]-on[0]===on.length-1;return run?on[0]+'~'+on[on.length-1]+'교시':on.join(',')+'교시'}
function diffShort(ds,pl){var i=pl.idx,g=function(k){return ds.getValue(i,k)},cur=norm(g('chulgyulGb')),o=[];
 if(cur!==pl.v.chulgyulGb)o.push(cur);
 else{for(var n=1;n<=pl.max;n++){if(norm(g('gyo'+n))!==pl.v['gyo'+n]){o.push(descMarks(g,pl.max,cur));break}}}
 if(norm(g('atteRmkCn'))!==norm(pl.v.atteRmkCn))o.push('"'+(norm(g('atteRmkCn'))||'사유 없음')+'"');
 return '나이스: '+o.join(' · ')}
function diffOne(ds,pl){var i=pl.idx,g=function(k){return ds.getValue(i,k)},out=[];
 var curGb=norm(g('chulgyulGb'));if(!curGb)return null;
 if(curGb!==pl.v.chulgyulGb)out.push('구분 '+curGb+' → '+pl.v.chulgyulGb);
 var mOk=true;for(var n=1;n<=pl.max;n++){if(norm(g('gyo'+n))!==pl.v['gyo'+n]){mOk=false;break}}
 if(!mOk&&curGb===pl.v.chulgyulGb){out.push('교시 '+descMarks(g,pl.max,curGb)+' → '+descMarks(function(k){return pl.v[k]},pl.max,pl.v.chulgyulGb))}
 else if(!mOk&&out.length){out[0]+=' ('+descMarks(function(k){return pl.v[k]},pl.max,pl.v.chulgyulGb)+')'}
 if(norm(g('atteRmkCn'))!==norm(pl.v.atteRmkCn))out.push('사유 "'+(norm(g('atteRmkCn'))||'없음')+'" → "'+pl.v.atteRmkCn+'"');
 return out}
function applyOne(ds,rec,force){var pl=planOne(ds,rec);if(typeof pl==='string')return pl;var idx=pl.idx;
 var cur=norm(ds.getValue(idx,'chulgyulGb'));
 if(String(ds.getValue(idx,'ddlnYn'))==='Y')return cur?'SKIP:이미 마감됨':'이미 마감된 날 — 직접 입력';
 if(cur&&!force)return 'SKIP:이미 입력됨('+cur+')';
 for(var k in pl.v)ds.setValue(idx,k,pl.v[k]);
 return 'OK:'+(cur?'수정됨':pl.v.chulgyulGb)}

/* ---------- 패널 UI ---------- */
var P=document.createElement('div');P.id='neis-att-panel';
var CSS='#neis-att-panel{--pr:#2563eb;--prh:#1d4ed8;--g9:#111827;--g7:#374151;--g5:#6b7280;--g4:#9ca3af;--g2:#e5e7eb;--g1:#f3f4f6;--g0:#f9fafb;--ok:#059669;--bad:#dc2626;box-sizing:border-box;position:fixed;top:72px;right:20px;width:580px;height:auto;max-height:calc(100vh - 40px);min-width:460px;min-height:180px;resize:both;display:flex;flex-direction:column;z-index:2147483647;background:#fff;border:1.5px solid var(--thBd,#9ca3af);border-radius:10px;box-shadow:0 0 0 4px rgba(0,0,0,.04),0 24px 40px -8px rgba(17,24,39,.28),0 8px 14px -6px rgba(17,24,39,.18);font:14.5px/1.45 "Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif;color:var(--g9);overflow:hidden;animation:naIn .18s ease-out}'+
'@keyframes naIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'+
'#neis-att-panel *{box-sizing:border-box;margin:0;font-family:inherit}'+
'#neis-att-panel .hd{position:relative;display:flex;align-items:center;gap:4px;height:44px;flex:none;padding:0 8px 0 16px;background:var(--th,#fff);color:var(--thTx,#111827);border-bottom:1px solid rgba(0,0,0,.08);cursor:grab;user-select:none}'+
'#neis-att-panel .hd b{flex:1;font-size:15.5px;font-weight:600;color:inherit}'+
'#neis-att-panel .cb{width:28px;height:28px;border:0;border-radius:6px;background:none;color:inherit;opacity:.75;cursor:pointer;display:grid;place-items:center;padding:0}#neis-att-panel .cb:hover{background:rgba(127,127,127,.2);opacity:1}'+
'#neis-att-panel .bar{display:flex;align-items:center;gap:8px;height:46px;flex:none;padding:0 12px 0 16px;border-bottom:1px solid var(--g2);background:var(--thSoft,#f9fafb);font-size:14px;color:var(--g9)}'+
'#neis-att-panel .bar>*{white-space:nowrap;flex-shrink:0}#neis-att-panel .bar>.sp{flex-shrink:1}#neis-att-panel .bar{overflow:hidden}\n#neis-att-panel .bar.c1 .lbl,#neis-att-panel .bar.c1 #na-api{display:none}\n#neis-att-panel .bar.c2{gap:5px;padding:0 8px 0 12px}\n#neis-att-panel .bar.c2 .lnk{padding:0 8px;font-size:13px}\n#neis-att-panel .bar.c2 .opt{font-size:13px}'+
'#neis-att-panel .bar .ar{color:var(--g4)}#neis-att-panel .bar .sp{flex:1}#neis-att-panel .bar .dim{color:var(--g4)}'+
'#neis-att-panel .lnk{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border:1px solid var(--pr);border-radius:6px;background:#fff;color:var(--pr);font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap}#neis-att-panel .lnk:hover{background:var(--pr);color:var(--prTx,#fff)}'+
'#neis-att-panel .opt{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:500;color:var(--g9);cursor:pointer;margin-right:12px;user-select:none}#neis-att-panel .opt input{margin:0;width:16px;height:16px;accent-color:var(--pr);cursor:pointer}'+
'#neis-att-panel .paste{flex:none;padding:12px 16px;border-bottom:1px solid var(--g2)}'+
'#neis-att-panel textarea{display:block;width:100%;height:76px;border:1px dashed #cbd5e1;border-radius:8px;background:#fff;padding:9px 11px;font-size:14px;color:var(--g9);resize:none;outline:none}#neis-att-panel textarea:focus{border:1px solid var(--pr);box-shadow:0 0 0 3px rgba(37,99,235,.15)}'+
'#neis-att-panel .wrap{overflow:auto;flex:1}'+
'#neis-att-panel table{width:100%;border-collapse:collapse;table-layout:fixed}'+
'#neis-att-panel table,#neis-att-panel thead,#neis-att-panel tbody,#neis-att-panel tr,#neis-att-panel th,#neis-att-panel td{border-spacing:0;font-family:inherit;letter-spacing:0;box-sizing:border-box!important}'+
'#neis-att-panel th{height:40px!important;line-height:40px!important;text-align:center!important;vertical-align:middle!important;font-size:13.5px!important;font-weight:700!important;color:var(--g9)!important;padding:0 8px!important;border-top:0;border-bottom:1px solid var(--g2)!important;background:var(--thSofter,#f9fafb)!important;position:sticky;top:0;z-index:1;white-space:nowrap;overflow:visible}'+
'#neis-att-panel td{height:46px!important;line-height:1.4!important;font-size:14.5px!important;color:var(--g9);padding:0 8px!important;border-bottom:1px solid var(--g1);vertical-align:middle;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#neis-att-panel tr:last-child td{border-bottom:0}'+
'#neis-att-panel th+th,#neis-att-panel td+td{border-left:1px solid var(--g1)}#neis-att-panel th:first-child,#neis-att-panel td:first-child{padding-left:8px}#neis-att-panel th:last-child,#neis-att-panel td:last-child{padding-right:8px;text-align:center;white-space:nowrap}'+
'#neis-att-panel td.no{color:var(--g7);font-weight:500;font-variant-numeric:tabular-nums}'+
'#neis-att-panel .kd{color:var(--g9);font-weight:500}#neis-att-panel .rs{color:var(--g7)}#neis-att-panel .rs.w{color:var(--bad)}'+
'#neis-att-panel .st{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%}'+
'#neis-att-panel .none{padding:32px 16px;text-align:center;color:var(--g7);font-size:14px}'+
'#neis-att-panel .ft{display:flex;align-items:center;gap:8px;height:58px;flex:none;padding:0 16px;border-top:1px solid var(--g2);background:#fff}'+
'#neis-att-panel .ft .msg{flex:1;font-size:14px;color:var(--g7)}#neis-att-panel .ft .msg.err{color:var(--bad)}#neis-att-panel .ft .msg b{color:var(--g9);font-weight:600}'+
'#neis-att-panel .btn{height:38px;padding:0 18px;border-radius:7px;font-size:15px;font-weight:600;cursor:pointer;white-space:nowrap;border:1px solid var(--pr);background:var(--pr);color:var(--prTx,#fff)}#neis-att-panel .btn:hover{background:var(--prh);border-color:var(--prh)}'+
'#neis-att-panel .pal{position:absolute;top:42px;right:8px;z-index:5;background:#fff;color:#111827;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 12px 24px rgba(0,0,0,.18);padding:12px;width:216px;cursor:default}#neis-att-panel .pal p{font-size:11.5px;font-weight:600;color:#6b7280;margin-bottom:8px}#neis-att-panel .sw{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}#neis-att-panel .sw button{width:26px;height:26px;border-radius:50%;border:1px solid rgba(0,0,0,.15);cursor:pointer;padding:0}#neis-att-panel .sw button.on{box-shadow:0 0 0 2px #fff,0 0 0 4px #111827}#neis-att-panel .cu{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;color:#374151}#neis-att-panel .cu input{width:32px;height:24px;border:1px solid #e5e7eb;border-radius:6px;padding:0;background:none;cursor:pointer}'+
'#neis-att-panel #na-dlg{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(17,24,39,0);transition:background .22s ease;border-radius:inherit;outline:none}#neis-att-panel #na-dlg.on{background:rgba(17,24,39,.28)}#neis-att-panel #na-dlg .dc{position:relative;width:min(360px,calc(100% - 32px));word-break:keep-all;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);padding:22px 22px 18px;text-align:center;opacity:0;transform:translateY(14px) scale(.96);transition:opacity .22s ease,transform .26s cubic-bezier(.2,.9,.3,1.2);zoom:var(--z,1)}#neis-att-panel #na-dlg.on .dc{opacity:1;transform:none}#neis-att-panel #na-dlg .dt{font-size:16px;font-weight:700;color:#111827;margin-bottom:10px}#neis-att-panel #na-dlg .dm{font-size:13.5px;color:#4b5563;line-height:1.6;word-break:keep-all}#neis-att-panel #na-dlg .dq{font-size:14px;font-weight:600;color:#111827;margin:14px 0 16px}#neis-att-panel #na-dlg .db{display:flex;gap:8px;justify-content:center}#neis-att-panel #na-dlg .db button{height:36px;padding:0 14px;font-size:13.5px}#neis-att-panel #na-dlg .pri{border:0;border-radius:6px;background:var(--pr);color:var(--prTx,#fff);font-weight:600;cursor:pointer}#neis-att-panel #na-dlg .pri:hover{background:var(--prh)}#neis-att-panel #na-dlg .dx{position:absolute;right:8px;top:6px;border:0;background:none;font-size:18px;color:#9ca3af;cursor:pointer;line-height:1;padding:4px}'+
'#neis-att-panel>.hd,#neis-att-panel>#na-body{zoom:var(--z,1)}#neis-att-panel .zt{position:absolute;left:50%;top:54px;transform:translateX(-50%);z-index:6;background:rgba(17,24,39,.85);color:#fff;font-size:13px;font-weight:600;padding:6px 12px;border-radius:999px;pointer-events:none;transition:opacity .3s}'+
'#neis-att-panel.mini{height:auto!important;min-height:0!important;resize:none!important}#neis-att-panel.mini #na-body{display:none!important}'+
'#neis-att-panel .pal{position:fixed!important}'+
'#neis-att-panel tr.fx td{background:#fef2f2!important}#neis-att-panel td.sh{color:var(--g9)}#neis-att-panel td s{color:var(--bad);text-decoration-thickness:1.5px}#neis-att-panel td .ar{color:var(--g4);margin:0 5px}#neis-att-panel td b{font-weight:700;color:var(--g9)}#neis-att-panel td .bad{color:var(--bad);font-weight:600}#neis-att-panel thead tr.h2 th{top:40px!important;height:32px!important;line-height:32px!important;font-size:12.5px!important;font-weight:600!important;color:var(--g7)!important}#neis-att-panel thead tr:first-child th{border-bottom:1px solid var(--g1)!important}#neis-att-panel th[rowspan]{border-bottom:1px solid var(--g2)!important}#neis-att-panel th.g{letter-spacing:.02em}#neis-att-panel td.ne0{color:var(--g4)}#neis-att-panel td.ne1{color:var(--g7)}#neis-att-panel td.neo{color:var(--ok);font-weight:500}#neis-att-panel td.neb{color:var(--bad);font-weight:600}#neis-att-panel .btn.danger{background:var(--bad);border-color:var(--bad);color:#fff}#neis-att-panel .btn.danger:hover{background:#b91c1c;border-color:#b91c1c}'+
'#neis-att-panel .btn:disabled{background:var(--g1);border-color:var(--g2);color:var(--g4);cursor:default}';
var IC={wait:'<span class="st" style="border:1.5px solid #d1d5db"></span>',
 ok:'<span class="st" style="background:#d1fae5;color:#059669"><svg width="10" height="10" viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
 skip:'<span class="st" style="background:#f3f4f6;color:#9ca3af"><svg width="10" height="10" viewBox="0 0 12 12"><path d="M3 6h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>',
 bad:'<span class="st" style="background:#fee2e2;color:#dc2626;font-size:11px;font-weight:700">!</span>'};
P.innerHTML='<style>'+CSS+'</style>'+
'<div class="hd"><b>출결 자동입력</b>'+
'<button class="cb" id="na-pal" title="테마 색"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.8a6.2 6.2 0 1 0 0 12.4c.9 0 1.3-.6 1.3-1.2 0-.8-.6-1-.6-1.7 0-.6.5-1 1.1-1h1.5a2.9 2.9 0 0 0 2.9-2.9C14.2 4.3 11.4 1.8 8 1.8z"/><circle cx="4.9" cy="7.4" r=".9" fill="currentColor" stroke="none"/><circle cx="7.2" cy="4.6" r=".9" fill="currentColor" stroke="none"/><circle cx="10.4" cy="5" r=".9" fill="currentColor" stroke="none"/></svg></button>'+
'<div class="pal" id="na-palbox" style="display:none"><p>테마 색</p><div class="sw" id="na-sw"></div><label class="cu"><input type="color" id="na-cu">직접 고르기</label></div>'+
'<button class="cb" id="na-min" title="접기"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>'+
'<button class="cb" id="na-x" title="닫기"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>'+
'<div id="na-body" style="display:flex;flex-direction:column;min-height:0;flex:1">'+
'<div class="bar"><span id="na-src" style="display:none"></span><span class="lbl" style="color:var(--g7);font-weight:500">나이스 조회 일자</span><span id="na-dst" style="font-weight:600;color:var(--g9)"></span><span class="sp"></span><span id="na-api" style="color:var(--g7);font-size:13px;white-space:nowrap"></span><label class="opt" id="na-optw" title="체크하면 출석인정도 Ø 대신 /로 표시"><input type="checkbox" id="na-slash">3학년부</label><button class="lnk" id="na-rvx" style="display:none" title="검토 그만하기">검토 종료</button><button class="lnk" id="na-rv" style="display:none">출결 검토</button><button class="lnk" id="na-am" style="display:none">월 자동 입력</button><button class="lnk" id="na-ref" style="display:none">새로고침</button><button class="lnk" id="na-chg">시트 변경</button></div>'+
'<div class="paste" id="na-paste"><textarea id="na-ta" placeholder="출결 시트에서 Ctrl+A → Ctrl+C 후 여기에 Ctrl+V"></textarea></div>'+
'<div class="wrap" id="na-list"></div>'+
'<div class="ft"><div class="msg" id="na-info"></div><button class="btn" id="na-run" disabled>입력</button></div></div>';
document.body.appendChild(P);
var $=function(id){return P.querySelector('#'+id)};
var state={sheet:'',p:null,err:'',key:'',todo:[],done:false};
if(!CFG.url){try{state.sheet=localStorage.getItem('neisAttSheet')||''}catch(e){}}
function info(h,err){var el=$('na-info');el.innerHTML=h||'';el.className='msg'+(err?' err':'')}
function loadSheet(){state.p=null;state.err='';if(state.sheet){try{state.p=parseSheet(state.sheet)}catch(e){state.err=e.message}}state.key=''}
function fmtP(p){return /^~/.test(p)?'1'+p+'교시':/~$/.test(p)?p.slice(0,-1)+'교시~':p+'교시'}
function fpOf(ds){try{var a=[];for(var i=0;i<ds.getRowCount();i++)a.push(ds.getValue(i,'chulgyulGb')+'|'+ds.getValue(i,'gyo1'));return a.join(',')}catch(e){return ''}}
function apiFetch(m,cls){try{__lastAuto=Date.now()}catch(e){}state.loading=true;state.apiErr='';if(!state.p)list();$('na-api').textContent='불러오는 중…';
 apiLoad(m,cls).then(function(d){if(d&&d.ok){state.sheet=d.tsv;if(d.ver!=null){state.ver=String(d.ver);state.verOK=true}state.apiM=m;state.apiC=cls;var t=new Date();state.apiInfo=cls+' 탭 · '+('0'+t.getHours()).slice(-2)+':'+('0'+t.getMinutes()).slice(-2);var pk=state.key;loadSheet();if(!state.done)state.key='';else state.key=pk}else{state.apiErr=(d&&d.error)||'시트를 불러오지 못했습니다'}})
 .catch(function(e){state.apiErr=e.message}).then(function(){state.loading=false;view();if(!state.p||state.apiErr)list()})}
function view(){if(state.reviewing)return;$('na-rv').style.display=state.p?'':'none';var PM=state.rvPause&&state.rvPause.mode==='auto';$('na-rv').textContent=state.rvPause&&!PM?'이어서 검토':'출결 검토';$('na-rv').style.display=state.p&&!PM?'':'none';$('na-am').textContent=PM?(state.rvPause.next?'다음 날 ▶':'이어서 자동 입력'):'월 자동 입력';$('na-am').style.display=state.p&&(!state.rvPause||PM)?'':'none';$('na-rvx').style.display=state.rvPause?'':'none';var p=state.p,sd=screenDate(),g=getGrid();
 if(CFG.url){var cls=screenClass(),want=(sd&&cls)?sd.m+'|'+cls+'|'+sd.d:'';if(want&&want!==state.apiWant&&!state.loading){state.apiWant=want;apiFetch(sd.m,cls)}
  if(!state.loading)$('na-api').innerHTML=state.apiErr?'<span style="color:var(--bad)">연결 실패</span>':(state.apiInfo?'시트 '+esc(state.apiInfo):'')}
 var API=!!CFG.url;$('na-optw').style.display=API?'none':'';$('na-ref').style.display=API?'':'none';
 if(state.done&&g&&state.fp&&fpOf(g.dataSet)!==state.fp){state.key='';}
 $('na-src').innerHTML=p?(p.month?p.month+'월':'')+' 시트':'<span class="dim">시트 없음</span>';
 $('na-dst').innerHTML=(sd&&g)?sd.m+'월 '+sd.d+'일 ('+sd.s.slice(-2,-1)+')':'<span class="dim" style="font-weight:400">없음 — 나이스에서 조회하세요</span>';
 var showPaste=(!p&&(!API||state.apiErr))||state.editing;$('na-paste').style.display=showPaste?'':'none';$('na-chg').style.display=(p&&(!API||state.apiErr))||state.editing?'':'none';$('na-chg').textContent=state.editing?'취소':'시트 변경';
 var key=(sd?sd.s:'')+'|'+(p?p.recs.length+':'+p.month:'')+'|'+(g?1:0);
 if(key!==state.key){var _wasDone=state.done;state.key=key;state.done=false;state.saved=false;if(_wasDone)setMini(false);state.todo=[];
  if(p&&sd&&!(p.month&&p.month!==sd.m)){state.todo=p.recs.filter(function(r){return r.day===sd.d}).map(function(r){return Object.assign({},r)});
   var seen={};state.todo.forEach(function(r){if(r.flag)return;if(seen[r.name])r.flag='같은 날 2건 이상';else seen[r.name]=1});
   if(g)state.todo.forEach(function(r){if(r.flag)return;var pl=planOne(g.dataSet,r);if(typeof pl==='string'){r.flag=pl;return}var d=diffOne(g.dataSet,pl);if(d===null)return;if(String(g.dataSet.getValue(pl.idx,'ddlnYn'))==='Y'){r.status=d.length?'마감된 날이라 수정 불가: '+d.join(' / '):'SKIP:나이스와 일치';return}if(d.length){r.fix=d.join(' / ');r.fixS=diffShort(g.dataSet,pl)}else r.status='SKIP:나이스와 일치'});
   state.todo.sort(function(a,b){return (+a.no||0)-(+b.no||0)})}
  list()}}
function off(msg,foot,err){$('na-list').innerHTML='<div class="none">'+msg+'</div>';var b=$('na-run');b.disabled=true;b.textContent='입력';info(foot,err)}
function list(){if(state.review){renderReview();return}var p=state.p,sd=screenDate(),b=$('na-run');
 if(!p){if(CFG.url&&!state.apiErr&&!state.err){off(state.loading||!state.apiWant?'출결 시트를 불러오는 중…':'시트를 불러오지 못했습니다.','');return}
  off(state.err?esc(state.err):(state.apiErr?esc(state.apiErr)+'<br>아래 칸에 시트를 직접 붙여넣어도 됩니다.':'출결 시트를 붙여넣으세요.'),'',!!(state.err||state.apiErr));return}
 if(!sd||!getGrid()){off('나이스 일일출결관리에서 날짜를 조회하세요.','');return}
 if(p.month&&p.month!==sd.m){off('시트는 '+p.month+'월, 나이스는 '+sd.m+'월입니다.',sd.m+'월 시트로 변경하세요.',1);return}
 var t=state.todo;if(!t.length){off('이 날짜에는 기록이 없습니다.','');return}
 var ready=0,ok=0,bad=0,fix=0,G=getGrid(),DS=G&&G.dataSet,gbW=0;
 var rows=t.map(function(r){var s=r.status||'',ic,w=false,fx=false,msg='';
  if(r.flag){ic=IC.bad;msg=r.flag;bad++}
  else if(!s&&r.fix){ic=IC.bad;fx=true;fix++}
  else if(!s){ic=IC.wait;ready++}
  else if(/^OK/.test(s)){ic=IC.ok;ok++}
  else if(/^SKIP/.test(s)){ic=/일치|마감됨/.test(s)?IC.ok:IC.skip}
  else{ic=IC.bad;msg=s;bad++}
  var kind=(r.cat||'')+(r.type||'');
  var pp=null;if(DS&&r.type&&r.type!=='결석'){var pl0=planOne(DS,r);if(typeof pl0!=='string')pp=descMarks(function(k){return pl0.v[k]},pl0.max,kind)}
  var sRs=(r.reason||'사유 없음')+(r.type&&r.type!=='결석'?' · '+(pp||(r.periods?fmtP(r.periods):'교시?')):'');
  var gbH=esc(kind||'?'),rsH=esc(sRs),tip='시트: '+kind+' · '+sRs;
  if(msg){rsH='<span class="bad">'+esc(msg)+'</span>';tip+='\n'+msg}
  else if(fx&&DS){var x=findIdx(DS,r);if(typeof x!=='string'){var gv=function(k){return DS.getValue(x,k)},cg=norm(gv('chulgyulGb')),mx=+gv('totMax')||7;
   var nR=norm(gv('atteRmkCn'))||'사유 없음',sR=r.reason||'사유 없음',nM=descMarks(gv,mx,cg),sM=pp||(r.periods?fmtP(r.periods):'교시?'),nonAbs=r.type&&r.type!=='결석';
   var D=function(a,b){return '<s>'+esc(a)+'</s><span class="ar">→</span><b>'+esc(b)+'</b>'};
   if(cg!==kind){gbH=D(cg,kind);gbW=Math.max(gbW,(cg+kind).length)}
   rsH=(nR!==sR?D(nR,sR):esc(sR))+(nonAbs?' · '+(cg===kind&&nM!==sM?D(nM,sM):esc(sM)):'');
   tip+='\n나이스: '+cg+' · '+nR+(/결석/.test(cg)?'':' · '+nM)}}
  return '<tr'+(fx?' class="fx"':'')+' title="'+esc(r.name+'\n'+tip)+'"><td class="no">'+esc(r.no)+'</td><td>'+esc(r.name)+'</td><td>'+gbH+'</td><td>'+rsH+'</td><td>'+ic+'</td></tr>'}).join('');
 $('na-list').innerHTML='<table><colgroup><col style="width:52px"><col style="width:80px"><col style="width:'+Math.min(300,Math.max(140,gbW*15+44))+'px"><col><col style="width:54px"></colgroup><thead><tr><th>번호</th><th>이름</th><th>구분</th><th>사유</th><th>상태</th></tr></thead><tbody>'+rows+'</tbody></table>';
 if(state.rvPause){pauseHL()}
 if(state.done){b.disabled=false;b.textContent='확인';b.classList.remove('danger');info(ok?'확인 후 나이스 <b>[저장]</b>을 누르세요.':'새로 입력된 항목이 없습니다.')}
 else{b.disabled=!(ready||fix);b.textContent=ready&&fix?ready+'건 입력 · '+fix+'건 수정':fix?fix+'건 수정':ready?ready+'건 입력':'입력';b.classList.toggle('danger',!!fix);
  info(fix?'<span style="color:var(--bad);font-weight:600">오기입 '+fix+'건 · 빨간 줄은 나이스 → <span style="color:var(--g9)">시트</span>로 고쳐집니다</span>'+(bad?' · 직접 입력 '+bad+'건':''):(bad?bad+'건은 직접 입력':''))}}
$('na-ta').addEventListener('input',function(){var v=this.value;if(!v.trim())return;var ok=true;try{parseSheet(v)}catch(e){ok=e.message}
 if(ok!==true&&state.p){info('붙여넣은 내용을 읽지 못했습니다: '+esc(ok),1);this.value='';return}
 state.editing=false;state.sheet=v;if(!CFG.url){try{localStorage.setItem('neisAttSheet',v)}catch(e){}}loadSheet();view()});
$('na-slash').checked=OPT.slashOnly;$('na-slash').onchange=function(){OPT.slashOnly=this.checked;try{localStorage.setItem('neisAttSlash',this.checked?'1':'0')}catch(e){}};
$('na-ref').onclick=function(){state.apiWant='';state.apiErr='';view()};
var __lastAuto=Date.now();function autoRef(){if(!CFG.url||state.loading||document.hidden||P.style.display==='none')return;if(Date.now()-__lastAuto<3000)return;__lastAuto=Date.now();state.apiWant='';view()}
document.addEventListener('visibilitychange',function(){if(!document.hidden)autoRef()});window.addEventListener('focus',autoRef);setInterval(function(){if(Date.now()-__lastAuto>=(state.verOK?60000:20000))autoRef()},5000);
var __verBusy=false,__verT2=null;setInterval(function(){if(!CFG.url||!state.verOK||__verBusy||state.loading||document.hidden||P.style.display==='none'||!state.apiM)return;__verBusy=true;
 apiLoad(state.apiM,state.apiC,'ver').then(function(d){if(d&&d.ok&&d.ver!=null){var v=String(d.ver);if(state.ver&&v!==state.ver){state.ver=v;state.apiWant='';view();clearTimeout(__verT2);__verT2=setTimeout(function(){state.apiWant='';view()},8000)}else state.ver=v}else if(d&&d.ok)state.verOK=false})
 .catch(function(){}).then(function(){__verBusy=false})},3000);
$('na-chg').onclick=function(){state.editing=!state.editing;var ta=$('na-ta');ta.value='';view();if(state.editing)ta.focus()};
$('na-run').onclick=function(){if(state.review){if(state.reviewing)state.rvStop=true;else{state.review=null;state.key='';view()}return}if(state.done){setMini(true);return}
 var g=getGrid();if(!g){info('나이스 출결 표를 찾지 못했습니다.',1);return}
 var ds=g.dataSet;state.todo.forEach(function(r){if(r.flag||r.status)return;try{r.status=applyOne(ds,r,!!r.fix)}catch(e){r.status='오류: '+e.message}});
 try{g.redraw&&g.redraw()}catch(e){}state.done=true;state.fp=fpOf(ds);list()};
$('na-x').onclick=function(){P.style.display='none';if(window.__NEIS_ATT__)window.__NEIS_ATT__.closed=true};
function setMini(on){P.classList.toggle('mini',!!on);$('na-palbox').style.display='none'}
$('na-min').onclick=function(){setMini(!P.classList.contains('mini'))};
(function(){var hd=P.querySelector('.hd'),sx,sy,ox,oy;hd.addEventListener('mousedown',function(e){if(e.target.closest('button,.pal'))return;sx=e.clientX;sy=e.clientY;var r=P.getBoundingClientRect();ox=r.left;oy=r.top;hd.style.cursor='grabbing';
 function mv(e){P.style.left=(ox+e.clientX-sx)+'px';P.style.top=(oy+e.clientY-sy)+'px';P.style.right='auto';keepIn()}
 function up(){hd.style.cursor='';document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);saveGeo()}
 document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)})})();

function hx(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c}).join('');var n=parseInt(h,16);return [n>>16&255,n>>8&255,n&255]}
function toHex(a){return '#'+a.map(function(v){v=Math.max(0,Math.min(255,Math.round(v)));return (v<16?'0':'')+v.toString(16)}).join('')}
function lum(a){var c=a.map(function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function mix(a,b,t){return [0,1,2].map(function(i){return a[i]*(1-t)+b[i]*t})}
var THEMES=['#ffffff','#2563eb','#1e3a8a','#0f766e','#047857','#6d28d9','#be185d','#dc2626','#ea580c','#ca8a04','#374151','#111827'];
function applyTheme(h){var c=hx(h),L=lum(c),W=[255,255,255];
 var pr=L>0.5?[37,99,235]:c;
 P.style.setProperty('--th',h);
 P.style.setProperty('--thTx',L>0.45?'#111827':'#ffffff');
 P.style.setProperty('--thSoft',toHex(mix(c,W,L>0.9?0.5:0.9)));
 P.style.setProperty('--thSofter',toHex(mix(c,W,L>0.9?0.6:0.95)));
 P.style.setProperty('--thBd',L>0.9?'#9ca3af':h);
 P.style.setProperty('--pr',toHex(pr));P.style.setProperty('--prh',toHex(mix(pr,[0,0,0],.15)));
 P.style.setProperty('--prTx',lum(pr)>0.45?'#111827':'#ffffff');
 try{localStorage.setItem('neisAttTheme',h)}catch(e){}
 var sw=$('na-sw');if(sw)[].forEach.call(sw.children,function(b){b.className=b.dataset.c===h?'on':''});$('na-cu').value=h.length===7?h:'#2563eb'}
$('na-sw').innerHTML=THEMES.map(function(c){return '<button data-c="'+c+'" style="background:'+c+'" title="'+c+'"></button>'}).join('');
$('na-sw').onclick=function(e){var b=e.target.closest('button');if(b)applyTheme(b.dataset.c)};
$('na-cu').oninput=function(){applyTheme(this.value)};
$('na-pal').onclick=function(e){e.stopPropagation();var bx=$('na-palbox');if(bx.style.display!=='none'){bx.style.display='none';return}var r=this.getBoundingClientRect();bx.style.display='';bx.style.top=(r.bottom+6)+'px';bx.style.left=Math.max(8,Math.min(r.right-216,innerWidth-224))+'px';bx.style.right='auto'};
$('na-palbox').addEventListener('mousedown',function(e){e.stopPropagation()});
document.addEventListener('mousedown',function(e){if(!P.contains(e.target))$('na-palbox').style.display='none'});
P.addEventListener('mousedown',function(e){if(!e.target.closest('#na-palbox,#na-pal'))$('na-palbox').style.display='none'});
var th0='#2563eb';try{th0=localStorage.getItem('neisAttTheme')||th0}catch(e){}applyTheme(th0);
/* 크기·위치 기억 */
function saveGeo(){if(P.classList.contains('mini'))return;try{var r=P.getBoundingClientRect();localStorage.setItem('neisAttGeo2',JSON.stringify({w:Math.round(r.width),h:P.dataset.sized?Math.round(r.height):0,l:P.style.left?Math.round(r.left):null,t:Math.round(r.top)}))}catch(e){}}
try{var gg=JSON.parse(localStorage.getItem('neisAttGeo2')||'null');if(gg){if(gg.w)P.style.width=Math.min(gg.w,innerWidth-20)+'px';if(gg.h){P.style.height=Math.min(gg.h,innerHeight-20)+'px';P.dataset.sized='1'}
 if(gg.l!=null){P.style.left=Math.max(0,Math.min(gg.l,innerWidth-200))+'px';P.style.right='auto'}if(gg.t!=null)P.style.top=Math.max(0,Math.min(gg.t,innerHeight-60))+'px'}}catch(e){}
(function(){var lw=0,lh=0,tm=null,first=true;if(typeof ResizeObserver==='undefined')return;new ResizeObserver(function(){var r=P.getBoundingClientRect();if(first){first=false;lw=r.width;lh=r.height;return}
 if(Math.abs(r.width-lw)>1||Math.abs(r.height-lh)>1){if(P._userResize){P.dataset.sized='1';P.style.maxHeight='none'}lw=r.width;lh=r.height;clearTimeout(tm);tm=setTimeout(saveGeo,300)}}).observe(P)})();
P.addEventListener('mousedown',function(e){var r=P.getBoundingClientRect();if(e.clientX>r.right-18&&e.clientY>r.bottom-18)P._userResize=true});
document.addEventListener('mouseup',function(){if(P._userResize){P._userResize=false;saveGeo()}});

var Z=1;try{Z=parseFloat(localStorage.getItem('neisAttZoom'))||1}catch(e){}
var ZT=document.createElement('div');ZT.className='zt';ZT.style.opacity='0';P.appendChild(ZT);var ztm=null;
var FIT=1;function applyZ(){P.style.setProperty('--z',Math.round(Z*FIT*1000)/1000)}
function setZoom(z,show){Z=Math.max(0.8,Math.min(1.8,Math.round(z*10)/10));applyZ();if(typeof fitSoon==='function')fitSoon();try{localStorage.setItem('neisAttZoom',Z)}catch(e){}
 if(show){ZT.textContent='글자 크기 '+Math.round(Z*100)+'%';ZT.style.opacity='1';clearTimeout(ztm);ztm=setTimeout(function(){ZT.style.opacity='0'},900)}}
P.addEventListener('wheel',function(e){if(!e.ctrlKey)return;e.preventDefault();e.stopPropagation();setZoom(Z+(e.deltaY<0?0.1:-0.1),true)},{passive:false});
P.addEventListener('keydown',function(e){if(e.ctrlKey&&e.key==='0'){e.preventDefault();setZoom(1,true)}});
setZoom(Z,false);
/* 창 안에 다 들어오게: 창이 좁으면 글자·버튼·표를 함께 줄임 */
function keepIn(){var r=P.getBoundingClientRect(),hd=P.querySelector('.hd'),hh=hd?hd.getBoundingClientRect().height:44;
 var t=Math.max(0,Math.min(r.top,innerHeight-hh)),l=Math.max(0,Math.min(r.left,innerWidth-Math.min(r.width,innerWidth)));
 if(Math.abs(t-r.top)>0.5){P.style.top=t+'px'}if(Math.abs(l-r.left)>0.5){P.style.left=l+'px';P.style.right='auto'}}
var __fitQ=0;function fitBar(){__fitQ=0;keepIn();var bar=P.querySelector('.bar');if(!bar||P.classList.contains('mini')||!bar.offsetWidth)return;
 bar.classList.remove('c1','c2');var ov=function(){return bar.scrollWidth>bar.clientWidth+1};
 var tryS=function(){if(FIT!==1){FIT=1;applyZ()}return !ov()};
 if(tryS())return;bar.classList.add('c1');if(tryS())return;bar.classList.add('c2');if(tryS())return;
 var need=bar.scrollWidth-bar.clientWidth;var w=Math.min(P.offsetWidth+need*FIT+6,innerWidth-16);if(w>P.offsetWidth){P.style.width=w+'px';keepIn()}}
function fitSoon(){if(!__fitQ)__fitQ=requestAnimationFrame(fitBar)}
try{new ResizeObserver(fitSoon).observe(P);new MutationObserver(fitSoon).observe(P.querySelector('.bar'),{subtree:true,childList:true,characterData:true,attributeFilter:['style']})}catch(e){}
addEventListener('resize',fitSoon);fitSoon();setTimeout(keepIn,0);

/* ---------- 출결 검토 (월 전체) ---------- */
function allCtls(pred){var out=[],A=null;var walk=function(c){try{if(pred(c)){try{c.__app=A}catch(e){}out.push(c)}(c.getChildren?c.getChildren():[]).forEach(walk)}catch(e){}};try{cpr.core.Platform.INSTANCE.getAllRunningAppInstances().forEach(function(a){try{A=a;walk(a.getContainer())}catch(e){}})}catch(e){}return out}
function ctlOn(c){try{if(c.visible===false)return false;var p=c;for(var k=0;k<40&&p;k++){if(p.visible===false)return false;p=p.getParent?p.getParent():null}return true}catch(e){return true}}
function pickBtn(match,needEnabled){var g=getGrid(),ga=g&&g.__app;var L=allCtls(function(c){return c.type==='button'&&match(norm(c.value||c.text||''))});
 L.sort(function(a,b){var sc=function(c){return (c.__app===ga?4:0)+(ctlOn(c)?2:0)+(c.enabled!==false?1:0)};return sc(b)-sc(a)});
 window.NA_DBG=window.NA_DBG||{};(window.NA_DBG.btn=window.NA_DBG.btn||[]).push(L.map(function(c){return {l:norm(c.value||c.text||''),same:c.__app===ga,on:ctlOn(c),en:c.enabled!==false,id:c.id}}));
 var c=L[0];if(!c||!ctlOn(c)||(needEnabled&&c.enabled===false))return null;return c}
function curYmd(){__G=null;var g=getGrid(),ds=g&&g.dataSet;try{return ds&&ds.getRowCount()?String(ds.getValue(0,'atteYmd')):''}catch(e){return ''}}
async function gotoDate(ymd){if(curYmd()===ymd)return true;
 var dis=allCtls(function(c){return c.type==='dateinput'});var di=dis.filter(function(c){return String(c.value||'').replace(/\D/g,'').length===8})[0]||dis[0];
 if(!di)throw new Error('나이스 일자 칸을 찾지 못했습니다');
 var btn=pickBtn(function(l){return l==='조회'});
 if(!btn)throw new Error('나이스 [조회] 버튼을 찾지 못했습니다');
 di.value=ymd;try{di.redraw&&di.redraw()}catch(e){}
 if(typeof btn.click==='function')btn.click();else btn.dispatchEvent(new cpr.events.CMouseEvent('click',{}));
 var end=Date.now()+12000;while(Date.now()<end){await sleep(250);if(curYmd()===ymd){var n0=-1,f0='';for(var k=0;k<12;k++){await sleep(200);var g0=getGrid(),ds0=g0&&g0.dataSet,c0=ds0?ds0.getRowCount():0,fp0=ds0?fpOf(ds0):'';if(c0>0&&c0===n0&&fp0===f0)break;n0=c0;f0=fp0}return true}}
 throw new Error((+ymd.slice(4,6))+'월 '+(+ymd.slice(6))+'일 조회가 되지 않았습니다')}
function reviewDay(p,d,ds){var res=[],used={};var recs=p.recs.filter(function(r){return r.day===d}).map(function(r){return Object.assign({},r)});
 var seen={};recs.forEach(function(r){if(r.flag)return;if(seen[r.name])r.flag='같은 날 2건 이상';else seen[r.name]=1});
 recs.forEach(function(r){var it={day:d,no:r.no,name:r.name,kind:(r.cat||'')+(r.type||''),reason:r.reason||''};
  var fi=findIdx(ds,r);if(typeof fi!=='string'){used[fi]=1;it.idx=fi}
  if(r.flag){it.t='check';it.msg=r.flag;res.push(it);return}
  var pl=planOne(ds,r);if(typeof pl==='string'){it.t='check';it.msg=pl;res.push(it);return}
  var df=diffOne(ds,pl);
  if(df===null){it.t='miss';it.msg='나이스 미입력'}else if(df.length){it.t='wrong';it.msg=diffShort(ds,pl)}else it.t='ok';
  res.push(it)});
 for(var i=0;i<ds.getRowCount();i++){if(used[i])continue;var cg=norm(ds.getValue(i,'chulgyulGb'));
  if(cg)res.push({idx:i,day:d,no:String(ds.getValue(i,'clsNo')),name:norm(ds.getValue(i,'stuFlnm')).replace(/\(.*\)$/,''),kind:cg,reason:norm(ds.getValue(i,'atteRmkCn')),t:'extra',msg:'시트에 없음 (나이스에만 있음)'})}
 return res}
var HLC={ok:'#bbf7d0',miss:'#fecaca',wrong:'#fecaca',extra:'#fecaca',check:'#fecaca'};
function highlight(rows){var st=document.getElementById('na-hl');if(!st){st=document.createElement('style');st.id='na-hl';document.head.appendChild(st)}
 st.textContent=(rows||[]).filter(function(x){return x.idx!=null}).map(function(x){var c=x.t==='ok'?'#bbf7d0':'#fecaca';
  return 'div[role=row][data-rowindex="'+x.idx+'"]>.cl-grid-cell,div[role=row][data-rowindex="'+x.idx+'"] .cl-control{background-color:'+c+'!important}div[role=row][data-rowindex="'+x.idx+'"]{box-shadow:inset 4px 0 0 '+(x.t==='ok'?'#16a34a':'#dc2626')+'}'}).join('')}
function renderReviewDay(R,d,rows){var el=$('na-list');try{var w='일월화수목금토'.charAt(new Date(+R.y,R.m-1,d).getDay());$('na-dst').textContent=R.m+'월 '+d+'일 ('+w+')'}catch(e){}
 el.innerHTML='<div style="padding:8px 16px;font-weight:700;color:var(--g9);background:var(--thSofter,#f9fafb);border-bottom:1px solid var(--g2)">'+R.m+'월 '+d+'일 검토 중 <span style="font-weight:400;color:var(--g5)">('+(R.done+1)+'/'+R.days+')</span></div>'+
  (rows.length?'<table><colgroup><col style="width:52px"><col style="width:80px"><col style="width:140px"><col><col style="width:84px"></colgroup><thead><tr><th>번호</th><th>이름</th><th>구분</th><th>사유</th><th>상태</th></tr></thead><tbody>'+
  rows.map(function(x){var T=x.t==='ok'?['일치','var(--ok)']:RVT[x.t];return '<tr><td class="no">'+esc(x.no)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.kind||'?')+'</td><td class="rs'+(x.t==='wrong'||x.t==='check'?' w':'')+'">'+esc(x.t==='wrong'||x.t==='check'?x.msg:x.reason)+'</td><td style="color:'+T[1]+';font-weight:600">'+(x.t==='ok'?'✓ ':'')+T[0]+'</td></tr>'}).join('')+'</tbody></table>':'<div class="none">이 날짜는 출결 기록 없음</div>')}
var RVT={miss:['미입력','var(--bad)'],wrong:['오기입','var(--bad)'],extra:['시트에 없음','var(--bad)'],check:['확인 필요','var(--bad)']};
function renderReview(){var R=state.review,b=$('na-run'),el=$('na-list');if(!R)return;
 var probs=R.rows.filter(function(x){return x.t!=='ok'}).sort(function(a,b){return a.day-b.day||(+a.no)-(+b.no)});
 var h='';
 if(R.err)h+='<div class="none" style="color:var(--bad)">'+esc(R.err)+'</div>';
 if(probs.length){h+='<table><colgroup><col style="width:54px"><col style="width:44px"><col style="width:70px"><col style="width:112px"><col><col style="width:100px"></colgroup><thead><tr><th>날짜</th><th>번호</th><th>이름</th><th>구분</th><th>내용</th><th>문제</th></tr></thead><tbody>'+
  probs.map(function(x){var T=RVT[x.t];return '<tr class="rv" data-d="'+x.day+'" style="cursor:pointer" title="눌러서 이 날짜로 이동"><td>'+R.m+'/'+x.day+'</td><td class="no">'+esc(x.no)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.kind||'?')+'</td><td class="rs'+(x.t==='wrong'||x.t==='check'?' w':'')+'">'+esc(x.t==='miss'?x.reason:x.t==='extra'?x.reason:x.msg)+'</td><td style="color:'+T[1]+';font-weight:600">'+T[0]+'</td></tr>'}).join('')+'</tbody></table>'}
 else if(!R.err)h+='<div class="none">'+(state.reviewing?'검토 중… 아직 문제 없음':(R.done?'<b style="color:var(--ok)">✓ '+R.done+'일 모두 시트와 일치합니다</b>':'검토할 날짜가 없습니다'))+'</div>';
 el.innerHTML=h;
 [].forEach.call(el.querySelectorAll('tr.rv'),function(tr){tr.onclick=function(){if(state.reviewing)return;var d=+tr.dataset.d;var ymd=R.y+('0'+R.m).slice(-2)+('0'+d).slice(-2);state.review=null;state.key='';info('이동 중…');gotoDate(ymd).then(function(){view()}).catch(function(e){info(esc(e.message),1)})}});
 var cnt={};probs.forEach(function(x){cnt[x.t]=(cnt[x.t]||0)+1});
 var sum=Object.keys(RVT).filter(function(k){return cnt[k]}).map(function(k){return '<span style="color:'+RVT[k][1]+';font-weight:600">'+RVT[k][0]+' '+cnt[k]+'</span>'}).join(' · ');
 if(state.reviewing){b.disabled=false;b.textContent='중지';b.classList.remove('danger');info((R.cur?R.m+'월 '+R.cur+'일 ':'')+'검토 중 ('+R.done+'/'+R.days+')'+(sum?' · '+sum:''))}
 else{b.disabled=false;b.textContent='닫기';b.classList.remove('danger');info((state.rvStop?'중지됨 · ':'')+(R.mode==='auto'?'<b>자동 입력 완료</b>, '+R.inputs+'건 입력'+(R.fixes?', '+R.fixes+'건 수정':'')+' · ':'')+R.done+'일 검토'+(sum?' · '+sum:' · 문제 없음')+(probs.length?' <span style="color:var(--g5)">(줄을 누르면 그 날짜로 이동)</span>':''))}}
function ctlLabel(c){return norm(c.value||c.text||'')}
function isBtn(c){return c.type==='button'}
function clickCtl(c){if(typeof c.click==='function')c.click();else c.dispatchEvent(new cpr.events.CMouseEvent('click',{}))}
function dialogText(){return [].filter.call(document.querySelectorAll('.cl-dialog,[role=dialog],[role=alertdialog]'),function(e){return e.id!=='neis-att-panel'&&!e.closest('#neis-att-panel')&&vis(e)}).map(function(e){return norm(e.innerText)}).join(' ')}
async function saveNeis(){return pressNeis(function(l){return l==='저장'},'저장')}
function appTexts(a){var out=[];var walk=function(c){try{if(c.type!=='button'){var v=c.value!=null&&typeof c.value!=='object'?String(c.value):(typeof c.text==='string'?c.text:'');v=norm(v);if(v&&v.length>1&&out.indexOf(v)<0)out.push(v)}(c.getChildren?c.getChildren():[]).forEach(walk)}catch(e){}};try{walk(a.getContainer())}catch(e){}return out.join(' ')}
async function pressNeis(match,name){var seen=allCtls(isBtn);var sb=pickBtn(match,true);if(!sb)return '나이스 ['+name+'] 버튼을 찾지 못했습니다';
 var log=function(x){try{window.NA_DBG=window.NA_DBG||{};(window.NA_DBG.dlg=window.NA_DBG.dlg||[]).push(x)}catch(e){}};
 clickCtl(sb);var end=Date.now()+3000,confirmed=false;
 while(Date.now()<end){await sleep(120);var gA=(getGrid()||{}).__app,DL=/^(확인|예|아니오|아니요|취소|닫기|OK)$/i;var news=allCtls(isBtn).filter(function(c){return seen.indexOf(c)<0&&ctlOn(c)&&DL.test(ctlLabel(c))});if(!news.length)continue;
  await sleep(350);var app=news[0].__app;var btns=allCtls(isBtn).filter(function(c){return c.__app===app&&ctlOn(c)});seen=seen.concat(btns,news);
  var txt=(app&&app!==gA?appTexts(app):'')||dialogText();var labs=btns.map(ctlLabel);log(name+': '+txt.slice(0,160)+' ['+labs.join(',')+']');
  var ok=btns.filter(function(c){return /^(예|확인|OK)$/i.test(ctlLabel(c))})[0],no=btns.filter(function(c){return /^(아니오|아니요|취소|닫기)$/.test(ctlLabel(c))})[0];
  if(ok&&no){ /* 확인/취소 창: 진행 */ if(txt&&/오류|실패|불가|할 수 없/.test(txt)&&!/하시겠/.test(txt)){clickCtl(no);return '나이스 알림: '+txt.slice(0,90)}clickCtl(ok);confirmed=true;end=Date.now()+6000;continue}
  var b=ok||no||news[0];clickCtl(b);
  if(/되었습니다|했습니다|됐습니다|완료|정상|성공/.test(txt)&&!/못|실패|오류|없습니다|불가/.test(txt))return 'OK';
  if(txt&&!/^확인$/.test(txt))return '나이스 알림: '+txt.slice(0,90);
  end=Date.now()+(confirmed?4000:1500)}
 return 'OK?'}
async function reloadDate(ymd){var dis=allCtls(function(c){return c.type==='dateinput'});var di=dis.filter(function(c){return String(c.value||'').replace(/\D/g,'').length===8})[0]||dis[0];
 var btn=pickBtn(function(l){return l==='조회'});if(!di||!btn)return false;di.value=ymd;try{di.redraw&&di.redraw()}catch(e){}clickCtl(btn);await sleep(500);
 var n0=-1,f0='';for(var k=0;k<50;k++){await sleep(150);var g0=getGrid(),ds0=g0&&g0.dataSet,c0=ds0?ds0.getRowCount():0,fp0=ds0?fpOf(ds0):'';if(c0>0&&c0===n0&&fp0===f0&&curYmd()===ymd)return true;n0=c0;f0=fp0}return curYmd()===ymd}
function dsClosed(ds){try{if(!ds.getRowCount())return false;for(var i=0;i<ds.getRowCount();i++)if(String(ds.getValue(i,'ddlnYn'))!=='Y')return false;return true}catch(e){return false}}
var CLOSE_RE=/^(출결\s*)?마감$/;
function isClosed(ds){if(dsClosed(ds))return true;var g=getGrid(),ga=g&&g.__app;
 var pref=function(L){var M=L.filter(function(c){return c.__app===ga});return M.length?M:L};
 var cl=pref(allCtls(function(c){return c.type==='button'&&CLOSE_RE.test(norm(c.value||c.text||''))&&ctlOn(c)})),cx=pref(allCtls(function(c){return c.type==='button'&&/^마감\s*취소$/.test(norm(c.value||c.text||''))&&ctlOn(c)}));
 if(cx.length&&cx[0].enabled!==false&&(!cl.length||cl[0].enabled===false))return true;return false}
async function closeDay(){var g=getGrid();if(!g)return '나이스 출결 표를 찾지 못했습니다';if(isClosed(g.dataSet))return 'OK';
 var r=await pressNeis(function(l){return CLOSE_RE.test(l)},'출결마감');if(r!=='OK'&&r!=='OK?')return r;
 for(var k=0;k<20;k++){__G=null;var gg=getGrid();if(gg&&isClosed(gg.dataSet))return 'OK';await sleep(150)}
 var ymd=curYmd();if(!(await reloadDate(ymd)))return '마감 후 다시 조회하지 못했습니다';
 var g2=getGrid();if(g2&&!isClosed(g2.dataSet))var dl=(window.NA_DBG&&window.NA_DBG.dlg||[]).slice(-1)[0];return '[출결마감]을 눌렀지만 마감되지 않았어요'+(dl?' (나이스 알림: '+dl.replace(/^[^:]*: /,'').slice(0,60)+')':'');return 'OK'}
async function unCloseDay(){var g=getGrid();if(!g)return '나이스 출결 표를 찾지 못했습니다';if(!isClosed(g.dataSet))return 'OK';
 var r=await pressNeis(function(l){return /^마감\s*취소$/.test(l)},'마감취소');if(r!=='OK'&&r!=='OK?')return r;
 for(var k=0;k<20;k++){__G=null;var gg=getGrid();if(gg&&!isClosed(gg.dataSet))break;await sleep(150)}
 var ymd=curYmd();if(!(await reloadDate(ymd)))return '마감취소 후 다시 조회하지 못했습니다';
 var g2=getGrid();if(g2&&isClosed(g2.dataSet))return '[마감취소]를 눌렀지만 마감이 풀리지 않았어요';return 'OK'}
async function autoInputDay(p,d){var g=getGrid();if(!g)return '나이스 출결 표를 찾지 못했습니다';var ds=g.dataSet,n=0;
 var recs=p.recs.filter(function(r){return r.day===d&&!r.flag}).map(function(r){return Object.assign({},r)});
 recs.forEach(function(r){var pl=planOne(ds,r);if(typeof pl==='string')return;var df=diffOne(ds,pl);if(df!==null&&!df.length)return;var st=applyOne(ds,r,df!==null);if(/^OK/.test(st))n++});
 if(!n)return 'OK';try{g.redraw&&g.redraw()}catch(e){}
 if(reviewDay(p,d,ds).some(function(x){return x.t!=='ok'}))return '입력 후 확인해 보니 맞지 않는 건이 있어요 (저장 안 함)';
 var sv=await saveNeis();if(sv!=='OK'&&sv!=='OK?')return sv;return 'OK'}
function autoDlg(){if(state.reviewing||$('na-dlg'))return;var o=document.createElement('div');o.id='na-dlg';
 o.innerHTML='<div class="dc"><div class="dt">월 자동 입력</div><div class="dm">그달 1일부터 오늘까지 출결을 입력하고<br>저장 및 출결 마감까지 합니다.<br>마감된 날도 시트와 다르면<br>고쳐서 다시 마감합니다.</div><div class="dq">마감한 뒤 다음 날로 자동 진행할까요?</div>'+
  '<div class="db"><button class="pri" data-v="1">예, 자동 진행</button><button class="lnk" data-v="0">아니요, 하루씩 확인</button></div><button class="dx" data-v="x" title="취소">×</button></div>';
 P.appendChild(o);var dc=o.querySelector('.dc'),need=Math.ceil(dc.getBoundingClientRect().height)+48,mh0=P.style.minHeight;if(P.offsetHeight<need)P.style.minHeight=need+'px';requestAnimationFrame(function(){requestAnimationFrame(function(){o.classList.add('on')})});
 var close=function(cb){o.classList.remove('on');setTimeout(function(){o.remove();P.style.minHeight=mh0;cb&&cb()},220)};
 o.addEventListener('mousedown',function(e){e.stopPropagation()});
 o.onclick=function(e){var b=e.target.closest('[data-v]');if(!b){if(e.target===o)close();return}var v=b.dataset.v;if(v==='x')return close();state.autoNext=v==='1';close(function(){runReview('auto',true)})};
 o.tabIndex=-1;o.focus();o.onkeydown=function(e){if(e.key==='Escape')close()}}
async function runReview(mode,go){mode=mode==='auto'?'auto':'review';if(state.reviewing)return;
 if(state.rvPause&&state.rvPause.mode&&state.rvPause.mode!==mode)return;
 if(mode==='auto'&&!state.rvPause&&!go){autoDlg();return}
 if(state.done&&!state.rvWarn){state.rvWarn=true;info('입력한 내용을 나이스에 <b>저장</b>한 뒤 검토하세요. 저장했다면 한 번 더 누르세요.',1);setTimeout(function(){state.rvWarn=false},8000);return}
 state.rvWarn=false;var PZ=state.rvPause;state.rvPause=null;highlight([]);
 var start=PZ?PZ.start:curYmd();if(!start){info('나이스 일일출결관리에서 먼저 조회하세요.',1);return}
 var y=start.slice(0,4),m=+start.slice(4,6);
 state.reviewing=true;state.rvStop=false;state.review={y:y,m:m,rows:PZ?PZ.rows:[],days:0,done:PZ?PZ.i:0,start:start,err:'',mode:mode,inputs:PZ&&PZ.inputs||0,fixes:PZ&&PZ.fixes||0};$('na-paste').style.display='none';renderReview();info('출결 시트를 불러오는 중…');
 var stoppedAt=null;
 try{var p=state.p;
  if(CFG.url){var cls=screenClass();var d0=await apiLoad(m,cls);if(!d0||!d0.ok)throw new Error((d0&&d0.error)||'시트를 불러오지 못했습니다');p=parseSheet(d0.tsv);state.sheet=d0.tsv;state.p=p}
  if(!p)throw new Error('출결 시트가 없습니다');if(p.month&&p.month!==m)throw new Error('시트는 '+p.month+'월, 나이스는 '+m+'월입니다');
  var now=new Date(),todayY=now.getFullYear()*10000+(now.getMonth()+1)*100+now.getDate();
  var days=(p.days||[]).filter(function(d){return +(y+('0'+m).slice(-2)+('0'+d).slice(-2))<=todayY});
  state.review.days=days.length;renderReview();
  for(var i=PZ?PZ.i:0;i<days.length;i++){if(state.rvStop)break;var d=days[i],ymd=y+('0'+m).slice(-2)+('0'+d).slice(-2);state.review.cur=d;highlight([]);
   await gotoDate(ymd);var g=getGrid();if(!g)throw new Error('나이스 출결 표를 찾지 못했습니다');
   var dr=reviewDay(p,d,g.dataSet);
   if(mode==='auto'){var miss=dr.filter(function(x){return x.t==='miss'}),oth=dr.filter(function(x){return x.t!=='ok'&&x.t!=='miss'});var hd=state.review.m+'월 '+d+'일 ('+(i+1)+'/'+state.review.days+') ';
    var fix=dr.filter(function(x){return x.t==='wrong'});oth=oth.filter(function(x){return x.t!=='wrong'});
    if((miss.length||fix.length)&&!oth.length){var ar='OK';
     if(isClosed(getGrid().dataSet)){info(hd+'마감 취소 중…');ar=await unCloseDay()}
     if(ar==='OK'){info(hd+(miss.length?miss.length+'건 입력 ':'')+(fix.length?fix.length+'건 수정 ':'')+'및 저장 중…');ar=await autoInputDay(p,d)}
     if(ar!=='OK'){dr=reviewDay(p,d,getGrid().dataSet);highlight(dr);renderReviewDay(state.review,d,dr);stoppedAt={i:i,d:d,n:miss.length+fix.length,err:ar};break}
     state.review.inputs+=miss.length;state.review.fixes=(state.review.fixes||0)+fix.length;dr=reviewDay(p,d,getGrid().dataSet)}
    if(!dr.some(function(x){return x.t!=='ok'})){var g3=getGrid();if(!isClosed(g3.dataSet)){info(hd+'출결 마감 중…');var cr=await closeDay();
      dr=reviewDay(p,d,getGrid().dataSet);if(cr==='OK'&&dr.some(function(x){return x.t!=='ok'}))cr='마감 후 다시 확인해 보니 맞지 않는 건이 있어요';
      if(cr!=='OK'){highlight(dr);renderReviewDay(state.review,d,dr);stoppedAt={i:i,d:d,n:1,err:cr};break}}}
    highlight(dr);renderReviewDay(state.review,d,dr);info(hd+(dr.some(function(x){return x.t!=='ok'})?'확인 필요':'완료'));await sleep(350)}
   else{highlight(dr);renderReviewDay(state.review,d,dr);info(state.review.m+'월 '+d+'일 검토 중 ('+(i+1)+'/'+state.review.days+')');await sleep(1200)}
   var bad=dr.filter(function(x){return x.t!=='ok'});
   if(bad.length&&!(PZ&&i===PZ.i&&PZ.again)){stoppedAt={i:i,d:d,n:bad.length};break}
   state.review.rows=state.review.rows.concat(dr);state.review.done=i+1;
   if(mode==='auto'&&!state.autoNext&&i<days.length-1&&!state.rvStop){stoppedAt={i:i+1,d:days[i+1],n:0,next:true,doneDay:d};break}}
 }catch(e){state.review.err=e.message}
 if(stoppedAt){state.rvPause={i:stoppedAt.i,d:stoppedAt.d,start:start,rows:state.review.rows,again:!stoppedAt.err&&!stoppedAt.next,next:!!stoppedAt.next,doneDay:stoppedAt.doneDay,n:stoppedAt.n,mode:mode,err:stoppedAt.err||'',inputs:state.review.inputs,fixes:state.review.fixes};state.review=null;state.reviewing=false;state.key='';state.apiWant=CFG.url?'':state.apiWant;view();return}
 try{if(curYmd()!==start)await gotoDate(start)}catch(e){}
 highlight([]);state.review.cur=0;state.reviewing=false;state.key='';renderReview()}
function pauseHL(){if(!state.rvPause)return;var g=getGrid();if(!g)return;var ds=g.dataSet;
 highlight(state.todo.map(function(r){var x=findIdx(ds,r);if(typeof x==='string')return null;var s=r.status||'';return {idx:x,t:(!r.flag&&!r.fix&&(/^OK/.test(s)||/일치|마감됨/.test(s)))?'ok':'bad'}}).filter(Boolean))}
$('na-rv').onclick=function(){runReview('review')};$('na-am').onclick=function(){runReview('auto')};
$('na-rvx').onclick=function(){state.rvPause=null;highlight([]);state.key='';view()};
function pauseExtras(){var g=getGrid();if(!g)return [];var ds=g.dataSet,used={};state.todo.forEach(function(r){var x=findIdx(ds,r);if(typeof x!=='string')used[x]=1});var out=[];
 for(var i=0;i<ds.getRowCount();i++){if(used[i])continue;var cg=norm(ds.getValue(i,'chulgyulGb'));if(cg)out.push({idx:i,no:String(ds.getValue(i,'clsNo')),name:norm(ds.getValue(i,'stuFlnm')).replace(/\(.*\)$/,''),kind:cg,reason:norm(ds.getValue(i,'atteRmkCn'))})}return out}
var __list0=list;list=function(){__list0();if(state.rvPause&&!state.review){var ex=pauseExtras();
 if(ex.length){var rowsH=ex.map(function(x){return '<tr class="fx"><td class="no">'+esc(x.no)+'</td><td>'+esc(x.name)+'</td><td><s>'+esc(x.kind)+'</s></td><td class="rs w">시트에 없음 · '+esc(x.reason||'사유 없음')+'</td><td>'+IC.bad+'</td></tr>'}).join('');
  var tb=$('na-list').querySelector('tbody');if(tb)tb.insertAdjacentHTML('beforeend',rowsH);else $('na-list').innerHTML='<table><colgroup><col style="width:52px"><col style="width:80px"><col style="width:140px"><col><col style="width:54px"></colgroup><thead><tr><th>번호</th><th>이름</th><th>구분</th><th>사유</th><th>상태</th></tr></thead><tbody>'+rowsH+'</tbody></table>';
  var hs=document.getElementById('na-hl');pauseHL();if(hs)hs.textContent+=ex.map(function(x){return 'div[role=row][data-rowindex="'+x.idx+'"]>.cl-grid-cell,div[role=row][data-rowindex="'+x.idx+'"] .cl-control{background-color:#fecaca!important}div[role=row][data-rowindex="'+x.idx+'"]{box-shadow:inset 4px 0 0 #dc2626}'}).join('')}
 var P0=state.rvPause;$('na-info').innerHTML=P0.next?'<span style="color:var(--ok,#16a34a);font-weight:600">'+P0.doneDay+'일 마감 완료</span> · 확인하고 [다음 날 ▶]':'<span style="color:var(--bad);font-weight:600">'+P0.d+'일에서 멈춤</span>'+(P0.err?' · '+esc(P0.err):' · 고치고 저장한 뒤 ['+(P0.mode==='auto'?'이어서 자동 입력':'이어서 검토')+']')+(ex.length?' <span style="color:var(--g5)">(시트에 없는 건은 시트에 적거나 나이스에서 지우세요)</span>':'')}};
loadSheet();view();var __iv=setInterval(view,800);
window.__NEIS_ATT__={v:49,cfg:__cfgSig,iv:__iv,show:function(){P.style.display=''},parseSheet:parseSheet};
})();

}};
