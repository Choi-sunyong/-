export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { apiKey, prompt, fileOld, fileRefs, fileExample } = req.body;
  if (!apiKey || !apiKey.startsWith('sk-ant-')) return res.status(400).json({ error: 'API 키가 올바르지 않습니다.' });

  const userContent = [];
  if (fileOld?.base64) userContent.push({type:'document',source:{type:'base64',media_type:fileOld.mediaType||'application/pdf',data:fileOld.base64}});
  if (Array.isArray(fileRefs)) {
    for (const ref of fileRefs) {
      if (ref?.base64) userContent.push({type:'document',source:{type:'base64',media_type:ref.mediaType||'application/pdf',data:ref.base64}});
    }
  }
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
    const usage = data.usage || {};
    // claude-sonnet-4-6: input $3/1M, output $15/1M (USD)
    const inputCost = (usage.input_tokens || 0) * 3 / 1000000;
    const outputCost = (usage.output_tokens || 0) * 15 / 1000000;
    const totalCost = inputCost + outputCost;
    res.status(200).json({ result, usage, cost: totalCost });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
