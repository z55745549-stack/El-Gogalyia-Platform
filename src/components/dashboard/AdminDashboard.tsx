import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, getDocs, db } from '@/lib/supabase';
import {
  Users, Upload, Clock, AlertTriangle, CheckCircle2,
  Coins, Activity, ArrowUpRight, Plus, Shield, Inbox, Calendar, Sparkles, Bell,
  Radio, Gift, Megaphone, AlertCircle, ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard } from '@/components/ui/loading-spinner';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { formatDate, formatOCoins, formatRelative, isOverdue, getNotificationEmoji, cn, formatFullName, hasUnlimitedCoins } from '@/utils';
import { broadcastNotificationToAll, manualOCoinAdjustment } from '@/lib/database-service';
import { DEFAULT_COMMITTEES } from '@/types';
import type { Task, OCoinTransaction, ActivityLog, UserProfile } from '@/types';

export function AdminDashboard() {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<OCoinTransaction[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Broadcast Modal State (Lead / Co-Lead)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  // Head Quick Reward Modal State
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardTargetUser, setRewardTargetUser] = useState<UserProfile | null>(null);
  const [rewardAmount, setRewardAmount] = useState('');
  const [rewardReason, setRewardReason] = useState('');
  const [rewarding, setRewarding] = useState(false);

  useEffect(() => {
    const taskUnsub = onSnapshot(
      query(collection(db, 'tasks'), orderBy('createdAt', 'desc')),
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
        setLoading(false);
      },
      (err) => { console.error('Tasks error:', err); setLoading(false); }
    );

    const actUnsub = onSnapshot(
      query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(10)),
      (snap) => setRecentActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog))),
      (err) => console.error('Activity error:', err)
    );

    const txUnsub = onSnapshot(
      query(collection(db, 'oCoins'), orderBy('createdAt', 'desc'), limit(8)),
      (snap) => setRecentTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OCoinTransaction))),
      (err) => console.error('Transactions error:', err)
    );

    getDocs(collection(db, 'users'))
      .then((s) => {
        setTotalEmployees(s.size);
        setAllUsers(s.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile)));
      })
      .catch((err) => console.error('Employees count error:', err));

    return () => { taskUnsub(); actUnsub(); txUnsub(); };
  }, []);

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    submitted: tasks.filter((t) => t.status === 'submitted').length,
    approved: tasks.filter((t) => t.status === 'approved' || t.status === 'completed').length,
    overdue: tasks.filter((t) => isOverdue(t.deadline, t.status)).length,
  };

  const totalCoinsDistributed = recentTransactions
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  const role = userProfile?.role;
  const isLead = role === 'lead';
  const isCoLead = role === 'co_lead';
  const isHead = role === 'head';
  const isTopLeader = isLead || isCoLead;

  // Committee calculations for Head
  const myCommitteeUsers = allUsers.filter(u =>
    Boolean(
      (u.committeeId && userProfile?.committeeId && u.committeeId === userProfile.committeeId) ||
      (u.committeeName && userProfile?.committeeName && u.committeeName.trim().toLowerCase() === userProfile.committeeName.trim().toLowerCase())
    )
  );
  const myCommitteeSubordinates = myCommitteeUsers.filter(
    u => u.uid !== userProfile?.uid && (u.role === 'member' || u.role === 'vice_head')
  );
  const myCommitteeTasks = tasks.filter(t =>
    Boolean(
      (t.committeeId && userProfile?.committeeId && t.committeeId === userProfile.committeeId) ||
      (t.committeeName && userProfile?.committeeName && t.committeeName.trim().toLowerCase() === userProfile.committeeName.trim().toLowerCase())
    )
  );
  const myCommitteeSubmitted = myCommitteeTasks.filter(t => t.status === 'submitted');

  // Committees performance stats for Top Leaders
  const committeesStats = DEFAULT_COMMITTEES.map(comm => {
    const commTasks = tasks.filter(t =>
      t.committeeId === comm.id ||
      (t.committeeName && t.committeeName.trim().toLowerCase() === comm.name.trim().toLowerCase())
    );
    const commCompleted = commTasks.filter(t => t.status === 'approved' || t.status === 'completed').length;
    const commMembers = allUsers.filter(u =>
      u.committeeId === comm.id ||
      (u.committeeName && u.committeeName.trim().toLowerCase() === comm.name.trim().toLowerCase())
    ).length;
    const rate = commTasks.length > 0 ? Math.round((commCompleted / commTasks.length) * 100) : 0;
    return {
      ...comm,
      totalTasks: commTasks.length,
      completedTasks: commCompleted,
      membersCount: commMembers,
      completionRate: rate,
    };
  });

  // Handlers
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim() || !userProfile) return;
    setBroadcasting(true);
    try {
      await broadcastNotificationToAll({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        createdByName: userProfile.displayName || userProfile.username,
      });
      toast.success('تمت إذاعة التنبيه بنجاح لجميع أعضاء المنظومة! 📢');
      setShowBroadcastModal(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err: any) {
      toast.error(err?.message || 'فشلت إذاعة التنبيه.');
    } finally {
      setBroadcasting(false);
    }
  };

  const handleHeadReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTargetUser || !rewardAmount || !rewardReason.trim() || !userProfile) return;
    if (rewardTargetUser.uid === userProfile.uid) {
      toast.error('❌ محظور: لا يمكنك منح كوينز لنفسك.');
      return;
    }
    const amt = parseInt(rewardAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      toast.error('يرجى إدخال عدد كوينز صحيح موجب.');
      return;
    }
    setRewarding(true);
    try {
      await manualOCoinAdjustment({
        targetUser: rewardTargetUser,
        amount: amt,
        type: 'manual_reward',
        reason: rewardReason.trim(),
        description: `مكافأة لجنة من رئيس اللجنة (${userProfile.displayName})`,
        actor: {
          email: userProfile.email || userProfile.username,
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL,
        },
      });
      toast.success(`تم صرف +${amt} OC للمحفظة (${rewardTargetUser.displayName}) بنجاح! 🌟`);
      setShowRewardModal(false);
      setRewardTargetUser(null);
      setRewardAmount('');
      setRewardReason('');
    } catch (err: any) {
      toast.error(err?.message || 'فشل صرف المكافأة.');
    } finally {
      setRewarding(false);
    }
  };

  // Role-specific badge and subtitle
  const roleBadgeText = isLead
    ? '🏆 LEAD · القائد العام للمنظومة'
    : isCoLead
    ? '🌟 CO-LEAD · نائب القائد العام'
    : isHead
    ? `👑 HEAD · رئيس لجنة ${userProfile?.committeeName || 'اللجنة'}`
    : 'لوحة الإشراف والقيادة المركزية · منصة الجوجالية';

  const roleSubtitle = isTopLeader
    ? 'لوحة القيادة المركزية العليا · إشراف شامل وتنسيق كامل لكافة اللجان والفرق والمهام دون قيود.'
    : isHead
    ? `لوحة قيادة لجنة ${userProfile?.committeeName || ''} · إدارة مهام وتسليمات وأعضاء اللجنة واعتماد التكليفات.`
    : stats.submitted > 0
    ? `لديك ${stats.submitted} تسليم جديد بانتظار المراجعة والاعتماد.`
    : 'جميع تسليمات المهام مستقرة ومحدثة.';

  const { notifications } = useNotifications(5);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-5 sm:space-y-6 font-sans text-right dir-rtl">
      {/* Modern High-Tech Hero Header */}
      <div className="card card-glass p-5 sm:p-6 relative overflow-hidden mesh-bg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-xs",
                isLead
                  ? "bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/40"
                  : isCoLead
                  ? "bg-purple-500/20 text-purple-900 dark:text-purple-200 border border-purple-500/40"
                  : isHead
                  ? "bg-blue-500/20 text-blue-900 dark:text-blue-200 border border-blue-500/40"
                  : "badge-primary"
              )}>
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>{roleBadgeText}</span>
              </div>

              {/* O-Coins Chip */}
              <Link
                to="/ocoins"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] border border-[var(--brand-warm)]/30 hover:bg-[var(--brand-warm)]/25 transition-colors"
                title="محفظة O-Coins"
              >
                <span>🪙</span>
                <span>{isTopLeader ? 'خزينة المنظومة: ∞ OC' : `رصيدك: ${formatOCoins(userProfile?.oCoinsBalance ?? 0)} OC`}</span>
              </Link>
            </div>

            <h1 className="page-title text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
              مرحباً، {userProfile?.displayName || 'المشرف'} 👋
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              {roleSubtitle}
              {stats.overdue > 0 && ` تنبيه: هناك ${stats.overdue} مهمة تجاوزت موعد التسليم.`}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isTopLeader && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowBroadcastModal(true)}
                className="font-bold text-xs gap-1.5 shadow-sm cursor-pointer"
              >
                <Radio className="h-3.5 w-3.5 animate-pulse text-white" />
                <span>إذاعة تنبيه للمنظومة</span>
              </Button>
            )}

            {isHead && (
              <Button
                size="sm"
                onClick={() => setShowRewardModal(true)}
                className="font-bold text-xs gap-1.5 shadow-sm cursor-pointer text-white bg-amber-600 hover:bg-amber-700"
              >
                <Gift className="h-3.5 w-3.5" />
                <span>مكافأة سريعة لعضو بلجنتي</span>
              </Button>
            )}

            {(isHead ? myCommitteeSubmitted.length > 0 : stats.submitted > 0) && (
              <Link to="/submitted-tasks">
                <Button variant="reward" size="sm" className="font-bold text-xs gap-1.5 shadow-sm">
                  <Inbox className="h-3.5 w-3.5" /> مراجعة التسليمات ({isHead ? myCommitteeSubmitted.length : stats.submitted})
                </Button>
              </Link>
            )}

            <Link to="/tasks">
              <Button variant="primary" size="sm" className="font-bold text-xs gap-1.5 shadow-sm">
                <Plus className="h-3.5 w-3.5" /> إنشاء مهمة جديدة
              </Button>
            </Link>

            {isTopLeader && (
              <Link to="/employees">
                <Button variant="outline" size="sm" className="font-semibold text-xs gap-1.5">
                  <Users className="h-3.5 w-3.5" /> إدارة الفريق
                </Button>
              </Link>
            )}

            <Link to="/meetings">
              <Button variant="outline" size="sm" className="font-semibold text-xs gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> الاجتماعات
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Semantic KPI Cards Grid — Tailored for Head or Top Leaders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        <StatCard
          title={isHead ? "أعضاء لجنتي" : "فريق العمل"}
          value={isHead ? myCommitteeUsers.length : totalEmployees}
          variant="primary"
          icon={<Users className="h-4 w-4" />}
          subtext={isHead ? `أعضاء ${userProfile?.committeeName || 'اللجنة'}` : "الأعضاء النشطين"}
        />
        <StatCard
          title={isHead ? "تسليمات لجنتي" : "تسليمات معلقة"}
          value={isHead ? myCommitteeSubmitted.length : stats.submitted}
          variant={(isHead ? myCommitteeSubmitted.length : stats.submitted) > 0 ? 'warm' : 'default'}
          icon={<Upload className="h-4 w-4" />}
          subtext="تحتاج مراجعة وقبول"
        />
        <StatCard
          title={isHead ? "مهام لجنتي الجارية" : "قيد التنفيذ"}
          value={isHead ? myCommitteeTasks.filter(t => t.status === 'in_progress').length : stats.inProgress}
          variant="accent"
          icon={<Clock className="h-4 w-4" />}
          subtext="يعمل عليها الفريق"
        />
        <StatCard
          title={isHead ? "مهام متأخرة بلجنتي" : "مهام متأخرة"}
          value={isHead ? myCommitteeTasks.filter(t => isOverdue(t.deadline, t.status)).length : stats.overdue}
          variant="default"
          icon={<AlertTriangle className="h-4 w-4" />}
          iconBg={(isHead ? myCommitteeTasks.filter(t => isOverdue(t.deadline, t.status)).length : stats.overdue) > 0 ? "bg-[var(--brand-danger)]/15 text-[var(--brand-danger)]" : undefined}
          subtext="تجاوزت الموعد"
        />
        <StatCard
          title={isHead ? "مهام معتمدة بلجنتي" : "مهام معتمدة"}
          value={isHead ? myCommitteeTasks.filter(t => t.status === 'approved' || t.status === 'completed').length : stats.approved}
          variant="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
          subtext="مكتملة ومصروفة"
        />
        <StatCard
          title="مكافآت O Coins"
          value={isTopLeader ? "∞" : formatOCoins(isHead ? (userProfile?.oCoinsBalance ?? 0) : totalCoinsDistributed)}
          variant="warm"
          icon={<Coins className="h-4 w-4" />}
          subtext={isTopLeader ? "خزينة لا نهائية" : isHead ? "رصيد محفظتك الشخصية" : "إجمالي المكافآت"}
        />
      </div>

      {/* ─── LEAD & CO-LEAD EXCLUSIVE: Committees Health Overview ────────────── */}
      {isTopLeader && (
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                <Shield className="h-4 w-4" />
              </span>
              <div>
                <h2 className="section-title text-sm sm:text-base text-[var(--text-primary)]">
                  مؤشر نبض وأداء اللجان في المنظومة
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  متابعة حية لمعدلات إنجاز المهام وعدد الأعضاء في كل لجنة
                </p>
              </div>
            </div>
            <Link to="/tasks" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              <span>إدارة مهام اللجان</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {committeesStats.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)] space-y-3 hover:border-[var(--brand-primary)]/40 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)]">{c.name}</h3>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{c.membersCount} أعضاء مسجلين</p>
                  </div>
                  <span className={cn(
                    "text-xs font-black px-2 py-0.5 rounded-lg",
                    c.completionRate >= 75
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : c.completionRate >= 40
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  )}>
                    {c.completionRate}%
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${c.completionRate}%`,
                        background: c.completionRate >= 75
                          ? 'var(--brand-success)'
                          : c.completionRate >= 40
                          ? 'var(--brand-warm)'
                          : 'var(--brand-danger)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-medium">
                    <span>{c.completedTasks} مهمة منجزة</span>
                    <span>من أصل {c.totalTasks}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── HEAD EXCLUSIVE: Committee Review Queue ──────────────────────────── */}
      {isHead && (
        <div className="card p-5 sm:p-6 space-y-4 border-l-4 border-l-[var(--brand-primary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                <Inbox className="h-4 w-4" />
              </span>
              <div>
                <h2 className="section-title text-sm sm:text-base text-[var(--text-primary)]">
                  طابور مراجعة واعتماد تسليمات لجنة {userProfile?.committeeName || ''}
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  التسليمات المرفوعة من أعضاء لجنتك بانتظار فحصك واعتماد صرف المكافأة
                </p>
              </div>
            </div>
            <Link to="/submitted-tasks" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              <span>صفحة التسليمات الكاملة</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {myCommitteeSubmitted.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[var(--bg-elevated)]/30 border border-dashed border-[var(--border-subtle)] space-y-1">
              <p className="text-xs font-bold text-[var(--text-primary)]">🎉 رائع! لا توجد تسليمات معلقة في لجنتك حالياً.</p>
              <p className="text-[11px] text-[var(--text-muted)]">كافة التكليفات المسلّمة تم فحصها واعتمادها بنجاح.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-surface)]">
              {myCommitteeSubmitted.slice(0, 5).map((t) => (
                <div key={t.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[var(--bg-elevated)]/50 transition-colors">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">{t.title}</p>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>بواسطة: {t.assignedToNames?.[0] || 'أحد أعضاء اللجنة'}</span>
                      <span>·</span>
                      <span className="text-[var(--brand-warm)] font-bold">مكافأة: {t.oCoinsReward} OC</span>
                    </div>
                  </div>
                  <Link to="/submitted-tasks">
                    <Button size="sm" variant="reward" className="font-bold text-xs gap-1 cursor-pointer">
                      <span>فحص واعتماد</span>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Tasks List — 2 Columns */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]/30">
            <div>
              <h2 className="section-title text-sm sm:text-base text-[var(--text-primary)]">أحدث التكليفات والمهام</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{tasks.length} مهمة مسجلة بالنظام</p>
            </div>
            <Link to="/tasks" className="text-xs font-bold text-[var(--brand-primary)] hover:text-[var(--brand-accent)] hover:underline flex items-center gap-1">
              عرض كافة المهام <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs sm:text-sm">
                لا توجد مهام مسجلة حالياً.{' '}
                <Link to="/tasks" className="text-[var(--brand-primary)] font-bold hover:underline">
                  أنشئ أول مهمة الآن.
                </Link>
              </div>
            ) : (
              tasks.slice(0, 6).map((task) => {
                const overdue = isOverdue(task.deadline, task.status);
                return (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className={cn(
                      'flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-[var(--bg-elevated)]/60 transition-colors group',
                      overdue && 'bg-[var(--brand-danger)]/[0.04]'
                    )}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--brand-primary)] transition-colors">
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[11px] text-[var(--text-muted)]">
                        <span>الموعد: {formatDate(task.deadline)}</span>
                        <span>·</span>
                        <span className="truncate">
                          {task.assignedToNames?.length
                            ? `${task.assignedToNames[0]}${task.assignedToNames.length > 1 ? ` +${task.assignedToNames.length - 1}` : ''}`
                            : 'غير محدد'}
                        </span>
                        <span>·</span>
                        <span className="text-[var(--brand-warm)] font-bold">🪙 {task.oCoinsReward} OC</span>
                      </div>
                    </div>
                    <StatusBadge status={task.status} overdue={overdue} />
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Side Column: Notifications, Activity & Coins Feeds */}
        <div className="space-y-4">
          {/* Recent Notifications Feed */}
          <div className="card overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]/30">
              <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Bell className="h-4 w-4 text-[var(--brand-primary)]" /> التنبيهات والإشعارات
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-[var(--brand-danger)] text-white">
                    {unreadCount} جديدة
                  </span>
                )}
              </h2>
              <Link to="/notifications" className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline">
                مركز التنبيهات
              </Link>
            </div>
            <div className="p-3 space-y-2">
              {notifications.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-3">لا توجد إشعارات حالياً.</p>
              ) : (
                notifications.slice(0, 4).map((n) => (
                  <Link
                    key={n.id}
                    to={n.actionUrl || '/notifications'}
                    className={cn(
                      'flex items-start gap-2.5 p-2 rounded-xl transition-colors text-right block',
                      !n.read ? 'bg-[var(--brand-primary)]/[0.06] border border-[var(--brand-primary)]/20' : 'hover:bg-[var(--bg-elevated)]/60'
                    )}
                  >
                    <span className="text-sm shrink-0 mt-0.5">{getNotificationEmoji(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs leading-snug', !n.read ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {n.createdAt ? formatRelative(n.createdAt) : 'الآن'}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
          {/* Live Activity Feed */}
          <div className="card overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]/30">
              <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--brand-accent)]" /> سجل النشاط المباشر
              </h2>
              <Link to="/activity-logs" className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline">
                السجل كامل
              </Link>
            </div>
            <div className="p-3.5 space-y-2.5">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-3">لا توجد أنشطة مسجلة بعد.</p>
              ) : (
                recentActivity.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 text-right">
                    <Avatar src={log.actorPhoto} name={log.actorName || log.actor} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text-primary)] leading-snug">
                        <span className="font-bold">{log.actorName?.split(' ')[0] || log.actor}</span>{' '}
                        <span className="text-[var(--text-muted)]">{log.action.replace(/\./g, ' ').replace(/_/g, ' ')}</span>
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-medium">
                        {log.timestamp ? formatRelative(log.timestamp) : 'الآن'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* O Coins Recent Rewards Feed */}
          <div className="card overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]/30">
              <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Coins className="h-4 w-4 text-[var(--brand-warm)]" /> مكافآت O Coins الأخيرة
              </h2>
              <Link to="/ocoins" className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline">
                دفتر المكافآت
              </Link>
            </div>
            <div className="p-3 space-y-2">
              {recentTransactions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-3">لا توجد مكافآت مسجلة بعد.</p>
              ) : (
                recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)]">
                    <div className="min-w-0 pr-1">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">{tx.userDisplayName}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">{tx.reason}</p>
                    </div>
                    <span className={cn(
                      'text-xs font-black shrink-0 px-2 py-0.5 rounded-lg',
                      tx.amount > 0
                        ? 'text-[var(--brand-accent)] bg-[var(--brand-accent)]/10'
                        : 'text-[var(--brand-danger)] bg-[var(--brand-danger)]/10'
                    )}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} OC
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Broadcast Announcement Modal (Lead / Co-Lead) ─────────────────── */}
      <Modal
        open={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        title="📢 إذاعة تنبيه وتوجيه عام للمنظومة"
        description="سيتم إرسال هذا التنبيه الفوري لجميع الأعضاء والفرق المسجلة في منصة الجوجالية دفعة واحدة."
      >
        <form onSubmit={handleSendBroadcast} className="space-y-4 text-right dir-rtl font-sans">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              عنوان التنبيه أو الإعلان *
            </label>
            <Input
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="مثال: اجتماع طارئ لجميع الفرق اليوم الساعة 8 مساءً"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              نص الرسالة أو التوجيه *
            </label>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="اكتب التوجيهات أو التعليمات بالتفصيل هنا..."
              required
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBroadcastModal(false)}
              className="font-bold text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              loading={broadcasting}
              className="font-bold text-xs gap-1.5"
            >
              <Radio className="h-3.5 w-3.5" />
              <span>إذاعة التنبيه فوراً</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Head Quick Reward Modal ────────────────────────────────────────── */}
      <Modal
        open={showRewardModal}
        onClose={() => setShowRewardModal(false)}
        title={`🌟 صرف مكافأة سريعة لعضو بلجنة ${userProfile?.committeeName || ''}`}
        description="اختر أحد أعضاء لجنتك لمنحه مكافأة O-Coins تقديرية لجهوده وتميزه."
      >
        <form onSubmit={handleHeadReward} className="space-y-4 text-right dir-rtl font-sans">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              عضو اللجنة المستهدف *
            </label>
            {myCommitteeSubordinates.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                لا يوجد أعضاء مسجلين في لجنتك حالياً.
              </p>
            ) : (
              <select
                value={rewardTargetUser?.uid || ''}
                onChange={(e) => {
                  const found = myCommitteeSubordinates.find(u => u.uid === e.target.value);
                  setRewardTargetUser(found || null);
                }}
                required
                className="w-full px-3 py-2.5 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              >
                <option value="">-- اختر عضو اللجنة --</option>
                {myCommitteeSubordinates.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {formatFullName(u.displayName)} (@{u.username || u.email}) — رصيده: {hasUnlimitedCoins(u.role) ? '∞' : (u.oCoinsBalance ?? 0)} OC
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              عدد عملات O Coins *
            </label>
            <Input
              type="number"
              min="1"
              max="500"
              placeholder="مثال: 50"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              سبب منح المكافأة *
            </label>
            <Input
              placeholder="مثال: تسليم متميز وسريع لمهمة التصميم الأسبوعية"
              value={rewardReason}
              onChange={(e) => setRewardReason(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRewardModal(false)}
              className="font-bold text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={rewarding}
              disabled={!rewardTargetUser || !rewardAmount || !rewardReason.trim()}
              className="font-bold text-xs gap-1.5"
            >
              <Gift className="h-3.5 w-3.5" />
              <span>تأكيد صرف المكافأة</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
