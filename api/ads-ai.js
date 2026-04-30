const Anthropic = require('@anthropic-ai/sdk');
const BRAND_DATA = require('../brand-data.json');

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
    const { brand, businessDescription, goals, audience, budget, tone } = req.body;
    const brandInfo = (BRAND_DATA.brands || []).find((b) => b.key === brand);
    const language = (brandInfo && brandInfo.language) || 'עברית';
    const isArabic = language.includes('ערבית') || language.includes('عربية');

    const ctaList = isArabic
      ? '"احجز الآن", "اشترِ الآن", "تواصل معنا", "اشترك الآن", "اطلب عرض سعر", "للمزيد من المعلومات"'
      : '"למידע נוסף", "הזמן עכשיו", "קנה עכשיו", "הירשם", "צור קשר", "קבל הצעת מחיר"';

    const prompt = `אתה מומחה לפרסום ברשתות חברתיות ובמיוחד ב-Meta (פייסבוק ואינסטגרם).
צור 3 מודעות Meta שונות ומגוונות בשפת ה${language} עבור העסק הבא:

מותג: ${brandInfo ? brandInfo.name : brand || 'לא ידוע'}
אתר: ${brandInfo ? brandInfo.domain : 'לא זמין'}
תיאור מותג: ${brandInfo ? brandInfo.profile : 'לא זמין'}
מטרת מותג: ${brandInfo ? brandInfo.focus : 'לא ידוע'}

תיאור עסק: ${businessDescription}
מטרות קמפיין: ${goals.join(', ')}
קהל יעד: ${audience.join(', ')}
תקציב יומי: ${budget}
טון: ${tone}

החזר תשובה בפורמט JSON בלבד (ללא טקסט נוסף) עם המבנה הבא:
{
  "ads": [
    {
      "headline": "כותרת (עד 125 תווים)",
      "primaryText": "טקסט ראשי (עד 500 תווים)",
      "description": "תיאור קצר (עד 30 תווים)",
      "callToAction": "קריאה לפעולה"
    }
  ]
}

הנחיות חשובות:
- כל המודעות חייבות להיות בשפת ה${language} בלבד - כותרות, טקסט ראשי, תיאור וקריאה לפעולה הכל ב${language}
- כל מודעה צריכה להיות שונה בגישה ובמסר
- השתמש ב${language} טבעית, נכונה ומשכנעת מבחינה תרבותית לקהל היעד
- התאם את הטון שביקשו
- הכלול הוקים חזקים בתחילת כל מודעה
- קריאה לפעולה חייבת להיות אחת מאלה (ב${language}): ${ctaList}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON response from AI');

    const adsData = JSON.parse(jsonMatch[0]);
    return res.status(200).json(adsData);
  } catch (error) {
    console.error('Error ads-ai:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
