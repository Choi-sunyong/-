// api/chat.js
// 윤리토론장(학생용 AI 채팅) 전용 대리인 서버.
// API 키를 따로 등록할 필요 없이, 이미 싯다르타(index.html)에서 쓰고 있는 선생님의 Anthropic 키를
// Supabase profiles 테이블에서 그때그때 직접 가져와서 씀. 이 조회는 서버(Vercel)에서만 일어나고,
// SUPABASE_SERVICE_KEY(=RLS를 우회하는 관리자 키)도 여기서만 쓰이므로 학생 브라우저엔 아무 키도 노출 안 됨.

export const config = { maxDuration: 60 };

const SUPABASE_URL = 'https://uxycuvpzsyfvsbwnrexv.supabase.co';

import crypto from 'node:crypto';

// ===== 유료 Gemma 4 (Google Cloud Vertex AI) =====
// Vercel 환경변수 GCP_SA_KEY(서비스 계정 JSON 전체)와 GCP_PROJECT_ID가 있으면 Vertex AI로 부름.
// 없거나 실패하면 아래 Gemini API 키(무료 등급) 방식으로 넘어감.
let vxToken = null, vxTokenExp = 0;
async function vertexToken() {
  if (vxToken && Date.now() < vxTokenExp - 60000) return vxToken;
  const sa = JSON.parse(process.env.GCP_SA_KEY);
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }) });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('Vertex 인증 실패: ' + (d.error_description || d.error || r.status));
  vxToken = d.access_token; vxTokenExp = Date.now() + (d.expires_in || 3600) * 1000;
  return vxToken;
}
async function vertexGemma(contents, gen, ms) {
  const project = process.env.GCP_PROJECT_ID || JSON.parse(process.env.GCP_SA_KEY).project_id;
  const tok = await vertexToken();
  // 가끔 한 요청이 60초 넘게 멈춰 학생이 하염없이 기다리는 일이 있어(2026-11 수업 중 확인) 시간 제한을 둠 → 끊고 바로 다시 요청
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms || 20000);
  let r;
  try {
    r = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/gemma-4-26b-a4b-it-maas:generateContent`, {
      method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ contents, generationConfig: gen })
    });
  } catch (e) { throw new Error(ac.signal.aborted ? 'Vertex 응답 지연' : String(e.message || e)); }
  finally { clearTimeout(to); }
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || ('Vertex 오류 ' + r.status));
  const u = d?.usageMetadata || {};
  return { text: (d?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim(), usage: { in: u.promptTokenCount || 0, out: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST만 지원해요.' }); return; }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    res.status(500).json({ error: 'SUPABASE_SERVICE_KEY가 서버에 설정되지 않았어요.' });
    return;
  }

  try {
    const { teacherId, systemPrompt, messages, maxTokens, temperature, engine } = req.body || {};
    // 채점 보조처럼 긴 JSON 답이 필요한 호출만 maxTokens를 크게 보냄 (기본 600, 최대 2000)
    const maxOut = Math.min(2000, Math.max(200, Number(maxTokens) || 600));
    if (!teacherId || !systemPrompt || !Array.isArray(messages)) {
      res.status(400).json({ error: 'teacherId, systemPrompt, messages가 모두 필요해요.' });
      return;
    }
    if (messages.length > 40) {
      res.status(400).json({ error: '대화가 너무 길어요. 새로고침 후 다시 시작해 주세요.' });
      return;
    }

    // engine==='gemini': 선생님이 설정에 등록한 Gemini API 키로 처리 (연습용 토론장에서 사용)
    if (engine === 'gemini' || engine === 'gemma') {
      const isGemma = engine === 'gemma';
      const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
      // Gemma는 시스템 지침을 첫 사용자 메시지 앞에 붙여서 전달 (모델별 지원 차이로 인한 오류 방지)
      if (isGemma && contents.length) contents[0].parts[0].text = `<지침>\n${systemPrompt}\n</지침>\n\n` + contents[0].parts[0].text;
      const gen = { maxOutputTokens: maxOut <= 800 ? 2048 : Math.max(4096, maxOut * 4) };
      if (typeof temperature === 'number') gen.temperature = Math.min(1, Math.max(0, temperature));
      let vxErr = '';
      if (isGemma && process.env.GCP_SA_KEY) {
        // 짧은 토론 답(기본 600)은 한 번에 15초까지만 기다리고 최대 3번 다시 시도, 채점처럼 긴 답은 45초
        const t0 = Date.now(), per = maxOut <= 800 ? 15000 : 45000;
        for (let i = 0; i < 3 && Date.now() - t0 + 3000 < 52000; i++) {
          try { const v = await vertexGemma(contents, gen, Math.min(per, 52000 - (Date.now() - t0))); if (v.text) { res.status(200).json({ text: v.text, via: 'vertex', usage: v.usage, tries: i + 1 }); return; } vxErr = '빈 응답'; }
          catch (e) { vxErr = String(e.message || e); }
        }
      }
      const gr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(teacherId)}&select=gemini_api_key`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      const gk = (await gr.json())?.[0]?.gemini_api_key;
      if (!gk) { res.status(400).json({ error: (vxErr ? vxErr + ' / ' : '') + '선생님 계정에 Gemini API 키가 등록되어 있지 않아요.' }); return; }
      // Gemma 4는 26B(활성 4B) 모델이 31B보다 훨씬 빨라서 교실 동시 사용에 맞음
      const model = isGemma ? 'gemma-4-26b-a4b-it' : 'gemini-3.5-flash';
      const r2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gk },
        body: JSON.stringify(Object.assign(isGemma ? {} : { systemInstruction: { parts: [{ text: systemPrompt }] } }, { contents, generationConfig: gen }))
      });
      const d2 = await r2.json();
      if (!r2.ok) { res.status(r2.status).json({ error: d2?.error?.message || 'Gemini 응답을 받아오지 못했어요.' }); return; }
      const text2 = (d2?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
      const u2 = d2?.usageMetadata || {};
      res.status(200).json({ text: text2, via: isGemma ? 'gemma-free' : 'gemini-api', vertexError: vxErr || undefined, usage: { in: u2.promptTokenCount || 0, out: (u2.candidatesTokenCount || 0) + (u2.thoughtsTokenCount || 0) } });
      return;
    }

    // 1) 선생님이 설정에 등록해둔 Anthropic API 키를 Supabase에서 조회 (service key라 RLS 무시하고 읽을 수 있음)
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(teacherId)}&select=api_key`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const profData = await profRes.json();
    const apiKey = profData?.[0]?.api_key;
    if (!apiKey) {
      res.status(400).json({ error: '선생님 계정에 API 키가 등록되어 있지 않아요. 싯다르타 설정에서 먼저 등록해 주세요.' });
      return;
    }

    // 2) 그 키로 Anthropic 호출
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', // 싯다르타 본체와 동일한 모델로 통일 (토론 상대 역할은 논리적 허점을 짚어내는 능력이 중요해서 Sonnet 사용)
        max_tokens: maxOut,
        ...(typeof temperature === 'number' ? { temperature: Math.min(1, Math.max(0, temperature)) } : {}),
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json({ error: data?.error?.message || 'AI 응답을 받아오지 못했어요.' });
      return;
    }
    const text = (data.content || []).map(b => b.text || '').join('');
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: '서버 오류: ' + e.message });
  }
}
