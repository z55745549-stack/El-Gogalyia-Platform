import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, db } from '@/lib/supabase';
import { CheckSquare, Calendar, Coins, ArrowLeft, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatDate, isOverdue, cn, safeDate } from '@/utils';
import { getUserTaskStatus } from '@/lib/database-service';
import type { Task, TaskStatus } from '@/types';

const TABS = [
  { label: 'جميع مهامي', value: 'all' },
  { label: 'قيد التنفيذ والانتظار', value: 'pending' },
  { label: 'تم تسليمها', value: 'submitted' },
  { label: 'مكتملة وموافق عليها', value: 'approved' },
  { label: 'متأخرة', value: 'overdue' },
];

export function MyTasksPage() {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const uid = userProfile?.uid || '';
  const usernameLower = (userProfile?.username || '').toLowerCase();
  const emailLower = (userProfile?.email || '').toLowerCase();
  const genUid = ('user_' + (userProfile?.username || '').replace(/[^a-z0-9]/g, '_')).toLowerCase();
  const uniqueIds = Array.from(new Set([uid, usernameLower, emailLower, genUid].filter(Boolean)));

  useEffect(() => {
    if (!userProfile?.uid && !userProfile?.username && !userProfile?.email) return;

    const isTaskAssignedToUser = (task: Task): boolean => {
      const assigned = (task.assignedTo || []).map((u: string) => u.toLowerCase().trim());
      return uniqueIds.some((id) => assigned.includes(id));
    };

    const loadTasks = (fsTasks: Task[]) => {
      const localTasks: Task[] = JSON.parse(localStorage.getItem('elgogalyia_local_tasks') || '[]');
      const userLocalTasks = localTasks.filter((t) => isTaskAssignedToUser(t));

      const map = new Map<string, Task>();
      fsTasks.forEach((t) => {
        if (isTaskAssignedToUser(t)) map.set(t.id, t);
      });
      userLocalTasks.forEach((t) => {
        if (!map.has(t.id)) map.set(t.id, t);
      });
      const sorted = Array.from(map.values()).sort(
        (a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime()
      );
      setTasks(sorted);
      setLoading(false);
    };

    let fsTasksById: Record<string, Task[]> = {};
    const unsubs: (() => void)[] = [];

    const refresh = () => {
      const merged = Object.values(fsTasksById).flat();
      const seen = new Map<string, Task>();
      merged.forEach((t) => seen.set(t.id, t));
      loadTasks(Array.from(seen.values()));
    };

    uniqueIds.forEach((id) => {
      const q = query(collection(db, 'tasks'), where('assignedTo', 'array-contains', id));
      const unsub = onSnapshot(
        q,
        (snap) => {
          fsTasksById[id] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
          refresh();
        },
        (err) => {
          console.warn(`MyTasksPage snapshot notice for ${id}:`, err);
          fsTasksById[id] = [];
          refresh();
        }
      );
      unsubs.push(unsub);
    });

    const handleDataChange = () => {
      refresh();
    };
    window.addEventListener('elgogalyia_data_change', handleDataChange);

    return () => {
      unsubs.forEach((u) => u());
      window.removeEventListener('elgogalyia_data_change', handleDataChange);
    };
  }, [userProfile?.uid, userProfile?.username, userProfile?.email]);

  const completedCount = tasks.filter((t) => {
    const st = getUserTaskStatus(t, uniqueIds).status;
    return st === 'approved';
  }).length;

  const overdueCount = tasks.filter((t) => {
    const st = getUserTaskStatus(t, uniqueIds).status;
    return isOverdue(t.deadline, st as any);
  }).length;

  const filtered = tasks.filter((t) => {
    const userStatusObj = getUserTaskStatus(t, uniqueIds);
    const personalStatus = userStatusObj.status;

    if (activeTab === 'all') return true;
    if (activeTab === 'overdue') return isOverdue(t.deadline, personalStatus as any);
    if (activeTab === 'pending') return personalStatus === 'pending' || personalStatus === 'in_progress' || personalStatus === 'rejected';
    if (activeTab === 'submitted') return personalStatus === 'submitted';
    if (activeTab === 'approved') return personalStatus === 'approved';
    return personalStatus === activeTab;
  });

  return (
    <div className="space-y-6 font-sans text-right dir-rtl">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white shadow-xl bg-gradient-to-r from-[#1E1B4B] via-[#0F172A] to-[#1E1B4B] border border-indigo-500/25">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/20 mb-3">
            <CheckSquare className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
            <span>مهامي الشخصية</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            مهامي وتكليفاتي الخاصة
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1.5 font-medium">
            إجمالي {tasks.length} مهمة مسندة إليك · {completedCount} تم إنجازها بنجاح 🚀
          </p>
        </div>
        <div className="absolute -left-8 -bottom-8 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {userProfile?.status === 'suspended' && (
        <div className="rounded-2xl p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-900 dark:text-rose-200">
          <ShieldAlert className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">الحساب معلق مؤقتاً</p>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed">
              لا يمكنك رفع تسليمات للمهام أو اكتساب عملات O-Coins خلال فترة التعليق. يرجى مراجعة إدارة المنصة.
            </p>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="card overflow-hidden transition-colors">
        {/* Tabs */}
        <div className="flex overflow-x-auto scrollbar-none snap-x border-b border-[var(--border-subtle)] px-2 sm:px-4 pt-2 bg-[var(--bg-elevated)]/20">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'snap-start shrink-0 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap -mb-px cursor-pointer active:scale-95',
                activeTab === tab.value
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] font-black'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              {tab.label}
              {tab.value === 'overdue' && overdueCount > 0 && (
                <span className="mr-1.5 px-1.5 py-0.5 bg-[var(--brand-danger)]/15 text-[var(--brand-danger)] text-[10px] font-black rounded-full">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3.5 sm:p-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="h-8 w-8 text-slate-400" />}
              title="لا توجد مهام في هذا التصنيف"
              description="تصفح التبويبات الأخرى أو انتظر إسناد مهام جديدة إليك من الإدارة."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((task) => {
                const userStatusObj = getUserTaskStatus(task, uniqueIds);
                const personalStatus = userStatusObj.status as TaskStatus;
                const overdue = isOverdue(task.deadline, personalStatus);

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'p-4 sm:p-5 rounded-2xl border hover:shadow-md transition-all bg-[var(--bg-elevated)]/40',
                      overdue
                        ? 'border-[var(--brand-danger)]/40 bg-[var(--brand-danger)]/[0.04]'
                        : 'border-[var(--border-subtle)]'
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={personalStatus} overdue={overdue} />
                          <span className="text-[10px] font-bold text-[var(--text-muted)]">
                            (مسندة إليك أنت فقط 🔒)
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] leading-snug">
                          {task.title}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                        <div className="flex items-center gap-3 pt-1 flex-wrap">
                          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <Calendar className="h-3.5 w-3.5" /> الموعد النهائي: {formatDate(task.deadline)}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-bold text-[var(--brand-warm)] bg-[var(--brand-warm)]/10 px-2 py-0.5 rounded-lg border border-[var(--brand-warm)]/25">
                            <Coins className="h-3.5 w-3.5 text-[var(--brand-warm)]" /> {task.oCoinsReward} OC
                          </span>
                        </div>
                      </div>

                      <Link to={`/my-tasks/${task.id}`} className="w-full sm:w-auto flex-shrink-0">
                        <Button
                          size="sm"
                          className="w-full sm:w-auto font-black text-xs gap-1.5 shadow-sm rounded-xl py-2.5"
                        >
                          فتح المهمة وتسليمها
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
