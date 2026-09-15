import { Link } from 'react-router-dom';
import { Menu, Sun, Moon, Bell } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useNotificationCount } from '@/hooks/useNotifications';

interface HeaderProps {
  onMobileMenuClick: () => void;
}

export function Header({ onMobileMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const unreadCount = useNotificationCount();

  return (
    <header
      className="sticky top-0 z-30 px-4 sm:px-6 h-14 flex items-center justify-between gap-3 font-sans transition-colors"
      style={{
        background: 'var(--surface-glass)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left side (RTL Start): Mobile Drawer Toggle + Brand & Date */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuClick}
          className="lg:hidden p-2 rounded-xl transition-colors cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-elevated)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--brand-primary)' }} />
          <span className="font-black text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-violet-400 dark:to-cyan-400">
            منصة الجوجالية
          </span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Right side: Notifications Bell + Theme Toggle */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <Link
          to="/notifications"
          title="مركز الإشعارات والتنبيهات"
          className="relative p-2 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
          style={{
            color: 'var(--text-secondary)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
          aria-label="مركز الإشعارات"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse ring-2 ring-[var(--surface)]"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Theme Toggle (Light / Dark Mode) */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الليلي'}
          className="p-2 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
          style={{
            color: 'var(--text-secondary)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
          aria-label="Toggle Theme"
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
