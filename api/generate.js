export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { apiKey, prompt, fileOld, fileRef, fileExample } = req.body;
  if (!apiKey || !apiKey.startsWith('sk-ant-')) return res.status(400).json({ error: 'API 키가 올바르지 않습니다.' });

  const userContent = [];

  if (fileOld?.base64) userContent.push({type:'document',source:{type:'base64',media_type:fileOld.mediaType||'application/pdf',data:fileOld.base64}});
  if (fileRef?.base64) userContent.push({type:'document',source:{type:'base64',media_type:fileRef.mediaType||'application/pdf',data:fileRef.base64}});
  if (fileExample?.base64) userContent.push({type:'document',source:{type:'base64',media_type:fileExample.mediaType||'application/pdf',data:fileExample.base64}});

  userContent.push({ type: 'text', text: prompt });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, messages: [{ role: 'user', content: userContent }] })
    });
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const result = data.content?.map(i => i.text || '').join('') || '';
    res.status(200).json({ result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
