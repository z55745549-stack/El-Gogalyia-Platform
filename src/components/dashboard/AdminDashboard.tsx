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

    // Calculate assignments total and approved
    const totalAssignments = commTasks.reduce(
      (acc, t) => acc + Math.max(1, (t.assignedTo || []).length),
      0
    );
    const approvedAssignments = commTasks.reduce((acc, t) => {
      if (t.status === 'completed' || t.status === 'approved') {
        return acc + Math.max(1, (t.assignedTo || []).length);
      }
      const approvedCount = (t.assignedTo || []).filter(
        (uid) => t.userStatuses?.[uid]?.status === 'approved'
      ).length;
      return acc + approvedCount;
    }, 0);

    const commCompletedTasks = commTasks.filter(
      (t) => t.status === 'approved' || t.status === 'completed'
    ).length;

    const commMembers = allUsers.filter(u =>
      u.committeeId === comm.id ||
      (u.committeeName && u.committeeName.trim().toLowerCase() === comm.name.trim().toLowerCase())
    ).length;

    // Rate: based on approved assignments out of total assignments if assignments exist
    const rate = totalAssignments > 0
      ? Math.round((approvedAssignments / totalAssignments) * 100)
      : commTasks.length > 0
      ? Math.round((commCompletedTasks / commTasks.length) * 100)
      : 0;

    return {
      ...comm,
      totalTasks: commTasks.length,
      completedTasks: commCompletedTasks,
      totalAssignments,
      approvedAssignments,
      membersCount: commMembers,
      completionRate: rate,
    };
  });

  // Overall completion rate for gauge (based on scoped tasks for head, all tasks for leaders)
  const scopedTasks = isHead ? myCommitteeTasks : tasks;
  const scopedTotalAssignments = scopedTasks.reduce(
    (acc, t) => acc + Math.max(1, (t.assignedTo || []).length),
    0
  );
  const scopedApprovedAssignments = scopedTasks.reduce((acc, t) => {
    if (t.status === 'completed' || t.status === 'approved') {
      return acc + Math.max(1, (t.assignedTo || []).length);
    }
    const approvedCount = (t.assignedTo || []).filter(
      (uid) => t.userStatuses?.[uid]?.status === 'approved'
    ).length;
    return acc + approvedCount;
  }, 0);

  const overallCompletionRate =
    scopedTotalAssignments > 0
      ? Math.round((scopedApprovedAssignments / scopedTotalAssignments) * 100)
      : scopedTasks.length > 0
      ? Math.round(
          (scopedTasks.filter((t) => t.status === 'approved' || t.status === 'completed').length /
            scopedTasks.length) *
            100
        )
      : 0;

  // Helpers to accurately identify user assignments and completion
  const getUserSearchKeys = (u: UserProfile) => {
    return [
      u.uid,
      (u as any).id,
      u.username,
      u.email,
      u.displayName,
      ...(u.username ? [u.username.replace('@', '')] : []),
      ...(u.email ? [u.email.split('@')[0]] : []),
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase().trim());
  };

  const isUserAssigned = (t: Task, u: UserProfile) => {
    const keys = getUserSearchKeys(u);
    const assigned = (t.assignedTo || []).map((a) => String(a).toLowerCase().trim());
    return keys.some((k) => assigned.includes(k));
  };

  const isUserCompleted = (t: Task, u: UserProfile) => {
    if (t.status === 'completed' || t.status === 'approved') return true;
    const keys = getUserSearchKeys(u);

    // Check userStatuses map
    if (t.userStatuses && typeof t.userStatuses === 'object') {
      for (const [k, val] of Object.entries(t.userStatuses)) {
        if (keys.includes(k.toLowerCase().trim()) && val?.status === 'approved') {
          return true;
        }
      }
    }

    // Check latestSubmission
    if (t.latestSubmission && t.latestSubmission.status === 'approved') {
      const subBy = (t.latestSubmission.submittedBy || '').toLowerCase().trim();
      if (keys.includes(subBy)) return true;
    }

    return false;
  };

  // Employee Performance breakdown — EXCLUDES Lead, Co-Lead, and Committee Heads (unlimited coins)
  const employeeReports = allUsers
    .filter((u) => !hasUnlimitedCoins(u.role))
    .filter((u) => !effectiveCommitteeFilter || u.committeeId === effectiveCommitteeFilter || (u.committeeName && u.committeeName.trim().toLowerCase() === effectiveCommitteeFilter.toLowerCase()))
    .map((u) => {
      const userTasks = tasks.filter((t) => isUserAssigned(t, u));
      const completed = userTasks.filter((t) => isUserCompleted(t, u)).length;
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

  // Interactive mouse spotlight handler for cards
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  // Activity log action translation
  const getActivityArabicAction = (action: string): string => {
    const clean = (action || '').toLowerCase().trim();
    if (clean.includes('user_approved') || clean.includes('user approved')) return 'اعتماد تسليم مهمة لعضو';
    if (clean.includes('user_rejected') || clean.includes('user rejected')) return 'رفض تسليم مهمة';
    if (clean.includes('status_changed') || clean.includes('status changed')) return 'تحديث حالة تكليف';
    if (clean.includes('task_created') || clean.includes('task created')) return 'إنشاء مهمة جديدة';
    if (clean.includes('task_updated') || clean.includes('task updated')) return 'تعديل تفاصيل المهمة';
    if (clean.includes('task_completed') || clean.includes('task completed')) return 'إكمال مهمة';
    if (clean.includes('reward') || clean.includes('coin')) return 'منح مكافأة O-Coins';
    if (clean.includes('login')) return 'تسجيل دخول للمنصة';
    if (clean.includes('user updated') || clean.includes('user_updated')) return 'تحديث بيانات مستخدم';
    return action.replace(/\./g, ' ').replace(/_/g, ' ');
  };

  // Role-specific badge and subtitle
  const roleBadgeText = isLead
    ? 'القائد العام (Lead)'
    : isCoLead
    ? 'نائب القائد العام (Co-Lead)'
    : isHead
    ? `رئيس لجنة ${userProfile?.committeeName || ''}`
    : 'مشرف المنصة';

  const roleSubtitle = isLead
    ? 'لوحة تحكم القائد العام · متابعة شاملة ومباشرة لكافة اللجان والمهام والتكليفات'
    : isCoLead
    ? 'لوحة تحكم نائب القائد العام · إشراف ومتابعة شاملة لجميع اللجان ومعدلات الإنجاز'
    : isHead
    ? `لوحة تحكم رئيس لجنة ${userProfile?.committeeName || ''} · إدارة مهام وتسليمات الأعضاء`
    : 'لوحة التحكم الإدارية';

  const { notifications } = useNotifications(5);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-5 sm:space-y-6 font-sans text-right dir-rtl">
      {/* Broadcast System Announcement Banner */}
      <BroadcastBanner />

      {/* Modern High-Tech Hero Header with Cyber Aura */}
      <div
        onMouseMove={handleCardMouseMove}
        className="glow-card-interactive p-5 sm:p-7 relative overflow-hidden bg-gradient-to-br from-[var(--surface-elevated)] via-[var(--surface)] to-[var(--surface-secondary)] border border-[var(--border-subtle)] shadow-xl"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black shadow-sm transition-all duration-300 glow-badge",
                isLead
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                  : isCoLead
                  ? "bg-purple-500/25 text-purple-200 border border-purple-500/50 shadow-[0_0_18px_rgba(168,85,247,0.35)]"
                  : isHead
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.25)]"
                  : "badge-primary"
              )}>
                <Shield className="h-3.5 w-3.5 shrink-0 glow-icon" />
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
                  نبض وأداء لجان المنصة
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  متابعة شاملة لحالة المهام ومعدلات إنجاز وتكليفات جميع لجان المنصة.
                </p>
              </div>
            </div>
            <Link to="/tasks" className="text-xs font-bold text-[var(--brand-primary)] hover:underline flex items-center gap-1">
              <span>إدارة واستعراض المهام</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {committeesStats.map((c) => {
              const hasNoTasks = c.totalTasks === 0;
              return (
                <div
                  key={c.id}
                  onMouseMove={handleCardMouseMove}
                  className="glow-card-interactive p-4 rounded-2xl border border-[var(--border-subtle)] space-y-3 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] glow-text transition-colors">
                        {c.name}
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {c.membersCount} أعضاء مسجلين
                      </p>
                    </div>
                    {hasNoTasks ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[var(--border-subtle)]/60 text-[var(--text-muted)]">
                        لا توجد مهام
                      </span>
                    ) : (
                      <span className={cn(
                        "text-xs font-black px-2 py-0.5 rounded-lg glow-badge",
                        c.completionRate >= 75
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : c.completionRate >= 40
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : c.completionRate > 0
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      )}>
                        {c.completionRate}%
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${c.completionRate}%`,
                          background: hasNoTasks
                            ? 'transparent'
                            : c.completionRate >= 75
                            ? 'var(--brand-success)'
                            : c.completionRate >= 40
                            ? 'var(--brand-warm)'
                            : c.completionRate > 0
                            ? 'var(--brand-primary)'
                            : 'var(--brand-danger)',
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-medium">
                      {hasNoTasks ? (
                        <span className="text-[10px] text-[var(--text-muted)]">لا توجد تكليفات حالياً</span>
                      ) : (
                        <>
                          <span>
                            {c.approvedAssignments > 0
                              ? `${c.approvedAssignments} تسليم معتمد`
                              : `${c.completedTasks} مهمة منجزة`}
                          </span>
                          <span>
                            من أصل {c.totalAssignments > c.totalTasks ? `${c.totalAssignments} تكليف` : `${c.totalTasks} مهمة`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── HEAD EXCLUSIVE: Committee Review Queue ──────────────────────────── */}
      {isHead && (
        <div
          onMouseMove={handleCardMouseMove}
          className="glow-card-interactive p-5 sm:p-6 space-y-4 border-l-4 border-l-[var(--brand-primary)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] glow-icon">
                <Inbox className="h-4 w-4" />
              </span>
              <div>
                <h2 className="section-title text-sm sm:text-base text-[var(--text-primary)] glow-text">
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

      {/* Main Split Content — Balanced 2 columns + 1 column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Columns: Tasks & O-Coins Rewards */}
        <div className="lg:col-span-2 space-y-5">
          {/* Recent Tasks List */}
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive overflow-hidden rounded-2xl border border-[var(--border-subtle)]"
          >
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]/30">
              <div>
                <h2 className="section-title text-sm sm:text-base text-[var(--text-primary)] flex items-center gap-2">
                  <span className="glow-text">
                    {!isTopLeader ? t('adminDashboard.latest_committee_tasks').replace('{name}', userProfile?.committeeName || 'اللجنة') : t('adminDashboard.latest_all_tasks')}
                  </span>
                </h2>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {!isTopLeader ? t('adminDashboard.committee_tasks_count').replace('{count}', String(myCommitteeTasks.length)) : t('adminDashboard.all_tasks_count').replace('{count}', String(tasks.length))}
                </p>
              </div>
              <Link to="/tasks" className="text-xs font-bold text-[var(--brand-primary)] hover:text-[var(--brand-accent)] hover:underline flex items-center gap-1">
                <span>{t('adminDashboard.view_all_tasks')}</span>
                <ArrowUpRight className="h-3 w-3" />
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

          {/* O Coins Recent Rewards Feed — Moved here for perfect height harmony */}
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive overflow-hidden rounded-2xl border border-[var(--border-subtle)]"
          >
            <div className="p-3.5 sm:p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]/30">
              <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Coins className="h-4 w-4 text-[var(--brand-warm)] glow-icon" />
                <span className="glow-text">{t('adminDashboard.recent_ocoins_rewards')}</span>
              </h2>
              <Link to="/ocoins" className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline">
                {t('adminDashboard.rewards_ledger')}
              </Link>
            </div>
            <div className="p-3 space-y-2">
              {recentTransactions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">{t('adminDashboard.no_rewards_recorded')}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {recentTransactions.slice(0, 6).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)] hover:border-[var(--brand-warm)]/40 transition-all"
                    >
                      <div className="min-w-0 pr-1">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{tx.userDisplayName}</p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate">{tx.reason}</p>
                      </div>
                      <span className={cn(
                        'text-xs font-black shrink-0 px-2 py-0.5 rounded-lg font-mono glow-badge',
                        tx.amount > 0
                          ? 'text-[var(--brand-warm)] bg-[var(--brand-warm)]/15 border border-[var(--brand-warm)]/30'
                          : 'text-[var(--brand-danger)] bg-[var(--brand-danger)]/15 border border-[var(--brand-danger)]/30'
                      )}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount} OC
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Notifications & Live Activity */}
        <div className="space-y-5">
          {/* Recent Notifications Feed */}
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive overflow-hidden rounded-2xl border border-[var(--border-subtle)]"
          >
            <div className="p-3.5 sm:p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]/30">
              <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Bell className="h-4 w-4 text-[var(--brand-primary)] glow-icon" />
                <span className="glow-text">{t('adminDashboard.alerts_notifications')}</span>
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
                <p className="text-xs text-[var(--text-muted)] text-center py-4">{t('common.no_data')}</p>
              ) : (
                notifications.slice(0, 4).map((n) => (
                  <Link
                    key={n.id}
                    to={n.actionUrl || '/notifications'}
                    className={cn(
                      'flex items-start gap-2.5 p-2.5 rounded-xl transition-all duration-200 text-right block',
                      !n.read ? 'bg-[var(--brand-primary)]/[0.08] border border-[var(--brand-primary)]/20' : 'hover:bg-[var(--bg-elevated)]/60'
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
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive overflow-hidden rounded-2xl border border-[var(--border-subtle)]"
          >
            <div className="p-3.5 sm:p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]/30">
              <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--brand-accent)] glow-icon" />
                <span className="glow-text">{t('adminDashboard.live_activity_log')}</span>
              </h2>
              <Link to="/activity-logs" className="text-[11px] font-bold text-[var(--brand-primary)] hover:underline">
                {t('adminDashboard.full_log')}
              </Link>
            </div>
            <div className="p-3.5 space-y-2.5">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">{t('common.no_data')}</p>
              ) : (
                recentActivity.slice(0, 6).map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 text-right p-1.5 rounded-xl hover:bg-[var(--bg-elevated)]/40 transition-colors">
                    <Avatar src={log.actorPhoto} name={log.actorName || log.actor} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text-primary)] leading-snug">
                        <span className="font-bold">{log.actorName?.split(' ')[0] || log.actor}</span>{' '}
                        <span className="text-[var(--text-secondary)] font-medium">{getActivityArabicAction(log.action)}</span>
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-medium font-mono">
                        {log.timestamp ? formatRelative(log.timestamp) : 'الآن'}
                      </p>
                    </div>
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
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive p-5 sm:p-6 rounded-2xl border border-[var(--border-subtle)]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500 glow-icon" />
                <span className="glow-text">{t('adminDashboard.honor_board_title')}</span>
              </h3>
              <span className="text-[11px] text-[var(--text-muted)] font-bold">{t('adminDashboard.honor_board_subtitle')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {topPerformers.map((item, idx) => {
                const medals = [
                  { rank: t('adminDashboard.rank_1'), color: 'border-amber-400/50 bg-amber-500/10 text-amber-400', glow: 'glow-warm' },
                  { rank: t('adminDashboard.rank_2'), color: 'border-slate-300 dark:border-slate-700 bg-slate-500/10 text-slate-300', glow: 'glow-primary' },
                  { rank: t('adminDashboard.rank_3'), color: 'border-amber-700/50 bg-amber-700/10 text-amber-500', glow: 'glow-warm' },
                ];
                const medal = medals[idx] || medals[0];
                return (
                  <div
                    key={item.user.uid}
                    onMouseMove={handleCardMouseMove}
                    className={cn(
                      "glow-card-interactive p-4 rounded-2xl border flex items-center gap-3 transition-transform hover:-translate-y-1 group",
                      medal.color,
                      medal.glow
                    )}
                  >
                    <Avatar src={item.user.photoURL} name={item.user.displayName || item.user.username || 'User'} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black glow-badge">{medal.rank}</span>
                        <span className="text-xs font-black text-amber-400 font-mono glow-text">
                          {item.coins > 0 ? `+${formatOCoins(item.coins)}` : formatOCoins(item.coins)} OC
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate mt-0.5 group-hover:text-white transition-colors">
                        {formatFullName(item.user.displayName || 'عضو')}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        {item.completed > 0 ? `${item.completed} مهمة معتمدة` : 'تكليفات قيد العمل'} {item.rate > 0 ? `· %${Math.round(item.rate)} إنجاز` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="glow-card-interactive p-5 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-elevated)]/30 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 text-lg glow-icon">
              🏆
            </div>
            <div className="min-w-0 text-right">
              <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] glow-text">{t('adminDashboard.member_honor_board')}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {t('adminDashboard.member_honor_board_desc')}
              </p>
            </div>
          </div>
        )}

        {/* Visual Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Chart 1: Tasks Health Gauge */}
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive p-5 sm:p-6 rounded-2xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-[var(--brand-primary)] glow-icon" />
                  <span className="glow-text">{t('adminDashboard.task_status_distribution')}</span>
                </h3>
                <span className="text-xs text-[var(--text-muted)] font-mono">{t('adminDashboard.total_tasks_count').replace('{count}', String(scopedTasks.length))}</span>
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
                  <span className="text-2xl font-black text-[var(--text-primary)] font-mono glow-text">{Math.round(overallCompletionRate)}%</span>
                  <span className="text-[10px] font-bold text-emerald-400">{t('adminDashboard.completion_rate')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-4 border-t border-[var(--border-subtle)]">
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-bold">تسليمات معتمدة</p>
                <p className="font-extrabold text-emerald-400 mt-0.5 glow-text font-mono">{scopedApprovedAssignments}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-bold">تكليفات جارية</p>
                <p className="font-extrabold text-[var(--brand-primary)] mt-0.5 glow-text font-mono">{Math.max(0, scopedTotalAssignments - scopedApprovedAssignments)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-muted)] font-bold">متأخرة</p>
                <p className="font-extrabold text-rose-500 mt-0.5 glow-text font-mono">{stats.overdue}</p>
              </div>
            </div>
          </div>

          {/* Chart 2: Committee Performance Distribution */}
          <div
            onMouseMove={handleCardMouseMove}
            className="glow-card-interactive p-5 sm:p-6 rounded-2xl flex flex-col justify-between lg:col-span-2"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400 glow-icon" />
                  <span className="glow-text">{t('adminDashboard.committee_completion_rates')}</span>
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
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {c.totalTasks === 0 ? 'لا توجد مهام' : `${c.approvedAssignments} معتمد من ${c.totalAssignments} تكليف`}
                      </span>
                      <span className="font-bold text-cyan-400 font-mono glow-badge">{c.completionRate}%</span>
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
        <div
          onMouseMove={handleCardMouseMove}
          className="glow-card-interactive overflow-hidden rounded-2xl border border-[var(--border-subtle)]"
        >
          <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-elevated)]/40">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <span className="glow-text">تفاصيل أداء أعضاء فريق العمل</span>
              </h3>
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
                <div
                  key={user.uid}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg-elevated)]/60 transition-all duration-200 min-w-[600px] sm:min-w-0 group"
                >
                  <div className="flex items-center gap-3.5 sm:w-64 min-w-0">
                    <Avatar src={user.photoURL} name={formatFullName(user.displayName || user.username || 'User')} size="sm" />
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--text-primary)] truncate text-xs group-hover:text-[var(--brand-primary)] transition-colors">
                        {formatFullName(user.displayName || 'عضو الفريق')}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate font-mono">@{user.username || user.email}</p>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">المسندة</span>
                      <strong className="text-xs font-extrabold text-[var(--text-primary)] font-mono">{total}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">المكتملة</span>
                      <strong className="text-xs font-extrabold text-emerald-400 font-mono glow-text">{completed}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">نسبة الإنجاز</span>
                      <strong className="text-xs font-extrabold text-[var(--brand-primary)] font-mono glow-badge px-1.5 py-0.5 rounded">
                        {Math.round(rate)}%
                      </strong>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] block">O Coins</span>
                      <strong
                        dir="ltr"
                        className={cn(
                          "text-xs font-extrabold font-mono glow-text",
                          hasUnlimitedCoins(user.role)
                            ? "text-amber-400"
                            : coins < 0
                            ? "text-rose-500 dark:text-rose-400"
                            : "text-amber-400"
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
