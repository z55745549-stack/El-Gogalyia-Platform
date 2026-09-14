import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, orderBy, limit
} from 'firebase/firestore';
import {
  CheckSquare, Clock, Upload, CheckCircle2, AlertTriangle,
  Coins, Calendar, ChevronLeft,
  TrendingUp, Sparkles, LifeBuoy, CalendarDays
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import {
  getGreeting, getFirstName, formatDate, formatOCoins, isOverdue, formatRelative, cn, safeDate
} from '@/utils';
import { getUserTaskStatus } from '@/lib/firestore';
import type { Task, TaskStatus, OCoinTransaction, Notification, Meeting } from '@/types';
import type { SupportTicket } from '@/types/support';

const TABS: { label: string; value: TaskStatus | 'all' | 'overdue' }[] = [
  { label: 'جميع مهامي', value: 'all' },
  { label: 'قيد التنفيذ', value: 'in_progress' },
  { label: 'تم تسليمها', value: 'submitted' },
  { label: 'المعتمدة', value: 'approved' },
  { label: 'المتأخرة', value: 'overdue' },
];

export function EmployeeDashboard() {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<OCoinTransaction[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [activeBan, setActiveBan] = useState<any>(null);

  const uid = userProfile?.uid || '';
  const usernameLower = (userProfile?.username || '').toLowerCase();
  const emailLower = (userProfile?.email || '').toLowerCase();
  const genUid = ('user_' + (userProfile?.username || '').replace(/[^a-z0-9]/g, '_')).toLowerCase();
  const uniqueIds = Array.from(new Set([uid, usernameLower, emailLower, genUid].filter(Boolean)));
  const userIdentifier = (userProfile?.username || userProfile?.email || '').toLowerCase();

  useEffect(() => {
    if (!userProfile?.uid && !userProfile?.username && !userProfile?.email) return;

    // 1. Fetch assigned tasks
    const loadTaskMerge = (allFsTasks: Task[]) => {
      const isAssigned = (t: Task) => {
        const assigned = (t.assignedTo || []).map((u: string) => u.toLowerCase().trim());
        return uniqueIds.some((id) => assigned.includes(id));
      };
      const userTasks = allFsTasks.filter(isAssigned);
      const sorted = userTasks.sort(
        (a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime()
      );
      setTasks(sorted);
      setLoading(false);
    };

    let fsTasksById: Record<string, Task[]> = {};
    const taskUnsubs: (() => void)[] = [];
    const refreshTasks = () => {
      const merged = Object.values(fsTasksById).flat();
      const seen = new Map<string, Task>();
      merged.forEach((t) => seen.set(t.id, t));
      loadTaskMerge(Array.from(seen.values()));
    };

    uniqueIds.forEach((id) => {
      const q = query(collection(db, 'tasks'), where('assignedTo', 'array-contains', id));
      const unsub = onSnapshot(q, (snap) => {
        fsTasksById[id] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
        refreshTasks();
      }, (err) => {
        console.warn('Firestore tasks query notice:', err);
        fsTasksById[id] = [];
        refreshTasks();
      });
      taskUnsubs.push(unsub);
    });

    // 2. Fetch recent O Coins transactions
    const ocoinsQuery = query(
      collection(db, 'oCoins'),
      where('userEmail', '==', userIdentifier),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubCoins = onSnapshot(
      ocoinsQuery,
      (snap) => {
        setRecentTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OCoinTransaction)));
      },
      (err) => console.warn('O Coins user query error:', err)
    );

    // 3. Upcoming Meetings
    const meetingsQuery = query(
      collection(db, 'meetings'),
      where('status', '==', 'scheduled'),
      orderBy('scheduledAt', 'asc'),
      limit(3)
    );
    const unsubMeetings = onSnapshot(
      meetingsQuery,
      (snap) => setUpcomingMeetings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting))),
      (err) => console.warn('Meetings query error:', err)
    );

    // 4. Support tickets
    const supportQuery = query(
      collection(db, 'supportTickets'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const unsubSupport = onSnapshot(
      supportQuery,
      (snap) => setSupportTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SupportTicket))),
      (err) => console.warn('Support tickets query error:', err)
    );

    return () => {
      taskUnsubs.forEach((u) => u());
      unsubCoins();
      unsubMeetings();
      unsubSupport();
    };
  }, [userProfile?.uid, userProfile?.username, userProfile?.email]);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const check = async () => {
      try {
        const { subscribeBans, getActiveBan } = await import('@/lib/bans');
        const unsub = subscribeBans((list) => {
          const active = getActiveBan(list, userProfile.uid);
          setActiveBan(active);
        });
        return unsub;
      } catch {}
    };
    let unsub: any;
    check().then((u) => { unsub = u; });
    return () => { if (unsub) unsub(); };
  }, [userProfile?.uid]);

  const overdueTasks = tasks.filter((t) => {
    const st = getUserTaskStatus(t, uniqueIds).status;
    return isOverdue(t.deadline, st as any);
  });
  const urgentTasks = tasks.filter((t) => {
    const st = getUserTaskStatus(t, uniqueIds).status;
    return (t.priority === 'urgent' || t.priority === 'high') && st !== 'approved';
  });
  const rejectedTasks = tasks.filter((t) => {
    const st = getUserTaskStatus(t, uniqueIds).status;
    return st === 'rejected';
  });

  const attentionItems = [...new Map([...overdueTasks, ...rejectedTasks, ...urgentTasks].map(item => [item.id, item])).values()];

  const filteredTasks = tasks.filter((t) => {
    const st = getUserTaskStatus(t, uniqueIds).status;
    if (activeTab === 'all') return true;
    if (activeTab === 'overdue') return isOverdue(t.deadline, st as any);
    if (activeTab === 'in_progress') return st === 'in_progress' || st === 'pending' || st === 'rejected';
    if (activeTab === 'submitted') return st === 'submitted';
    if (activeTab === 'approved') return st === 'approved';
    return st === activeTab;
  });

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter((t) => {
      const st = getUserTaskStatus(t, uniqueIds).status;
      return st === 'in_progress' || st === 'pending' || st === 'rejected';
    }).length,
    submitted: tasks.filter((t) => {
      const st = getUserTaskStatus(t, uniqueIds).status;
      return st === 'submitted';
    }).length,
    completed: tasks.filter((t) => {
      const st = getUserTaskStatus(t, uniqueIds).status;
      return st === 'approved';
    }).length,
    overdue: overdueTasks.length,
  };

  const earnedThisMonth = recentTransactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (activeBan) {
    const end = activeBan.endAt?.toDate ? activeBan.endAt.toDate() : new Date(activeBan.endAt);
    return (
      <div className="space-y-5 font-sans text-right dir-rtl">
        <div className="card p-6 sm:p-8 bg-[var(--brand-danger)]/10 border border-[var(--brand-danger)]/30 rounded-2xl text-[var(--text-primary)]">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[var(--brand-danger)] text-white text-xs font-bold">
            حسابك معلق حالياً
          </div>
          <h1 className="text-xl sm:text-2xl font-black mt-2">تم إيقاف صلاحيات الحساب مؤقتاً</h1>
          <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)]">
            تاريخ انتهاء التعليق: <strong>{end.toLocaleString('ar-EG')}</strong>
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">السبب: {activeBan.reason}</p>
          <p className="text-xs text-[var(--text-muted)] mt-3">
            لا يمكنك رفع تسليمات للمهام أو اكتساب عملات O-Coins خلال فترة التعليق. يرجى التواصل مع الإدارة.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 font-sans text-right dir-rtl">
      {/* ─── 1. Welcome & Contextual Header ────────────────────────────────────── */}
      <div className="card card-glass p-5 sm:p-6 relative overflow-hidden mesh-bg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full badge-accent text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5" />
              مساحة العمل والإنجاز · GDG HITU
            </div>
            <h1 className="page-title text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
              {getGreeting()}، {getFirstName(userProfile?.displayName ?? 'عضو الفريق')} 👋
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl font-medium leading-relaxed">
              {attentionItems.length > 0
                ? `لديك ${attentionItems.length} مهمة تتطلب اتخاذ إجراء وتسليم سريع.`
                : 'أداء ممتاز! جميع تكليفاتك المطلوبة محدثة وفي موعدها.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link to="/support">
              <Button
                variant="outline"
                size="sm"
                className="font-bold text-xs gap-1.5 cursor-pointer"
              >
                <LifeBuoy className="h-4 w-4 text-[var(--brand-accent)]" />
                <span>مركز المساعدة والدعم</span>
              </Button>
            </Link>
            <div className="px-3.5 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--brand-primary)]" />
              <span>{new Date().toLocaleDateString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Top Metrics & O Coins Account Card ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4">
        {/* O Coins Account Card (5 cols) */}
        <div className="md:col-span-5 card p-5 flex flex-col justify-between relative overflow-hidden border-[var(--brand-warm)]/30">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--brand-warm)] animate-pulse" />
                <p className="text-xs font-bold text-[var(--brand-warm)] uppercase tracking-wider">
                  رصيد عملات O-Coins
                </p>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight">
                {formatOCoins(userProfile?.oCoinsBalance ?? 0)}
                <span className="text-xs font-bold text-[var(--brand-warm)] mr-2">OC</span>
              </p>
            </div>
            <div className="w-12 h-12 bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] rounded-2xl flex items-center justify-center border border-[var(--brand-warm)]/30 shrink-0 shadow-sm shadow-[var(--brand-warm)]/20">
              <Coins className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 px-2.5 py-1 rounded-full border border-[var(--brand-accent)]/20">
              <TrendingUp className="h-3.5 w-3.5" />
              +{earnedThisMonth} OC مكافآت حديثة
            </div>
            <Link
              to="/ocoins"
              className="text-xs font-bold text-[var(--brand-primary)] hover:text-[var(--brand-accent)] hover:underline flex items-center gap-1"
            >
              <span>سجل المحفظة</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Task Counters Grid (7 cols) */}
        <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card rounded-2xl p-4 flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center mb-2">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.inProgress}</p>
              <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">قيد التنفيذ</p>
            </div>
          </div>

          <div className="card rounded-2xl p-4 flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] flex items-center justify-center mb-2">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.submitted}</p>
              <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">تم التسليم</p>
            </div>
          </div>

          <div className="card rounded-2xl p-4 flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-success)]/15 text-[var(--brand-success)] flex items-center justify-center mb-2">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.completed}</p>
              <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">تم الاعتماد</p>
            </div>
          </div>

          <div className={cn(
            'card rounded-2xl p-4 flex flex-col justify-between',
            stats.overdue > 0 && 'border-[var(--brand-danger)]/40 bg-[var(--brand-danger)]/[0.04]'
          )}>
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-2', stats.overdue > 0 ? 'bg-[var(--brand-danger)]/15 text-[var(--brand-danger)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]')}>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className={cn('text-2xl font-extrabold', stats.overdue > 0 ? 'text-[var(--brand-danger)]' : 'text-[var(--text-primary)]')}>{stats.overdue}</p>
              <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">متأخرة</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. Upcoming Meetings & Support Tickets Row ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Upcoming Meetings */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[var(--brand-accent)]" />
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                الاجتماعات واللقاءات القادمة
              </h3>
            </div>
            <Link to="/meetings" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              عرض الجدول <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>

          {upcomingMeetings.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-3 text-center">لا توجد لقاءات مجدولة حالياً.</p>
          ) : (
            <div className="space-y-2">
              {upcomingMeetings.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-xl bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{m.title}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{m.startTime} · {m.location || 'أونلاين'}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] shrink-0">
                    مجدول
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Support Tickets Quick View */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-[var(--brand-primary)]" />
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                تذاكر الدعم والاستفسارات
              </h3>
            </div>
            <Link to="/support" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              مركز الدعم <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>

          {supportTickets.length === 0 ? (
            <div className="py-3 text-center space-y-1.5">
              <p className="text-xs text-[var(--text-muted)]">ليس لديك أي تذاكر مفتوحة حالياً.</p>
              <Link to="/support" className="inline-block text-xs font-bold text-[var(--brand-primary)] hover:underline">
                + فتح تذكرة جديدة
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {supportTickets.map((t) => (
                <Link
                  key={t.id}
                  to={`/support/${t.id}`}
                  className="p-2.5 rounded-xl bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)] flex items-center justify-between gap-2 hover:bg-[var(--bg-elevated)] transition-colors block"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-[var(--brand-primary)]">{t.ticketNumber}</span>
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">{t.subject}</p>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {t.lastActivityAt ? formatRelative(t.lastActivityAt) : formatRelative(t.createdAt)}
                    </p>
                  </div>
                  <ChevronLeft className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── 4. Tasks Requiring Attention ───────────────────────────── */}
      {attentionItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--brand-danger)] animate-pulse" />
            <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
              مهام تتطلب اهتمامك وإجراءات سريعة ({attentionItems.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {attentionItems.slice(0, 2).map((item) => {
              const overdue = isOverdue(item.deadline, item.status);
              const isRejected = item.latestSubmission?.status === 'rejected';

              return (
                <div
                  key={item.id}
                  className={cn(
                    'card p-4 sm:p-5 flex flex-col justify-between gap-3',
                    overdue
                      ? 'border-[var(--brand-danger)]/40 bg-[var(--brand-danger)]/[0.03]'
                      : isRejected
                      ? 'border-[var(--brand-warm)]/40'
                      : ''
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={item.priority} />
                        <StatusBadge status={item.status} overdue={overdue} />
                      </div>
                      <span className="text-xs font-bold text-[var(--brand-warm)] bg-[var(--brand-warm)]/15 px-2 py-0.5 rounded-md border border-[var(--brand-warm)]/30">
                        🪙 {item.oCoinsReward} OC
                      </span>
                    </div>

                    <h3 className="font-bold text-[var(--text-primary)] text-sm sm:text-base">{item.title}</h3>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{item.description}</p>

                    {isRejected && item.latestSubmission?.rejectionReason && (
                      <div className="p-2.5 bg-[var(--brand-danger)]/10 rounded-xl border border-[var(--brand-danger)]/20 text-xs text-[var(--brand-danger)] font-medium">
                        <strong>ملاحظة الإدارة:</strong> {item.latestSubmission.rejectionReason}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[var(--brand-danger)]" /> الموعد: {formatDate(item.deadline)}
                    </span>
                    <Link to={`/my-tasks/${item.id}`}>
                      <Button variant="primary" size="sm" className="font-bold text-xs h-8">
                        تنفيذ وتسليم المهمة
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 5. Main "My Tasks" Showcase ─────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Header with Navigation Tabs */}
        <div className="p-4 sm:p-5 pb-0 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="section-title text-sm sm:text-base text-[var(--text-primary)]">مهامي وتكليفاتي</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">متابعة وتسليم التكليفات المسندة إليك</p>
            </div>
            <Link to="/my-tasks" className="text-xs font-bold text-[var(--brand-primary)] hover:text-[var(--brand-accent)] hover:underline flex items-center gap-1">
              عرض كافة المهام <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'px-3.5 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap -mb-px cursor-pointer',
                  activeTab === tab.value
                    ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                {tab.label}
                {tab.value === 'overdue' && overdueTasks.length > 0 && (
                  <span className="mr-1.5 px-1.5 py-0.2 bg-[var(--brand-danger)]/15 text-[var(--brand-danger)] text-[10px] font-black rounded-full">
                    {overdueTasks.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards Content */}
        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="h-8 w-8 text-[var(--text-muted)]" />}
              title="لا توجد مهام في هذا التبويب"
              description={activeTab === 'all' ? "ليس لديك أي تكليفات مسندة حالياً." : `لا توجد مهام حالياً بالحالة المطلوبة.`}
            />
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const overdue = isOverdue(task.deadline, task.status);

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-elevated)]/40 hover:bg-[var(--bg-elevated)]/70',
                      overdue
                        ? 'border-[var(--brand-danger)]/40'
                        : 'border-[var(--border-subtle)]'
                    )}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} overdue={overdue} />
                      </div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{task.title}</h3>
                      <div className="flex items-center gap-2.5 text-[11px] text-[var(--text-muted)]">
                        <span>الموعد: {formatDate(task.deadline)}</span>
                        <span>·</span>
                        <span className="text-[var(--brand-warm)] font-bold">🪙 {task.oCoinsReward} OC</span>
                      </div>
                    </div>

                    <Link to={`/my-tasks/${task.id}`}>
                      <Button variant="outline" size="sm" className="font-semibold text-xs shrink-0">
                        التفاصيل والتسليم ←
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
