# منصة الجوجالية — GDG HITU Platform 🚀

منصة الحوكمة وإدارة الفرق الذكية المصممة وفق أعلى المعايير الهندسية والتقنية لتنظيم الأعمال، المهام، الحضور، ومكافآت التميز.

---

## 🏛️ التقنيات المستخدمة (Tech Stack)
- **Frontend Framework:** React 19 + TypeScript
- **Bundler & Build Tool:** Vite 8
- **Styling:** Tailwind CSS v4 + Vanilla CSS Design Tokens (Cosmic Indigo & Aurora Dark / Warm Stone Light)
- **Icons & UI:** Lucide React, Framer Motion, Radix UI Primitives, Sonner Toaster
- **Backend & Database:** Supabase (PostgreSQL + Realtime Sync + Storage)
- **Security & Cryptography:** PBKDF2 Password Hashing, Device Biometric Identity (WebAuthn), Session Tamper Protection
- **Deployment:** Vercel (Edge Network & Serverless)

---

## 👥 هيكل وهرمية الصلاحيات (5-Role Hierarchy)
1. **قائد الفريق (LEAD):** رتبة إشراف عامة 100% متساوية مع الكو ليد فوق كافة اللجان.
2. **نائب القائد (CO-LEAD):** رتبة إشراف عامة 100% متساوية مع الليد بصلاحيات حوكمة كاملة.
3. **رئيس اللجنة (HEAD):** إدارة وصلاحيات كاملة للجان والمهام والحضور والمكافآت.
4. **نائب رئيس اللجنة (VICE-HEAD):** استلام وتنفيذ المهام، الحضور، والمتجر.
5. **العضو (MEMBER):** تنفيذ المهام، الحضور، متجر O Coins، والملف الشخصي.

---

## 📁 هيكلية المشروع النظيفة (Clean Architecture)

```
├── src/
│   ├── assets/           # الوسائط والصور المعتمدة
│   ├── components/       # المكونات القابلة لإعادة الاستخدام
│   │   ├── auth/         # صفحات ومكونات تسجيل الدخول والاعتماد
│   │   ├── dashboard/    # لوحات تحكم مخصصة لكل دور
│   │   ├── layout/       # الهيكل العام (Sidebar, Header, AppLayout)
│   │   ├── settings/     # إعدادات الحساب وهوية الجهاز
│   │   ├── support/      # نظام الدعم والمساعد الذكي العائم
│   │   ├── tasks/        # نوافذ ونماذج المهام
│   │   └── ui/           # مكتبة العناصر الأساسية (Buttons, Modals, Cards)
│   ├── context/          # سياقات الحالة العامة (AuthContext, ThemeContext)
│   ├── hooks/            # الخطافات المخصصة (useNotifications)
│   ├── lib/              # خدمات العمليات وقاعدة البيانات والأمان
│   ├── pages/            # 18 صفحة شاشات رئيسية للمنصة
│   ├── routes/           # التوجيه وحماية المسارات (ProtectedRoute)
│   ├── types/            # تعريفات TypeScript الصارمة
│   ├── utils/            # دوال المساعدة والتنسيق والصلاحيات
│   ├── index.css         # نظام التصميم العالمي وتدرجات الألوان
│   └── main.tsx          # نقطة دخول التطبيق الرئيسية
├── public/               # الملفات الثابتة والأيقونات العامة
├── vercel.json           # إعدادات النشر وحماية الهيدرز (CSP, HSTS)
└── vite.config.ts        # إعدادات Vite ومسارات الاستيراد (@/)
```

---

## 🔒 معايير الأمان والحوكمة
- **تشفير كلمات المرور:** اعتماد خوارزمية PBKDF2 المشفرة، وعدم تخزين أي كلمات مرور بصيغة نصية.
- **الحماية اللحظية:** منع التلاعب بالجلسات وتتبع سجل العمليات الإدارية (Activity Logs).
- **الهوية البيومترية:** دعم المصادقة عبر بصمة الإصبع والوجه للوصول فائق السرعة والأمان.

---

## 🚀 تشغيل المشروع محلياً (Local Development)

```bash
# تثبيت الحزم
npm install

# تشغيل خادم التطوير
npm run dev

# فحص البناء والإنتاج
npm run build
```
