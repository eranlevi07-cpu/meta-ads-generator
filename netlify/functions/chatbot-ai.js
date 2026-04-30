const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

let BRAND_DATA = null;
try {
  const brandPath = path.join(__dirname, "..", "..", "brand-data.json");
  const rawBrands = fs.readFileSync(brandPath, "utf8");
  BRAND_DATA = JSON.parse(rawBrands).brands || [];
} catch (e) {
  console.error("Error loading brand-data.json:", e);
  BRAND_DATA = [];
}

const brandSummary = BRAND_DATA.map((b) => {
  return `- ${b.name} (${b.key}): ${b.profile} | אתר: ${b.domain} | קהל: ${b.audience}`;
}).join("\n");

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
    const { message, conversationHistory } = JSON.parse(event.body);

    if (!message || message.trim() === "") {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Missing message" }),
      };
    }

    // בניית history עם context
    const messages = [
      ...((conversationHistory || []).map((m) => ({
        role: m.role,
        content: m.content,
      })) || []),
      { role: "user", content: message },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: BUSINESS_CONTEXT,
      messages,
    });

    const assistantMessage = response.content[0].text;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        reply: assistantMessage,
        conversation: [
          ...(conversationHistory || []),
          { role: "user", content: message },
          { role: "assistant", content: assistantMessage },
        ],
      }),
    };
  } catch (error) {
    console.error("Error chatbot-ai:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};