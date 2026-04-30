const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { originalText, tone, targetPlatform, style } = req.body;

    if (!originalText) return res.status(400).json({ error: 'Missing originalText' });

    const platformGuide = {
      instagram: 'קצר, מעורר, עם emojiים משכנעים',
      facebook: 'מעמיק יותר, סטוריה, קריאה לפעולה בולטת',
      linkedin: 'מקצועי, חשוב, ערך B2B',
      tiktok: 'קצר מאוד, ויראלי, חוכמה נוכחת',
      whatsapp: 'אישי, חם, התחבורה ישירה',
      telegram: 'ממוקד, מידע בר שימוש',
    };

    const prompt = `אתה סוכן ניסוח תוכן מומחה בעברית.
קח את הטקסט המקורי וכתוב 4 גרסאות שונות של אותו הודעה.
כל גרסה צריכה להיות בזווית שונה אבל עם אותו המסר הליבה.

טקסט מקורי:
"${originalText}"

פלטפורמה יעד: ${targetPlatform} (${platformGuide[targetPlatform] || 'כללי'})
טון: ${tone || 'טבעי'}
סגנון: ${style || 'רגיל'}

כתוב בפורמט JSON בלבד (ללא טקסט נוסף):
{
  "rewrites": [
    {"version": 1, "text": "..."},
    {"version": 2, "text": "..."},
    {"version": 3, "text": "..."},
    {"version": 4, "text": "..."}
  ]
}

הנחיות:
- כל גרסה צריכה להיות מלחמה וחדשה
- שמור על ההודעה הליבה
- התאם לפלטפורמה
- אל תשכחי CTA והשראה`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON response');

    const data = JSON.parse(jsonMatch[0]);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error rewrite-ai:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
