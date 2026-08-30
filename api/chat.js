// api/chat.js
// 윤리토론장(학생용 AI 채팅) 전용 대리인 서버.
// API 키를 따로 등록할 필요 없이, 이미 싯다르타(index.html)에서 쓰고 있는 선생님의 Anthropic 키를
// Supabase profiles 테이블에서 그때그때 직접 가져와서 씀. 이 조회는 서버(Vercel)에서만 일어나고,
// SUPABASE_SERVICE_KEY(=RLS를 우회하는 관리자 키)도 여기서만 쓰이므로 학생 브라우저엔 아무 키도 노출 안 됨.

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
    const { teacherId, systemPrompt, messages } = req.body || {};
    if (!teacherId || !systemPrompt || !Array.isArray(messages)) {
      res.status(400).json({ error: 'teacherId, systemPrompt, messages가 모두 필요해요.' });
      return;
    }
    if (messages.length > 40) {
      res.status(400).json({ error: '대화가 너무 길어요. 새로고침 후 다시 시작해 주세요.' });
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
        max_tokens: 600,
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
