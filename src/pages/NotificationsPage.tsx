import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, writeBatch, db } from '@/lib/supabase';
import { Bell, CheckCheck, Inbox, Sparkles, Filter, CheckCircle2, ChevronLeft, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const { notifications, loading } = useNotifications(100);
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();

  const markAllRead = async () => {
    const recipientId = (userProfile?.username || userProfile?.email || '').toLowerCase();
    if (!recipientId) return;

    setMarkingAll(true);
    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientEmail', '==', recipientId),
        where('read', '==', false)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.info('جميع الإشعارات مقروءة بالفعل.');
        setMarkingAll(false);
        return;
      }
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
      toast.success('تم تحديد جميع الإشعارات كمقروءة ✨');
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

  const unreadCount = notifications.filter((n) => !n.read).length;

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

  return (
    <div className="space-y-6 max-w-4xl mx-auto dir-rtl text-right font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="page-title text-2xl font-black text-slate-900 dark:text-white">
              مركز الإشعارات والتنبيهات
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FF3483]/10 text-[#FF3483] border border-[#FF3483]/20">
              {notifications.length}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            {unreadCount > 0
              ? `لديك ${unreadCount} إشعار غير مقروء في حسابك.`
              : 'جميع الإشعارات مقروءة ومحدثة بالكامل ✨'}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            loading={markingAll}
            className="gap-2 shadow-sm shrink-0 font-bold text-xs cursor-pointer"
          >
            <CheckCheck className="h-4 w-4 text-emerald-500" />
            <span>تحديد الكل كمقروء</span>
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: 'جميع الإشعارات', count: notifications.length },
          { id: 'unread', label: 'غير المقروءة', count: unreadCount },
          { id: 'tasks', label: 'المهام والتكليفات' },
          { id: 'support', label: 'الدعم الفني والتذاكر' },
          { id: 'meetings', label: 'الاجتماعات' },
          { id: 'system', label: 'المكافآت والنظام' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as NotificationTab)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5',
              activeTab === tab.id
                ? 'bg-[var(--brand-primary)] text-white shadow-md shadow-[var(--brand-primary)]/25'
                : 'bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-black',
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List Container */}
      <div className="card overflow-hidden transition-colors">
        {loading ? (
          <div className="p-6">
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
            <AnimatePresence>
              {filteredNotifications.map((notif) => (
                <NotificationRow
                  key={notif.id}
                  notif={notif}
                  onClick={() => handleNotificationClick(notif)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationRow({ notif, onClick }: { notif: Notification; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'flex items-start gap-3.5 px-5 py-4 hover:bg-[var(--bg-elevated)]/60 transition-colors cursor-pointer text-right group',
        !notif.read ? 'bg-[var(--brand-primary)]/[0.04]' : 'opacity-85'
      )}
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-lg shrink-0 shadow-xs group-hover:scale-105 transition-transform">
        {getNotificationEmoji(notif.type)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-sm text-[var(--text-primary)] flex items-center gap-1.5', !notif.read ? 'font-black' : 'font-bold')}>
            {notif.title}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {!notif.read && (
              <span className="w-2.5 h-2.5 bg-[var(--brand-primary)] rounded-full shrink-0 animate-pulse" />
            )}
            <ChevronLeft className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          </div>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
          {notif.message}
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
          {notif.createdAt ? formatRelative(notif.createdAt) : 'الآن'}
        </p>
      </div>
    </motion.div>
  );
}
