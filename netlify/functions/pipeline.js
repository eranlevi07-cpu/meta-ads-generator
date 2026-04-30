const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

async function postJson(path, payload) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'request failed');
  return json;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { brand, businessDescription, goals, audience, budget, tone, groupInfo, contentType, imagePrompt, imageStyle, rewriteText } = JSON.parse(event.body);

    if (!brand || !businessDescription || !groupInfo || !contentType || !imagePrompt) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const safe = async (label, fn) => {
      try { return await fn(); }
      catch (err) { console.error(`pipeline:${label} failed`, err); return { error: err.message }; }
    };

    const adsResult = await postJson('/.netlify/functions/ads-ai', { brand, businessDescription, goals, audience, budget, tone });
    const hrResult = await safe('hr', () => postJson('/.netlify/functions/hr-content-ai', { groupInfo, contentType, tone, language: 'עברית' }));
    const imageResult = await safe('image', () => postJson('/.netlify/functions/image-ai', { prompt: imagePrompt, style: imageStyle || 'מציאותי' }));
    const rewriteResult = rewriteText
      ? await safe('rewrite', () => postJson('/.netlify/functions/rewrite-ai', { originalText: rewriteText, targetPlatform: 'whatsapp', tone: 'מקצועי', style: 'קצר' }))
      : { rewrites: [] };

    const saveResult = await safe('google-save', () => postJson('/.netlify/functions/google-save', {
      brand,
      brief: businessDescription,
      ads: adsResult.ads || [],
      hrContent: hrResult.items || [],
      imageUrls: imageResult.images || [],
      status: 'pending',
    }));

    const telegramResult = await safe('telegram', () => postJson('/.netlify/functions/telegram-approval', {
      brand,
      brief: businessDescription,
      ads: adsResult.ads || [],
      hrContent: hrResult.items || [],
      imageUrls: imageResult.images || [],
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        ads: adsResult.ads,
        hr: hrResult.items,
        images: imageResult.images,
        rewrites: rewriteResult.rewrites,
        googleSave: saveResult,
        telegram: telegramResult,
      }),
    };
  } catch (error) {
    console.error('pipeline failed', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
  }
};
