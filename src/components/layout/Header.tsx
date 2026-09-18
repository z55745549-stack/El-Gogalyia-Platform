import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Sun, Moon, Bell, Calendar, Clock, Coins, Shield } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNotificationCount } from '@/hooks/useNotifications';
import { Avatar } from '@/components/ui/avatar';
import { formatOCoins, hasUnlimitedCoins, formatFullName, cn } from '@/utils';
import { getRoleLabel } from '@/utils/permissions';
import type { UserRole } from '@/types';

interface HeaderProps {
  onMobileMenuClick: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'لوحة القيادة والمتابعة',
  '/operations': 'إدارة المهام والتكليفات',
  '/my-tasks': 'مهامي وتكليفاتي',
  '/employees': 'فريق العمل والطلاب',
  '/compliance': 'الحضور والانضباط',
  '/reports': 'التقارير والتحليلات',
  '/courses': 'الدورات التدريبية',
  '/opportunities': 'الفرص والتدريبات',
  '/ocoins': 'محفظة O Coins والمتجر',
  '/meetings': 'الاجتماعات واللقاءات',
  '/support': 'تذاكر الدعم الفني',
  '/activity-logs': 'سجل العمليات المباشر',
  '/notifications': 'مركز التنبيهات والإشعارات',
  '/profile': 'الملف الشخصي',
  '/settings': 'إعدادات الحساب والملف الشخصي',
};

export function Header({ onMobileMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { userProfile } = useAuth();
  const { isRTL, t } = useLanguage();
  const location = useLocation();
  const unreadCount = useNotificationCount();

  // Live real-time clock ticker
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = now.toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const formattedTime = now.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Derive current view title
  const currentTitle = (() => {
    const p = location.pathname;
    if (PAGE_TITLES[p]) return PAGE_TITLES[p];
    for (const [route, title] of Object.entries(PAGE_TITLES)) {
      if (p.startsWith(route)) return title;
    }
    return 'لوحة التحكم';
  })();

  return (
    <header
      className="sticky top-0 z-30 px-3 sm:px-6 h-15 flex items-center justify-between gap-3 font-sans transition-colors"
      style={{
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* ─── Start (Right in RTL): Navigation controls, Current View & Live Clock ─── */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        {/* Mobile menu toggle */}
        <button
          onClick={onMobileMenuClick}
          className="lg:hidden p-2 rounded-xl transition-colors cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
          aria-label={t('header.aria_open_nav', 'Open Navigation Menu')}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Current View Indicator Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] shadow-2xs">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs sm:text-[13px] font-black text-[var(--text-primary)] tracking-tight truncate">
            {currentTitle}
          </span>
        </div>

        {/* Global Live Date & Clock Widget (Unified in Navbar, keeping Dashboard Hero uncluttered) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-xs font-mono font-bold shadow-2xs">
          <Calendar className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
          <span className="text-[var(--text-secondary)]">{formattedDate}</span>
          <span className="text-[var(--border-strong)]">·</span>
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[var(--text-primary)] font-bold">{formattedTime}</span>
        </div>
      </div>

      {/* ─── End (Left in RTL): O-Coins, User Pill, Notifications & Theme ─── */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* O-Coins Balance Chip */}
        {userProfile && (
          <Link
            to="/ocoins"
            title="رصيد O Coins ومحفظة المكافآت"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all shadow-2xs glow-badge"
          >
            <span>🪙</span>
            <span dir="ltr">
              {hasUnlimitedCoins(userProfile.role) ? '∞' : formatOCoins(userProfile.oCoinsBalance ?? 0)}
            </span>
            <span className="text-[10px] text-amber-400/80 font-mono">OC</span>
          </Link>
        )}

        {/* Notifications Bell */}
        <Link
          to="/notifications"
          title={t('header.notifications', 'مركز الإشعارات والتنبيهات')}
          className="relative p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--brand-primary)] shadow-2xs"
          aria-label={t('header.aria_notifications', 'مركز الإشعارات')}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className={`absolute -top-1 ${isRTL ? '-left-1' : '-right-1'} min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse ring-2 ring-[var(--surface)]`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? t('header.theme.light', 'التبديل إلى الوضع الفاتح') : t('header.theme.dark', 'التبديل إلى الوضع الليلي')}
          className="p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] shadow-2xs"
          aria-label={t('header.aria_toggle_theme', 'Toggle Theme')}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400 animate-in spin-in-90 duration-300" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-600 animate-in spin-in-90 duration-300" />
          )}
        </button>

        {/* Executive User Profile Quick Pill — Leads to Profile & Account Settings */}
        {userProfile && (
          <Link
            to="/settings"
            title="إعدادات الحساب والملف الشخصي"
            className="flex items-center gap-2.5 p-1 pl-2 sm:pl-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--brand-primary)]/60 transition-all shadow-2xs group cursor-pointer"
          >
            <div className="relative">
              <Avatar
                src={userProfile.photoURL}
                name={formatFullName(userProfile.displayName || userProfile.username || 'User')}
                size="xs"
              />
              <span className="absolute -bottom-0.5 -left-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[var(--surface)] ring-1 ring-emerald-400/50" />
            </div>
            <div className="hidden lg:flex flex-col text-right leading-none">
              <span className="text-[11px] font-black text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors truncate max-w-[110px]">
                {formatFullName(userProfile.displayName || 'المستخدم').split(' ')[0]}
              </span>
              <span className="text-[9px] text-[var(--text-muted)] font-bold mt-0.5">
                {getRoleLabel(userProfile.role as UserRole)}
              </span>
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
