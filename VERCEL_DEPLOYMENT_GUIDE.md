# دليل رفع مشروع SAAS Work Hub على Vercel 🚀

المشروع جاهز ومؤهل 100% للرفع على استضافة **Vercel** مجاناً مع إعدادات حظر أخطاء الـ SPA (404 Page Not Found) تلقائياً.

---

## 📋 الإعدادات المجهزة تلقائياً للمشروع:

1. **ملف `vercel.json`**:
   - تم إنشاء وتعيين التوجيهات (`rewrites`) بحيث يتم تحويل كافة المسارات الفرعية إلى `index.html` دون أي أخطاء 404 عند عمل تحديث للصفحة (Refresh).
2. **أوامر البناء (`npm run build`)**:
   - بيئة البناء تستخرج المخرجات في مجلد `dist/` خلال أقل من ثانيتين وبطريقة متوافقة تماماً مع Vercel.

---

## 🛠️ طرق الرفع على Vercel:

### الطريقة الأولى: الرفع عبر GitHub (الأسهل والأفضل) ⭐

1. ارفع الكود إلى مستودع جديد على **GitHub**.
2. ادخل على منصة [Vercel](https://vercel.com) وسجل الدخول بحساب GitHub الخاص بك.
3. اضغط على **Add New...** -> **Project**.
4. اختر المستودع الخاص بـ **SAAS Work Hub** واضغط **Import**.
5. في شاشة الإعدادات (**Environment Variables**):
   - أضف متغيرات بيئة Supabase التالية (من ملف `.env.local`):
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - **مهم للتأكيدات الإدارية (Environmental Variables for the serverless API):**
     أضف نفس قيم التفويض الموجودة في `.env.local` (بدون بادئة `VITE_` لأنها أسرار تُقرأ فقط سيرفراً):
     - `ADD_EMPLOYEE_CONFIRM_USERNAME` و `ADD_EMPLOYEE_CONFIRM_PASSWORD`
     - `ADD_ADMIN_CONFIRM_USERNAME` و `ADD_ADMIN_CONFIRM_PASSWORD`
     - `ADD_OPPORTUNITY_CONFIRM_USERNAME` و `ADD_OPPORTUNITY_CONFIRM_PASSWORD`
     - `BAN_CONFIRM_USERNAME` و `BAN_CONFIRM_PASSWORD`
     - `MAINTENANCE_CONFIRM_USERNAME` و `MAINTENANCE_CONFIRM_PASSWORD`
     - `CHANGE_USER_PASSWORD_CONFIRM_USERNAME` و `CHANGE_USER_PASSWORD_CONFIRM_PASSWORD`
     ⚠️ إذا لم تُضف هذه المتغيرات، ستظهر رسالة «خطأ في إعداد مفاتيح التفويض على الخادم».
     ⚠️ غيّر قيمها الافتراضية إلى قيم قوية وسرية خاصة بك.
6. اضغط على زر **Deploy**.
7. خلال ثوانٍ معدودة سيعطيك Vercel الرابط النهائي المباشر للتطبيق!

---

### الطريقة الثانية: الرفع المباشر عبر Vercel CLI

إذا كنت تريد الرفع المباشر من جهازك بدون GitHub:

1. افتح مبدل الأوامر (Terminal) في مجلد المشروع ونفّذ الأمر:
   ```bash
   npm install -g vercel
   ```
2. قم بتسجيل الدخول بأمر:
   ```bash
   vercel login
   ```
3. انشر المشروع مباشرة بـ أمر:
   ```bash
   vercel --prod
   ```

---

## 🧪 التطوير المحلي مع الخادم اللاخادم (Serverless) للتأكيدات

للاختبار المحلي لعملية التفويض الإدارية (نافذة اسم المستخدم وكلمة المرور للتأكيد)، يجب تشغيل دالة Vercel محلياً عبر:
```bash
npm install -g vercel
vercel dev
```
ثم في نافذة أخرى:
```bash
npm run dev
```
سيقوم `vite.config.ts` بتحويل طلبات `/api/*` إلى `vercel dev` (port 3000) تلقائياً.

> **ملاحظة:** إذا لم تُضبط متغيرات التفويض في `vercel dev`، يمكن تعليقها في `.env.local` وسيلتقطها Vercel CLI.

---

🎉 **مبروك! مشروعك الآن جاهز للعمل على Vercel بأعلى أداء واستقرار.**
