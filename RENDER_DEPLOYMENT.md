# نشر النظام على Render

## 1) ارفع المشروع إلى GitHub
- Render يسحب الكود من Git repository.
- تأكد أن الملف `render.yaml` موجود في جذر المشروع.

## 2) إنشاء Blueprint على Render
1. ادخل Render Dashboard.
2. اختر `New` ثم `Blueprint`.
3. اختر المستودع (repo) الذي يحتوي على المشروع.
4. Render سيقرأ `render.yaml` وينشئ:
   - PostgreSQL database: `crm-postgres`
   - Backend web service: `crm-backend`
   - Frontend static service: `crm-frontend`

## 3) بعد أول Deploy
- ادخل على backend service > `Environment`.
- تأكد أن:
  - `ALLOWED_ORIGINS` = رابط الـ frontend الصحيح.
  - `JWT_SECRET` قيمة قوية (Render ينشئها تلقائيًا).

## 4) إنشاء أدمن رسمي
- من Shell الخاصة بخدمة backend أو عبر Job:
```bash
npm run admin:bootstrap -- --name "مدير النظام" --email "admin@yourcompany.com" --password "StrongPass!2026"
```

## 5) رابط التجربة للعميل
- رابط الواجهة: `https://crm-frontend.onrender.com` (أو الرابط الفعلي الذي يولده Render).
- API health check: `https://crm-backend.onrender.com/api/health`

## ملاحظات مهمة
- لو أسماء الخدمات كانت محجوزة على Render، غيّرها داخل `render.yaml` ثم أعد النشر.
- لا تستخدم بيانات seed الافتراضية في الإنتاج.
- أول تشغيل للـ backend قد يحتاج دقيقة إضافية حتى تكتمل migrations.
