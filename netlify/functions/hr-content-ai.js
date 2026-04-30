const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { groupInfo, contentType, tone, language } = JSON.parse(event.body);

    if (!groupInfo || !contentType) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing groupInfo or contentType" }),
      };
    }

    const prompt = `אתה סוכן תוכן למנהלות רווחה ורכזות אירועים.\n\n` +
      `הקשר: ${groupInfo}\n` +
      `בקשה: צור 3 רעיונות/נוסחים שיווקיים לשירותי הפקת אירועים ארגוניים (ימי כיף, סדנאות גיבוש, הרדינגים) שמיועדים למנהלות HR / רווחה.\n` +
      `אל תייצר מודעות דרושים או גיוס עובדים.\n` +
      `הקפד על פורמט קריא, קצר ועם משפט פתיחה חזק.\n` +
      `כתוב בעברית ${language || ''} ובטון ${tone || 'מקצועי'}.\n` +
      `הנחיות לפלט JSON בלבד (ללא טקסט נוסף) מבנה: {"items":[{"title":"","body":"","copy":""}]}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1800,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON response from AI");

    const data = JSON.parse(jsonMatch[0]);

    if (!data.items || !Array.isArray(data.items)) {
      throw new Error("AI response format is invalid");
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Error hr-content-ai:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};