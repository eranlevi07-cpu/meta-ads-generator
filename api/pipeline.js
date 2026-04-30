function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req.headers.host || 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'request failed');
  return json;
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { brand, businessDescription, goals, audience, budget, tone, groupInfo, contentType, imagePrompt, imageStyle, rewriteText } = req.body;

    if (!brand || !businessDescription || !groupInfo || !contentType || !imagePrompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const base = getBaseUrl(req);

    const safe = async (label, fn) => {
      try { return await fn(); }
      catch (err) { console.error(`pipeline:${label} failed`, err); return { error: err.message }; }
    };

    const adsResult = await postJson(`${base}/api/ads-ai`, { brand, businessDescription, goals, audience, budget, tone });
    const hrResult = await safe('hr', () => postJson(`${base}/api/hr-content-ai`, { groupInfo, contentType, tone, language: 'עברית' }));
    const imageResult = await safe('image', () => postJson(`${base}/api/image-ai`, { prompt: imagePrompt, style: imageStyle || 'מציאותי' }));
    const rewriteResult = rewriteText
      ? await safe('rewrite', () => postJson(`${base}/api/rewrite-ai`, { originalText: rewriteText, targetPlatform: 'whatsapp', tone: 'מקצועי', style: 'קצר' }))
      : { rewrites: [] };

    const saveResult = await safe('google-save', () => postJson(`${base}/api/google-save`, {
      brand,
      brief: businessDescription,
      ads: adsResult.ads || [],
      hrContent: hrResult.items || [],
      imageUrls: imageResult.images || [],
      status: 'pending',
    }));

    const telegramResult = await safe('telegram', () => postJson(`${base}/api/telegram-approval`, {
      brand,
      brief: businessDescription,
      ads: adsResult.ads || [],
      hrContent: hrResult.items || [],
      imageUrls: imageResult.images || [],
    }));

    return res.status(200).json({
      success: true,
      ads: adsResult.ads,
      hr: hrResult.items,
      images: imageResult.images,
      rewrites: rewriteResult.rewrites,
      googleSave: saveResult,
      telegram: telegramResult,
    });
  } catch (error) {
    console.error('pipeline failed', error);
    return res.status(500).json({ error: error.message });
  }
};
