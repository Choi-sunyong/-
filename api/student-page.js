// api/student-page.js
// 카카오톡·메신저 링크 미리보기는 자바스크립트를 실행하지 않고 <title>만 읽음.
// student.html?cat=담임/동아리 링크가 미리보기에서도 그 반 이름으로 보이도록, 제목만 바꿔서 그대로 내려줌.
import fs from 'fs';
import path from 'path';
const TITLES={'담임':'향남고등학교 2학년 4반','동아리':'향남고등학교 코리아 윙즈'};
const IMAGES={'담임':'og-homeroom-2.jpg','동아리':'og-club.png'};
// 물품 신청 미리보기 설명 = 그 신청(학습지) 이름
const SB_URL='https://uxycuvpzsyfvsbwnrexv.supabase.co';
async function sdtWsTitle(ws,t){
  const key=process.env.SUPABASE_SERVICE_KEY;ws=String(ws||'');t=String(t||'');
  if(!key||!/^\d+$/.test(ws)||!/^[0-9a-f-]{36}$/i.test(t))return '';
  try{const r=await fetch(SB_URL+'/rest/v1/worksheets?select=title&id=eq.'+ws+'&user_id=eq.'+t,{headers:{apikey:key,Authorization:'Bearer '+key}});
    const j=await r.json();const v=String((j&&j[0]&&j[0].title)||'');return v.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}catch(e){return '';}
}
export default async function handler(req,res){
  const cat=String(req.query.cat||'');
  let html='';
  try{html=fs.readFileSync(path.join(process.cwd(),'student.html'),'utf8');}
  catch(e){const r=await fetch('https://'+req.headers.host+'/student.html');html=await r.text();}
  if(String(req.query.p||'')==='1'){ // 물품 신청 링크
    html=html.replace(/<title>[^<]*<\/title>/,'<title>향남고등학교 물품 신청</title>')
      .replace(/(<meta property="og:title" content=")[^"]*/,'$1향남고등학교 물품 신청')
      .replace(/(<meta property="og:description" content=")[^"]*/,'$1'+(await sdtWsTitle(req.query.ws,req.query.t)||'온라인 신청서'))
      .replace('og-subject.png','og-purchase-2.png');
  }
  const t=TITLES[cat];
  if(t){
    html=html.replace(/<title>[^<]*<\/title>/,'<title>'+t+'</title>')
      .replace(/(<meta property="og:title" content=")[^"]*/,'$1'+t)
      .replace('og-subject.png',IMAGES[cat]);
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.status(200).send(html);
}
