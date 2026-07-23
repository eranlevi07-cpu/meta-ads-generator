// חיבור יחיד ל-Firebase (Firestore + Storage), משותף לכל הפונקציות.
// המפתח מגיע ממשתנה סביבה FIREBASE_SERVICE_ACCOUNT_JSON (תוכן קובץ ה-JSON כמו שהוא).
const admin = require('firebase-admin');

let app = null;

function getFirebase() {
  if (app) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON לא מוגדר ב-Vercel. הוסף אותו ב-Settings > Environment Variables.');
  }

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON אינו JSON תקין - העתק את כל תוכן הקובץ שירד מ-Firebase');
  }

  // ב-Vercel לפעמים ה-newlines במפתח הפרטי מגיעים כ-\\n מילולי
  if (creds.private_key && creds.private_key.includes('\\n')) {
    creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  }

  app = admin.initializeApp({
    credential: admin.credential.cert(creds),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${creds.project_id}.firebasestorage.app`,
  });

  return app;
}

function getDb() {
  getFirebase();
  return admin.firestore();
}

function getBucket() {
  getFirebase();
  return admin.storage().bucket();
}

module.exports = { getDb, getBucket };
