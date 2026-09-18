import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, getDocs, db } from '@/lib/supabase';
import {
  Users, Upload, Clock, AlertTriangle, CheckCircle2,
  Coins, Activity, ArrowUpRight, Plus, Shield, Inbox, Calendar, Sparkles, Bell,
  Radio, Gift, Megaphone, AlertCircle, ChevronLeft, Crown, Download, BarChart3, TrendingUp,
  PieChart as PieChartIcon, Search, Lock
} from 'lucide-react';
import { BroadcastBanner } from '@/components/dashboard/BroadcastBanner';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/context/LanguageContext';
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
  const { t, language } = useLanguage();
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

  // Integrated Reports & Leaderboard State
  const [leaderboardCommitteeFilter, setLeaderboardCommitteeFilter] = useState('');
  const [leaderboardSearch, setLeaderboardSearch] = useState('');

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
      query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(10)),
      (snap) => {
        const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
        if (fetched.length > 0) {
          setRecentActivity(fetched);
        } else {
          try {
            const local = JSON.parse(localStorage.getItem('elgogalyia_activity_logs') || '[]');
            setRecentActivity(local.slice(0, 10));
          } catch {}
        }
      },
      (err) => {
        console.warn('Activity error:', err);
        try {
          const local = JSON.parse(localStorage.getItem('elgogalyia_activity_logs') || '[]');
          setRecentActivity(local.slice(0, 10));
        } catch {}
      }
    );

    const txUnsub = onSnapshot(
      query(collection(db, 'oCoins'), orderBy('createdAt', 'desc'), limit(8)),
      (snap) => setRecentTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OCoinTransaction))),
      (err) => console.error('Transactions error:', err)
    );

    // Realtime listener for users to immediately sync balances and changes
    const usersUnsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const activeUsers = snapshot.docs
          .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
          .filter((u) => (u.status as string) !== 'suspended' && u.status !== 'inactive');
        setTotalEmployees(activeUsers.length);
        setAllUsers(activeUsers);
      },
      (err) => console.error('Employees snapshot error:', err)
    );

    // Activity log event listener
    const handleActivityLogged = (e: any) => {
      if (e.detail) {
        setRecentActivity((prev) => [e.detail, ...prev].slice(0, 10));
      }
    };
    window.addEventListener('elgogalyia_activity_logged', handleActivityLogged);

    // Same-tab instant sync listener
    const handleDataChange = () => {
      try {
        const local = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
        if (local && local.length > 0) {
          setAllUsers((prev) => {
            return prev.map((u) => {
              const matched = local.find((l: any) => l.uid === u.uid);
              if (matched && typeof matched.oCoinsBalance === 'number') {
                return { ...u, oCoinsBalance: matched.oCoinsBalance, ocoins_balance: matched.oCoinsBalance };
              }
              return u;
            });
          });
        }
      } catch {}
    };
    window.addEventListener('elgogalyia_data_change', handleDataChange);

    return () => {
      taskUnsub();
      actUnsub();
      txUnsub();
      usersUnsub();
      window.removeEventListener('elgogalyia_data_change', handleDataChange);
      window.removeEventListener('elgogalyia_activity_logged', handleActivityLogged);
    };
  }, []);

  const isTaskPendingReview = (t: Task) => {
    if (t.status === 'submitted') return true;
    if (t.latestSubmission && t.latestSubmission.status === 'pending') return true;
    return Object.values(t.userStatuses || {}).some((st: any) => st?.status === 'submitted');
  };

  const isTaskApprovedOrCompleted = (t: Task) => {
    return t.status === 'approved' || t.status === 'completed';
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    submitted: tasks.filter((t) => isTaskPendingReview(t)).length,
    approved: tasks.filter((t) => isTaskApprovedOrCompleted(t)).length,
    overdue: tasks.filter((t) => isOverdue(t.deadline, t.status)).length,
  };

  // Real calculation of all coins in circulation across members
  const totalMemberCoinsInCirculation = allUsers
    .filter((u) => !hasUnlimitedCoins(u.role))
    .reduce((sum, u) => {
      const bal = typeof u.oCoinsBalance === 'number' ? u.oCoinsBalance : (typeof u.ocoins_balance === 'number' ? u.ocoins_balance : 0);
      return sum + (bal > 0 ? bal : 0);
    }, 0);

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
  const myCommitteeSubmitted = myCommitteeTasks.filter((t) => isTaskPendingReview(t));

  // Determine effective committee filter (head is strictly locked to their own committee)
  const headCommitteeId = userProfile?.committeeId || '';
  const headCommitteeName = userProfile?.committeeName || '';
  const effectiveCommitteeFilter = isHead
    ? (headCommitteeId || headCommitteeName)
    : leaderboardCommitteeFilter;

  // Committees performance stats (Head sees ONLY their committee, Top Leaders see all)
  const visibleCommittees = isHead
    ? DEFAULT_COMMITTEES.filter(comm =>
        comm.id === headCommitteeId ||
        (headCommitteeName && comm.name.trim().toLowerCase() === headCommitteeName.trim().toLowerCase())
      )
    : DEFAULT_COMMITTEES;

  const committeesStats = visibleCommittees.map(comm => {
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

  // Overall completion rate for gauge (based on scoped tasks for head, all tasks for leaders)
  const scopedTasks = isHead ? myCommitteeTasks : tasks;
  const scopedApprovedCount = isHead
    ? myCommitteeTasks.filter(t => t.status === 'approved' || t.status === 'completed').length
    : stats.approved;
  const overallCompletionRate = scopedTasks.length > 0 ? (scopedApprovedCount / scopedTasks.length) * 100 : 0;

  // Employee Performance breakdown — EXCLUDES Lead, Co-Lead, and Committee Heads (unlimited coins)
  const employeeReports = allUsers
    .filter((u) => !hasUnlimitedCoins(u.role))
    .filter((u) => !effectiveCommitteeFilter || u.committeeId === effectiveCommitteeFilter || (u.committeeName && u.committeeName.trim().toLowerCase() === effectiveCommitteeFilter.toLowerCase()))
    .map((u) => {
      const ids = [u.uid, u.username || '', u.email || ''].filter(Boolean).map((v) => v.toLowerCase());
      const userTasks = tasks.filter((t) => {
        const assigned = (t.assignedTo || []).map((a) => a.toLowerCase());
        return ids.some((id) => assigned.includes(id));
      });
      // User is completed if the task is completed OR if user's personal status in userStatuses is approved
      const completed = userTasks.filter((t) => {
        if (t.status === 'approved' || t.status === 'completed') return true;
        if (!t.userStatuses) return false;
        return ids.some((id) => t.userStatuses?.[id]?.status === 'approved');
      }).length;
      const overdue = userTasks.filter((t) => isOverdue(t.deadline, t.status)).length;
      const rate = userTasks.length > 0 ? Math.round((completed / userTasks.length) * 100) : 0;
      const userCoins = typeof u.oCoinsBalance === 'number' ? u.oCoinsBalance : (typeof u.ocoins_balance === 'number' ? u.ocoins_balance : 0);
      return { user: u, total: userTasks.length, completed, overdue, rate, coins: userCoins };
    })
    .sort((a, b) => b.completed - a.completed || b.coins - a.coins);

  // Top Performers — Exclusively for regular members who actually have completed tasks (> 0) or earned coins (> 0)
  const topPerformers = employeeReports
    .filter((r) => r.user.role === 'member' && (r.completed > 0 || r.coins > 0))
    .slice(0, 3);

  const filteredEmployeeReports = employeeReports.filter((r) => {
    if (!leaderboardSearch.trim()) return true;
    const term = leaderboardSearch.toLowerCase();
    return (
      (r.user.displayName || '').toLowerCase().includes(term) ||
      (r.user.username || '').toLowerCase().includes(term) ||
      (r.user.committeeName || '').toLowerCase().includes(term)
    );
  });

  const exportCSV = () => {
    const rows = [
      ['اسم الموظف / العضو', 'المعرف', 'اللجنة', 'إجمالي المهام', 'المكتملة', 'المتأخرة', 'نسبة الإنجاز', 'مجموع O Coins'],
      ...employeeReports.map((r) => [
        `"${r.user.displayName || ''}"`,
        `"${r.user.email || r.user.username || ''}"`,
        `"${r.user.committeeName || ''}"`,
        r.total,
        r.completed,
        r.overdue,
        `"${r.rate.toFixed(1)}%"`,
        hasUnlimitedCoins(r.user.role) ? '"∞"' : r.coins
      ])
    ];
    const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gogalyia_performance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('adminDashboard.export_success'));
  };

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
      toast.success(t('adminDashboard.broadcast_success'));
      setShowBroadcastModal(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err: any) {
      toast.error(err?.message || t('adminDashboard.broadcast_failed'));
    } finally {
      setBroadcasting(false);
    }
  };

  const handleHeadReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTargetUser || !rewardAmount || !rewardReason.trim() || !userProfile) return;
    const isSelf =
      rewardTargetUser.uid === userProfile.uid ||
      Boolean(rewardTargetUser.username && userProfile.username && rewardTargetUser.username.toLowerCase() === userProfile.username.toLowerCase()) ||
      Boolean(rewardTargetUser.email && userProfile.email && rewardTargetUser.email.toLowerCase() === userProfile.email.toLowerCase());
    if (isSelf) {
      toast.error(t('adminDashboard.cannot_reward_self'));
      return;
    }
    // FIX: Unlimited-coin roles must never receive a numeric reward
    if (hasUnlimitedCoins(rewardTargetUser.role)) {
      toast.error(t('adminDashboard.cannot_reward_unlimited'));
      return;
    }
    const amt = parseInt(rewardAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      toast.error(t('adminDashboard.invalid_coin_amount'));
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
      toast.success(t('adminDashboard.reward_success').replace('{amount}', String(amt)).replace('{name}', rewardTargetUser.displayName));
      setShowRewardModal(false);
      setRewardTargetUser(null);
      setRewardAmount('');
      setRewardReason('');
    } catch (err: any) {
      toast.error(err?.message || t('adminDashboard.reward_failed'));
    } finally {
      setRewarding(false);
    }
  };

  // Role-specific badge and subtitle
  const roleBadgeText = isLead
    ? t('adminDashboard.lead_subtitle')
    : isCoLead
    ? t('adminDashboard.lead_subtitle') // Co-lead gets same as lead
    : isHead
    ? `👑 HEAD · ${t('role.head')} ${userProfile?.committeeName || t('common.committee')}`
    : t('adminDashboard.lead_subtitle'); // Default for others

  const roleSubtitle = isTopLeader
    ? t('adminDashboard.lead_subtitle')
    : isHead
    ? t('adminDashboard.head_subtitle').replace('{name}', userProfile?.committeeName || '')
    : stats.submitted > 0
    ? t('adminDashboard.pending_submissions_count').replace('{count}', String(stats.submitted))
    : t('adminDashboard.all_submissions_stable');

  const { notifications } = useNotifications(5);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-5 sm:space-y-6 font-sans text-right dir-rtl">
      {/* Broadcast System Announcement Banner */}
      <BroadcastBanner />

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
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border transition-colors",
                  !hasUnlimitedCoins(userProfile?.role) && (userProfile?.oCoinsBalance ?? 0) < 0
                    ? "bg-rose-500/15 text-rose-500 border-rose-500/30 hover:bg-rose-500/25"
                    : "bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] border-[var(--brand-warm)]/30 hover:bg-[var(--brand-warm)]/25"
                )}
                title={t('common.ocoins_wallet')}
              >
                <span>🪙</span>
                <span dir="ltr">
                  {hasUnlimitedCoins(userProfile?.role)
                    ? (isHead ? t('adminDashboard.committee_head_vault_unlimited_label') : t('adminDashboard.system_vault_unlimited'))
                    : t('adminDashboard.your_balance').replace('{amount}', formatOCoins(userProfile?.oCoinsBalance ?? 0))}
                </span>
              </Link>
            </div>

            <h1 className="page-title text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
              {t('adminDashboard.welcome_user').replace('{name}', userProfile?.displayName || 'المشرف')}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              {roleSubtitle}
              {stats.overdue > 0 && t('adminDashboard.overdue_alert').replace('{count}', String(stats.overdue))}
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
                <span>{t('adminDashboard.broadcast_alert')}</span>
              </Button>
            )}

            {isHead && (
              <Button
                size="sm"
                onClick={() => setShowRewardModal(true)}
                className="font-bold text-xs gap-1.5 shadow-sm cursor-pointer text-white bg-amber-600 hover:bg-amber-700"
              >
                <Gift className="h-3.5 w-3.5" />
                <span>{t('adminDashboard.quick_reward')}</span>
              </Button>
            )}

            {(isHead ? myCommitteeSubmitted.length > 0 : stats.submitted > 0) && (
              <Link to="/submitted-tasks">
                <Button variant="reward" size="sm" className="font-bold text-xs gap-1.5 shadow-sm">
                  <Inbox className="h-3.5 w-3.5" /> {t('adminDashboard.review_submissions')} ({isHead ? myCommitteeSubmitted.length : stats.submitted})
                </Button>
              </Link>
            )}

            <Link to="/tasks">
              <Button variant="primary" size="sm" className="font-bold text-xs gap-1.5 shadow-sm">
                <Plus className="h-3.5 w-3.5" /> {t('adminDashboard.create_task')}
              </Button>
            </Link>

            {isTopLeader && (
              <Link to="/employees">
                <Button variant="outline" size="sm" className="font-semibold text-xs gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {t('adminDashboard.manage_team')}
                </Button>
              </Link>
            )}

            <Link to="/meetings">
              <Button variant="outline" size="sm" className="font-semibold text-xs gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {t('adminDashboard.meetings')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Semantic KPI Cards Grid — Tailored for Committee or Top Leaders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        <Link to="/employees" className="block focus:outline-none group cursor-pointer" title={!isTopLeader ? t('adminDashboard.my_committee_members') : t('adminDashboard.team_members')}>
          <StatCard
            title={!isTopLeader ? t('adminDashboard.my_committee_members') : t('adminDashboard.team_members')}
            value={!isTopLeader ? myCommitteeUsers.length : totalEmployees}
            variant="primary"
            icon={<Users className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />}
            subtext={!isTopLeader ? t('adminDashboard.committee_members_view_list').replace('{committeeName}', userProfile?.committeeName || 'اللجنة') : t('adminDashboard.active_members_manage')}
            className="group-hover:border-[var(--brand-primary)] group-hover:shadow-md transition-all cursor-pointer"
          />
        </Link>
        <StatCard
          title={!isTopLeader ? t('adminDashboard.my_committee_submissions') : t('adminDashboard.pending_submissions')}
          value={!isTopLeader ? myCommitteeSubmitted.length : stats.submitted}
          variant={(!isTopLeader ? myCommitteeSubmitted.length : stats.submitted) > 0 ? 'warm' : 'default'}
          icon={<Upload className="h-4 w-4" />}
          subtext={t('adminDashboard.need_review_approval')}
        />
        <StatCard
          title={!isTopLeader ? t('adminDashboard.my_committee_ongoing') : t('adminDashboard.in_progress_tasks')}
          value={!isTopLeader ? myCommitteeTasks.filter(t => t.status === 'in_progress').length : stats.inProgress}
          variant="accent"
          icon={<Clock className="h-4 w-4" />}
          subtext={t('adminDashboard.team_working_on')}
        />
        <StatCard
          title={!isTopLeader ? t('adminDashboard.my_committee_overdue') : t('adminDashboard.overdue_tasks')}
          value={!isTopLeader ? myCommitteeTasks.filter(t => isOverdue(t.deadline, t.status)).length : stats.overdue}
          variant="default"
          icon={<AlertTriangle className="h-4 w-4" />}
          iconBg={(!isTopLeader ? myCommitteeTasks.filter(t => isOverdue(t.deadline, t.status)).length : stats.overdue) > 0 ? "bg-[var(--brand-danger)]/15 text-[var(--brand-danger)]" : undefined}
          subtext={t('adminDashboard.exceeded_deadline')}
        />
        <StatCard
          title={!isTopLeader ? t('adminDashboard.my_committee_approved') : t('adminDashboard.approved_tasks')}
          value={!isTopLeader ? myCommitteeTasks.filter(t => t.status === 'approved' || t.status === 'completed').length : stats.approved}
          variant="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
          subtext={t('adminDashboard.completed_and_paid')}
        />
        <StatCard
          title={t('adminDashboard.ocoins_rewards')}
          value={formatOCoins(totalMemberCoinsInCirculation)}
          variant="warm"
          icon={<Coins className="h-4 w-4" />}
          subtext={isHead ? t('adminDashboard.committee_head_vault_unlimited') : t('adminDashboard.total_distributed_rewards')}
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
                  {t('adminDashboard.committee_pulse_title')}
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {t('adminDashboard.committee_pulse_desc')}
                </p>
              </div>
            </div>
            <Link to="/tasks" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              <span>{t('adminDashboard.manage_committee_tasks')}</span>
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
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {c.membersCount} أعضاء مسجلين
                    </p>
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
                  {t('adminDashboard.review_queue_title').replace('{name}', userProfile?.committeeName || '')}
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {t('adminDashboard.review_queue_desc')}
                </p>
              </div>
            </div>
            <Link to="/submitted-tasks" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              <span>{t('adminDashboard.full_submissions_page')}</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {myCommitteeSubmitted.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[var(--bg-elevated)]/30 border border-dashed border-[var(--border-subtle)] space-y-1">
              <p className="text-xs font-bold text-[var(--text-primary)]">{t('adminDashboard.no_pending_submissions')}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{t('adminDashboard.all_submissions_approved')}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-surface)]">
              {myCommitteeSubmitted.slice(0, 5).map((task) => (
                <div key={task.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[var(--bg-elevated)]/50 transition-colors">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">{task.title}</p>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>{t('adminDashboard.submitted_by').replace('{name}', task.assignedToNames?.[0] || 'أحد أعضاء اللجنة')}</span>
                      <span>·</span>
                      <span className="text-[var(--brand-warm)] font-bold">{t('adminDashboard.reward_amount').replace('{amount}', String(task.oCoinsReward))}</span>
                    </div>
                  </div>
                  <Link to="/submitted-tasks">
                    <Button size="sm" variant="reward" className="font-bold text-xs gap-1 cursor-pointer">
                      <span>{t('adminDashboard.review_and_approve')}</span>
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
              <h2 className="section-title text-sm sm:text-base text-[var(--text-primary)]">
                {!isTopLeader ? t('adminDashboard.latest_committee_tasks').replace('{name}', userProfile?.committeeName || 'اللجنة') : t('adminDashboard.latest_all_tasks')}
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {!isTopLeader ? t('adminDashboard.committee_tasks_count').replace('{count}', String(myCommitteeTasks.length)) : t('adminDashboard.all_tasks_count').replace('{count}', String(tasks.length))}
              </p>
            </div>
            <Link to="/tasks" className="text-xs font-bold text-[var(--brand-primary)] hover:text-[var(--brand-accent)] hover:underline flex items-center gap-1">
              {t('adminDashboard.view_all_tasks')} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : (isTopLeader ? tasks : myCommitteeTasks).length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs sm:text-sm">
                {t('adminDashboard.no_tasks_registered')}{' '}
                <Link to="/tasks" className="text-[var(--brand-primary)] font-bold hover:underline">
                  {t('adminDashboard.create_first_task')}
                </Link>
              </div>
            ) : (
              (isTopLeader ? tasks : myCommitteeTasks).slice(0, 6).map((task) => {
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
                <Bell className="h-4 w-4 text-[var(--brand-primary)]" /> {t('adminDashboard.alerts_notifications')}
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-[var(--brand-danger)] text-white">
                    {t('adminDashboard.new_count').replace('{count}', String(unreadCount))}
                  </span>
                )}
              </h2>
              <Link to="/notifications" className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline">
                {t('adminDashboard.alerts_center')}
              </Link>
            </div>
            <div className="p-3 space-y-2">
              {notifications.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-3">{t('common.no_data')}</p>
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
                <Activity className="h-4 w-4 text-[var(--brand-accent)]" /> {t('adminDashboard.live_activity_log')}
              </h2>
              <Link to="/activity-logs" className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline">
                {t('adminDashboard.full_log')}
              </Link>
            </div>
            <div className="p-3.5 space-y-2.5">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-3">{t('common.no_data')}</p>
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
                <Coins className="h-4 w-4 text-[var(--brand-warm)]" /> {t('adminDashboard.recent_ocoins_rewards')}
              </h2>
              <Link to="/ocoins" className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline">
                {t('adminDashboard.rewards_ledger')}
              </Link>
            </div>
            <div className="p-3 space-y-2">
              {recentTransactions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-3">{t('adminDashboard.no_rewards_recorded')}</p>
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

      {/* ─── Integrated Reports & Team Performance Analytics ──────────────── */}
      <div className="space-y-6 pt-2">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)]">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[var(--brand-primary)]" />
              <span>{t('adminDashboard.team_performance_title')}</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {t('adminDashboard.team_performance_desc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Committee Filter — Locked for head, full selector for top leaders */}
            {isHead ? (
              <span className="px-3 py-1.5 rounded-xl text-xs bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/30 font-bold flex items-center gap-1.5 shadow-xs">
                <Lock className="h-3.5 w-3.5" />
                <span>{t('adminDashboard.committee_exclusive').replace('{name}', userProfile?.committeeName || 'التابعة لك')}</span>
              </span>
            ) : (
              <select
                value={leaderboardCommitteeFilter}
                onChange={(e) => setLeaderboardCommitteeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] cursor-pointer"
              >
                <option value="">{t('adminDashboard.all_committees')}</option>
                {DEFAULT_COMMITTEES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              className="gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>{t('adminDashboard.export_csv')}</span>
            </Button>
          </div>
        </div>

        {/* Top 3 Performers Podium */}
        {topPerformers.length > 0 ? (
          <div className="card p-5 sm:p-6 rounded-2xl border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <span>{t('adminDashboard.honor_board_title')}</span>
              </h3>
              <span className="text-[11px] text-[var(--text-muted)] font-bold">{t('adminDashboard.honor_board_subtitle')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {topPerformers.map((item, idx) => {
                const medals = [
                  { rank: t('adminDashboard.rank_1'), color: 'border-amber-400/50 bg-amber-500/10 text-amber-500', icon: '🏆' },
                  { rank: t('adminDashboard.rank_2'), color: 'border-slate-300 dark:border-slate-700 bg-slate-500/10 text-slate-400', icon: '🥈' },
                  { rank: t('adminDashboard.rank_3'), color: 'border-amber-700/50 bg-amber-700/10 text-amber-700 dark:text-amber-500', icon: '🥉' },
                ];
                const medal = medals[idx] || medals[0];
                return (
                  <div
                    key={item.user.uid}
                    className={`p-4 rounded-2xl border ${medal.color} flex items-center gap-3 transition-transform hover:-translate-y-0.5`}
                  >
                    <Avatar src={item.user.photoURL} name={item.user.displayName || item.user.username || 'User'} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">{medal.rank}</span>
                        <span className="text-xs font-black text-amber-500 font-mono">
                          {item.coins > 0 ? `+${formatOCoins(item.coins)}` : formatOCoins(item.coins)} OC
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate mt-0.5">
                        {formatFullName(item.user.displayName || 'عضو')}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        {t('adminDashboard.completed_tasks_count').replace('{count}', String(item.completed)).replace('{rate}', String(Math.round(item.rate)))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card p-5 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-elevated)]/30 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 text-lg">
              🏆
            </div>
            <div className="min-w-0 text-right">
              <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">{t('adminDashboard.member_honor_board')}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {t('adminDashboard.member_honor_board_desc')}
              </p>
            </div>
          </div>
        )}

        {/* Visual Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Chart 1: Tasks Health Gauge */}
          <div className="card p-5 sm:p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-[var(--brand-primary)]" />
                  <span>{t('adminDashboard.task_status_distribution')}</span>
                </h3>
                <span className="text-xs text-[var(--text-muted)] font-mono">{t('adminDashboard.total_tasks_count').replace('{count}', String(tasks.length))}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t('adminDashboard.completion_vs_ongoing')}</p>
            </div>

            <div className="my-6 flex items-center justify-center">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[var(--bg-elevated)]"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500 transition-all duration-1000 ease-out"
                    strokeDasharray={`${Math.round(overallCompletionRate)}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-[var(--text-primary)] font-mono">{Math.round(overallCompletionRate)}%</span>
                  <span className="text-[10px] font-bold text-emerald-500">{t('adminDashboard.completion_rate')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-4 border-t border-[var(--border-subtle)]">
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-bold">{t('adminDashboard.completed_label')}</p>
                <p className="font-extrabold text-emerald-500 mt-0.5">{stats.approved}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-bold">{t('adminDashboard.in_progress_label')}</p>
                <p className="font-extrabold text-[var(--brand-primary)] mt-0.5">{stats.inProgress + stats.pending}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-bold">{t('adminDashboard.overdue_label')}</p>
                <p className="font-extrabold text-rose-500 mt-0.5">{stats.overdue}</p>
              </div>
            </div>
          </div>

          {/* Chart 2: Committee Performance Distribution */}
          <div className="card p-5 sm:p-6 rounded-2xl flex flex-col justify-between lg:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-500" />
                  <span>{t('adminDashboard.committee_completion_rates')}</span>
                </h3>
                <span className="text-xs text-[var(--text-muted)]">{t('adminDashboard.active_committees_count').replace('{count}', String(committeesStats.length))}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t('adminDashboard.committee_efficiency_desc')}</p>
            </div>

            <div className="my-4 space-y-3">
              {committeesStats.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-primary)]">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-muted)]">{c.completedTasks} من {c.totalTasks} مهمة</span>
                      <span className="font-bold text-cyan-500 font-mono">{c.completionRate}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-[var(--bg-elevated)] h-2 rounded-full overflow-hidden border border-[var(--border-subtle)]">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-[var(--brand-primary)] h-full rounded-full transition-all duration-1000"
                      style={{ width: `${c.completionRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
              <span>{t('adminDashboard.committee_update_note')}</span>
            </div>
          </div>
        </div>

        {/* Employee Performance Breakdown Table */}
        <div className="card overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-elevated)]/40">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">تفاصيل أداء أعضاء فريق العمل</h3>
              <p className="text-[11px] text-[var(--text-muted)]">إحصائيات إنجاز التكليفات ومجموع الرصيد (مستثنى منها القادة تلقائياً)</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={leaderboardSearch}
                  onChange={(e) => setLeaderboardSearch(e.target.value)}
                  placeholder="بحث عن عضو..."
                  className="pr-8 pl-3 py-1.5 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
              </div>
              <span className="text-xs text-[var(--text-muted)] font-semibold shrink-0">{filteredEmployeeReports.length} عضواً</span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[var(--text-muted)] text-sm">جاري تجميع وحساب بيانات الأداء...</div>
          ) : filteredEmployeeReports.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-muted)] text-sm">لا توجد سجلات أعضاء مطابقة.</div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] overflow-x-auto">
              {filteredEmployeeReports.map(({ user, total, completed, overdue, rate, coins }) => (
                <div key={user.uid} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg-elevated)]/30 transition-colors min-w-[600px] sm:min-w-0">
                  <div className="flex items-center gap-3.5 sm:w-64 min-w-0">
                    <Avatar src={user.photoURL} name={formatFullName(user.displayName || user.username || 'User')} size="sm" />
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--text-primary)] truncate text-xs">{formatFullName(user.displayName || 'عضو الفريق')}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate font-mono">@{user.username || user.email}</p>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">المسندة</span>
                      <strong className="text-xs font-extrabold text-[var(--text-primary)]">{total}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">المكتملة</span>
                      <strong className="text-xs font-extrabold text-emerald-500">{completed}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">نسبة الإنجاز</span>
                      <strong className="text-xs font-extrabold text-[var(--brand-primary)]">{Math.round(rate)}%</strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">O Coins</span>
                      <strong
                        dir="ltr"
                        className={cn(
                          "text-xs font-extrabold font-mono",
                          hasUnlimitedCoins(user.role)
                            ? "text-amber-500"
                            : coins < 0
                            ? "text-rose-500 dark:text-rose-400"
                            : "text-amber-500"
                        )}
                      >
                        {hasUnlimitedCoins(user.role) ? '∞' : formatOCoins(coins)}
                      </strong>
                    </div>
                  </div>

                  {overdue > 0 && (
                    <div className="shrink-0">
                      <span className="badge bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                        <AlertTriangle className="h-3 w-3 ml-1 inline" /> {overdue} متأخرة
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
                    {formatFullName(u.displayName)} (@{u.username || u.email}) — رصيده: {hasUnlimitedCoins(u.role) ? '∞' : `${formatOCoins(typeof u.oCoinsBalance === 'number' ? u.oCoinsBalance : (u.ocoins_balance ?? 0))} OC`}
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
