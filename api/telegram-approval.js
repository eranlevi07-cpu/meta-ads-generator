const TELEGRAM_API_BASE = 'https://api.telegram.org';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

async function sendMessage(token, chatId, text) {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  return response.json();
}

function buildMultipart(fields, fileField, fileBuffer, fileName, fileMime) {
  const boundary = '----formdata-meta-ads-' + Math.random().toString(36).substring(2);
  const CRLF = '\r\n';
  const headParts = [];

  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined || val === null) continue;
    headParts.push(`--${boundary}${CRLF}Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}${val}${CRLF}`);
  }

  headParts.push(`--${boundary}${CRLF}Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"${CRLF}Content-Type: ${fileMime}${CRLF}${CRLF}`);

  const head = Buffer.from(headParts.join(''), 'utf8');
  const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
  const body = Buffer.concat([head, fileBuffer, tail]);

  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function sendPhoto(token, chatId, imageDataOrUrl, caption) {
  if (imageDataOrUrl.startsWith('data:')) {
    const matches = imageDataOrUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) { console.error('sendPhoto: invalid data URL'); return null; }
    const mime = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const fields = { chat_id: chatId };
    if (caption) fields.caption = caption;
    const { body, contentType } = buildMultipart(fields, 'photo', buffer, 'image.png', mime);
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'Content-Length': String(body.length) },
      body,
    });
    const json = await response.json();
    if (!json.ok) console.error('sendPhoto failed:', json);
    return json;
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: imageDataOrUrl, caption }),
  });
  const json = await response.json();
  if (!json.ok) console.error('sendPhoto URL failed:', json);
  return json;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramToken || !chatId) throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');

    const { brand, brief, ads = [], hrContent = [], imageUrls = [] } = req.body;
    if (!brand || !brief) return res.status(400).json({ error: 'Missing brand or brief' });

    const messageIds = [];

    const header = `<b>📢 תוכן חדש - ${escapeHtml(brand)}</b>\n\n` +
      `<b>בריף:</b>\n${escapeHtml(brief).slice(0, 500)}\n\n` +
      `סה"כ: ${ads.length} מודעות, ${hrContent.length} פוסטים, ${imageUrls.length} תמונות`;
    const headerRes = await sendMessage(telegramToken, chatId, header);
    if (headerRes.ok) messageIds.push(headerRes.result.message_id);

    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      const text = `<b>✦ מודעה ${i + 1}/${ads.length}</b>\n\n` +
        `<b>${escapeHtml(ad.headline || '')}</b>\n\n` +
        `${escapeHtml(ad.primaryText || '')}\n\n` +
        `<i>${escapeHtml(ad.description || '')}</i>\n\n` +
        `🔘 <b>${escapeHtml(ad.callToAction || '')}</b>`;
      const r = await sendMessage(telegramToken, chatId, text);
      if (r.ok) messageIds.push(r.result.message_id);
    }

    for (let i = 0; i < hrContent.length; i++) {
      const item = hrContent[i];
      const body = typeof item === 'string' ? item : (item.content || item.text || JSON.stringify(item));
      const text = `<b>📝 תוכן HR ${i + 1}/${hrContent.length}</b>\n\n${escapeHtml(body)}`;
      const r = await sendMessage(telegramToken, chatId, text);
      if (r.ok) messageIds.push(r.result.message_id);
    }

    for (let i = 0; i < imageUrls.length; i++) {
      const r = await sendPhoto(telegramToken, chatId, imageUrls[i], `🖼️ תמונה ${i + 1}/${imageUrls.length}`);
      if (r && r.ok) messageIds.push(r.result.message_id);
    }

    return res.status(200).json({ success: true, messageIds });
  } catch (error) {
    console.error('telegram-approval error', error);
    return res.status(500).json({ error: error.message });
  }
};
