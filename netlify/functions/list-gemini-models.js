const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    const models = (data.models || [])
      .filter(m => {
        const name = m.name || '';
        const methods = m.supportedGenerationMethods || [];
        return /image|imagen/i.test(name) || methods.some(x => /image/i.test(x));
      })
      .map(m => ({
        name: m.name,
        displayName: m.displayName,
        methods: m.supportedGenerationMethods,
      }));

    const all = (data.models || []).map(m => m.name);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ imageRelated: models, allCount: all.length, all }, null, 2),
    };
  } catch (error) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
  }
};
