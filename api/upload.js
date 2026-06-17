export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = 'https://uxycuvpzsyfvsbwnrexv.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not set' });
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  const contentType = req.headers['content-type'] || 'application/octet-stream';
  const filePath = decodeURIComponent(req.headers['x-file-path'] || 'unknown');

  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/files/${filePath}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    return res.status(400).json({ error: errText });
  }

  res.status(200).json({ success: true, path: filePath });
}
