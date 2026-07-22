const { guard } = require('./_guard');
const { generateImagePrompt } = require('./_image-prompt');

// ממיר data URL למרכיביו. מחזיר null אם זה לא data URL.
function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2], buffer: Buffer.from(m[2], 'base64') };
}

// ===== Gemini / Nano Banana =====
// אותו מודל משמש ליצירה ולעריכה. בעריכה מצרפים את התמונה הקיימת
// לצד ההוראה, והמודל משנה רק את מה שביקשו במקום לייצר מאפס.
const geminiImage = async ({ prompt, style, baseImage, instruction }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY אינו מוגדר');

  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-image-preview';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts = [];
  if (baseImage) {
    const parsed = parseDataUrl(baseImage);
    if (!parsed) throw new Error('התמונה לעריכה אינה בפורמט תקין');
    parts.push({ inlineData: { mimeType: parsed.mime, data: parsed.base64 } });
    parts.push({
      text:
        `Edit this image. Apply ONLY the following change and keep everything else ` +
        `exactly as it is - same composition, same subjects, same lighting, same style:\n${instruction}`,
    });
  } else {
    parts.push({ text: style ? `${prompt}. Style: ${style}` : prompt });
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const images = [];
  for (const part of data?.candidates?.[0]?.content?.parts || []) {
    const inline = part.inlineData || part.inline_data;
    if (inline && inline.data) {
      const mime = inline.mimeType || inline.mime_type || 'image/png';
      images.push(`data:${mime};base64,${inline.data}`);
    }
  }

  if (images.length === 0) throw new Error('לא התקבלו תמונות מ-Gemini');
  return images;
};

// ===== OpenAI GPT Image =====
const openaiImage = async ({ prompt, style, baseImage, instruction }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY אינו מוגדר');

  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const size = process.env.OPENAI_IMAGE_SIZE || '1024x1024';

  let response;

  if (baseImage) {
    // עריכה: נשלח כ-multipart עם התמונה הקיימת
    const parsed = parseDataUrl(baseImage);
    if (!parsed) throw new Error('התמונה לעריכה אינה בפורמט תקין');

    const form = new FormData();
    form.append('model', model);
    form.append('size', size);
    form.append('n', '1');
    form.append(
      'prompt',
      `Apply ONLY this change to the image, keeping everything else identical: ${instruction}`
    );
    form.append(
      'image',
      new Blob([parsed.buffer], { type: parsed.mime }),
      `image.${parsed.mime.split('/')[1] || 'png'}`
    );

    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } else {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: style ? `${prompt}. Style: ${style}` : prompt,
        size,
        n: 1,
      }),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const images = [];
  for (const chunk of data?.data || []) {
    if (chunk.b64_json) images.push(`data:image/png;base64,${chunk.b64_json}`);
    else if (chunk.url) images.push(chunk.url);
  }

  if (images.length === 0) throw new Error('לא התקבלו תמונות מ-OpenAI');
  return images;
};

// ===== NanoBanana (ספק חלופי) =====
const nanoBananaImage = async ({ prompt, style }) => {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) throw new Error('NANOBANANA_API_KEY אינו מוגדר');

  const response = await fetch(process.env.NANOBANANA_ENDPOINT || 'https://api.nanobanana.io/v1/images', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, style, width: 1024, height: 1024, format: 'base64', quality: 'high' }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NanoBanana API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const images = [];
  for (const chunk of data?.data || []) {
    if (chunk.b64_json) images.push(`data:image/png;base64,${chunk.b64_json}`);
    else if (chunk.url) images.push(chunk.url);
  }

  if (images.length === 0) throw new Error('לא התקבלו תמונות מ-NanoBanana');
  return images;
};

module.exports = async (req, res) => {
  if (guard(req, res, { method: 'POST' })) return;

  try {
    const { mode, prompt, style, provider, baseImage, instruction } = req.body;

    // מצב ניסוח: מחזיר פרומט מקצועי במקום תמונה.
    // מאוחד לכאן ולא כ-endpoint נפרד בגלל מגבלת 12 הפונקציות בתוכנית Hobby.
    if (mode === 'prompt') {
      const data = await generateImagePrompt(req.body);
      return res.status(200).json(data);
    }

    const isEdit = Boolean(baseImage);

    if (isEdit && !instruction) return res.status(400).json({ error: 'חסרה הוראת עריכה' });
    if (!isEdit && !prompt) return res.status(400).json({ error: 'Missing prompt' });

    const args = { prompt, style, baseImage, instruction };
    const useProvider = String(provider || '').toLowerCase();

    let images;
    if (useProvider === 'openai') {
      images = await openaiImage(args);
    } else if (useProvider === 'nanobanana') {
      if (isEdit) throw new Error('NanoBanana אינו תומך בעריכת תמונה קיימת');
      images = await nanoBananaImage(args);
    } else {
      // ברירת מחדל Gemini, ואם הוא נופל - נסיון בספק חלופי שמוגדר
      try {
        images = await geminiImage(args);
      } catch (mainErr) {
        if (process.env.OPENAI_API_KEY) images = await openaiImage(args);
        else if (process.env.NANOBANANA_API_KEY && !isEdit) images = await nanoBananaImage(args);
        else throw mainErr;
      }
    }

    return res.status(200).json({ images, edited: isEdit });
  } catch (error) {
    console.error('Error image-ai:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
