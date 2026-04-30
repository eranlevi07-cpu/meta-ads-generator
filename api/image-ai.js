function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

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

  if (images.length === 0) throw new Error('לא התקבלו תמונות מ-Gemini');
  return images;
};

const nanoBananaImage = async (prompt, style) => {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) throw new Error('NANOBANANA_API_KEY אינו מוגדר');

  const payload = { prompt, style, width: 1024, height: 1024, format: 'base64', quality: 'high' };

  const response = await fetch(process.env.NANOBANANA_ENDPOINT || 'https://api.nanobanana.io/v1/images', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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

  if (images.length === 0) throw new Error('לא התקבלו תמונות מ-NanoBanana');
  return images;
};

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, style, provider } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

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

    return res.status(200).json({ images });
  } catch (error) {
    console.error('Error image-ai:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
