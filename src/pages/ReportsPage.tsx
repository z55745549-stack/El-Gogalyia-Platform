import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, db } from '@/lib/supabase';
import {
  BarChart3,
  Download,
  Users,
  CheckCircle2,
  AlertTriangle,
  Coins,
  TrendingUp,
  Award,
  Crown,
  Filter,
  Clock,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { StatCard } from '@/components/ui/stat-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatOCoins, formatPercent, isOverdue, cn, formatFullName, hasUnlimitedCoins } from '@/utils';
import { subscribeCommittees } from '@/lib/committees';
import type { Task, UserProfile, OCoinTransaction, Committee } from '@/types';

type DateFilter = 'all' | 'today' | 'week' | 'month';

export function ReportsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [transactions, setTransactions] = useState<OCoinTransaction[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [committeeFilter, setCommitteeFilter] = useState<string>('');

  useEffect(() => {
    const unsubTasks = onSnapshot(query(collection(db, 'tasks')), (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    const unsubTx = onSnapshot(query(collection(db, 'oCoins')), (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OCoinTransaction)));
      setLoading(false);
    });

    const unsubComm = subscribeCommittees((list) => {
      setCommittees(list);
    });

    return () => {
      unsubTasks();
      unsubUsers();
      unsubTx();
      unsubComm();
    };
  }, []);

  const getDateThreshold = (): Date | null => {
    const now = new Date();
    if (dateFilter === 'today') { now.setHours(0, 0, 0, 0); return now; }
    if (dateFilter === 'week') { now.setDate(now.getDate() - 7); return now; }
    if (dateFilter === 'month') { now.setDate(now.getDate() - 30); return now; }
    return null;
  };

  const filterByDate = <T extends { createdAt?: any }>(items: T[]): T[] => {
    const threshold = getDateThreshold();
    if (!threshold) return items;
    return items.filter((i) => {
      if (!i.createdAt) return true;
      const d = i.createdAt.toDate ? i.createdAt.toDate() : new Date(i.createdAt);
      return d >= threshold;
    });
  };

  // Date and Committee filtering
  const filteredTasks = filterByDate(tasks).filter(
    (t) => !committeeFilter || t.committeeId === committeeFilter
  );
  const filteredTx = filterByDate(transactions);

  const totalOCoins = filteredTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const completedTasks = filteredTasks.filter((t) => t.status === 'approved' || t.status === 'completed');
  const activeTasks = filteredTasks.filter((t) => (t.status === 'pending' || t.status === 'in_progress') && !isOverdue(t.deadline, t.status));
  const overdueTasks = filteredTasks.filter((t) => isOverdue(t.deadline, t.status));
  const completionRate = filteredTasks.length > 0 ? (completedTasks.length / filteredTasks.length) * 100 : 0;

  // Committee performance analytics
  const committeeStats = committees.map((c) => {
    const cTasks = tasks.filter((t) => t.committeeId === c.id);
    const cCompleted = cTasks.filter((t) => t.status === 'approved' || t.status === 'completed').length;
    const cRate = cTasks.length > 0 ? (cCompleted / cTasks.length) * 100 : 0;
    return {
      id: c.id,
      name: c.name,
      totalTasks: cTasks.length,
      completedTasks: cCompleted,
      rate: cRate,
    };
  }).filter((c) => c.totalTasks > 0);

  // Employee Performance breakdown — EXCLUDES Lead, Co-Lead, and Committee Heads (unlimited coins)
  const employeeReports = users
    .filter((u) => !hasUnlimitedCoins(u.role))
    .filter((u) => !committeeFilter || u.committeeId === committeeFilter)
    .map((u) => {
      const ids = [u.uid, u.username || '', u.email || ''].filter(Boolean).map((v) => v.toLowerCase());
      const userTasks = filteredTasks.filter((t) => {
        const assigned = (t.assignedTo || []).map((a) => a.toLowerCase());
        return ids.some((id) => assigned.includes(id));
      });
      const completed = userTasks.filter((t) => t.status === 'approved' || t.status === 'completed').length;
      const overdue = userTasks.filter((t) => isOverdue(t.deadline, t.status)).length;
      const rate = userTasks.length > 0 ? (completed / userTasks.length) * 100 : 0;
      const userCoins = filteredTx
        .filter((t) => (ids.includes((t.userEmail || '').toLowerCase()) || t.uid === u.uid) && t.amount > 0)
        .reduce((s, t) => s + t.amount, 0);
      return { user: u, total: userTasks.length, completed, overdue, rate, coins: userCoins };
    })
    .sort((a, b) => b.completed - a.completed || b.coins - a.coins);

  // Top 3 Leaderboard
  const topPerformers = employeeReports.slice(0, 3);

  const exportCSV = () => {
    const rows = [
      ['اسم الموظف / العضو', 'المعرف', 'اللجنة', 'إجمالي المهام', 'المكتملة', 'المتأخرة', 'نسبة الإنجاز', 'مجموع O Coins'],
      ...employeeReports.map((r) => [
        `"${r.user.displayName || ''}"`,
        `"${r.user.email || r.user.username}"`,
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
    link.setAttribute('download', `gogalyia_reports_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير تقرير أداء فريق منصة الجوجالية بنجاح!');
  };

  const DATE_FILTERS: { label: string; value: DateFilter }[] = [
    { label: 'الكل', value: 'all' },
    { label: 'اليوم', value: 'today' },
    { label: 'هذا الأسبوع', value: 'week' },
    { label: 'هذا الشهر', value: 'month' },
  ];

  return (
    <div className="space-y-6 text-right animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--brand-primary)] to-cyan-500 text-white flex items-center justify-center shadow-md">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span>التقارير والإحصائيات الشاملة</span>
          </h1>
          <p className="text-[var(--text-muted)] text-xs sm:text-sm mt-1">
            مؤشرات أداء فريق منصة الجوجالية، نسب إنجاز التكليفات، وتوزيع مكافآت O Coins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Committee Filter */}
          <select
            value={committeeFilter}
            onChange={(e) => setCommitteeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] cursor-pointer"
          >
            <option value="">جميع اللجان</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <div className="flex gap-1 bg-[var(--surface-elevated)] p-1 rounded-xl border border-[var(--border-subtle)]">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setDateFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  dateFilter === f.value
                    ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Button variant="outline" onClick={exportCSV} className="gap-2 shadow-xs text-xs font-bold">
            <Download className="h-4 w-4 text-[var(--brand-primary)]" /> تصدير تقرير CSV
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { title: 'إجمالي الفريق', value: users.length, icon: <Users className="h-5 w-5 text-[var(--brand-primary)]" />, iconBg: 'bg-[var(--brand-primary)]/10' },
          { title: 'المهام المعروضة', value: filteredTasks.length, icon: <BarChart3 className="h-5 w-5 text-blue-500" />, iconBg: 'bg-blue-500/10' },
          { title: 'المهام المنجزة', value: completedTasks.length, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />, iconBg: 'bg-emerald-500/10' },
          { title: 'المهام المتأخرة', value: overdueTasks.length, icon: <AlertTriangle className="h-5 w-5 text-rose-500" />, iconBg: overdueTasks.length > 0 ? 'bg-rose-500/10' : 'bg-[var(--surface-elevated)]' },
          { title: 'معدل الإنجاز', value: formatPercent(completionRate), icon: <TrendingUp className="h-5 w-5 text-emerald-500" />, iconBg: 'bg-emerald-500/10' },
          { title: 'مكافآت O Coins', value: formatOCoins(totalOCoins), icon: <Coins className="h-5 w-5 text-amber-500" />, iconBg: 'bg-amber-500/10' },
        ].map((s) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Tasks Health Gauge */}
        <div className="card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-[var(--brand-primary)]" />
                توزيع حالة المهام
              </h2>
              <span className="text-xs text-[var(--text-muted)] font-mono">{filteredTasks.length} مهمة</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">نسبة الإنجاز مقارنة بالمهام الجارية والمتأخرة</p>
          </div>

          <div className="my-6 flex items-center justify-center">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[var(--surface-elevated)]"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 transition-all duration-1000 ease-out"
                  strokeDasharray={`${Math.round(completionRate)}, 100`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-[var(--text-primary)] font-mono">{Math.round(completionRate)}%</span>
                <span className="text-[10px] font-bold text-emerald-500">معدل الإنجاز</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-4 border-t border-[var(--border-subtle)]">
            <div>
              <p className="text-[10px] text-[var(--text-muted)] font-bold">مكتملة</p>
              <p className="font-extrabold text-emerald-500 mt-0.5">{completedTasks.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] font-bold">جارية</p>
              <p className="font-extrabold text-[var(--brand-primary)] mt-0.5">{activeTasks.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] font-bold">متأخرة</p>
              <p className="font-extrabold text-rose-500 mt-0.5">{overdueTasks.length}</p>
            </div>
          </div>
        </div>

        {/* Chart 2: Committee Performance Distribution */}
        <div className="card p-6 rounded-2xl flex flex-col justify-between lg:col-span-2">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-500" />
                معدل إنجاز اللجان والفرق
              </h2>
              <span className="text-xs text-[var(--text-muted)]">{committeeStats.length} لجان نشطة</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">مقارنة بصرية لكفاءة وسرعة تسليم كل لجنة للتكليفات</p>
          </div>

          <div className="my-4 space-y-3">
            {committeeStats.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-8">لا توجد بيانات لجان كافية للعرض.</p>
            ) : (
              committeeStats.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-primary)]">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-muted)]">{c.completedTasks} من {c.totalTasks} مهمة</span>
                      <span className="font-bold text-cyan-500 font-mono">{Math.round(c.rate)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-[var(--surface-elevated)] h-2.5 rounded-full overflow-hidden border border-[var(--border-subtle)]">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-[var(--brand-primary)] h-full rounded-full transition-all duration-1000"
                      style={{ width: `${c.rate}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
            <span>💡 يتم تحديث مؤشرات اللجان لحظياً بمجرد اعتماد المشرفين للتسليمات.</span>
          </div>
        </div>
      </div>

      {/* Top Performers Podium */}
      {topPerformers.length > 0 && (
        <div className="card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              لوحة شرف المتميزين (Top 3 Performers)
            </h2>
            <span className="text-xs text-[var(--text-muted)]">الأعلى إنجازاً للتكليفات</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {topPerformers.map((item, idx) => {
              const medals = [
                { rank: 'الأول 🥇', color: 'border-amber-400/50 bg-amber-500/10 text-amber-500', icon: '🏆' },
                { rank: 'الثاني 🥈', color: 'border-slate-300 dark:border-slate-700 bg-slate-500/10 text-slate-400', icon: '🥈' },
                { rank: 'الثالث 🥉', color: 'border-amber-700/50 bg-amber-700/10 text-amber-700 dark:text-amber-500', icon: '🥉' },
              ];
              const medal = medals[idx] || medals[0];
              return (
                <div
                  key={item.user.uid}
                  className={`p-4 rounded-2xl border ${medal.color} flex items-center gap-3.5 transition-transform hover:-translate-y-0.5`}
                >
                  <Avatar src={item.user.photoURL} name={item.user.displayName || item.user.username || 'User'} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{medal.rank}</span>
                      <span className="text-xs font-black text-amber-500 font-mono">+{formatOCoins(item.coins)} OC</span>
                    </div>
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate mt-0.5">
                      {formatFullName(item.user.displayName || 'عضو')}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      أنجز {item.completed} مهمة بنجاح
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Employee Breakdown Table */}
      <div className="card overflow-hidden rounded-2xl">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-elevated)]/50">
          <h2 className="text-sm font-extrabold text-[var(--text-primary)]">تفاصيل أداء أعضاء فريق العمل</h2>
          <span className="text-xs text-[var(--text-muted)] font-semibold">{employeeReports.length} عضواً</span>
        </div>
        {loading ? (
          <div className="p-12 text-center text-[var(--text-muted)] text-sm">جاري تجميع وحساب بيانات التقارير...</div>
        ) : employeeReports.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-muted)] text-sm">لا توجد سجلات أعضاء حالياً.</div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] overflow-x-auto">
            {employeeReports.map(({ user, total, completed, overdue, rate, coins }) => (
              <div key={user.uid} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--surface-elevated)]/40 transition-colors min-w-[600px] sm:min-w-0">
                <div className="flex items-center gap-3.5 sm:w-64 min-w-0">
                  <Avatar src={user.photoURL} name={formatFullName(user.displayName || user.username || 'User')} size="md" />
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--text-primary)] truncate text-sm">{formatFullName(user.displayName || 'عضو الفريق')}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate font-mono">@{user.username || user.email}</p>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">المسندة</span>
                    <strong className="text-sm font-extrabold text-[var(--text-primary)]">{total}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">المكتملة</span>
                    <strong className="text-sm font-extrabold text-emerald-500">{completed}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">نسبة الإنجاز</span>
                    <strong className="text-sm font-extrabold text-[var(--brand-primary)]">{formatPercent(rate)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">O Coins</span>
                    <strong className="text-sm font-extrabold text-amber-500">
                      {hasUnlimitedCoins(user.role) ? '∞' : formatOCoins(coins)}
                    </strong>
                  </div>
                </div>

                {overdue > 0 && (
                  <div className="shrink-0">
                    <span className="badge bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-bold px-2.5 py-1 rounded-lg">
                      <AlertTriangle className="h-3.5 w-3.5 ml-1 inline" /> {overdue} متأخرة
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
