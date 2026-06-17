import { createClient } from '@supabase/supabase-js';

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
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  const contentType = req.headers['content-type'] || 'application/octet-stream';
  const fileName = decodeURIComponent(req.headers['x-file-name'] || 'file');
  const filePath = decodeURIComponent(req.headers['x-file-path'] || fileName);

  const { error } = await sb.storage
    .from('files')
    .upload(filePath, buffer, { contentType, upsert: true });

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json({ success: true, path: filePath });
}
