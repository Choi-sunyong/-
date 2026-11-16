// api/product.js
// 학생 물품 신청: 11번가·G마켓 상품 링크 → 품명·가격(할인 전 판매가)을 읽어 줌.
// 쇼핑몰 화면은 브라우저에서 직접 못 읽어서(다른 사이트) 서버가 대신 읽음. 11번가·G마켓 주소만, 출입증(학생) 또는 선생님 로그인이 있어야 함.
const SUPABASE_URL = 'https://uxycuvpzsyfvsbwnrexv.supabase.co';

async function allowed(req, serviceKey) {
  try {
    const tk = String(req.headers['x-sdt-tok'] || '');
    if (/^[0-9a-f]{48}$/.test(tk)) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/sdt_sessions?token=eq.${tk}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=student_id`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if ((await r.json())?.[0]) return true;
    }
    const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (tok) { const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${tok}` } }); if (u.ok) return true; }
  } catch (e) {}
  return false;
}
const dec = s => String(s || '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const meta = (h, p) => { const m = h.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']`, 'i')) || h.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${p}["']`, 'i')); return m ? dec(m[1]) : ''; };
const firstNum = (h, res) => { for (const re of res) { const m = h.match(re); if (m) { const v = +String(m[1]).replace(/[^\d]/g, ''); if (v > 0 && v < 100000000) return v; } } return 0; };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-sdt-tok');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) { res.status(500).json({ error: 'server' }); return; }
  if (!(await allowed(req, serviceKey))) { res.status(401).json({ error: 'auth' }); return; }
  const raw = String(req.query.url || '');
  let id = '', shop = '', url = '';
  let m;
  if (/11st\.co\.kr/i.test(raw) && (m = raw.match(/products\/(?:ma\/|pa\/)?(\d{5,})/))) { shop = 'st'; id = m[1]; url = 'https://www.11st.co.kr/products/' + id; }
  else if (/(gmarket\.co\.kr|gmkt\.kr)/i.test(raw) && ((m = raw.match(/goods[cC]ode=(\d{5,})/)) || (m = raw.match(/\/(?:vi\/)?product\/(\d{5,})/)) || (m = raw.match(/\/vi\/(\d{5,})/)))) { shop = 'gm'; id = m[1]; url = 'https://item.gmarket.co.kr/Item?goodscode=' + id; }
  if (!url) { res.status(400).json({ error: 'url' }); return; }
  try {
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 'Accept-Language': 'ko-KR,ko;q=0.9', Accept: 'text/html,application/xhtml+xml' } });
    clearTimeout(to);
    const h = await r.text();
    let name = meta(h, 'og:title') || dec((h.match(/<title>([^<]*)<\/title>/i) || [])[1]);
    name = name.replace(/^\[?11번가\]?\s*[-:]?\s*/, '').replace(/\s*[-|:]\s*(11번가|G마켓|지마켓|Gmarket).*$/i, '').replace(/^G마켓\s*[-:]\s*/i, '').trim();
    // 할인 전 판매가 우선 (품의는 할인 전 금액)
    const price = shop === 'st'
      ? firstNum(h, [/"selPrc"\s*:\s*"?([\d,]+)/, /"dispPrice"\s*:\s*"?([\d,]+)/, /"finalDscPrc"\s*:\s*"?([\d,]+)/, /product:price:amount["'][^>]*content=["']([\d,.]+)/i, /content=["']([\d,.]+)["'][^>]*product:price:amount/i])
      : firstNum(h, [/class="price_original"[^>]*>\s*([\d,]+)/, /"originalPrice"\s*:\s*"?([\d,]+)/, /class="price_real"[^>]*>\s*([\d,]+)/, /"(?:sellPrice|itemPrice|price)"\s*:\s*"?([\d,]+)/, /product:price:amount["'][^>]*content=["']([\d,.]+)/i, /content=["']([\d,.]+)["'][^>]*product:price:amount/i]);
    res.status(200).json({ ok: !!(name || price), name: name.slice(0, 120), price, shop, status: r.status });
  } catch (e) { res.status(200).json({ ok: false, error: String(e.message || e).slice(0, 80) }); }
}
