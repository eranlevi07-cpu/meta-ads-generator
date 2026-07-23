// דאטהבייס התוכן: כל מה שנוצר במחולל נשמר כאן וזמין לשכפול, עריכה ומחיקה.
// endpoint אחד עם פעולות (action) במקום כמה - בגלל מגבלת 12 הפונקציות ב-Vercel Hobby.
//
// פעולות:
//   save      - שמירת פריט { itemType, brand, language, title, payload, images[] }
//   list      - רשימת פריטים (מסוננת לפי itemType/brand אם נשלחו)
//   get       - פריט בודד לפי id
//   duplicate - שכפול פריט קיים
//   delete    - מחיקת פריט (+ התמונות שלו מה-Storage)
const crypto = require('crypto');
const { guard } = require('./_guard');
const { getDb, getBucket } = require('./_firebase');

const COLLECTION = 'content_items';

// תמונות נשמרות ב-Storage כקבצים, וב-Firestore רק הקישור -
// כי מסמך Firestore מוגבל ל-1MB ותמונה ממוצעת שוקלת יותר.
async function uploadImages(images, itemId) {
  const bucket = getBucket();
  const urls = [];

  for (let i = 0; i < images.length; i++) {
    const dataUrl = images[i];
    const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!m) {
      // כבר URL רגיל (למשל מפריט משוכפל) - נשמר כמו שהוא
      if (String(dataUrl).startsWith('http')) urls.push(dataUrl);
      continue;
    }

    const ext = (m[1].split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
    const path = `content/${itemId}/${i}.${ext}`;
    const file = bucket.file(path);
    const token = crypto.randomUUID();

    await file.save(Buffer.from(m[2], 'base64'), {
      metadata: {
        contentType: m[1],
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    urls.push(
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
    );
  }

  return urls;
}

module.exports = async (req, res) => {
  if (guard(req, res, { method: 'POST' })) return;

  try {
    const { action } = req.body || {};
    const db = getDb();
    const col = db.collection(COLLECTION);

    // ===== שמירה =====
    if (action === 'save') {
      const { itemType, brand, language, title, payload, images } = req.body;
      if (!itemType || !payload) return res.status(400).json({ error: 'חסר itemType או payload' });

      const ref = col.doc();
      const imageUrls = Array.isArray(images) && images.length ? await uploadImages(images, ref.id) : [];

      await ref.set({
        itemType,                          // 'ads' | 'hr' | 'rewrite' | 'image'
        brand: brand || '',
        language: language || '',
        title: title || '',
        payload,                           // התוכן עצמו (מודעות, פוסטים וכו')
        imageUrls,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: ref.id, imageUrls });
    }

    // ===== רשימה =====
    if (action === 'list') {
      const { itemType, brand, limit } = req.body;
      let q = col.orderBy('createdAt', 'desc').limit(Math.min(Number(limit) || 50, 200));
      if (itemType) q = q.where('itemType', '==', itemType);
      if (brand) q = q.where('brand', '==', brand);

      const snap = await q.get();
      const items = snap.docs.map((d) => {
        const data = d.data();
        // ברשימה לא מחזירים את כל התוכן - רק תקציר, לחסכון בתעבורה
        return {
          id: d.id,
          itemType: data.itemType,
          brand: data.brand,
          language: data.language,
          title: data.title,
          createdAt: data.createdAt,
          imageUrls: data.imageUrls || [],
          preview: JSON.stringify(data.payload).slice(0, 160),
        };
      });

      return res.status(200).json({ items });
    }

    // ===== פריט בודד =====
    if (action === 'get') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'חסר id' });
      const doc = await col.doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: 'הפריט לא נמצא' });
      return res.status(200).json({ id: doc.id, ...doc.data() });
    }

    // ===== שכפול =====
    if (action === 'duplicate') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'חסר id' });
      const doc = await col.doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: 'הפריט לא נמצא' });

      const data = doc.data();
      const ref = col.doc();
      await ref.set({
        ...data,
        title: (data.title || 'ללא כותרת') + ' (עותק)',
        createdAt: new Date().toISOString(),
        duplicatedFrom: id,
      });

      return res.status(200).json({ id: ref.id });
    }

    // ===== מחיקה =====
    if (action === 'delete') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'חסר id' });

      const doc = await col.doc(id).get();
      if (!doc.exists) return res.status(404).json({ error: 'הפריט לא נמצא' });

      // מחיקת התמונות של הפריט מה-Storage - אבל רק אם אף פריט אחר
      // (למשל עותק משוכפל) לא מפנה אליהן
      const data = doc.data();
      if ((data.imageUrls || []).length && !data.duplicatedFrom) {
        const dupes = await col.where('duplicatedFrom', '==', id).limit(1).get();
        if (dupes.empty) {
          const bucket = getBucket();
          await bucket.deleteFiles({ prefix: `content/${id}/` }).catch(() => {});
        }
      }

      await col.doc(id).delete();
      return res.status(200).json({ deleted: id });
    }

    return res.status(400).json({ error: 'action לא מוכר: ' + action });
  } catch (error) {
    console.error('Error db:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
