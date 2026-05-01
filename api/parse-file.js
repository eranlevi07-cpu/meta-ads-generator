const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

async function extractFromPDF(base64Data) {
  const pdfParse = require('pdf-parse');
  const buffer = Buffer.from(base64Data, 'base64');
  const data = await pdfParse(buffer);
  return data.text.trim();
}

async function extractFromImage(base64Data, mimeType) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64Data },
        },
        {
          type: 'text',
          text: 'חלץ את כל הטקסט והמידע מהמסמך/תמונה. כלול: שם עסק, מוצרים/שירותים, מחירים, קהל יעד, הצעות מיוחדות, יתרונות, כל פרט שיועיל לבניית קמפיין פרסומי. ענה בעברית בצורה מסודרת.',
        },
      ],
    }],
  });
  return response.content[0].text.trim();
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { fileBase64, fileName, mimeType } = req.body;

    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: 'Missing fileBase64 or mimeType' });
    }

    let extractedText = '';

    if (mimeType === 'application/pdf') {
      extractedText = await extractFromPDF(fileBase64);
    } else if (mimeType.startsWith('image/')) {
      extractedText = await extractFromImage(fileBase64, mimeType);
    } else {
      return res.status(400).json({ error: `סוג קובץ לא נתמך: ${mimeType}. נתמך: PDF, תמונות` });
    }

    if (!extractedText || extractedText.length < 20) {
      return res.status(422).json({ error: 'לא ניתן לחלץ טקסט מהקובץ' });
    }

    return res.status(200).json({
      success: true,
      text: extractedText,
      fileName: fileName || 'קובץ',
      charCount: extractedText.length,
    });
  } catch (error) {
    console.error('parse-file error:', error);
    return res.status(500).json({ error: error.message || 'שגיאה בפענוח קובץ' });
  }
};
