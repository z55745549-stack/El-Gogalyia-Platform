import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, Users, Coins, BarChart3,
  Shield, ClipboardList, Bell, Settings, LogOut,
  ListTodo, CalendarDays, Ban, Inbox, GraduationCap, LifeBuoy,
  QrCode, CalendarCheck, Tag, ShoppingBag, BookOpen
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/utils';
import { getRoleLabel } from '@/utils/permissions';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
  category: 'main' | 'work' | 'development' | 'rewards' | 'content' | 'team' | 'help' | 'system';
}

const ALL_ADMIN_ROLES: UserRole[] = ['lead', 'co_lead', 'head', 'superAdmin', 'admin'];
const MEMBER_ROLES: UserRole[] = ['member', 'vice_head', 'employee'];
const ALL_ROLES: UserRole[] = ['lead', 'co_lead', 'head', 'vice_head', 'member', 'superAdmin', 'admin', 'employee'];

const navItems: NavItem[] = [
  { label: 'لوحة التحكم', path: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, roles: ALL_ROLES, category: 'main' },
  { label: 'مهامي وتكليفاتي', path: '/my-tasks', icon: <ListTodo className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'work' },
  { label: 'سجل حضوري', path: '/my-attendance', icon: <CalendarCheck className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'work' },
  { label: 'الاجتماعات واللقاءات', path: '/meetings', icon: <CalendarDays className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'work' },
  { label: 'المهام والتكليفات', path: '/tasks', icon: <CheckSquare className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'work' },
  { label: 'تسليمات المهام', path: '/submitted-tasks', icon: <Inbox className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'work' },
  { label: 'فريق العمل والطلاب', path: '/employees', icon: <Users className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },
  { label: 'نظام الحضور (QR)', path: '/attendance', icon: <QrCode className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },
  { label: 'الاجتماعات واللقاءات', path: '/meetings', icon: <CalendarDays className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },
  { label: 'الحظر والعقوبات', path: '/bans', icon: <Ban className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'team' },
  { label: 'الدورات التعليمية', path: '/courses', icon: <BookOpen className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'development' },
  { label: 'الفرص والتدريبات', path: '/opportunities', icon: <GraduationCap className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'development' },
  { label: 'الدورات التعليمية', path: '/courses', icon: <BookOpen className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'content' },
  { label: 'إدارة الدورات', path: '/admin/courses', icon: <GraduationCap className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'content' },
  { label: 'الفرص والتدريبات', path: '/opportunities', icon: <GraduationCap className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'content' },
  { label: 'إدارة الخصومات', path: '/admin/discounts', icon: <Tag className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'content' },
  { label: 'محفظة O Coins', path: '/ocoins', icon: <Coins className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'rewards' },
  { label: 'متجر الخصومات', path: '/discounts', icon: <Tag className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'rewards' },
  { label: 'مشترياتي', path: '/my-discounts', icon: <ShoppingBag className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'rewards' },
  { label: 'محفظة O Coins', path: '/ocoins', icon: <Coins className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'rewards' },
  { label: 'متجر الخصومات', path: '/discounts', icon: <Tag className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'rewards' },
  { label: 'مركز المساعدة', path: '/support', icon: <LifeBuoy className="h-4 w-4" />, roles: MEMBER_ROLES, category: 'help' },
  { label: 'إدارة التذاكر', path: '/admin/support', icon: <LifeBuoy className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'help' },
  { label: 'إدارة الوصول', path: '/access-management', icon: <Shield className="h-4 w-4" />, roles: ['lead', 'co_lead', 'head', 'superAdmin', 'admin'], category: 'system' },
  { label: 'التقارير والإحصائيات', path: '/reports', icon: <BarChart3 className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'system' },
  { label: 'سجل العمليات', path: '/activity-logs', icon: <ClipboardList className="h-4 w-4" />, roles: ALL_ADMIN_ROLES, category: 'system' },
  { label: 'مركز التنبيهات', path: '/notifications', icon: <Bell className="h-4 w-4" />, roles: ALL_ROLES, category: 'system' },
  { label: 'الإعدادات والأمان', path: '/settings', icon: <Settings className="h-4 w-4" />, roles: ALL_ROLES, category: 'system' },
];

const categoryLabels: Record<string, string> = {
  main: 'الرئيسية',
  work: 'عملي وإنجازاتي',
  team: 'إدارة الفريق',
  development: 'التطوير والتعلم',
  content: 'المحتوى والتدريب',
  rewards: 'المكافآت و O Coins',
  help: 'المساعدة والدعم',
  system: 'النظام والأمان',
};

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function GDGLogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sbLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6C63FF" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#sbLogoGrad)" />
      <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="13" fontWeight="900"
        fontFamily="Inter, Cairo, sans-serif" letterSpacing="-0.5">G</text>
    </svg>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const role = userProfile?.role ?? 'member';

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
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Brand Header ─────────────────────────────────────────── */}
      <div
        className="p-4 sm:p-5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <GDGLogoMark />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
                GDG HITU
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(108,99,255,0.12)',
                  color: '#A78BFA',
                  border: '1px solid rgba(108,99,255,0.2)',
                }}
              >
                Platform
              </span>
            </div>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
              Google Developer Group
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
                          isActive ? 'text-[#A78BFA]' : 'group-hover:text-[#A78BFA]'
                        )}
                        style={{ color: isActive ? '#A78BFA' : 'var(--text-muted)' }}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
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
