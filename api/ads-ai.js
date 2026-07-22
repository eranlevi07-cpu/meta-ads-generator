const Anthropic = require('@anthropic-ai/sdk');
const BRAND_DATA = require('../brand-data.json');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const { guard } = require('./_guard');

module.exports = async (req, res) => {
  if (guard(req, res, { method: 'POST' })) return;

  try {
    const { brand, businessDescription, goals, audience, budget, tone, language: requestedLanguage } = req.body;
    const brandInfo = (BRAND_DATA.brands || []).find((b) => b.key === brand);

    // סדר עדיפות: שפה שנבחרה בממשק > שפת המותג > עברית
    const language = requestedLanguage || (brandInfo && brandInfo.language) || 'עברית';

    // רשימת קריאות לפעולה תקניות של Meta, לכל שפה
    const CTA_BY_LANGUAGE = {
      עברית: '"למידע נוסף", "הזמן עכשיו", "קנה עכשיו", "הירשם", "צור קשר", "קבל הצעת מחיר"',
      ערבית: '"احجز الآن", "اشترِ الآن", "تواصل معنا", "اشترك الآن", "اطلب عرض سعر", "للمزيد من المعلومات"',
      רוסית: '"Узнать больше", "Забронировать", "Купить сейчас", "Зарегистрироваться", "Связаться с нами", "Получить предложение"',
    };

    const matchedLanguage =
      Object.keys(CTA_BY_LANGUAGE).find((key) => language.includes(key)) || 'עברית';
    const ctaList = CTA_BY_LANGUAGE[matchedLanguage];

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
- **אלה מודעות מקוריות, לא תרגום.** כתוב אותן כאילו אתה קופירייטר יליד ${language} שכותב לקהל שלו מאפס. השתמש בביטויים, הומור, ניואנסים ונקודות כאב שמדברים דווקא לקהל הזה. מותר ואף רצוי שהזווית תהיה שונה לגמרי ממה שהיית כותב בשפה אחרת.
- כל מודעה צריכה להיות שונה בגישה ובמסר
- השתמש ב${language} טבעית, נכונה ומשכנעת מבחינה תרבותית לקהל היעד
- התאם את הטון שביקשו
- הכלול הוקים חזקים בתחילת כל מודעה
- קריאה לפעולה חייבת להיות אחת מאלה (ב${language}): ${ctaList}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON response from AI');

    const adsData = JSON.parse(jsonMatch[0]);
    // מחזירים גם את השפה כדי שהממשק ידע איך להציג (כיוון טקסט, כותרת קבוצה)
    return res.status(200).json({ ...adsData, language: matchedLanguage });
  } catch (error) {
    console.error('Error ads-ai:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
