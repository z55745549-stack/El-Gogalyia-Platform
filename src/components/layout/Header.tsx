import { Link } from 'react-router-dom';
import { Menu, Sun, Moon, Bell, Languages } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNotificationCount } from '@/hooks/useNotifications';

interface HeaderProps {
  onMobileMenuClick: () => void;
}

export function Header({ onMobileMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { language, isRTL, toggleLanguage, t } = useLanguage();
  const unreadCount = useNotificationCount();

  const formattedDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header
      className="sticky top-0 z-30 px-4 sm:px-6 h-14 flex items-center justify-between gap-3 font-sans transition-colors"
      style={{
        background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left side (Start): Mobile Drawer Toggle + Brand & Date */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuClick}
          className="lg:hidden p-2 rounded-xl transition-colors cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-elevated)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          aria-label={t('header.aria_open_nav', 'Open Navigation Menu')}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile Brand Title */}
        <div className="flex sm:hidden items-center gap-1.5 text-xs font-black">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--brand-primary)' }} />
          <span className="text-slate-900 dark:text-white font-black text-[13px]">
            {t('platform.name', 'منصة الجوجالية')}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--brand-primary)' }} />
          <span className="font-black text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-violet-400 dark:to-cyan-400">
            {t('platform.name', 'منصة الجوجالية')}
          </span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {formattedDate}
          </span>
        </div>
      </div>

      {/* Right side: Language Switcher + Notifications Bell + Theme Toggle */}
      <div className="flex items-center gap-2">
        {/* Language Switcher (AR / EN) */}
        <button
          onClick={toggleLanguage}
          title={t('header.lang.switch', language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية')}
          className="p-2 px-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-black"
          style={{
            color: 'var(--text-secondary)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
          aria-label={t('header.lang.switch', language === 'ar' ? 'Switch to English' : 'Switch to Arabic')}
        >
          <Languages className="h-4 w-4 text-indigo-500" />
          <span className="uppercase font-mono text-[11px] font-black tracking-wider text-[var(--text-primary)]">
            {language === 'ar' ? 'EN' : 'عربي'}
          </span>
        </button>

        {/* Notification Bell */}
        <Link
          to="/notifications"
          title={t('header.notifications', 'مركز الإشعارات والتنبيهات')}
          className="relative p-2 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
          style={{
            color: 'var(--text-secondary)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
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

        {/* Theme Toggle (Light / Dark Mode) */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? t('header.theme.light', 'التبديل إلى الوضع الفاتح') : t('header.theme.dark', 'التبديل إلى الوضع الليلي')}
          className="p-2 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
          style={{
            color: 'var(--text-secondary)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
          aria-label={t('header.aria_toggle_theme', 'Toggle Theme')}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400 animate-in spin-in-90 duration-300" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-600 animate-in spin-in-90 duration-300" />
          )}
        </button>
      </div>
    </header>
  );
}
