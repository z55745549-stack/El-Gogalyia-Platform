import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, orderBy, limit, db
} from '@/lib/supabase';
import {
  CheckSquare, Clock, Upload, CheckCircle2, AlertTriangle,
  Coins, Calendar, ChevronLeft,
  TrendingUp, Sparkles, LifeBuoy, CalendarDays, Bell,
  UserCheck, QrCode, Flame, Target, Award, Inbox
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/context/LanguageContext';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import {
  getGreeting, getFirstName, formatDate, formatOCoins, isOverdue, formatRelative, getNotificationEmoji, cn, safeDate, hasUnlimitedCoins
} from '@/utils';
import { getUserTaskStatus } from '@/lib/database-service';
import { subscribeBans, getActiveBan } from '@/lib/bans';
import { BroadcastBanner } from '@/components/dashboard/BroadcastBanner';
import type { Task, TaskStatus, OCoinTransaction, Notification, Meeting } from '@/types';
import type { SupportTicket } from '@/types/support';

export function EmployeeDashboard() {
  const { userProfile } = useAuth();
  const { t } = useLanguage();
  const TABS: { label: string; value: TaskStatus | 'all' | 'overdue' }[] = [
    { label: t('employeeDashboard.tab_all_tasks'), value: 'all' },
    { label: t('employeeDashboard.tab_in_progress'), value: 'in_progress' },
    { label: t('employeeDashboard.tab_submitted'), value: 'submitted' },
    { label: t('employeeDashboard.tab_approved'), value: 'approved' },
    { label: t('employeeDashboard.tab_overdue'), value: 'overdue' },
  ];
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<OCoinTransaction[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [checkingAttendance, setCheckingAttendance] = useState(true);
  const [committeeTasks, setCommitteeTasks] = useState<Task[]>([]);
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
        console.warn('Supabase tasks query notice:', err);
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
    const unsub = subscribeBans((list) => {
      const active = getActiveBan(list, userProfile.uid);
      setActiveBan(active);
    });
    return () => { if (unsub) unsub(); };
  }, [userProfile?.uid]);

  const isViceHead = userProfile?.role === 'vice_head';

  // 1. Subscribe to Today's Attendance Record
  useEffect(() => {
    if (!userProfile?.uid) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'attendance_records'),
      where('employeeId', '==', userProfile.uid),
      where('date', '==', todayStr),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setTodayAttendance(snap.docs[0].data());
      } else {
        setTodayAttendance(null);
      }
      setCheckingAttendance(false);
    }, () => setCheckingAttendance(false));
    return () => unsub();
  }, [userProfile?.uid]);

  // 2. If Vice-Head: Subscribe to Committee Tasks for Peer Coordination
  useEffect(() => {
    if (!isViceHead || (!userProfile?.committeeId && !userProfile?.committeeName)) return;
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      const inComm = all.filter(t =>
        (t.committeeId && userProfile.committeeId && t.committeeId === userProfile.committeeId) ||
        (t.committeeName && userProfile.committeeName && t.committeeName.trim().toLowerCase() === userProfile.committeeName.trim().toLowerCase())
      );
      setCommitteeTasks(inComm);
    }, (err) => console.warn('Vice Head committee tasks notice:', err));
    return () => unsub();
  }, [isViceHead, userProfile?.committeeId, userProfile?.committeeName]);

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

  // Level & Milestone Progress Gamification
  const completedTasksCount = stats.completed;
  let levelTitle = 'عضو جديد 🚀';
  let nextTarget = 2;
  let levelProgress = Math.min(100, Math.round((completedTasksCount / 2) * 100));

  if (completedTasksCount >= 20) {
    levelTitle = 'أسطورة الجوجالية 👑';
    nextTarget = 30;
    levelProgress = 100;
  } else if (completedTasksCount >= 10) {
    levelTitle = 'نجم المنظومة ⭐';
    nextTarget = 20;
    levelProgress = Math.min(100, Math.round(((completedTasksCount - 10) / 10) * 100));
  } else if (completedTasksCount >= 5) {
    levelTitle = 'عضو متميز 🔥';
    nextTarget = 10;
    levelProgress = Math.min(100, Math.round(((completedTasksCount - 5) / 5) * 100));
  } else if (completedTasksCount >= 2) {
    levelTitle = 'عضو نشط ⚡';
    nextTarget = 5;
    levelProgress = Math.min(100, Math.round(((completedTasksCount - 2) / 3) * 100));
  }

  const { notifications } = useNotifications(3);
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

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

  const roleBadgeText = isViceHead
    ? `🔹 VICE-HEAD · نائب رئيس لجنة ${userProfile?.committeeName || 'اللجنة'}`
    : `👤 عضو لجنة ${userProfile?.committeeName || 'المنظومة'}`;

  return (
    <div className="space-y-5 sm:space-y-6 font-sans text-right dir-rtl">
      {/* Broadcast Announcement Banner */}
      <BroadcastBanner />

      {/* ─── 1. Welcome & Contextual Header ────────────────────────────────────── */}
      <div className="card card-glass p-5 sm:p-6 relative overflow-hidden mesh-bg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-xs",
                isViceHead
                  ? "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border border-emerald-500/40"
                  : "badge-accent"
              )}>
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>{roleBadgeText}</span>
              </div>
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
                <span>{t('employeeDashboard.help_support_center')}</span>
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
                  {t('employeeDashboard.ocoins_balance')}
                </p>
              </div>
              <p className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tight">
                {hasUnlimitedCoins(userProfile?.role)
                  ? <span className="text-[var(--brand-warm)]">∞</span>
                  : formatOCoins(userProfile?.oCoinsBalance ?? 0)
                }
                <span className="text-xs font-bold text-[var(--brand-warm)] mr-2">
                  {hasUnlimitedCoins(userProfile?.role) ? t('employeeDashboard.unlimited_vault') : t('employeeDashboard.oc_label')}
                </span>
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
              <span>{t('employeeDashboard.wallet_ledger')}</span>
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
              <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">{t('employeeDashboard.stat_in_progress')}</p>
            </div>
          </div>

          <div className="card rounded-2xl p-4 flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] flex items-center justify-center mb-2">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.submitted}</p>
              <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">{t('employeeDashboard.stat_submitted')}</p>
            </div>
          </div>

          <div className="card rounded-2xl p-4 flex flex-col justify-between">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-success)]/15 text-[var(--brand-success)] flex items-center justify-center mb-2">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[var(--text-primary)]">{stats.completed}</p>
              <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">{t('employeeDashboard.stat_approved')}</p>
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
              <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">{t('employeeDashboard.stat_overdue')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2.5 Quick Attendance Status & Level Progress Gamification Grid ────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Attendance Check-in Widget */}
        <div className="card p-5 space-y-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                <UserCheck className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                  {t('employeeDashboard.today_attendance_status')}
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] font-mono">
                  {t('employeeDashboard.attendance_code').replace('{code}', userProfile?.employeeCode || 'جاري التوليد...')}
                </p>
              </div>
            </div>
            <Link to="/attendance" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              <span>{t('employeeDashboard.attendance_record')}</span>
              <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>

          {checkingAttendance ? (
            <div className="p-3 bg-[var(--bg-elevated)] rounded-xl animate-pulse text-xs text-[var(--text-muted)] text-center">
              {t('employeeDashboard.checking_attendance')}
            </div>
          ) : todayAttendance ? (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    {t('employeeDashboard.attendance_recorded')}
                  </p>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                    {t('employeeDashboard.checkin_time').replace('{time}', todayAttendance.checkInTime).replace('{status}', todayAttendance.status === 'late' ? t('employeeDashboard.late') : t('employeeDashboard.on_time'))}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
                {t('employeeDashboard.present')}
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                    {t('employeeDashboard.no_attendance_yet')}
                  </p>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                    {t('employeeDashboard.sessions_available')}
                  </p>
                </div>
              </div>
              <Link to="/attendance-check-in">
                <Button size="sm" variant="primary" className="font-bold text-xs gap-1 cursor-pointer shrink-0">
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{t('employeeDashboard.register_now')}</span>
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Level & Milestone Progress Bar Card */}
        <div className="card p-5 space-y-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Flame className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                  مستوى الأداء والترقية المستمرة
                </h3>
                <p className="text-[10px] text-[var(--text-muted)]">
                  نظام التميز المؤسسي ونقاط الأداء
                </p>
              </div>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/25">
              {levelTitle}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)] font-bold">
                المهام المعتمدة: <strong>{completedTasksCount}</strong> مهمة
              </span>
              <span className="text-[var(--brand-warm)] font-bold text-[11px]">
                {completedTasksCount >= 20 ? 'أعلى مستوى تميز 👑' : `متبقي ${Math.max(0, nextTarget - completedTasksCount)} مهام للترقية القادمة`}
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)]"
                style={{ width: `${levelProgress}%` }}
              />
            </div>

            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              💡 كل مهمة تعتمدها تمنحك O-Coins وترفع تصنيفك نحو المستوى التالي وشارة النجم الذهبي!
            </p>
          </div>
        </div>
      </div>

      {/* ─── VICE-HEAD EXCLUSIVE: Committee Tasks Pulse & Submissions Review ──────────────────────── */}
      {isViceHead && (
        <div className="card p-5 sm:p-6 space-y-4 border-l-4 border-l-emerald-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Target className="h-4 w-4" />
              </span>
              <div>
                <h2 className="section-title text-sm sm:text-base text-[var(--text-primary)]">
                  متابعة مهام زملاء لجنة {userProfile?.committeeName || ''}
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  صلاحية الفايس هيد: مراجعة تسليمات أعضاء لجنتك، اعتماد الأعمال وصرف مكافآت O-Coins
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <Link to="/operations?tab=submissions">
                <Button size="sm" className="btn-primary text-xs font-black gap-1.5 rounded-xl cursor-pointer">
                  <Inbox className="h-3.5 w-3.5" />
                  <span>مراجعة تسليمات لجنتي</span>
                  {committeeTasks.filter((t) => t.status === 'submitted' || t.latestSubmission?.status === 'pending').length > 0 && (
                    <span className="px-1.5 py-0.5 bg-amber-400 text-slate-900 rounded-full text-[10px] font-black mr-1">
                      {committeeTasks.filter((t) => t.status === 'submitted' || t.latestSubmission?.status === 'pending').length}
                    </span>
                  )}
                </Button>
              </Link>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20">
                {committeeTasks.length} مهام باللجنة
              </span>
            </div>
          </div>

          {committeeTasks.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">لا توجد مهام مسجلة للجنة حالياً.</p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-surface)]">
              {committeeTasks.slice(0, 5).map((t) => {
                const overdue = isOverdue(t.deadline, t.status);
                return (
                  <div key={t.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-[var(--bg-elevated)]/50 transition-colors">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={t.priority} />
                        <Link to={`/tasks/${t.id}`} className="text-xs font-bold text-[var(--text-primary)] hover:text-[var(--brand-primary)] hover:underline truncate">
                          {t.title}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                        <span>المكلف: {t.assignedToNames?.[0] || 'عضو اللجنة'}</span>
                        <span>·</span>
                        <span>الموعد: {formatDate(t.deadline)}</span>
                        <span>·</span>
                        <span className="text-[var(--brand-warm)] font-bold">🪙 {t.oCoinsReward} OC</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={t.status} overdue={overdue} />
                      <Link to={`/tasks/${t.id}`}>
                        <Button size="sm" variant="outline" className="text-[11px] font-bold h-7 px-2.5 rounded-lg cursor-pointer">
                          مراجعة
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── 3. Upcoming Meetings, Notifications & Support Tickets Row ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Upcoming Meetings */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[var(--brand-accent)]" />
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                الاجتماعات واللقاءات
              </h3>
            </div>
            <Link to="/meetings" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              الجدول <ChevronLeft className="h-3 w-3" />
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

        {/* Live Notifications Feed */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--brand-primary)]" />
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                أحدث التنبيهات
              </h3>
              {unreadNotifsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[var(--brand-danger)] text-white">
                  {unreadNotifsCount}
                </span>
              )}
            </div>
            <Link to="/notifications" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              الكل <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-3 text-center">لا توجد إشعارات حالياً.</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 3).map((n) => (
                <Link
                  key={n.id}
                  to={n.actionUrl || '/notifications'}
                  className={cn(
                    'p-2 rounded-xl border border-[var(--border-subtle)] flex items-center gap-2 transition-colors block text-right',
                    !n.read ? 'bg-[var(--brand-primary)]/[0.06] border-[var(--brand-primary)]/20' : 'bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)]'
                  )}
                >
                  <span className="text-sm shrink-0">{getNotificationEmoji(n.type)}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-xs truncate', !n.read ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>
                      {n.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {n.createdAt ? formatRelative(n.createdAt) : 'الآن'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Support Tickets Quick View */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-[var(--brand-warm)]" />
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                تذاكر الدعم
              </h3>
            </div>
            <Link to="/support" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              المساعدة <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>

          {supportTickets.length === 0 ? (
            <div className="py-3 text-center space-y-1.5">
              <p className="text-xs text-[var(--text-muted)]">ليس لديك تذاكر مفتوحة.</p>
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
