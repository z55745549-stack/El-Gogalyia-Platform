import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, onSnapshot, db } from '@/lib/supabase';
import {
  Plus,
  Search,
  CheckSquare,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Inbox,
  Sparkles,
  Archive
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { deleteTask, endTask, archiveTask } from '@/lib/database-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { isAdminRole } from '@/utils/permissions';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { formatDate, safeDate, isOverdue, cn } from '@/utils';
import type { Task } from '@/types';

const PRIORITY_OPTIONS = [
  { value: '', label: 'جميع الأولويات' },
  { value: 'urgent', label: '🔴 عاجل' },
  { value: 'high', label: '🟠 عالي' },
  { value: 'medium', label: '🟡 متوسط' },
  { value: 'low', label: '🟢 منخفض' },
];

export function TasksPage() {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<string>('all'); // all, active, submitted, completed, expired, archived
  const [priorityFilter, setPriorityFilter] = useState('');

  // Task Actions State
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [endTarget, setEndTarget] = useState<Task | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Task | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let lastFsTasks: Task[] = [];
    const loadTasks = (fsTasks: Task[]) => {
      lastFsTasks = fsTasks;
      const localTasks: Task[] = JSON.parse(localStorage.getItem('elgogalyia_local_tasks') || '[]');
      const map = new Map<string, Task>();
      fsTasks.forEach((t) => map.set(t.id, t));
      localTasks.forEach((t) => {
        if (!map.has(t.id)) map.set(t.id, t);
      });

      const allSorted = Array.from(map.values()).sort(
        (a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime()
      );
      setTasks(allSorted);
      setLoading(false);
    };

    const q = query(collection(db, 'tasks'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fsTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
        loadTasks(fsTasks);
      },
      (err) => {
        console.warn('TasksPage snapshot notice:', err);
        loadTasks([]);
      }
    );

    const handleDataChange = () => {
      loadTasks(lastFsTasks);
    };
    window.addEventListener('elgogalyia_data_change', handleDataChange);

    return () => {
      unsub();
      window.removeEventListener('elgogalyia_data_change', handleDataChange);
    };
  }, []);

  const handleDeleteTask = async () => {
    if (!deleteTarget || !userProfile) return;
    setActionLoading(true);
    const targetId = deleteTarget.id;
    const targetTitle = deleteTarget.title;
    try {
      setTasks((prev) => prev.filter((t) => t.id !== targetId));
      await deleteTask(targetId, targetTitle, {
        email: userProfile.username || userProfile.email || 'admin',
        displayName: userProfile.displayName,
      });
      toast.success(`تم حذف المهمة "${targetTitle}" بنجاح!`);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف المهمة.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndTask = async () => {
    if (!endTarget || !userProfile) return;
    setActionLoading(true);
    try {
      await endTask(endTarget.id, {
        email: userProfile.username || userProfile.email || 'admin',
        displayName: userProfile.displayName,
      });
      toast.success(`تم إنهاء المهمة "${endTarget.title}" وإغلاق باب التسليمات بنجاح.`);
      setEndTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('فشل إنهاء المهمة.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveTask = async () => {
    if (!archiveTarget || !userProfile) return;
    setActionLoading(true);
    try {
      await archiveTask(archiveTarget.id, {
        email: userProfile.username || userProfile.email || 'admin',
        displayName: userProfile.displayName,
      });
      toast.success(`تم نقل المهمة "${archiveTarget.title}" إلى الأرشيف.`);
      setArchiveTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('فشل أرشفة المهمة.');
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics
  const activeCount = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
  const submittedCount = tasks.filter((t) => t.status === 'submitted').length;
  const completedCount = tasks.filter((t) => t.status === 'approved' || t.status === 'completed').length;
  const expiredCount = tasks.filter((t) => t.status === 'expired' || isOverdue(t.deadline, t.status)).length;
  const archivedCount = tasks.filter((t) => t.status === 'archived').length;

  const filtered = tasks.filter((t) => {
    const matchSearch =
      !search ||
      (t.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase());

    let matchTab = true;
    if (statusTab === 'active') {
      matchTab = (t.status === 'pending' || t.status === 'in_progress') && !isOverdue(t.deadline, t.status);
    } else if (statusTab === 'submitted') {
      matchTab = t.status === 'submitted';
    } else if (statusTab === 'completed') {
      matchTab = t.status === 'approved' || t.status === 'completed';
    } else if (statusTab === 'expired') {
      matchTab = t.status === 'expired' || isOverdue(t.deadline, t.status);
    } else if (statusTab === 'archived') {
      matchTab = t.status === 'archived';
    }

    const matchPriority = !priorityFilter || t.priority === priorityFilter;
    return matchSearch && matchTab && matchPriority;
  });

  const canCreate = userProfile ? isAdminRole(userProfile.role) : false;

  return (
    <div className="space-y-6 font-sans text-right dir-rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#140e29] p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm transition-colors">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-amber-500" /> إدارة وتكليف المهام
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            إجمالي {tasks.length} مهمة مسجلة بالنظام · {submittedCount} بانتظار الاعتماد
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {submittedCount > 0 && (
            <Link to="/submitted-tasks">
              <Button size="sm" variant="outline" className="gap-2 border-amber-300 text-amber-600 dark:text-amber-400 text-xs font-bold">
                <Inbox className="h-4 w-4" /> مراجعة التسليمات ({submittedCount})
              </Button>
            </Link>
          )}
          {canCreate && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="gap-2 font-black text-xs py-2.5 px-4 rounded-xl shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" /> إنشاء مهمة جديدة
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200 dark:border-white/10">
        {[
          { id: 'all', label: 'جميع المهام', count: tasks.length },
          { id: 'active', label: 'المهام النشطة', count: activeCount },
          { id: 'submitted', label: 'تم التسليم', count: submittedCount, alert: submittedCount > 0 },
          { id: 'completed', label: 'المكتملة والمنتهية', count: completedCount },
          { id: 'expired', label: 'منتهية الموعد', count: expiredCount },
          { id: 'archived', label: 'المؤرشفة', count: archivedCount },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusTab(tab.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer',
              statusTab === tab.id
                ? 'bg-[var(--brand-primary)] text-white shadow-md shadow-[var(--brand-primary)]/25 font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-black',
                statusTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300',
                tab.alert && statusTab !== tab.id && 'bg-[var(--brand-danger)] text-white animate-pulse'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-[#140e29] p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col sm:flex-row gap-3 transition-colors">
        <div className="flex-1">
          <Input
            placeholder="البحث باسم المهمة أو الوصف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-slate-400" />}
          />
        </div>
        <div className="w-full sm:w-60">
          <Select
            options={PRIORITY_OPTIONS}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Task Table - Desktop & Mobile */}
      <div className="bg-white dark:bg-[#140e29] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm overflow-hidden transition-colors">
        {loading ? (
          <SkeletonTable rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-8 w-8 text-slate-400" />}
            title="لا توجد مهام مطابقة"
            description={
              search || statusTab !== 'all' || priorityFilter
                ? 'جرّب تغيير خيارات البحث أو التبويب.'
                : 'ابدأ بإنشاء أول مهمة للموظفين.'
            }
            action={
              canCreate ? (
                <Button
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  className="gap-2 font-bold"
                >
                  <Plus className="h-4 w-4" /> إنشاء مهمة
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="p-4">بيانات المهمة</th>
                    <th className="p-4">المكلفون بها</th>
                    <th className="p-4">الأولوية</th>
                    <th className="p-4">الموعد النهائي</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                  {filtered.map((task) => {
                    const overdue = isOverdue(task.deadline, task.status);
                    const isClosed =
                      task.status === 'completed' || task.status === 'expired' || task.status === 'archived';

                    return (
                      <tr
                        key={task.id}
                        className={cn(
                          'hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors',
                          overdue && 'bg-rose-50/20 dark:bg-rose-950/10'
                        )}
                      >
                        <td className="p-4 max-w-xs">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{task.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {task.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-[var(--brand-warm)] inline-block bg-[var(--brand-warm)]/10 px-2 py-0.5 rounded-lg border border-[var(--brand-warm)]/20">
                              🪙 {task.oCoinsReward} OC
                            </span>
                            {task.committeeName && (
                              <span className="text-[11px] font-bold text-[var(--brand-primary)] inline-block bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-lg border border-[var(--brand-primary)]/20">
                                🏛 {task.committeeName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1 flex-wrap">
                            {(task.assignedToNames || task.assignedTo || []).map((name, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-md"
                              >
                                <Avatar name={name} size="xs" />
                                {name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <PriorityBadge priority={task.priority} />
                        </td>
                        <td className="p-4">
                          <span
                            className={cn(
                              'text-xs font-bold',
                              overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'
                            )}
                          >
                            {formatDate(task.deadline)}
                          </span>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={task.status} overdue={overdue} />
                        </td>
                        <td className="p-4 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link to={`/tasks/${task.id}`}>
                              <Button size="sm" variant="outline" className="text-xs gap-1.5">
                                <ExternalLink className="h-3.5 w-3.5" /> التفاصيل
                              </Button>
                            </Link>

                            {/* End Task Action */}
                            {canCreate && !isClosed && (
                              <button
                                onClick={() => setEndTarget(task)}
                                title="إنهاء المهمة وإغلاق التسليمات"
                                className="p-2 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}

                            {/* Archive Task Action */}
                            {canCreate && task.status !== 'archived' && (
                              <button
                                onClick={() => setArchiveTarget(task)}
                                title="أرشفة المهمة"
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                            )}

                            {/* Delete Task Action */}
                            {canCreate && (
                              <button
                                onClick={() => setDeleteTarget(task)}
                                title="حذف المهمة نهائياً"
                                className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-slate-100 dark:divide-white/5">
              {filtered.map((task) => {
                const overdue = isOverdue(task.deadline, task.status);
                const isClosed =
                  task.status === 'completed' || task.status === 'expired' || task.status === 'archived';

                return (
                  <div
                    key={`m-${task.id}`}
                    className={`p-4 space-y-3 ${overdue ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight flex-1">
                        {task.title}
                      </h3>
                      <StatusBadge status={task.status} overdue={overdue} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{task.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <PriorityBadge priority={task.priority} />
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[var(--brand-warm)]/15 text-[var(--brand-warm)] border border-[var(--brand-warm)]/30">
                        🪙 {task.oCoinsReward} OC
                      </span>
                      {task.committeeName && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border border-[var(--brand-primary)]/20">
                          🏛 {task.committeeName}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold ${
                          overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {formatDate(task.deadline)}
                      </span>
                    </div>
                    {(task.assignedToNames || []).length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(task.assignedToNames || []).slice(0, 3).map((n, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-full"
                          >
                            <Avatar name={n} size="xs" />
                            {n}
                          </span>
                        ))}
                        {(task.assignedToNames || []).length > 3 && (
                          <span className="text-[11px] text-slate-400">+{task.assignedToNames.length - 3}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Link to={`/tasks/${task.id}`} className="flex-1">
                        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
                          <ExternalLink className="h-3.5 w-3.5" /> التفاصيل
                        </Button>
                      </Link>
                      {canCreate && !isClosed && (
                        <button
                          onClick={() => setEndTarget(task)}
                          title="إنهاء المهمة"
                          className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      {canCreate && (
                        <button
                          onClick={() => setDeleteTarget(task)}
                          title="حذف المهمة"
                          className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <TaskFormModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />

      {/* Confirm End Task Dialog */}
      <ConfirmDialog
        open={Boolean(endTarget)}
        onClose={() => setEndTarget(null)}
        onConfirm={handleEndTask}
        title="تأكيد إنهاء المهمة"
        description={`هل تريد إنهاء المهمة "${endTarget?.title}"؟ إنهاء المهمة سيغلق باب رفع التسليمات الجديدة ويحتفظ بجميع التسليمات والإحصائيات الحالية.`}
        confirmLabel="إنهاء المهمة الآن"
        cancelLabel="إلغاء"
        variant="warning"
        loading={actionLoading}
      />

      {/* Confirm Archive Dialog */}
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveTask}
        title="تأكيد أرشفة المهمة"
        description={`هل تريد نقل المهمة "${archiveTarget?.title}" إلى الأرشيف؟`}
        confirmLabel="أرشفة"
        cancelLabel="إلغاء"
        variant="default"
        loading={actionLoading}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTask}
        title="تأكيد حذف المهمة"
        description={`هل أنت متأكد من حذف المهمة "${deleteTarget?.title}"؟ سيتم حذف المهمة نهائياً من جميع اللوحات وشاشات الموظفين.`}
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
