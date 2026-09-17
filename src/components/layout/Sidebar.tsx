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
import { useNotificationCount } from '@/hooks/useNotifications';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/utils';
import { getRoleLabel } from '@/utils/permissions';
import type { UserRole } from '@/types';

interface NavItem {
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
  { label: 'لوحة التحكم', path: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, roles: ALL_ROLES, category: 'main' },

  // Member / Vice-Head work
  { label: 'مهامي وتكليفاتي', path: '/my-tasks', icon: <ListTodo className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'work' },
  { label: 'مراجعة تسليمات لجنتي', path: '/operations?tab=submissions', icon: <Inbox className="h-4 w-4" />, roles: ['vice_head'], category: 'work' },
  { label: 'سجل حضوري', path: '/my-attendance', icon: <CalendarCheck className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'work' },

  // Admin/Lead/Head work — unified
  { label: 'المهام والتكليفات', path: '/operations', icon: <CheckSquare className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'work' },
  { label: 'الاجتماعات واللقاءات', path: '/meetings', icon: <CalendarDays className="h-4 w-4" />, roles: ALL_ROLES, category: 'work' },

  // Team management
  { label: 'فريق العمل والطلاب', path: '/employees', icon: <Users className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },
  { label: 'الحضور والانضباط', path: '/compliance', icon: <Shield className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },
  { label: 'التقارير التحليلية', path: '/reports', icon: <BarChart3 className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },

  // Development
  { label: 'الدورات التعليمية', path: '/courses', icon: <BookOpen className="h-4 w-4" />, roles: ALL_ROLES, category: 'development' },
  { label: 'الفرص والتدريبات', path: '/opportunities', icon: <GraduationCap className="h-4 w-4" />, roles: ALL_ROLES, category: 'development' },

  // Unified Rewards & Perks
  { label: 'محفظة O Coins والمتجر', path: '/ocoins', icon: <Coins className="h-4 w-4" />, roles: ALL_ROLES, category: 'rewards' },

  // System & Security
  { label: 'تذاكر الدعم الفني', path: '/support', icon: <HeadphonesIcon className="h-4 w-4" />, roles: ALL_ROLES, category: 'system' },
  { label: 'سجل العمليات', path: '/activity-logs', icon: <ClipboardList className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'system' },
  { label: 'مركز التنبيهات', path: '/notifications', icon: <Bell className="h-4 w-4" />, roles: ALL_ROLES, category: 'system' },
  { label: 'الإعدادات والأمان', path: '/settings', icon: <Settings className="h-4 w-4" />, roles: ALL_ROLES, category: 'system' },
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
  return (
    <div className="relative inline-flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] rounded-xl">
      <svg width="34" height="34" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-xl">
        <defs>
          <linearGradient id="sbLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <linearGradient id="sbRightGrad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="sbRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <rect x="16" y="16" width="480" height="480" rx="120" fill="#0A0C14" stroke="url(#sbRim)" strokeWidth="6" />
        <polygon points="186,126 78,256 186,386 226,346 148,256 226,166" fill="url(#sbLeftGrad)" />
        <polygon points="272,118 314,118 240,394 198,394" fill="#FFFFFF" />
        <polygon points="326,126 434,256 326,386 286,346 364,256 286,166" fill="url(#sbRightGrad)" />
        <line x1="78" y1="256" x2="186" y2="126" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.85" />
        <line x1="326" y1="126" x2="434" y2="256" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.85" />
      </svg>
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { userProfile, signOut } = useAuth();
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
        borderLeft: '1px solid var(--border-subtle)',
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
                منصة الجوجالية
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
              مجتمع الجوجالية الرسمي
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
                className="text-[9.5px] font-bold uppercase tracking-widest px-2.5 mb-1.5 text-right"
                style={{ color: 'var(--text-muted)' }}
              >
                {categoryLabels[cat]}
              </div>

              {itemsInCat.map((item) => (
                <NavLink
                  key={item.path + item.label}
                  to={item.path}
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer text-right group relative overflow-hidden',
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
                      <span className="truncate flex-1">{item.label}</span>
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
        <div
          className="flex items-center gap-2.5 p-2.5 rounded-xl"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Avatar
            src={userProfile?.photoURL}
            name={userProfile?.displayName || userProfile?.username || 'User'}
            size="sm"
          />
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {userProfile?.displayName || userProfile?.username || 'عضو الفريق'}
            </p>
            <p className="text-[10px] font-semibold" style={{ color: '#A78BFA' }}>
              {getRoleLabel(role)}
            </p>
          </div>
        </div>

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
          <span>تسجيل الخروج</span>
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
              initial={{ x: 260 }}
              animate={{ x: 0 }}
              exit={{ x: 260 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="fixed right-0 top-0 bottom-0 w-64 z-50 shadow-2xl lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
