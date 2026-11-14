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

  // 보안(2026-11-14): 누구나 부를 수 있는 주소라서 학생 사진 올리기 형식만 허용 — 'ws-학습지번호/학생-시각.jpg' 새 파일만, 이미지만, 5MB까지.
  // 예전엔 아무 경로나 지우고 덮어쓸 수 있었음(서비스 키로 버킷 전체 접근)
  const contentType = String(req.headers['content-type'] || '');
  const filePath = decodeURIComponent(String(req.headers['x-file-path'] || ''));
  if (!/^ws-\d+\/[A-Za-z0-9_-]{1,40}-\d{10,14}\.jpg$/.test(filePath)) return res.status(400).json({ error: 'bad path' });
  if (!/^image\/(jpeg|png|webp)$/.test(contentType)) return res.status(400).json({ error: 'bad type' });
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 5 * 1024 * 1024) return res.status(413).json({ error: 'too big' }); chunks.push(chunk); }
  const buffer = Buffer.concat(chunks);

  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/files/${filePath}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      body: buffer,
    }
  );

  const responseText = await uploadRes.text();
  
  if (!uploadRes.ok) {
    return res.status(400).json({ error: responseText });
  }

  res.status(200).json({ success: true, path: filePath });
}
