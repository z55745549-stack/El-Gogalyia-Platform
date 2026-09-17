import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  isRTL: boolean;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Platform brand & Header
    'platform.name': 'منصة الجوجالية',
    'platform.desc': 'المنصة الرسمية لمجتمع الجوجالية',
    'header.notifications': 'مركز الإشعارات والتنبيهات',
    'header.theme.light': 'التبديل إلى الوضع الفاتح',
    'header.theme.dark': 'التبديل إلى الوضع الليلي',
    'header.lang.switch': 'Switch to English',
    'header.search': 'بحث...',

    // Sidebar navigation
    'nav.dashboard': 'لوحة التحكم',
    'nav.my_tasks': 'مهامي وتكليفاتي',
    'nav.review_submissions': 'مراجعة تسليمات لجنتي',
    'nav.my_attendance': 'سجل حضوري',
    'nav.tasks': 'المهام والتكليفات',
    'nav.meetings': 'الاجتماعات واللقاءات',
    'nav.employees': 'فريق العمل والطلاب',
    'nav.compliance': 'الحضور والانضباط',
    'nav.reports': 'التقارير التحليلية',
    'nav.courses': 'الدورات التعليمية',
    'nav.opportunities': 'الفرص والتدريبات',
    'nav.ocoins': 'محفظة O Coins والمتجر',
    'nav.support': 'تذاكر الدعم الفني',
    'nav.activity_logs': 'سجل العمليات',
    'nav.notifications': 'مركز التنبيهات',
    'nav.settings': 'إعدادات الحساب',
    'nav.logout': 'تسجيل الخروج',

    // Nav categories
    'nav.cat.main': 'الرئيسية',
    'nav.cat.work': 'عملي وإنجازاتي',
    'nav.cat.team': 'إدارة الفريق',
    'nav.cat.development': 'التطوير والتعلم',
    'nav.cat.rewards': 'منظومة المكافآت والمزايا',
    'nav.cat.system': 'النظام والأمان',

    // Roles
    'role.lead': 'قائد المنصة (Lead)',
    'role.co_lead': 'نائب القائد (Co-Lead)',
    'role.head': 'رئيس لجنة (Head)',
    'role.vice_head': 'نائب رئيس (Vice-Head)',
    'role.member': 'عضو (Member)',

    // Common Actions
    'action.add': 'إضافة',
    'action.save': 'حفظ التعديلات',
    'action.cancel': 'إلغاء',
    'action.delete': 'حذف',
    'action.edit': 'تعديل',
    'action.confirm': 'تأكيد',
    'action.close': 'إغلاق',
    'action.submit': 'إرسال',
    'action.approve': 'قبول واعتماد',
    'action.reject': 'رفض',
    'action.filter': 'تصفية',
    'action.search': 'بحث',
    'action.back': 'رجوع',
    'action.export': 'تصدير',

    // Status
    'status.active': 'نشط',
    'status.pending': 'قيد المراجعة',
    'status.suspended': 'معطل / موقوف',
    'status.completed': 'مكتمل',
    'status.in_progress': 'قيد التنفيذ',

    // Common labels
    'common.all': 'الكل',
    'common.committee': 'اللجنة',
    'common.specialty_tag': 'الوسم التخصصي',
    'common.date': 'التاريخ',
    'common.time': 'الوقت',
    'common.coins': 'عملات O-Coins',
  },
  en: {
    // Platform brand & Header
    'platform.name': 'El-Gogalyia Platform',
    'platform.desc': 'Official Platform of El-Gogalyia Community',
    'header.notifications': 'Notifications Center',
    'header.theme.light': 'Switch to Light Mode',
    'header.theme.dark': 'Switch to Dark Mode',
    'header.lang.switch': 'التبديل إلى العربية',
    'header.search': 'Search...',

    // Sidebar navigation
    'nav.dashboard': 'Dashboard',
    'nav.my_tasks': 'My Tasks',
    'nav.review_submissions': 'Review Submissions',
    'nav.my_attendance': 'My Attendance',
    'nav.tasks': 'Operations & Tasks',
    'nav.meetings': 'Meetings',
    'nav.employees': 'Team & Members',
    'nav.compliance': 'Attendance & Discipline',
    'nav.reports': 'Analytical Reports',
    'nav.courses': 'Courses & Academy',
    'nav.opportunities': 'Opportunities',
    'nav.ocoins': 'O-Coins Wallet & Perks',
    'nav.support': 'Support Tickets',
    'nav.activity_logs': 'Activity Logs',
    'nav.notifications': 'Notifications Center',
    'nav.settings': 'Account Settings',
    'nav.logout': 'Logout',

    // Nav categories
    'nav.cat.main': 'Main',
    'nav.cat.work': 'My Work',
    'nav.cat.team': 'Team Management',
    'nav.cat.development': 'Development & Learning',
    'nav.cat.rewards': 'Rewards & Perks',
    'nav.cat.system': 'System & Security',

    // Roles
    'role.lead': 'Platform Lead',
    'role.co_lead': 'Co-Lead',
    'role.head': 'Committee Head',
    'role.vice_head': 'Vice-Head',
    'role.member': 'Member',

    // Common Actions
    'action.add': 'Add',
    'action.save': 'Save Changes',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.confirm': 'Confirm',
    'action.close': 'Close',
    'action.submit': 'Submit',
    'action.approve': 'Approve',
    'action.reject': 'Reject',
    'action.filter': 'Filter',
    'action.search': 'Search',
    'action.back': 'Back',
    'action.export': 'Export',

    // Status
    'status.active': 'Active',
    'status.pending': 'Pending',
    'status.suspended': 'Suspended',
    'status.completed': 'Completed',
    'status.in_progress': 'In Progress',

    // Common labels
    'common.all': 'All',
    'common.committee': 'Committee',
    'common.specialty_tag': 'Specialty Tag',
    'common.date': 'Date',
    'common.time': 'Time',
    'common.coins': 'O-Coins',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('elgogalyia_lang');
    return saved === 'en' ? 'en' : 'ar';
  });

  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = direction === 'rtl';

  useEffect(() => {
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', language);
    localStorage.setItem('elgogalyia_lang', language);
  }, [language, direction]);

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language];
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        direction,
        isRTL,
        toggleLanguage,
        setLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
