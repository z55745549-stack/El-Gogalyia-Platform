import React, { useState, useRef, useEffect } from 'react';
import { Bell, Menu, Sun, Moon, LogOut, CheckCheck, User, Settings, ChevronDown, Wrench } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMaintenance } from '@/hooks/useMaintenance';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AdminActionConfirmModal } from '@/components/auth/AdminActionConfirmModal';
import { getRoleLabel } from '@/utils/permissions';
import { formatRelative, getNotificationEmoji, cn } from '@/utils';
import { doc, updateDoc, writeBatch, collection, query, where, getDocs, db } from '@/lib/supabase';
import { toast } from 'sonner';

interface HeaderProps {
  onMobileMenuClick: () => void;
}

export function Header({ onMobileMenuClick }: HeaderProps) {
  const { userProfile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isMaintenanceActive, toggleMaintenance } = useMaintenance();
  const { notifications } = useNotifications(15);
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showAuthConfirm, setShowAuthConfirm] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isAdmin = userProfile && (userProfile.role === 'admin' || userProfile.role === 'superAdmin');
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const markAllRead = async () => {
    const recipientId = (userProfile?.username || userProfile?.email || '').toLowerCase();
    if (!recipientId) return;

    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientEmail', '==', recipientId),
        where('read', '==', false)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
      toast.success('تم تحديد جميع الإشعارات كمقروءة');
    } catch {
      toast.error('حدث خطأ');
    }
  };

  const markAsRead = async (notif: any) => {
    try {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      setShowNotifications(false);
      if (notif.actionUrl) {
        navigate(notif.actionUrl);
      } else if (notif.ticketId) {
        navigate(isAdmin ? '/admin/support' : `/support/${notif.ticketId}`);
      } else if (notif.taskId) {
        navigate(isAdmin ? `/tasks/${notif.taskId}` : `/my-tasks/${notif.taskId}`);
      } else if (notif.type?.startsWith('meeting')) {
        navigate('/meetings');
      } else if (notif.type?.startsWith('opportunity')) {
        navigate('/opportunities');
      } else if (notif.type?.startsWith('ocoin')) {
        navigate('/ocoins');
      }
    } catch {}
  };

  const executeEnableMaintenance = async () => {
    setTogglingMaintenance(true);
    try {
      await toggleMaintenance(true);
      toast.warning('تم تشغيل وضعية الصيانة الفورية!');
      setShowAuthConfirm(false);
    } catch {
      toast.error('حدث خطأ أثناء تفعيل الصيانة');
    } finally {
      setTogglingMaintenance(false);
    }
  };

  const executeDisableMaintenance = async () => {
    setTogglingMaintenance(true);
    try {
      await toggleMaintenance(false);
      toast.success('تم إنهاء وضعية الصيانة بنجاح وإتاحة المنصة للجميع! ✨');
      setShowMaintenanceModal(false);
    } catch {
      toast.error('حدث خطأ أثناء تعطيل وضع الصيانة');
    } finally {
      setTogglingMaintenance(false);
    }
  };

  const handleToggleMaintenanceMode = async () => {
    if (isMaintenanceActive) {
      await executeDisableMaintenance();
    } else {
      setShowMaintenanceModal(false);
      setShowAuthConfirm(true);
    }
  };

  return (
    <header
      className="sticky top-0 z-30 px-4 sm:px-6 h-14 flex items-center justify-between gap-3 font-sans transition-colors"
      style={{
        background: 'rgba(var(--surface, 15,15,26), 0.9)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'color-mix(in srgb, var(--surface) 90%, transparent)',
      }}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuClick}
          className="lg:hidden p-2 rounded-xl transition-colors cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-elevated)'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#6C63FF' }} />
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>GDG HITU Platform</span>
          <span style={{ color: 'var(--border-strong)' }}>·</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Admin Maintenance Mode Button */}
        {isAdmin && (
          <button
            onClick={() => setShowMaintenanceModal(true)}
            title={
              isMaintenanceActive
                ? 'وضعية الصيانة الفورية مفعلة حالياً — انقر للتعطيل وإتاحة المنصة'
                : 'تفعيل وضعية الصيانة الفورية للمنصة للتحديثات'
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border"
            style={isMaintenanceActive ? {
              background: 'rgba(244,63,94,0.15)',
              color: '#F43F5E',
              borderColor: 'rgba(244,63,94,0.3)',
            } : {
              background: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-default)',
            }}
            aria-label="Toggle Maintenance Mode"
          >
            <Wrench className={cn('h-3.5 w-3.5', isMaintenanceActive ? 'animate-spin' : '')} style={{ color: isMaintenanceActive ? '#F43F5E' : 'var(--text-muted)' }} />
            <span className="hidden md:inline">
              {isMaintenanceActive ? 'الصيانة نشطة' : 'وضع الصيانة'}
            </span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الليلي'}
          className="p-2 rounded-xl transition-colors cursor-pointer"
          style={{ color: 'var(--text-secondary)', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
          aria-label="Toggle Theme"
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4" style={{ color: '#F59E0B' }} />
            : <Moon className="h-4 w-4" style={{ color: '#6C63FF' }} />}
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className="relative p-2 rounded-xl transition-colors cursor-pointer"
            style={{ color: 'var(--text-secondary)', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 text-white text-[9px] font-black rounded-full flex items-center justify-center"
                style={{ background: 'var(--brand-danger)', boxShadow: '0 0 0 2px var(--surface)' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-88 rounded-2xl overflow-hidden z-50 text-right"
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <div className="p-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)' }}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>الإشعارات</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 font-bold text-[10px] rounded-full badge badge-danger">
                        {unreadCount} جديدة
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] font-semibold hover:underline flex items-center gap-1 cursor-pointer transition-opacity"
                      style={{ color: '#A78BFA' }}
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto no-scrollbar" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      لا توجد إشعارات جديدة حالياً
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n)}
                        className="p-3 flex items-start gap-2.5 transition-colors cursor-pointer text-right"
                        style={{
                          background: !n.read ? 'rgba(108,99,255,0.04)' : 'transparent',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-overlay)'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = !n.read ? 'rgba(108,99,255,0.04)' : 'transparent'}
                      >
                        <span className="text-sm shrink-0 mt-0.5">{getNotificationEmoji(n.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs leading-snug" style={{ color: 'var(--text-primary)', fontWeight: n.read ? 500 : 700 }}>
                            {n.title}
                          </p>
                          <p className="text-[11px] mt-0.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            {n.message}
                          </p>
                          <span className="text-[9px] font-medium mt-1 block" style={{ color: 'var(--text-muted)' }}>
                            {n.createdAt ? formatRelative(n.createdAt) : 'الآن'}
                          </span>
                        </div>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: 'var(--brand-primary)' }} />
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 text-center" style={{ background: 'var(--surface-overlay)' }}>
                  <Link
                    to="/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs font-bold hover:underline block py-1 transition-opacity"
                    style={{ color: '#A78BFA' }}
                  >
                    عرض كافة الإشعارات ←
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Popover Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl transition-colors cursor-pointer"
            style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-default)' }}
          >
            <Avatar
              src={userProfile?.photoURL}
              name={userProfile?.displayName || 'User'}
              size="sm"
            />
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold leading-tight truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>
                {userProfile?.displayName || 'عضو الفريق'}
              </p>
              <span className="text-[10px] font-semibold" style={{ color: '#A78BFA' }}>
                {getRoleLabel(userProfile?.role || 'employee')}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 hidden sm:block" style={{ color: 'var(--text-muted)' }} />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-56 rounded-2xl overflow-hidden z-50 text-right"
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <div className="p-3.5" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-overlay)' }}>
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{userProfile?.displayName}</p>
                  <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{userProfile?.email || userProfile?.username}</p>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <Link
                    to="/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-overlay)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <User className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} /> الملف الشخصي والأمان
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--surface-overlay)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Settings className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} /> إعدادات المنصة
                  </Link>
                </div>

                <div className="p-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    style={{ color: 'var(--brand-danger)' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.08)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <LogOut className="h-3.5 w-3.5" /> تسجيل الخروج
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Maintenance Mode Confirm Dialog for Disabling */}
      <ConfirmDialog
        open={showMaintenanceModal}
        onClose={() => setShowMaintenanceModal(false)}
        onConfirm={handleToggleMaintenanceMode}
        loading={togglingMaintenance}
        title={isMaintenanceActive ? 'إنهاء وضعية الصيانة الفورية' : 'تفعيل وضعية الصيانة الفورية للمنصة'}
        description={
          isMaintenanceActive
            ? 'هل أنت متأكد من إنهاء وضعية الصيانة وإعادة إتاحة المنصة لجميع الموظفين بشكل طبيعي؟'
            : 'تنبيه عاجل: سيتم إيقاف عمل المنصة فوراً أمام جميع الموظفين وحجب الوصول عنها وتوجيههم لشاشة الصيانة الفورية.'
        }
        confirmLabel={isMaintenanceActive ? 'إنهاء الصيانة وإتاحة المنصة' : 'تفعيل وضع الصيانة الفورية الآن'}
        cancelLabel="تراجع"
        variant={isMaintenanceActive ? 'default' : 'danger'}
      />

      {/* 2-Step Authorization Modal for Enabling Maintenance */}
      <AdminActionConfirmModal
        open={showAuthConfirm}
        actionType="enable_maintenance"
        onClose={() => setShowAuthConfirm(false)}
        onVerified={executeEnableMaintenance}
        loading={togglingMaintenance}
      />
    </header>
  );
}
