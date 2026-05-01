function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

// קריאה ישירה לפונקציה במקום HTTP פנימי
async function callHandler(handler, body) {
  return new Promise((resolve, reject) => {
    const req = { method: 'POST', body, headers: { 'content-type': 'application/json' } };
    const res = {
      _status: 200,
      status(code) { this._status = code; return this; },
      setHeader() { return this; },
      json(data) {
        if (this._status >= 400) reject(new Error(data.error || 'Error'));
        else resolve(data);
      },
      end() { resolve({}); },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

const adsHandler = require('./ads-ai');
const hrHandler = require('./hr-content-ai');
const imageHandler = require('./image-ai');
const rewriteHandler = require('./rewrite-ai');
const googleSaveHandler = require('./google-save');
const telegramHandler = require('./telegram-approval');

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { brand, businessDescription, goals, audience, budget, tone, groupInfo, contentType, imagePrompt, imageStyle, rewriteText } = req.body;

    if (!brand || !businessDescription || !groupInfo || !contentType || !imagePrompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const safe = async (label, fn) => {
      try { return await fn(); }
      catch (err) { console.error(`pipeline:${label} failed`, err); return { error: err.message }; }
    };

    const adsResult = await callHandler(adsHandler, { brand, businessDescription, goals, audience, budget, tone });
    const hrResult = await safe('hr', () => callHandler(hrHandler, { groupInfo, contentType, tone, language: 'עברית' }));
    const imageResult = await safe('image', () => callHandler(imageHandler, { prompt: imagePrompt, style: imageStyle || 'מציאותי' }));
    const rewriteResult = rewriteText
      ? await safe('rewrite', () => callHandler(rewriteHandler, { originalText: rewriteText, targetPlatform: 'whatsapp', tone: 'מקצועי', style: 'קצר' }))
      : { rewrites: [] };

    const saveResult = await safe('google-save', () => callHandler(googleSaveHandler, {
      brand,
      brief: businessDescription,
      ads: adsResult.ads || [],
      hrContent: hrResult.items || [],
      imageUrls: imageResult.images || [],
      status: 'pending',
    }));

    const telegramResult = await safe('telegram', () => callHandler(telegramHandler, {
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
