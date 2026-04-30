const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

let BRAND_DATA = [];
try {
  const brandPath = path.join(__dirname, '..', 'brand-data.json');
  const rawBrands = fs.readFileSync(brandPath, 'utf8');
  BRAND_DATA = JSON.parse(rawBrands).brands || [];
} catch (e) {
  console.error('Error loading brand-data.json:', e);
}

const brandSummary = BRAND_DATA.map((b) => {
  return `- ${b.name} (${b.key}): ${b.profile} | אתר: ${b.domain} | קהל: ${b.audience}`;
}).join('\n');

const BUSINESS_CONTEXT = `אתה צ'אטבוט של ערן לוי, מפיק אירועים ויזמ בישראל.

*** מותגים שהמערכת יודעת עליהם ***
${brandSummary}

*** איך לעזור ***
1. תשובות לשאלות על אירועים וגיבושים
2. המלצות על מקומות ופעילויות
3. טיפים להפקות מצליחות
4. קישור ללקוחות לפרטי התקשרות
5. הנעה להצטרפות לקמיוניטי (Instagram @eran_pro, WhatsApp)

בתשובות שלך:
- בעברית תמיד, טבעית וחם
- קצר וישיר
- שאל שאלות חוזרות כדי להבין את הצורך
- תמיד תן CTA - קבוצת WhatsApp, Instagram, reservation`;

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, conversationHistory } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const messages = [
      ...((conversationHistory || []).map((m) => ({ role: m.role, content: m.content })) || []),
      { role: 'user', content: message },
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: BUSINESS_CONTEXT,
      messages,
    });

    const assistantMessage = response.content[0].text;

    return res.status(200).json({
      reply: assistantMessage,
      conversation: [
        ...(conversationHistory || []),
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage },
      ],
    });
  } catch (error) {
    console.error('Error chatbot-ai:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
