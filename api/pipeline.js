const { guard } = require('./_guard');

// קריאה ישירה לפונקציה במקום HTTP פנימי
async function callHandler(handler, body) {
  return new Promise((resolve, reject) => {
    // הקריאה הפנימית עוברת את אותה בדיקת סיסמה, לכן מצרפים את המפתח מהשרת
    const req = {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', 'x-app-key': process.env.APP_ACCESS_KEY },
    };
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
  if (guard(req, res, { method: 'POST' })) return;

  try {
    const { brand, businessDescription, goals, audience, budget, tone, groupInfo, contentType, imagePrompt, imageStyle, rewriteText } = req.body;

    if (!brand || !businessDescription || !groupInfo || !contentType || !imagePrompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const safe = async (label, fn) => {
      try { return await fn(); }
      catch (err) { console.error(`pipeline:${label} failed`, err); return { error: err.message }; }
    };

    // הרץ את כל הקריאות הבלתי-תלויות במקביל
    const [adsResult, hrResult, imageResult, rewriteResult] = await Promise.all([
      safe('ads', () => callHandler(adsHandler, { brand, businessDescription, goals, audience, budget, tone })),
      safe('hr', () => callHandler(hrHandler, { groupInfo, contentType, tone, language: 'עברית' })),
      safe('image', () => callHandler(imageHandler, { prompt: imagePrompt, style: imageStyle || 'מציאותי' })),
      rewriteText
        ? safe('rewrite', () => callHandler(rewriteHandler, { originalText: rewriteText, targetPlatform: 'whatsapp', tone: 'מקצועי', style: 'קצר' }))
        : Promise.resolve({ rewrites: [] }),
    ]);

    if (adsResult.error && !adsResult.ads) {
      return res.status(500).json({ error: `ads failed: ${adsResult.error}` });
    }

    const [saveResult, telegramResult] = await Promise.all([
      safe('google-save', () => callHandler(googleSaveHandler, {
        brand,
        brief: businessDescription,
        ads: adsResult.ads || [],
        hrContent: hrResult.items || [],
        imageUrls: imageResult.images || [],
        status: 'pending',
      })),
      safe('telegram', () => callHandler(telegramHandler, {
        brand,
        brief: businessDescription,
        ads: adsResult.ads || [],
        hrContent: hrResult.items || [],
        imageUrls: imageResult.images || [],
      })),
    ]);

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
