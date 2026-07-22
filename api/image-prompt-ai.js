const Anthropic = require('@anthropic-ai/sdk');
const BRAND_DATA = require('../brand-data.json');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const { guard } = require('./_guard');

// מבנה מחייב לתשובה - פרומט באנגלית למחולל, והסבר בעברית לערן
const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    promptEn: { type: 'string' },
    explanationHe: { type: 'string' },
    negativePromptEn: { type: 'string' },
  },
  required: ['promptEn', 'explanationHe', 'negativePromptEn'],
  additionalProperties: false,
};

module.exports = async (req, res) => {
  if (guard(req, res, { method: 'POST' })) return;

  try {
    const { brand, businessDescription, imageIdea, style, adHeadline } = req.body;
    const brandInfo = (BRAND_DATA.brands || []).find((b) => b.key === brand);

    const prompt = `אתה מנהל אמנותי שמתמחה בתמונות למודעות Meta (פייסבוק ואינסטגרם) בשוק הישראלי.
המשימה שלך: לנסח פרומט מקצועי באנגלית למחולל תמונות AI.

הקשר העסקי:
מותג: ${brandInfo ? brandInfo.name : brand || 'לא צוין'}
תיאור מותג: ${brandInfo ? brandInfo.profile : 'לא זמין'}
מטרת מותג: ${brandInfo ? brandInfo.focus : 'לא ידוע'}
קהל יעד: ${brandInfo ? brandInfo.audience : 'לא צוין'}
תיאור העסק/הקמפיין: ${businessDescription || 'לא צוין'}
${adHeadline ? `כותרת המודעה שהתמונה תלווה: ${adHeadline}` : ''}
סגנון מבוקש: ${style || 'מציאותי'}
${imageIdea ? `רעיון גולמי של הלקוח: ${imageIdea}` : 'הלקוח לא נתן רעיון - תציע אתה את הרעיון החזק ביותר למותג הזה.'}

החזר שלושה שדות:

1. promptEn - הפרומט באנגלית. כללים:
   - תיאור חזותי מפורט: נושא, פעולה, סביבה, תאורה, זווית מצלמה, מצב רוח, פלטת צבעים
   - ציין יחס גובה-רוחב מרובע (1:1) שמתאים לפיד של Meta
   - **אל תבקש טקסט או כיתוב בתוך התמונה** - מחוללי תמונות מייצרים אותיות עבריות משובשות. הטקסט מגיע ממודעת ה-Meta עצמה.
   - אם מופיעים אנשים - שיהיו אמינים ומגוונים ומתאימים לקהל היעד הישראלי, לא סטוק גנרי מחייך
   - תמונה שנראית כמו צילום אמיתי או עיצוב מקצועי, לא "AI מובהק"
   - אורך: 60-120 מילים

2. explanationHe - הסבר קצר בעברית (2-3 משפטים) של מה יופיע בתמונה ולמה זה עובד למותג. ערן לא קורא אנגלית טכנית - זה מה שיאפשר לו להבין מה ביקשת.

3. negativePromptEn - מה להימנע ממנו, באנגלית, מופרד בפסיקים (למשל: text, watermark, distorted hands, generic stock photo look).`;

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      output_config: { format: { type: 'json_schema', schema: PROMPT_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = (message.content || []).find((b) => b.type === 'text');
    const responseText = (textBlock ? textBlock.text : '').trim();
    if (!responseText) throw new Error('התקבלה תשובה ריקה מהמודל');

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('התקבלה תשובה שאינה JSON תקין');
      data = JSON.parse(jsonMatch[0]);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error image-prompt-ai:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
