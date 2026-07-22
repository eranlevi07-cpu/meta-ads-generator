const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const { guard } = require('./_guard');

module.exports = async (req, res) => {
  if (guard(req, res, { method: 'POST' })) return;

  try {
    const { groupInfo, contentType, tone, language } = req.body;

    if (!groupInfo || !contentType) {
      return res.status(400).json({ error: 'Missing groupInfo or contentType' });
    }

    const prompt = `אתה סוכן תוכן למנהלות רווחה ורכזות אירועים.\n\n` +
      `הקשר: ${groupInfo}\n` +
      `בקשה: צור 3 רעיונות/נוסחים שיווקיים לשירותי הפקת אירועים ארגוניים (ימי כיף, סדנאות גיבוש, הרדינגים) שמיועדים למנהלות HR / רווחה.\n` +
      `אל תייצר מודעות דרושים או גיוס עובדים.\n` +
      `הקפד על פורמט קריא, קצר ועם משפט פתיחה חזק.\n` +
      `כתוב בעברית ${language || ''} ובטון ${tone || 'מקצועי'}.\n` +
      `הנחיות לפלט JSON בלבד (ללא טקסט נוסף) מבנה: {"items":[{"title":"","body":"","copy":""}]}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON response from AI');

    const data = JSON.parse(jsonMatch[0]);
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('AI response format is invalid');
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error hr-content-ai:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
