import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, Users, Coins, BarChart3,
  Shield, ClipboardList, Bell, Settings, LogOut,
  ListTodo, CalendarDays, GraduationCap, MessageCircleQuestion,
  CalendarCheck, Tag, ShoppingBag, BookOpen, ShieldAlert, Rocket, Sparkles, HeadphonesIcon,
  Inbox
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useNotificationCount } from '@/hooks/useNotifications';
import { Avatar } from '@/components/ui/avatar';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/utils';
import { getRoleLabel } from '@/utils/permissions';
import type { UserRole } from '@/types';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
  category: 'main' | 'work' | 'development' | 'rewards' | 'team' | 'system';
}

const ALL_ADMIN_ROLES: UserRole[] = ['lead', 'co_lead', 'head'];
const MEMBER_ROLES: UserRole[] = ['member', 'vice_head'];
const ALL_ROLES: UserRole[] = ['lead', 'co_lead', 'head', 'vice_head', 'member'];

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'لوحة التحكم', path: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, roles: ALL_ROLES, category: 'main' },

  // Member / Vice-Head work
  { key: 'my_tasks', label: 'مهامي وتكليفاتي', path: '/my-tasks', icon: <ListTodo className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'work' },
  { key: 'review_submissions', label: 'مراجعة تسليمات لجنتي', path: '/operations?tab=submissions', icon: <Inbox className="h-4 w-4" />, roles: ['vice_head'], category: 'work' },
  { key: 'my_attendance', label: 'سجل حضوري', path: '/my-attendance', icon: <CalendarCheck className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'work' },

  // Admin/Lead/Head work — unified
  { key: 'tasks', label: 'المهام والتكليفات', path: '/operations', icon: <CheckSquare className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'work' },
  { key: 'meetings', label: 'الاجتماعات واللقاءات', path: '/meetings', icon: <CalendarDays className="h-4 w-4" />, roles: ALL_ROLES, category: 'work' },

  // Team management
  { key: 'employees', label: 'فريق العمل والطلاب', path: '/employees', icon: <Users className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },
  { key: 'compliance', label: 'الحضور والانضباط', path: '/compliance', icon: <Shield className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },
  { key: 'reports', label: 'التقارير التحليلية', path: '/reports', icon: <BarChart3 className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },

  // Development
  { key: 'courses', label: 'الدورات التعليمية', path: '/courses', icon: <BookOpen className="h-4 w-4" />, roles: ALL_ROLES, category: 'development' },
  { key: 'opportunities', label: 'الفرص والتدريبات', path: '/opportunities', icon: <GraduationCap className="h-4 w-4" />, roles: ALL_ROLES, category: 'development' },

  // Unified Rewards & Perks
  { key: 'ocoins', label: 'محفظة O Coins والمتجر', path: '/ocoins', icon: <Coins className="h-4 w-4" />, roles: ALL_ROLES, category: 'rewards' },

  // System & Security
  { key: 'support', label: 'تذاكر الدعم الفني', path: '/support', icon: <HeadphonesIcon className="h-4 w-4" />, roles: ALL_ROLES, category: 'system' },
  { key: 'activity_logs', label: 'سجل العمليات', path: '/activity-logs', icon: <ClipboardList className="h-4 w-4" />, roles: ALL_ROLES, category: 'system' },
  { key: 'notifications', label: 'مركز التنبيهات', path: '/notifications', icon: <Bell className="h-4 w-4" />, roles: ALL_ROLES, category: 'system' },
];

const categoryLabels: Record<string, string> = {
  main: 'الرئيسية',
  work: 'عملي وإنجازاتي',
  team: 'إدارة الفريق',
  development: 'التطوير والتعلم',
  rewards: 'منظومة المكافآت والمزايا',
  system: 'النظام والأمان',
};

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function GogalyiaLogoMark() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0 shadow-sm rounded-xl transition-all duration-300">
      <svg width="34" height="34" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-xl transition-all duration-300">
        <rect
          x="16"
          y="16"
          width="480"
          height="480"
          rx="124"
          fill={isDark ? '#090B11' : '#FFFFFF'}
          stroke={isDark ? '#1E2330' : '#E2E8F0'}
          strokeWidth="6"
          className="transition-colors duration-300"
        />
        <path
          d="M 352 160 A 136 136 0 1 0 352 352 L 352 256"
          stroke={isDark ? '#FFFFFF' : '#0F172A'}
          strokeWidth="56"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="transition-colors duration-300"
        />
        <path
          d="M 352 256 L 244 256"
          stroke={isDark ? '#38BDF8' : '#2563EB'}
          strokeWidth="56"
          strokeLinecap="round"
          fill="none"
          className="transition-colors duration-300"
        />
      </svg>
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { userProfile, signOut } = useAuth();
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const role = userProfile?.role ?? 'member';
  const unreadCount = useNotificationCount();

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const categories = ['main', 'work', 'team', 'development', 'content', 'rewards', 'help', 'system'].filter(
    (cat) => visibleItems.some((item) => item.category === cat)
  );

  const sidebarContent = (
    <div
      className="flex flex-col h-full select-none transition-colors"
      style={{
        background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: isRTL ? '1px solid var(--border-subtle)' : 'none',
        borderRight: !isRTL ? '1px solid var(--border-subtle)' : 'none',
      }}
    >
      {/* ── Brand Header ─────────────────────────────────────────── */}
      <div
        className="p-4 sm:p-5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <GogalyiaLogoMark />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-slate-100 dark:to-indigo-200">
                {t('platform.name', 'منصة الجوجالية')}
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(79,70,229,0.12)',
                  color: 'var(--brand-primary)',
                  border: '1px solid rgba(79,70,229,0.2)',
                }}
              >
                2026
              </span>
            </div>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {t('platform.desc', 'مجتمع الجوجالية الرسمي')}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-4 no-scrollbar">
        {categories.map((cat) => {
          const itemsInCat = visibleItems.filter((item) => item.category === cat);
          if (!itemsInCat.length) return null;

          return (
            <div key={cat} className="space-y-0.5">
              <div
                className="text-[9.5px] font-bold uppercase tracking-widest px-2.5 mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('nav.cat.' + cat, categoryLabels[cat] || cat)}
              </div>

              {itemsInCat.map((item) => (
                <NavLink
                  key={item.path + item.label}
                  to={item.path}
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer group relative overflow-hidden',
                      isActive
                        ? 'sidebar-nav-item-active'
                        : 'sidebar-nav-item-inactive'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'shrink-0 transition-colors duration-150',
                          isActive ? 'text-[var(--brand-primary)]' : 'group-hover:text-[var(--brand-primary)]'
                        )}
                        style={{ color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)' }}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate flex-1">{t('nav.' + item.key, item.label)}</span>
                      {item.path === '/notifications' && unreadCount > 0 && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white min-w-[18px] text-center leading-none">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* ── User Card ─────────────────────────────────────────────── */}
      <div
        className="p-3 space-y-2"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={() => {
            navigate('/settings');
            onMobileClose();
          }}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-right transition-all duration-200 cursor-pointer group hover:scale-[1.01] active:scale-[0.99]"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
          title="عرض الملف الشخصي والإعدادات والأمان"
          aria-label="الملف الشخصي والإعدادات والأمان"
        >
          <div className="relative">
            <Avatar
              src={userProfile?.photoURL}
              name={userProfile?.displayName || userProfile?.username || 'User'}
              size="sm"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-900" />
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs font-bold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" style={{ color: 'var(--text-primary)' }}>
              {userProfile?.displayName || userProfile?.username || 'عضو الفريق'}
            </p>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <p className="text-[10px] font-semibold" style={{ color: '#A78BFA' }}>
                {getRoleLabel(role)}
              </p>
              <span className="text-[9px] font-bold text-slate-400 group-hover:text-indigo-500 transition-colors">
                {t('nav.settings', 'الملف الشخصي')} {isRTL ? '←' : '→'}
              </span>
            </div>
          </div>
        </button>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          style={{ color: 'var(--brand-danger)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{t('nav.logout', 'تسجيل الخروج')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-60 h-screen sticky top-0 shrink-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 lg:hidden"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: isRTL ? 260 : -260 }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? 260 : -260 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className={`fixed top-0 bottom-0 w-64 z-50 shadow-2xl lg:hidden ${isRTL ? 'right-0' : 'left-0'}`}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
