// api/chat.js
// 윤리토론장(학생용 AI 채팅) 전용 대리인 서버.
// API 키는 여기(Vercel 서버)에만 있고, 학생 브라우저는 이 주소(/api/chat)로만 요청을 보냄.
// Vercel 프로젝트 설정 > Environment Variables 에 ANTHROPIC_API_KEY를 반드시 추가해야 동작함.

export default async function handler(req, res) {
  // 다른 사이트에서 이 서버를 함부로 갖다 쓰는 걸 막기 위한 최소한의 안전장치.
  // 필요하면 여기 도메인을 실제 배포 주소로 바꿔서 더 좁혀도 됨 (예: 'https://rosy-phi-35.vercel.app').
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST만 지원해요.' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY가 서버에 설정되지 않았어요. Vercel 환경변수를 확인해 주세요.' });
    return;
  }

  try {
    const { systemPrompt, messages } = req.body || {};
    if (!systemPrompt || !Array.isArray(messages)) {
      res.status(400).json({ error: 'systemPrompt와 messages가 필요해요.' });
      return;
    }
    // 한 번 요청에 너무 긴 대화가 오는 것(=비용 폭탄)을 막기 위한 최소한의 길이 제한
    if (messages.length > 40) {
      res.status(400).json({ error: '대화가 너무 길어요. 새로고침 후 다시 시작해 주세요.' });
      return;
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5', // 토론 상대 역할은 논리적 허점을 짚어내는 능력이 중요해서 Sonnet으로 감. 비용을 더 줄이고 싶으면 'claude-haiku-4-5-20251001'로 바꿔도 됨(품질은 좀 떨어짐).
        max_tokens: 500,
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
api/chat.js
