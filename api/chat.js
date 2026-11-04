// api/chat.js
// 윤리토론장(학생용 AI 채팅) 전용 대리인 서버.
// API 키를 따로 등록할 필요 없이, 이미 싯다르타(index.html)에서 쓰고 있는 선생님의 Anthropic 키를
// Supabase profiles 테이블에서 그때그때 직접 가져와서 씀. 이 조회는 서버(Vercel)에서만 일어나고,
// SUPABASE_SERVICE_KEY(=RLS를 우회하는 관리자 키)도 여기서만 쓰이므로 학생 브라우저엔 아무 키도 노출 안 됨.

export const config = { maxDuration: 60 };

const SUPABASE_URL = 'https://uxycuvpzsyfvsbwnrexv.supabase.co';

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
      const gr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(teacherId)}&select=gemini_api_key`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      const gk = (await gr.json())?.[0]?.gemini_api_key;
      if (!gk) { res.status(400).json({ error: '선생님 계정에 Gemini API 키가 등록되어 있지 않아요.' }); return; }
      const isGemma = engine === 'gemma';
      const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
      // Gemma는 시스템 지침을 첫 사용자 메시지 앞에 붙여서 전달 (모델별 지원 차이로 인한 오류 방지)
      if (isGemma && contents.length) contents[0].parts[0].text = `<지침>\n${systemPrompt}\n</지침>\n\n` + contents[0].parts[0].text;
      const gen = { maxOutputTokens: Math.max(4096, maxOut * 4) };
      if (typeof temperature === 'number') gen.temperature = Math.min(1, Math.max(0, temperature));
      // Gemma 4는 26B(활성 4B) 모델이 31B보다 훨씬 빨라서 교실 동시 사용에 맞음
      const model = isGemma ? 'gemma-4-26b-a4b-it' : 'gemini-3.5-flash';
      const r2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gk },
        body: JSON.stringify(Object.assign(isGemma ? {} : { systemInstruction: { parts: [{ text: systemPrompt }] } }, { contents, generationConfig: gen }))
      });
      const d2 = await r2.json();
      if (!r2.ok) { res.status(r2.status).json({ error: d2?.error?.message || 'Gemini 응답을 받아오지 못했어요.' }); return; }
      const text2 = (d2?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
      res.status(200).json({ text: text2 });
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
