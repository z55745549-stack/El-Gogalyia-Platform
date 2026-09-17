import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, writeBatch, db } from '@/lib/supabase';
import { Bell, CheckCheck, ChevronLeft, Sparkles, Filter, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRow } from '@/components/ui/loading-spinner';
import { formatRelative, getNotificationEmoji, cn } from '@/utils';
import { toast } from 'sonner';
import type { Notification } from '@/types';
import { isAdminRole } from '@/utils/permissions';

type NotificationTab = 'all' | 'unread' | 'tasks' | 'support' | 'meetings' | 'system';

export function NotificationsPage() {
  const { userProfile } = useAuth();
  const { notifications, loading, unreadCount } = useNotifications(100);
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();

  const markAllRead = async () => {
    const unreadItems = notifications.filter((n) => !n.read);
    if (unreadItems.length === 0) {
      toast.info('جميع الإشعارات مقروءة بالفعل.');
      return;
    }

    setMarkingAll(true);
    try {
      const batch = writeBatch(db);
      unreadItems.forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
      toast.success('تم تحديد جميع الإشعارات كمقروءة بنجاح ✨');
    } catch (err) {
      console.error('Mark all read error:', err);
      toast.error('حدث خطأ أثناء تحديث الإشعارات.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.read) {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      }
    } catch (err) {
      console.error('Mark read error:', err);
    }

    // Determine target URL
    const isAdmin = userProfile ? isAdminRole(userProfile.role) : false;
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    } else if (notif.ticketId) {
      navigate(isAdmin ? `/admin/support` : `/support/${notif.ticketId}`);
    } else if (notif.taskId) {
      navigate(isAdmin ? `/tasks/${notif.taskId}` : `/my-tasks/${notif.taskId}`);
    } else if (notif.type.startsWith('meeting')) {
      navigate('/meetings');
    } else if (notif.type.startsWith('opportunity')) {
      navigate('/opportunities');
    } else if (notif.type.startsWith('ocoin')) {
      navigate('/ocoins');
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'tasks') {
      return (
        n.type === 'task_assigned' ||
        n.type === 'task_submitted' ||
        n.type === 'task_approved' ||
        n.type === 'task_rejected' ||
        n.type === 'deadline_approaching' ||
        n.type === 'deadline_changed'
      );
    }
    if (activeTab === 'support') {
      return (
        n.type === 'support_ticket_created' ||
        n.type === 'support_ticket_reply' ||
        n.type === 'support_ticket_status' ||
        n.type === 'support_ticket_assigned'
      );
    }
    if (activeTab === 'meetings') {
      return (
        n.type === 'meeting.created' ||
        n.type === 'meeting.updated' ||
        n.type === 'meeting.cancelled'
      );
    }
    if (activeTab === 'system') {
      return (
        n.type === 'ocoin_added' ||
        n.type === 'ocoin_removed' ||
        n.type === 'ban.suspended' ||
        n.type === 'ban.lifted' ||
        n.type === 'opportunity.created' ||
        n.type === 'opportunity.updated'
      );
    }
    return true;
  });

  const tabs: Array<{ id: NotificationTab; label: string; count?: number }> = [
    { id: 'all', label: 'الكل', count: notifications.length },
    { id: 'unread', label: 'غير المقروءة', count: unreadCount },
    { id: 'tasks', label: 'المهام والتكليفات' },
    { id: 'support', label: 'الدعم والتذاكر' },
    { id: 'meetings', label: 'الاجتماعات' },
    { id: 'system', label: 'المكافآت والنظام' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto dir-rtl text-right font-sans">
      {/* ─── Header Section (Responsive Mobile + Desktop) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface-elevated)]/40 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-[var(--border-subtle)] backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--brand-primary)] to-cyan-500 text-white flex items-center justify-center shadow-xs">
              <Bell className="h-4 w-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
              مركز التنبيهات والإشعارات
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20">
              {notifications.length}
            </span>
          </div>
          <p className="text-[var(--text-muted)] text-xs sm:text-sm mt-1">
            {unreadCount > 0
              ? `لديك ${unreadCount} تنبيه غير مقروء في حسابك.`
              : 'جميع الإشعارات مقروءة ومحدثة بالكامل ✨'}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            loading={markingAll}
            className="w-full sm:w-auto justify-center gap-2 shadow-xs shrink-0 font-bold text-xs h-9 rounded-xl border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)]"
          >
            <CheckCheck className="h-4 w-4 text-emerald-500" />
            <span>تحديد الكل كمقروء</span>
          </Button>
        )}
      </div>

      {/* ─── Filter Tabs (Wrapped Cleanly for Instant Mobile Access) ─── */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1 pt-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95',
                isActive
                  ? 'bg-[var(--brand-primary)] text-white shadow-md shadow-[var(--brand-primary)]/25'
                  : 'bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-black',
                    isActive ? 'bg-white/20 text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Notifications List (Ultra-Performant, Zero Framedrops on Mobile) ─── */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm transition-colors">
        {loading ? (
          <div className="p-4 sm:p-6">
            <SkeletonRow count={5} />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8 text-[var(--text-muted)]" />}
            title="لا توجد إشعارات في هذا القسم"
            description="ستصلك إشعارات وتنبيهات فورية عند إسناد مهام جديدة، مراجعة التسليمات، أو تعديل رصيد O Coins."
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {filteredNotifications.map((notif) => (
              <NotificationRow
                key={notif.id}
                notif={notif}
                onClick={() => handleNotificationClick(notif)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationRow({ notif, onClick }: { notif: Notification; onClick: () => void }) {
  const isUnread = !notif.read;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={cn(
        'flex items-start gap-3 sm:gap-3.5 px-3.5 py-3 sm:px-5 sm:py-4 transition-all duration-150 cursor-pointer text-right group active:scale-[0.99]',
        isUnread
          ? 'bg-[var(--brand-primary)]/[0.04] border-r-3 sm:border-r-4 border-r-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/[0.08]'
          : 'hover:bg-[var(--surface-elevated)]/60 opacity-90'
      )}
    >
      {/* Notification Icon Avatar */}
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-base sm:text-lg shrink-0 shadow-xs group-hover:scale-105 transition-transform mt-0.5">
        {getNotificationEmoji(notif.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'text-xs sm:text-sm text-[var(--text-primary)] truncate leading-tight',
              isUnread ? 'font-black' : 'font-bold'
            )}
          >
            {notif.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {isUnread && (
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-[var(--brand-primary)] rounded-full shrink-0 animate-pulse shadow-xs shadow-[var(--brand-primary)]" />
            )}
            <ChevronLeft className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:-translate-x-0.5 transition-all" />
          </div>
        </div>

        <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-1 leading-relaxed line-clamp-2 sm:line-clamp-3">
          {notif.message}
        </p>

        <p className="text-[10px] text-[var(--text-muted)] mt-1.5 font-medium flex items-center gap-1">
          <span>{notif.createdAt ? formatRelative(notif.createdAt) : 'الآن'}</span>
        </p>
      </div>
    </div>
  );
}
