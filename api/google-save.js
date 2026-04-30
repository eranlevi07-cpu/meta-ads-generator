const { google } = require('googleapis');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

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

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const required = ['brand', 'brief', 'ads', 'hrContent', 'imageUrls', 'status'];

    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) {
        return res.status(400).json({ error: `Missing field ${key}` });
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

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('google-save error', error);
    return res.status(500).json({ error: error.message });
  }
};
