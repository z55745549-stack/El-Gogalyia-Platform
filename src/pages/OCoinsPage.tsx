import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, getDocs, db } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { DiscountsPage } from '@/pages/DiscountsPage';
import { MyDiscountsPage } from '@/pages/MyDiscountsPage';
import { AdminDiscountsPage } from '@/pages/AdminDiscountsPage';
import {
  Coins,
  Plus,
  Minus,
  Search,
  Trash2,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Tag,
  ShieldCheck,
  Gift,
  Award,
  Calendar,
  AlertCircle,
  FileText,
  User,
  Clock,
  CheckCircle2,
  Filter,
  Layers,
  ChevronLeft,
  ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { isAdminRole } from '@/utils/permissions';
import {
  manualOCoinAdjustment,
  deleteOCoinTransaction,
  clearAllOCoinTransactions
} from '@/lib/database-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { formatOCoins, formatDate, formatRelative, cn, formatFullName, hasUnlimitedCoins } from '@/utils';
import type { OCoinTransaction, OCoinTransactionType, UserProfile } from '@/types';

const TRANSACTION_TYPE_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ReactNode; isPositive: boolean }
> = {
  manual_reward: {
    label: 'مكافأة تميز وأداء',
    badgeClass: 'bg-[var(--brand-accent)]/15 text-[var(--brand-accent-dark)] dark:text-[var(--brand-accent)] border-[var(--brand-accent)]/30',
    icon: <Gift className="h-3.5 w-3.5" />,
    isPositive: true,
  },
  manual_add: {
    label: 'إيداع إداري',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    icon: <Plus className="h-3.5 w-3.5" />,
    isPositive: true,
  },
  task_reward: {
    label: 'مكافأة إنجاز مهمة',
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    icon: <Award className="h-3.5 w-3.5" />,
    isPositive: true,
  },
  task_approved: {
    label: 'اعتماد تسليم مهمة',
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    icon: <Award className="h-3.5 w-3.5" />,
    isPositive: true,
  },
  meeting_reward: {
    label: 'مكافأة حضور اجتماع',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    icon: <Calendar className="h-3.5 w-3.5" />,
    isPositive: true,
  },
  achievement_reward: {
    label: 'إنجاز استثنائي',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    isPositive: true,
  },
  admin_adjustment: {
    label: 'تعديل وتدقيق إداري',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    icon: <FileText className="h-3.5 w-3.5" />,
    isPositive: true,
  },
  penalty_deduction: {
    label: 'خصم / جزاء إداري',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    icon: <Minus className="h-3.5 w-3.5" />,
    isPositive: false,
  },
  manual_remove: {
    label: 'خصم رصيد يدوي',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    icon: <Minus className="h-3.5 w-3.5" />,
    isPositive: false,
  },
  ban_penalty: {
    label: 'جزاء تعليق الحساب',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 border-rose-300 dark:border-rose-700',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    isPositive: false,
  },
  shop_purchase: {
    label: 'شراء من المتجر',
    badgeClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    icon: <Coins className="h-3.5 w-3.5" />,
    isPositive: false,
  },
  discount_purchase: {
    label: 'شراء عرض / خصم',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    icon: <ShoppingBag className="h-3.5 w-3.5" />,
    isPositive: false,
  },
};

export function OCoinsPage() {
  const { userProfile } = useAuth();
  const role = userProfile?.role;
  const isTopLeader = role === 'lead' || role === 'co_lead';
  const isHead = role === 'head';
  const canManage = isTopLeader || isHead;

  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'wallet';

  const [allTransactions, setAllTransactions] = useState<OCoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<'all' | 'rewards' | 'deductions' | 'tasks'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Detail Modal
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<OCoinTransaction | null>(null);

  // Admin Manual Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<OCoinTransactionType>('manual_reward');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // Admin Delete / Clear Modals
  const [deleteTarget, setDeleteTarget] = useState<OCoinTransaction | null>(null);
  const [deletingTx, setDeletingTx] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  // 1. Realtime Subscriptions
  useEffect(() => {
    if (!userProfile) return;

    // Listen to all transactions in realtime
    const q = query(collection(db, 'oCoins'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OCoinTransaction));
        setAllTransactions(txs);
        setLoading(false);
      },
      (err) => {
        console.warn('oCoins snapshot listener notice:', err);
        setLoading(false);
      }
    );

    // Fetch team users for Admin modal
    if (canManage) {
      getDocs(collection(db, 'users'))
        .then((snap) => {
          const localUsers: UserProfile[] = JSON.parse(
            localStorage.getItem('elgogalyia_local_users') || '[]'
          );
          const fsUsers = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
          const map = new Map<string, UserProfile>();
          fsUsers.forEach((u) => map.set(u.uid, u));
          localUsers.forEach((u) => {
            if (!map.has(u.uid)) map.set(u.uid, u);
          });
          setAllUsers(Array.from(map.values()));
        })
        .catch((err) => console.warn('Failed to load users:', err));
    }

    return unsub;
  }, [userProfile, canManage]);

  // 2. Filter Transactions by User and Search Criteria
  const myId = userProfile?.uid;
  const myEmail = (userProfile?.email || userProfile?.username || '').toLowerCase();
  const myUsername = (userProfile?.username || '').toLowerCase();

  // Helper: check if a transaction belongs to a user (all field name variants)
  const txBelongsTo = (t: any, uid: string, email: string, username: string): boolean => {
    if (!uid && !email) return false;
    if (uid) {
      if (t.uid === uid) return true;
      if (t.employeeId === uid) return true;
      if (t.userId === uid) return true;
      if (t.user_id === uid) return true;
    }
    const tEmail = (t.userEmail || t.user_email || '').toLowerCase();
    if (tEmail && email && tEmail === email) return true;
    if (tEmail && username && tEmail === username) return true;
    return false;
  };

  const userTransactions = canManage
    ? selectedUser
      ? allTransactions.filter((t) =>
          txBelongsTo(
            t,
            selectedUser.uid,
            (selectedUser.email || selectedUser.username || '').toLowerCase(),
            (selectedUser.username || '').toLowerCase()
          )
        )
      : allTransactions
    : allTransactions.filter((t) => txBelongsTo(t, myId || '', myEmail, myUsername));

  // Calculate totals
  // FIX #11: For unlimited-coin roles, totals are meaningless numeric values — skip calculation
  const viewingUnlimitedUser = canManage && selectedUser
    ? hasUnlimitedCoins(selectedUser.role)
    : hasUnlimitedCoins(role);

  const totalEarned = viewingUnlimitedUser
    ? null
    : userTransactions
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalSpent = viewingUnlimitedUser
    ? null
    : userTransactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

  // Apply tab and text search filters
  const filteredTransactions = userTransactions.filter((t) => {
    // Tab filter
    if (activeTab === 'rewards' && t.amount <= 0) return false;
    if (activeTab === 'deductions' && t.amount >= 0) return false;
    if (
      activeTab === 'tasks' &&
      t.type !== 'task_reward' &&
      t.type !== 'task_approved' &&
      !t.taskId
    )
      return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchReason = (t.reason || '').toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchTask = (t.taskTitle || '').toLowerCase().includes(q);
      const matchUser = (t.userDisplayName || t.userEmail || '').toLowerCase().includes(q);
      const matchAdmin = (t.createdByName || '').toLowerCase().includes(q);
      return matchReason || matchDesc || matchTask || matchUser || matchAdmin;
    }

    return true;
  });

  // 3. Handlers
  const handleAdjust = async () => {
    if (!adjustTarget || !userProfile || !adjustAmount || !adjustReason.trim()) return;
    const amountNum = parseInt(adjustAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('يرجى إدخال رقم صحيح موجب لمقدار الـ O Coins.');
      return;
    }

    // Role-based security check
    if (isHead) {
      if (adjustTarget.uid === userProfile.uid) {
        toast.error('❌ محظور نهائياً: لا يمكن لرئيس اللجنة منح كوينز لنفسه. مكافآت القيادة تمنح بواسطة القائد العام فقط.');
        return;
      }
      const sameCommittee = Boolean(
        (adjustTarget.committeeId && userProfile.committeeId && adjustTarget.committeeId === userProfile.committeeId) ||
        (adjustTarget.committeeName && userProfile.committeeName && adjustTarget.committeeName.trim().toLowerCase() === userProfile.committeeName.trim().toLowerCase())
      );
      if (!sameCommittee || (adjustTarget.role !== 'member' && adjustTarget.role !== 'vice_head')) {
        toast.error('❌ صلاحيتك كرئيس لجنة تقتصر حصراً على أعضاء ونائب رئيس لجنتك فقط.');
        return;
      }
    }

    setAdjusting(true);
    try {
      const actorId = (userProfile.email || userProfile.username || 'admin').toLowerCase();
      await manualOCoinAdjustment({
        targetUser: adjustTarget,
        amount: amountNum,
        type: adjustType,
        reason: adjustReason.trim(),
        description: adjustDescription.trim() || adjustReason.trim(),
        source: 'admin_portal',
        actor: {
          email: actorId,
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || '',
        },
      });

      const isPositive = adjustType !== 'penalty_deduction' && adjustType !== 'manual_remove';
      toast.success(
        `تم ${isPositive ? 'إضافة' : 'خصم'} ${amountNum} O Coins للحساب (${adjustTarget.displayName}) بنجاح! ✨`
      );

      setShowAdjustModal(false);
      setAdjustAmount('');
      setAdjustReason('');
      setAdjustDescription('');
      setAdjustTarget(null);
      setAdjustType('manual_reward');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'فشل تعديل الـ O Coins.');
    } finally {
      setAdjusting(false);
    }
  };

  const handleDeleteTx = async () => {
    if (!deleteTarget || !userProfile) return;
    setDeletingTx(true);
    try {
      await deleteOCoinTransaction(deleteTarget.id, {
        email: userProfile.email || userProfile.username || '',
        displayName: userProfile.displayName,
      });
      toast.success('تم مسح سجل المعاملة بنجاح.');
      setDeleteTarget(null);
    } catch {
      toast.error('فشل مسح سجل المعاملة.');
    } finally {
      setDeletingTx(false);
    }
  };

  const handleClearAll = async () => {
    if (!userProfile) return;
    setClearingAll(true);
    try {
      await clearAllOCoinTransactions({
        email: userProfile.email || userProfile.username || '',
        displayName: userProfile.displayName,
      });
      toast.success('تم مسح جميع سجلات معاملات O Coins بنجاح.');
      setShowClearAllModal(false);
    } catch {
      toast.error('فشل مسح السجلات.');
    } finally {
      setClearingAll(false);
    }
  };

  // Filter users based on role permissions
  const manageableUsers = allUsers.filter((u) => {
    if (isTopLeader) return true;
    if (isHead) {
      if (u.uid === userProfile?.uid) return false; // Head NEVER grants coins to himself
      const sameCommittee = Boolean(
        (u.committeeId && userProfile?.committeeId && u.committeeId === userProfile.committeeId) ||
        (u.committeeName && userProfile?.committeeName && u.committeeName.trim().toLowerCase() === userProfile.committeeName.trim().toLowerCase())
      );
      return sameCommittee && (u.role === 'member' || u.role === 'vice_head');
    }
    return false;
  });

  const filteredTargetUsers = manageableUsers.filter(
    (u) =>
      (u.displayName || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto dir-rtl text-right font-sans pb-12">
      {/* Unified Rewards Hub Segmented Switcher */}
      <div className="flex items-center justify-between p-1.5 sm:p-2 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none snap-x w-full">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={cn(
              'snap-start shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 active:scale-95',
              currentTab === 'wallet'
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            )}
          >
            <Coins className="h-4 w-4" />
            <span>محفظة O Coins والمعاملات</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'store' })}
            className={cn(
              'snap-start shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 active:scale-95',
              currentTab === 'store'
                ? 'bg-[var(--brand-primary)] text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            )}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>متجر الخصومات والمكافآت</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'purchases' })}
            className={cn(
              'snap-start shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 active:scale-95',
              currentTab === 'purchases'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
            )}
          >
            <Gift className="h-4 w-4" />
            <span>مشترياتي وقسائمي المفعّلة</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'manage_discounts' })}
              className={cn(
                'snap-start shrink-0 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 active:scale-95',
                currentTab === 'manage_discounts'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
              )}
            >
              <Tag className="h-4 w-4" />
              <span>إدارة العروض والخصومات (مشرف)</span>
            </button>
          )}
        </div>

        {canManage && (
          <div className="items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 text-purple-400 text-[11px] font-black border border-purple-500/20 hidden lg:flex shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>صلاحيات الإشراف مفعّلة</span>
          </div>
        )}
      </div>

      {currentTab === 'manage_discounts' && canManage ? (
        <AdminDiscountsPage />
      ) : currentTab === 'store' ? (
        <DiscountsPage />
      ) : currentTab === 'purchases' ? (
        <MyDiscountsPage />
      ) : (
        <>
          {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="page-title text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              محفظة وسجل معاملات O Coins
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FFCF00]/15 text-[#B28900] dark:text-[#FFCF00] border border-[#FFCF00]/30">
              🪙 Rewards Hub
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            {canManage
              ? 'سجل المعاملات المعتمدة، صرف المكافآت التقديرية، وتعديلات الأرصدة الإدارية الشاملة.'
              : 'دفتر حساباتك الشفاف: كافة المكافآت المكتسبة، مكافآت المهام، والتعديلات الإدارية مع تفاصيلها.'}
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setShowAdjustModal(true)}
            variant="primary"
            className="w-full sm:w-auto justify-center gap-2 shadow-xs shrink-0 font-black text-xs h-10 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            <span>صرف مكافأة / تعديل رصيد يدوي</span>
          </Button>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Current Balance */}
        <div className="card p-5 rounded-2xl flex items-center justify-between shadow-xs border-[var(--brand-warm)]/30">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">
              {canManage && selectedUser
                ? `رصيد (${selectedUser.displayName})`
                : hasUnlimitedCoins(role)
                ? (isHead ? 'رصيد رئيس اللجنة (خزينة غير محدودة)' : 'رصيد القيادة العليا (خزينة المنظومة)')
                : 'الرصيد الكلي المتاح'}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              {canManage && selectedUser ? (
                hasUnlimitedCoins(selectedUser.role) ? (
                  <div className="flex items-center gap-2">
                    <span className="text-4xl font-black text-[var(--brand-warm)]">∞</span>
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      خزينة لا نهائية
                    </span>
                  </div>
                ) : (
                  <p className="text-3xl font-black text-[var(--text-primary)]">
                    {formatOCoins(selectedUser.oCoinsBalance ?? 0)}
                    <span className="text-sm font-bold text-[var(--brand-warm)] mr-1.5">OC</span>
                  </p>
                )
              ) : hasUnlimitedCoins(role) ? (
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-black text-[var(--brand-warm)]">∞</span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    خزينة لا نهائية
                  </span>
                </div>
              ) : (
                <p className="text-3xl font-black text-[var(--text-primary)]">
                  {formatOCoins(userProfile?.oCoinsBalance ?? 0)}
                  <span className="text-sm font-bold text-[var(--brand-warm)] mr-1.5">OC</span>
                </p>
              )}
            </div>
          </div>
          <div className="w-12 h-12 bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] rounded-2xl flex items-center justify-center border border-[var(--brand-warm)]/30 shrink-0">
            <Coins className="h-6 w-6" />
          </div>
        </div>

        {/* Total Earned */}
        <div className="card p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">
              {viewingUnlimitedUser ? 'عمليات الإيداع المسجَّلة' : 'إجمالي العملات المكتسبة'}
            </p>
            {viewingUnlimitedUser ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-4xl font-black text-[var(--brand-accent)]">∞</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  خزينة لا نهائية
                </span>
              </div>
            ) : (
              <p className="text-3xl font-black text-[var(--brand-accent)] mt-1">
                +{formatOCoins(totalEarned ?? 0)}
                <span className="text-sm font-bold text-[var(--brand-accent)]/80 mr-1.5">OC</span>
              </p>
            )}
          </div>
          <div className="w-12 h-12 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] rounded-2xl flex items-center justify-center border border-[var(--brand-accent)]/20 shrink-0">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Total Spent / Deducted */}
        <div className="card p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">
              {viewingUnlimitedUser ? 'عمليات الخصم المسجَّلة' : 'إجمالي الخصومات والمصروفات'}
            </p>
            {viewingUnlimitedUser ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-4xl font-black text-[var(--brand-danger)]">—</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30">
                  لا تؤثر على الرصيد
                </span>
              </div>
            ) : (
              <p className="text-3xl font-black text-[var(--brand-danger)] mt-1">
                -{formatOCoins(totalSpent ?? 0)}
                <span className="text-sm font-bold text-[var(--brand-danger)]/80 mr-1.5">OC</span>
              </p>
            )}
          </div>
          <div className="w-12 h-12 bg-[var(--brand-danger)]/10 text-[var(--brand-danger)] rounded-2xl flex items-center justify-center border border-[var(--brand-danger)]/20 shrink-0">
            <TrendingDown className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Admin Employee Filter Carousel */}
      {canManage && (isTopLeader ? allUsers.length > 0 : manageableUsers.length > 0) && (
        <div className="card p-4 rounded-2xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {isHead ? `تصفية حسب أعضاء لجنة ${userProfile?.committeeName || ''}:` : 'تصفية السجل المالي حسب عضو الفريق:'}
            </h2>
            {selectedUser && (
              <button
                onClick={() => setSelectedUser(null)}
                className="text-xs text-[var(--brand-primary)] hover:text-[var(--brand-accent)] font-bold hover:underline cursor-pointer"
              >
                إلغاء التحديد وتصفح الكل
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setSelectedUser(null)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer',
                !selectedUser
                  ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {isHead ? `كافة أعضاء اللجنة (${manageableUsers.length})` : `كافة أعضاء الفريق (${allUsers.length})`}
            </button>
            {(isHead ? manageableUsers : allUsers).map((u) => (
              <button
                key={u.uid}
                onClick={() => setSelectedUser(selectedUser?.uid === u.uid ? null : u)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer border',
                  selectedUser?.uid === u.uid
                    ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-xs'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                )}
              >
                <Avatar name={formatFullName(u.displayName || u.username || 'User')} size="xs" />
                <span>{formatFullName(u.displayName || u.username || '')}</span>
                <span className="text-[10px] font-bold text-[var(--brand-warm)]">
                  ({hasUnlimitedCoins(u.role) ? '∞' : formatOCoins(u.oCoinsBalance ?? 0)})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Section & Table */}
      <div className="card rounded-3xl overflow-hidden shadow-xs space-y-4 p-5">
        {/* Search & Tabs Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'كافة المعاملات' },
              { id: 'rewards', label: 'المكافآت والإيداعات (+)' },
              { id: 'deductions', label: 'الخصومات والمصروفات (-)' },
              { id: 'tasks', label: 'مكافآت المهام 🎯' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer',
                  activeTab === tab.id
                    ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 md:max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="ابحث بالسبب، الوصف، أو المسؤول..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-4 py-2 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>
        </div>

        {/* List of Transactions */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            جاري تحميل سجل المعاملات المالية المعتمدة...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={<Coins className="h-10 w-10 text-[#FFCF00]" />}
            title="لا توجد حركات أو معاملات مسجلة"
            description="يتم تسجيل المعاملات في هذا الأرشيف فور اعتماد المهام وصرف المكافآت أو عند اتخاذ أي إجراء إداري معتمد."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#241a49] -mx-5 -mb-5">
            {filteredTransactions.map((tx) => {
              const cfg =
                TRANSACTION_TYPE_CONFIG[tx.type] ||
                (tx.amount > 0
                  ? TRANSACTION_TYPE_CONFIG.manual_reward
                  : TRANSACTION_TYPE_CONFIG.penalty_deduction);

              return (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTxForDetail(tx)}
                  className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-black shadow-xs transition-transform group-hover:scale-105',
                        tx.amount > 0
                          ? 'bg-[var(--brand-accent)]/15 text-[var(--brand-accent-dark)] dark:text-[var(--brand-accent)]'
                          : 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                      )}
                    >
                      {tx.amount > 0 ? <Plus className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-[var(--brand-primary)] dark:group-hover:text-[var(--brand-accent)] transition-colors">
                          {tx.reason || tx.taskTitle || 'معاملة رصيد'}
                        </p>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border',
                            cfg.badgeClass
                          )}
                        >
                          {cfg.icon}
                          <span>{cfg.label}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                        {canManage && (
                          <span className="font-bold text-slate-600 dark:text-slate-300">
                            العضو: {tx.userDisplayName} ·
                          </span>
                        )}
                        <span>بواسطة: {tx.createdByName || tx.createdBy || 'الإدارة'}</span>
                        <span>·</span>
                        <span>
                          {tx.createdAt
                            ? typeof tx.createdAt === 'string'
                              ? formatDate(tx.createdAt)
                              : formatRelative(tx.createdAt)
                            : 'الآن'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <p
                        className={cn(
                          'text-sm sm:text-base font-black',
                          tx.amount > 0
                            ? 'text-emerald-500 dark:text-emerald-400'
                            : 'text-rose-500'
                        )}
                      >
                        {tx.amount > 0 ? '+' : ''}
                        {tx.amount} OC
                      </p>
                      {typeof tx.newBalance === 'number' && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          الرصيد: {tx.newBalance} OC
                        </p>
                      )}
                    </div>

                    <div className="text-slate-400 group-hover:text-[var(--brand-primary)] dark:group-hover:text-[var(--brand-accent)] group-hover:translate-x-[-2px] transition-transform">
                      <ChevronLeft className="h-4 w-4" />
                    </div>

                    {canManage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(tx);
                        }}
                        title="حذف هذا السجل"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Transaction Details */}
      <Modal
        open={Boolean(selectedTxForDetail)}
        onClose={() => setSelectedTxForDetail(null)}
        title="تفاصيل وبيانات المعاملة المالية"
        description="سجل تدقيق كامل وموثق لعملية تحويل الـ O Coins."
        size="md"
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedTxForDetail(null)}
            className="text-xs"
          >
            إغلاق
          </Button>
        }
      >
        {selectedTxForDetail && (
          <div className="space-y-4 font-sans text-right dir-rtl">
            {/* Amount Banner */}
            <div
              className={cn(
                'p-5 rounded-2xl flex items-center justify-between border',
                selectedTxForDetail.amount > 0
                  ? 'bg-[var(--brand-accent)]/10 border-[var(--brand-accent)]/30 text-[var(--brand-accent-dark)] dark:text-[var(--brand-accent)]'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              )}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block opacity-80">
                  قيمة المعاملة
                </span>
                <span className="text-3xl font-black">
                  {selectedTxForDetail.amount > 0 ? '+' : ''}
                  {selectedTxForDetail.amount} O Coins
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-black/20 flex items-center justify-center font-bold">
                <Coins className="h-6 w-6" />
              </div>
            </div>

            {/* Information Grid */}
            <div className="space-y-3 text-xs bg-slate-50 dark:bg-[#181233] p-4 rounded-2xl border border-slate-200/80 dark:border-[#281e4b]">
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2">
                <span className="text-slate-400 font-bold">نوع المعاملة:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {TRANSACTION_TYPE_CONFIG[selectedTxForDetail.type]?.label || selectedTxForDetail.type}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2">
                <span className="text-slate-400 font-bold">عنوان / سبب الإجراء:</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {selectedTxForDetail.reason || selectedTxForDetail.taskTitle || '—'}
                </span>
              </div>

              {selectedTxForDetail.description && (
                <div className="border-b border-slate-200/60 dark:border-white/5 pb-2">
                  <span className="text-slate-400 font-bold block mb-1">الشرح والتفاصيل:</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-white dark:bg-[#130d29] p-2.5 rounded-xl border border-slate-200/60 dark:border-[#281e4b]">
                    {selectedTxForDetail.description}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2">
                <span className="text-slate-400 font-bold">صاحب الحساب (المستفيد):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedTxForDetail.userDisplayName} ({selectedTxForDetail.userEmail})
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2">
                <span className="text-slate-400 font-bold">تم الإجراء والاعتماد بواسطة:</span>
                <span className="font-bold text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">
                  {selectedTxForDetail.createdByName || selectedTxForDetail.createdBy}
                </span>
              </div>

              {typeof selectedTxForDetail.previousBalance === 'number' &&
                typeof selectedTxForDetail.newBalance === 'number' && (
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2">
                    <span className="text-slate-400 font-bold">تدرج الرصيد:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {selectedTxForDetail.previousBalance} OC ➜ {selectedTxForDetail.newBalance} OC
                    </span>
                  </div>
                )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400 font-bold">تاريخ ووقت المعاملة:</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  {selectedTxForDetail.createdAt ? formatDate(selectedTxForDetail.createdAt) : '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Admin Manual Adjustment */}
      <Modal
        open={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="صرف مكافأة / تعديل رصيد O Coins يدوياً"
        description="يتطلب التعديل اليدوي سبباً واضحاً وشرحاً لتوثيقه في سجل المعاملات وإشعار الموظف به."
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdjustModal(false)}
              disabled={adjusting}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleAdjust}
              loading={adjusting}
              size="sm"
              disabled={!adjustTarget || !adjustAmount || !adjustReason.trim()}
              className={cn(
                'text-xs font-bold',
                adjustType === 'penalty_deduction' || adjustType === 'manual_remove'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'btn-primary'
              )}
            >
              {adjustType === 'penalty_deduction' || adjustType === 'manual_remove'
                ? 'تأكيد خصم الرصيد'
                : 'تأكيد صرف المكافأة'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-right font-sans dir-rtl">
          {isHead && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 font-bold flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="leading-relaxed">
                <span>صلاحيتك كرئيس لجنة <strong>{userProfile?.committeeName || ''}</strong>: تقتصر حصراً على أعضاء ونائب رئيس لجنتك. محظور صرف كوينز لنفسك أو خارج لجنتك.</span>
              </div>
            </div>
          )}

          {/* Target employee */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              {isHead ? `اختر عضو لجنة ${userProfile?.committeeName || ''} المستهدف *` : 'اختر عضو الفريق المستهدف *'}
            </label>
            <div className="border border-[var(--border-subtle)] rounded-2xl overflow-hidden bg-[var(--bg-surface)]">
              <div className="p-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40">
                <Input
                  placeholder="ابحث باسم العضو أو المعرف..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4 text-[var(--text-muted)]" />}
                />
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                {filteredTargetUsers.map((u) => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => setAdjustTarget(u)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2 text-right hover:bg-[var(--bg-elevated)]/60 cursor-pointer transition-colors',
                      adjustTarget?.uid === u.uid &&
                        'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={formatFullName(u.displayName || u.username || 'User')} size="xs" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {formatFullName(u.displayName)}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate font-mono">
                          @{u.username || u.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[var(--brand-warm)] shrink-0">
                      {hasUnlimitedCoins(u.role) ? '∞' : formatOCoins(u.oCoinsBalance ?? 0)} OC
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {adjustTarget && (
              <p className="text-xs text-[var(--brand-primary)] font-bold mt-1.5">
                ✓ العضو المختار: {formatFullName(adjustTarget.displayName)} (@{adjustTarget.username || adjustTarget.email})
              </p>
            )}
          </div>

          {/* Action Type */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              تصنيف المعاملة والسبب الرئيسي *
            </label>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as OCoinTransactionType)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            >
              <option value="manual_reward">🌟 مكافأة تميز وأداء استثنائي (+)</option>
              <option value="meeting_reward">📅 مكافأة حضور اجتماع هام (+)</option>
              <option value="achievement_reward">🏆 مكافأة إنجاز استثنائي (+)</option>
              <option value="manual_add">➕ إيداع رصيد إداري عام (+)</option>
              <option value="admin_adjustment">⚙️ تدقيق وتعديل إداري للرصيد</option>
              <option value="penalty_deduction">⚠️ خصم / جزاء إداري (-)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              عدد عملات O Coins *
            </label>
            <Input
              type="number"
              min="1"
              placeholder="مثال: 100"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              عنوان السبب المسجل *
            </label>
            <Input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="مثال: تميز استثنائي في إعداد التقرير النهائي"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              شرح وتفاصيل إضافية (تظهر للموظف في الإشعار والأرشيف)
            </label>
            <textarea
              rows={3}
              value={adjustDescription}
              onChange={(e) => setAdjustDescription(e.target.value)}
              placeholder="اكتب توضيحاً يشرح للعضو سبب منحه هذه المكافأة لتعزيز التحفيز والشفافية..."
              className="w-full p-3 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Single Transaction Modal */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTx}
        loading={deletingTx}
        title="حذف سجل المعاملة"
        description={`هل أنت متأكد من حذف سجل معاملة "${deleteTarget?.taskTitle || deleteTarget?.reason}" (${deleteTarget?.amount && deleteTarget.amount > 0 ? '+' : ''}${deleteTarget?.amount} OC)؟`}
        confirmLabel="حذف السجل"
        cancelLabel="إلغاء"
        variant="danger"
      />

      {/* Confirm Clear All Transactions Modal */}
      <ConfirmDialog
        open={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        onConfirm={handleClearAll}
        loading={clearingAll}
        title="مسح جميع سجلات معاملات O Coins"
        description="تحذير: هل أنت متأكد من رغبتك في مسح كافة سجلات وتاريخ معاملات O Coins بالكامل من النظام؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="نعم، مسح كل السجلات"
        cancelLabel="إلغاء"
        variant="danger"
      />
        </>
      )}
    </div>
  );
}
