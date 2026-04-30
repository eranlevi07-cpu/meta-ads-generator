const fetch = global.fetch || require('node-fetch');

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const geminiImage = async (prompt, style) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY אינו מוגדר');

  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-image-preview';
  const fullPrompt = style ? `${prompt}. Style: ${style}` : prompt;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const images = [];

  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline && inline.data) {
      const mime = inline.mimeType || inline.mime_type || 'image/png';
      images.push(`data:${mime};base64,${inline.data}`);
    }
  }

  if (images.length === 0) {
    throw new Error('לא התקבלו תמונות מ-Gemini');
  }

  return images;
};

const nanoBananaImage = async (prompt, style) => {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) throw new Error('NANOBANANA_API_KEY אינו מוגדר');

  const payload = {
    prompt,
    style,
    width: 1024,
    height: 1024,
    format: 'base64',
    quality: 'high',
  };

  const response = await fetch(process.env.NANOBANANA_ENDPOINT || 'https://api.nanobanana.io/v1/images', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NanoBanana API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const images = [];

  if (data?.data?.length) {
    for (const chunk of data.data) {
      if (chunk.b64_json) images.push(`data:image/png;base64,${chunk.b64_json}`);
      else if (chunk.url) images.push(chunk.url);
    }
  }

  if (images.length === 0) {
    throw new Error('לא התקבלו תמונות מ-NanoBanana');
  }

  return images;
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { prompt, style, provider } = JSON.parse(event.body);

    if (!prompt) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing prompt' }) };
    }

    let images;
    const useProvider = (provider || '').toLowerCase();

    if (useProvider === 'nanobanana') {
      images = await nanoBananaImage(prompt, style);
    } else {
      try {
        images = await geminiImage(prompt, style);
      } catch (mainErr) {
        if (process.env.NANOBANANA_API_KEY) {
          images = await nanoBananaImage(prompt, style);
        } else {
          throw mainErr;
        }
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ images }),
    };
  } catch (error) {
    console.error('Error image-ai:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};