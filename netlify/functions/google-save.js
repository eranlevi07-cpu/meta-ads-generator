const { google } = require('googleapis');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function getGoogleAuthClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!keyJson || !sheetId) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID in env');
  }

  const credentials = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/calendar'],
  });

  return { auth, sheetId };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const required = ['brand', 'brief', 'ads', 'hrContent', 'imageUrls', 'status'];

    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `Missing field ${key}` }) };
      }
    }

    const { auth, sheetId } = getGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const row = [
      new Date().toISOString(),
      body.brand,
      body.brief,
      JSON.stringify(body.ads || []),
      JSON.stringify(body.hrContent || []),
      JSON.stringify(body.imageUrls || []),
      body.status || 'pending',
      body.telegramMessageId || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:H',
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('google-save error', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
  }
};
