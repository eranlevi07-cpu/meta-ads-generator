// שכבת הגנה משותפת לכל ה-API endpoints.
// קובץ שמתחיל ב-_ אינו נחשב endpoint ב-Vercel, אלא מודול עזר בלבד.
const crypto = require('crypto');

// רשימת הדומיינים המורשים, מופרדת בפסיקים. לדוגמה:
// ALLOWED_ORIGINS=https://meta-ads-generator.vercel.app,https://www.yomkef.co.il
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function setCors(res, methods = 'POST, OPTIONS', origin) {
  // בקשות מאותו דומיין (האתר עצמו) לא צריכות כותרת CORS כלל.
  // כותרת נשלחת רק לדומיין שנמצא ברשימה המורשית.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Key');
  res.setHeader('Access-Control-Allow-Methods', methods);
}

function keysMatch(provided, expected) {
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// מחזיר true אם הבקשה טופלה כאן (OPTIONS / שיטה שגויה / סיסמה שגויה)
// ואז ה-endpoint צריך לעצור. מחזיר false אם הכל תקין וצריך להמשיך.
function guard(req, res, { method = 'POST' } = {}) {
  setCors(res, `${method}, OPTIONS`, req.headers.origin);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  if (req.method !== method) {
    res.status(405).json({ error: 'Method not allowed' });
    return true;
  }

  const expected = process.env.APP_ACCESS_KEY;
  if (!expected) {
    // נכשל סגור בכוונה: בלי הגדרת סיסמה בשרת אין הגנה, ועדיף שהאתר יצעק
    // מאשר שיישאר פתוח לכל העולם בשקט.
    res.status(503).json({
      error: 'APP_ACCESS_KEY לא מוגדר בשרת. הוסף אותו ב-Vercel > Settings > Environment Variables.',
    });
    return true;
  }

  const provided = req.headers['x-app-key'];
  if (!provided || !keysMatch(provided, expected)) {
    res.status(401).json({ error: 'סיסמת גישה שגויה או חסרה' });
    return true;
  }

  return false;
}

module.exports = { guard, setCors };
