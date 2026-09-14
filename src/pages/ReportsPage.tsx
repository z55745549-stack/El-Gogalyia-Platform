import { useState, useEffect } from 'react';
import { collection, getDocs, db } from '@/lib/supabase';
import { BarChart3, Download, Users, CheckCircle, AlertTriangle, Coins, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { StatCard } from '@/components/ui/stat-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatOCoins, formatPercent, isOverdue, cn } from '@/utils';
import type { Task, UserProfile, OCoinTransaction } from '@/types';

type DateFilter = 'all' | 'today' | 'week' | 'month';

export function ReportsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [transactions, setTransactions] = useState<OCoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const [taskSnap, userSnap, txSnap] = await Promise.all([
          getDocs(collection(db, 'tasks')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'oCoins')),
        ]);
        setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
        setUsers(userSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile)));
        setTransactions(txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as OCoinTransaction)));
      } catch (err) {
        console.error('ReportsPage fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
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

  const filteredTasks = filterByDate(tasks);
  const filteredTx = filterByDate(transactions);

  const totalOCoins = filteredTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const completedTasks = filteredTasks.filter((t) => t.status === 'approved' || t.status === 'completed');
  const overdueTasks = filteredTasks.filter((t) => isOverdue(t.deadline, t.status));
  const completionRate = filteredTasks.length > 0 ? (completedTasks.length / filteredTasks.length) * 100 : 0;

  const employeeReports = users.map((u) => {
    const ids = [u.uid, u.username || '', u.email || ''].filter(Boolean).map((v) => v.toLowerCase());
    const userTasks = filteredTasks.filter((t) => {
      const assigned = (t.assignedTo || []).map((a) => a.toLowerCase());
      return ids.some((id) => assigned.includes(id));
    });
    const completed = userTasks.filter((t) => t.status === 'approved' || t.status === 'completed').length;
    const overdue = userTasks.filter((t) => isOverdue(t.deadline, t.status)).length;
    const rate = userTasks.length > 0 ? (completed / userTasks.length) * 100 : 0;
    const userCoins = filteredTx.filter((t) => (ids.includes((t.userEmail || '').toLowerCase()) || t.uid === u.uid) && t.amount > 0).reduce((s, t) => s + t.amount, 0);
    return { user: u, total: userTasks.length, completed, overdue, rate, coins: userCoins };
  }).sort((a, b) => b.total - a.total);

  const exportCSV = () => {
    const rows = [
      ['اسم الموظف / العضو', 'البريد الإلكتروني / المعرف', 'إجمالي المهام', 'المكتملة', 'المتأخرة', 'نسبة الإنجاز', 'مجموع O Coins'],
      ...employeeReports.map((r) => [
        `"${r.user.displayName || ''}"`,
        `"${r.user.email || r.user.username}"`,
        r.total,
        r.completed,
        r.overdue,
        `"${r.rate.toFixed(1)}%"`,
        r.coins
      ])
    ];
    const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gdg_hitu_reports_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير تقرير أداء فريق GDG HITU بنجاح!');
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
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--brand-primary)] to-[var(--brand-accent)] text-white flex items-center justify-center shadow-md shadow-[var(--brand-primary)]/20">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span>التقارير والإحصائيات الشاملة</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            مؤشرات أداء فريق GDG HITU، نسب إنجاز التكليفات، وتوزيع مكافآت O Coins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setDateFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  dateFilter === f.value
                    ? 'bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={exportCSV} className="gap-2 shadow-xs text-xs">
            <Download className="h-4 w-4" /> تصدير تقرير CSV
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { title: 'إجمالي الفريق', value: users.length, icon: <Users className="h-5 w-5 text-[var(--brand-primary)] dark:text-[var(--brand-accent)]" />, iconBg: 'bg-[var(--brand-primary)]/10' },
          { title: 'المهام المعروضة', value: filteredTasks.length, icon: <BarChart3 className="h-5 w-5 text-blue-500" />, iconBg: 'bg-blue-500/10' },
          { title: 'المهام المنجزة', value: completedTasks.length, icon: <CheckCircle className="h-5 w-5 text-emerald-500" />, iconBg: 'bg-emerald-500/10' },
          { title: 'المهام المتأخرة', value: overdueTasks.length, icon: <AlertTriangle className="h-5 w-5 text-rose-500" />, iconBg: overdueTasks.length > 0 ? 'bg-rose-500/10' : 'bg-slate-500/10', className: overdueTasks.length > 0 ? 'border-rose-500/30' : '' },
          { title: 'معدل الإنجاز', value: formatPercent(completionRate), icon: <TrendingUp className="h-5 w-5 text-emerald-500" />, iconBg: 'bg-emerald-500/10' },
          { title: 'مكافآت O Coins', value: formatOCoins(totalOCoins), icon: <Coins className="h-5 w-5 text-amber-500" />, iconBg: 'bg-amber-500/10' },
        ].map((s) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </div>

      {/* Employee Breakdown */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">تفاصيل أداء أعضاء فريق العمل</h2>
          <span className="text-xs text-slate-400 font-semibold">{employeeReports.length} عضواً</span>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">جاري تجميع وحساب بيانات التقارير...</div>
        ) : employeeReports.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">لا توجد سجلات أعضاء حالياً.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5 overflow-x-auto">
            {employeeReports.map(({ user, total, completed, overdue, rate, coins }) => (
              <div key={user.uid} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors min-w-[600px] sm:min-w-0">
                <div className="flex items-center gap-3.5 sm:w-64 min-w-0">
                  <Avatar src={user.photoURL} name={user.displayName || user.username || 'User'} size="md" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate text-sm">{user.displayName || 'عضو الفريق'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">@{user.username || user.email}</p>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">المسندة</span>
                    <strong className="text-sm font-extrabold text-slate-900 dark:text-white">{total}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">المكتملة</span>
                    <strong className="text-sm font-extrabold text-emerald-500 dark:text-emerald-400">{completed}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">نسبة الإنجاز</span>
                    <strong className="text-sm font-extrabold text-[var(--brand-primary)] dark:text-[var(--brand-accent)]">{formatPercent(rate)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">O Coins</span>
                    <strong className="text-sm font-extrabold text-amber-500">{formatOCoins(coins)}</strong>
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
