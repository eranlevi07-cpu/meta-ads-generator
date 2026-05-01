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
  BRAND_DATA = JSON.parse(fs.readFileSync(brandPath, 'utf8')).brands || [];
} catch (e) {
  console.error('Error loading brand-data.json:', e);
}

const brandList = BRAND_DATA.map(b =>
  `• ${b.name} (key: "${b.key}") - ${b.profile.substring(0, 120)}...`
).join('\n');

const SYSTEM_PROMPT = `אתה סוכן בריף שיווקי בכיר. תפקידך: לראיין את הלקוח בשיחה קצרה וממוקדת, ולהפיק ממנו את כל המידע לקמפיין מנצח.

המותגים הקיימים במערכת:
${brandList}
• אחר (key: "other") - מותג חיצוני

כללי שיחה:
- שאל שאלה אחת בכל פעם, קצרה וחדה
- השתמש בשפה חמה ומקצועית
- הגב בקצרה לתשובות ("מצוין", "מעולה", "בדיוק")
- אחרי 4-6 שאלות שיש לך מספיק מידע - עצור וסנתז

שאלות שחייב לכסות:
1. איזה מותג/עסק פרסום היום? (תבדוק אם קיים במערכת)
2. מה ההצעה / הפעילות הספציפית שרוצה לפרסם עכשיו?
3. מי הלקוח האידיאלי? (גיל, תפקיד, מה הוא מחפש)
4. מה הדבר אחד שהופך את ההצעה הזו לבלתי ניתנת לסירוב?
5. תאר את התמונה שתרצה לראות במודעה (סצנה, אנשים, מיקום, תחושה)

כשיש לך תשובות לכל השאלות, כתוב "✅ מעולה! סינתזתי לך בריף מנצח." ואז הוסף בדיוק את הבלוק הזה:

<FORM_DATA>
{
  "brandKey": "yomkef",
  "businessDescription": "תיאור מפורט ומשכנע של העסק + ההצעה הספציפית + מה מייחד אותה",
  "groupInfo": "תיאור קבוצת הווטסאפ ומי הם: קהל היעד, מה הם מחפשים, מה מעניין אותם",
  "imagePrompt": "תיאור מפורט וויזואלי לתמונת המודעה: סצנה, אנשים, צבעים, תחושה, מיקום",
  "imageStyle": "מציאותי",
  "goals": ["לידים", "מכירות"],
  "audience": ["גיל 35-50", "נשים"],
  "tone": "מקצועי",
  "budget": "200₪ ליום"
}
</FORM_DATA>

חשוב: המלא את ה-JSON עם תוכן אמיתי ועשיר מהשיחה - לא placeholder. ה-businessDescription וה-imagePrompt צריכים להיות ברמה שתייצר תוצאות מטורפות.

ערכים חוקיים:
- brandKey: אחד מ-"yomkef", "eran-pro", "xstream-bar", "kayaks", "ptl", "other"
- goals: מבין ["מכירות", "לידים", "מודעות למותג", "תנועה לאתר", "מעורבות"]
- audience: מבין ["גיל 18-25", "גיל 25-35", "גיל 35-50", "גיל 50+", "גברים", "נשים", "בעלי עסקים", "הורים"]
- tone: אחד מ-"מקצועי", "ידידותי", "שנוני", "רגשי", "דחוף"
- budget: אחד מ-"50₪ ליום", "100₪ ליום", "200₪ ליום", "500₪ ליום", "1000₪+ ליום"
- imageStyle: אחד מ-"מציאותי", "אילוסטרציה", "קומיקס", "minimal"`;

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
      ...((conversationHistory || []).map(m => ({ role: m.role, content: m.content }))),
      { role: 'user', content: message },
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content[0].text;

    // חלץ FORM_DATA אם קיים
    let formData = null;
    const formMatch = reply.match(/<FORM_DATA>([\s\S]*?)<\/FORM_DATA>/);
    if (formMatch) {
      try {
        formData = JSON.parse(formMatch[1].trim());
      } catch (parseErr) {
        console.error('brief-agent: failed to parse FORM_DATA', parseErr);
      }
    }

    // הסר את הבלוק הטכני מהטקסט שמוצג
    const displayReply = reply.replace(/<FORM_DATA>[\s\S]*?<\/FORM_DATA>/g, '').trim();

    return res.status(200).json({
      reply: displayReply,
      formData,
      conversation: [
        ...(conversationHistory || []),
        { role: 'user', content: message },
        { role: 'assistant', content: reply },
      ],
    });
  } catch (error) {
    console.error('brief-agent error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
