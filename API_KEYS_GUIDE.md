# 📖 מדריך API Keys + Telegram Setup
## כל ה-Details שאתה צריך

---

### 🔑 API Keys שצריך (לפי עדיפות)

#### 1. **ANTHROPIC_API_KEY** ✅ (כבר יש לך)
- בשימוש: Claude AI לכל הסוכנים
- איפה: https://console.anthropic.com
- סטטוס: כבר מוגדר ב-Netlify secrets

---

#### 2. **TELEGRAM_BOT_TOKEN** (לאישור תוכן)
1. פתח Telegram ים → `@BotFather`
2. כתוב: `/newbot`
3. בחר שם: `eran_pro_content_bot` (או כל שם)
4. קבל token (משהו כמו: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
5. שמור אותו ב-Netlify:
   - Settings → Build & Deploy → Environment
   - Add variable: `TELEGRAM_BOT_TOKEN` = הtoken שקיבלת

---

#### 3. **TELEGRAM_CHAT_ID** (דירוגך)
1. שלח הודעה כלשהי ל-`@BotFather` עם הbotשלך  
2. וקיצור: עדה את הבוט במצא את ה-chat ID שלך:
   ```
   https://api.telegram.org/bot[TOKEN]/getUpdates
   ```
   (החלף [TOKEN] בtoken שקיבלת)

3. אתה תראה משהו כמו:
   ```json
   "chat": {
     "id": -987654321,
     ...
   }
   ```
   זה ה-CHAT_ID שלך

4. שמור ב-Netlify: `TELEGRAM_CHAT_ID`

---

#### 4. **INSTAGRAM_BUSINESS_ACCOUNT_ID** (posting)
- דרוש: Instagram Business account + Facebook page מקושרת
- דרך: https://developers.facebook.com
  1. Create App → Business
  2. Add Product: Instagram Basic Display + Graph API
  3. קבל: `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID`
  4. שמור בשני: `NETLIFY_INSTAGRAM_ACCESS_TOKEN`, `NETLIFY_INSTAGRAM_ACCOUNT_ID`

**עבור עכשיו**: אם אתה לא מוכן ל-Instagram API, אנחנו נתחיל עם Telegram approval בלבד.

---

#### 5. **GOOGLE_SHEETS_API** (לוג תוכן)
- אופציונלי: פשוט שמור את כל הפרסומים ב-Google Sheet
- דרך: https://console.cloud.google.com
1. Create project
2. Enable Google Sheets API
3. Create service account
4. Generate key (JSON)
5. שתף sheet עם email של service account

---

### 🤖 איך Telegram Approval עובדת

**זרימה**:
```
1. אתה כותב טקסט → לוחץ "צור"
2. AI מייצר 3-4 אפשרויות
3. בוט שלך בטלגרם קולט את הפרסום
4. אתה מדיר: ✅ (אישור) או ❌ (דחיה)
5. אם אישור → עולה לפלטפורמות (Instagram, Facebook, וכו')
```

---

### 💾 איך לשמור את ה-Keys ב-Netlify

1. לך ל- https://app.netlify.com
2. בחר site → Site settings
3. Build & Deploy → Environment
4. Add variable:
   ```
   TELEGRAM_BOT_TOKEN = [הtoken שלך]
   TELEGRAM_CHAT_ID = [הchat ID שלך]
   ANTHROPIC_API_KEY = [כבר יש]
   ```

5. Deploy שוב:
   ```bash
   netlify deploy --prod
   ```

---

### 📋 סטטוס עדכון (מה מוכן?)

- ✅ Claude API (Anthropic)
- ⏳ Telegram Bot (צריך לייצור bot)
- ⏳ Instagram API (אם רוצה posting ישיר)
- ⏳ Google Sheets (logging)

---

### ❓ שאלה לערן

האם אתה רוצה:
1. **עדיפות 1**: Telegram approval בלבד (בדיקה של הטקסט לפני עלייה)
2. **עדיפות 2**: + Instagram direct posting
3. **עדיפות 3**: + Google Sheets logging (כל פרסום נרשם)

תמלא את: telegram bot (דרך BotFather), ואחר כך נחבר הכל.

---

### 🚀 השלבים הבאים (אחרי שיש לך Telegram):

1. עדכון `index.html` - הוסף פאנל "אישור Telegram"
2. עדכון `ads-ai.js` → כולל שליחה לטלגרם
3. חיבור hr-content-ai, rewrite-ai → גם להם אישור
4. Dashboard עם לוג של כל מה שעלה

---

**בואלי לעבודה! 🔥**