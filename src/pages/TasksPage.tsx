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
  Archive,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
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
import { subscribeCommittees } from '@/lib/committees';
import type { Task, Committee } from '@/types';

const PRIORITY_OPTIONS = [
  { value: '', label: 'جميع الأولويات' },
  { value: 'urgent', label: '🔴 عاجل' },
  { value: 'high', label: '🟠 عالي' },
  { value: 'medium', label: '🟡 متوسط' },
  { value: 'low', label: '🟢 منخفض' },
];

export function TasksPage() {
  const { userProfile } = useAuth();
  const { t } = useLanguage();
  const isViceHead = userProfile?.role === 'vice_head';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [committeeFilter, setCommitteeFilter] = useState<string>(
    ((userProfile?.role === 'head' || userProfile?.role === 'vice_head') && userProfile?.committeeId) ? userProfile.committeeId : ''
  );
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
        try {
          localStorage.setItem('elgogalyia_local_tasks', JSON.stringify(fsTasks));
        } catch {}
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

    const unsubCommittees = subscribeCommittees((list) => {
      setCommittees(list);
    });

    return () => {
      unsub();
      unsubCommittees();
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
             toast.success(t('tasks.toast_deleted', 'تم حذف المهمة "{{title}}" بنجاح!').replace('{{title}}', targetTitle));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
       toast.error(t('tasks.toast_delete_error', 'حدث خطأ أثناء حذف المهمة.'));
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
      toast.success(t('tasks.toast_ended', 'تم إنهاء المهمة "{{title}}" وإغلاق باب التسليمات بنجاح.').replace('{{title}}', endTarget.title));
      setEndTarget(null);
    } catch (err) {
      console.error(err);
      toast.error(t('tasks.toast_end_error', 'فشل إنهاء المهمة.'));
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
      toast.success(t('tasks.toast_archived', 'تم نقل المهمة "{{title}}" إلى الأرشيف.').replace('{{title}}', archiveTarget.title));
      setArchiveTarget(null);
    } catch (err) {
      console.error(err);
      toast.error(t('tasks.toast_archive_error', 'فشل أرشفة المهمة.'));
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

    const isTopTier = userProfile?.role === 'lead' || userProfile?.role === 'co_lead';
    const matchPriority = !priorityFilter || t.priority === priorityFilter;
    const matchCommittee = !isTopTier
      ? (
          (userProfile?.committeeId && t.committeeId === userProfile.committeeId) ||
          (userProfile?.committeeName && t.committeeName && t.committeeName.trim().toLowerCase() === userProfile.committeeName.trim().toLowerCase())
        )
      : (!committeeFilter || t.committeeId === committeeFilter);
    return matchSearch && matchTab && matchPriority && matchCommittee;
  });

  const priorityOptions = PRIORITY_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t('tasks.prio_' + (opt.value || 'all'), opt.label),
  }));

  const isTopTier = userProfile?.role === 'lead' || userProfile?.role === 'co_lead';
  const canCreate = userProfile ? isAdminRole(userProfile.role) : false;

  return (
    <div className="space-y-6 font-sans text-right dir-rtl">
      {/* Top Header */}
      <div className="card p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-amber-500" />
             {!isTopTier ? t('tasks.title_committee', 'مهام وتكليفات لجنة {{name}}').replace('{{name}}', userProfile?.committeeName || t('tasks.committee_default', 'لجنتك')) : t('tasks.title_manage', 'إدارة وتكليف المهام')}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
             {isViceHead
               ? t('tasks.subtitle_vice', 'استعراض مهام ومشاريع أعضاء لجنتك ومتابعة التسليمات ({{count}} بانتظار الاعتماد)').replace('{{count}}', String(submittedCount))
               : t('tasks.subtitle_default', 'إجمالي {{total}} مهمة مسجلة بالنظام · {{count}} بانتظار الاعتماد').replace('{{total}}', String(tasks.length)).replace('{{count}}', String(submittedCount))}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {submittedCount > 0 && (
            <Link to="/submitted-tasks">
                 <Button size="sm" variant="outline" className="gap-2 border-amber-500/40 text-amber-500 text-xs font-bold">
                   <Inbox className="h-4 w-4" /> {t('tasks.btn_review_submissions', 'مراجعة التسليمات ({{count}})').replace('{{count}}', String(submittedCount))}
                 </Button>
            </Link>
          )}
          {canCreate && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="gap-2 font-black text-xs py-2.5 px-4 rounded-xl shadow-sm cursor-pointer"
            >
               <Plus className="h-4 w-4" /> {t('tasks.btn_create', 'إنشاء مهمة جديدة')}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 rounded-2xl flex items-center justify-between">
          <div>
             <p className="text-xs font-bold text-[var(--text-muted)]">{t('tasks.kpi_total', 'إجمالي المهام')}</p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-0.5">{tasks.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
            <CheckSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 rounded-2xl flex items-center justify-between">
          <div>
             <p className="text-xs font-bold text-[var(--text-muted)]">{t('tasks.kpi_active', 'مهام قيد العمل')}</p>
            <p className="text-2xl font-black text-[var(--brand-primary)] mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 rounded-2xl flex items-center justify-between">
          <div>
             <p className="text-xs font-bold text-[var(--text-muted)]">{t('tasks.kpi_pending', 'بانتظار الاعتماد')}</p>
            <p className="text-2xl font-black text-amber-500 mt-0.5">{submittedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
            <Inbox className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 rounded-2xl flex items-center justify-between">
          <div>
             <p className="text-xs font-bold text-[var(--text-muted)]">{t('tasks.kpi_completed', 'تم اعتمادها')}</p>
            <p className="text-2xl font-black text-emerald-500 mt-0.5">{completedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs - Wrapped cleanly for instant mobile access */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[var(--border-subtle)]">
        {[
           { id: 'all', label: t('tasks.tab_all', 'جميع المهام'), count: tasks.length },
           { id: 'active', label: t('tasks.tab_active', 'المهام النشطة'), count: activeCount },
           { id: 'submitted', label: t('tasks.tab_submitted', 'تم التسليم'), count: submittedCount, alert: submittedCount > 0 },
           { id: 'completed', label: t('tasks.tab_completed', 'المكتملة والمنتهية'), count: completedCount },
           { id: 'expired', label: t('tasks.tab_overdue', 'منتهية الموعد'), count: expiredCount },
           { id: 'archived', label: t('tasks.tab_archived', 'المؤرشفة'), count: archivedCount },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusTab(tab.id)}
            className={cn(
              'px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer',
              statusTab === tab.id
                ? 'bg-[var(--brand-primary)] text-white shadow-md shadow-[var(--brand-primary)]/25 font-black'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-black',
                statusTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]',
                tab.alert && statusTab !== tab.id && 'bg-rose-500 text-white animate-pulse'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="card p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
             placeholder={t('tasks.search_placeholder', 'البحث باسم المهمة أو الوصف...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-[var(--text-muted)]" />}
          />
        </div>
        <div className="w-full sm:w-56">
          {!isTopTier ? (
            <div className="w-full px-3 py-2.5 rounded-xl text-xs bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5 justify-center">
               <span>🏛️ {t('tasks.committee_restricted', 'لجنة {{name}} (مقيد)').replace('{{name}}', userProfile?.committeeName || t('tasks.committee_default', 'لجنتك'))}</span>
            </div>
          ) : (
            <select
              value={committeeFilter}
              onChange={(e) => setCommitteeFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-xs bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] cursor-pointer"
            >
               <option value="">{t('tasks.committees_all', 'جميع اللجان')}</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={PRIORITY_OPTIONS}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Task Table - Desktop & Mobile */}
      <div className="card rounded-2xl overflow-hidden">
        {loading ? (
          <SkeletonTable rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-8 w-8 text-slate-400" />}
             title={t('tasks.empty_title', 'لا توجد مهام مطابقة')}
             description={
               search || statusTab !== 'all' || priorityFilter
                 ? t('tasks.empty_search_desc', 'جرّب تغيير خيارات البحث أو التبويب.')
                 : t('tasks.empty_create_desc', 'ابدأ بإنشاء أول مهمة للموظفين.')
             }
            action={
              canCreate ? (
                <Button
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  className="gap-2 font-bold"
                >
                   <Plus className="h-4 w-4" /> {t('tasks.empty_create_btn', 'إنشاء مهمة')}
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
                    <th className="p-4">{t('tasks.col_task_data', 'بيانات المهمة')}</th>
                    <th className="p-4">{t('tasks.col_assignees', 'المكلفون بها')}</th>
                    <th className="p-4">{t('tasks.col_priority', 'الأولوية')}</th>
                    <th className="p-4">{t('tasks.col_deadline', 'الموعد النهائي')}</th>
                    <th className="p-4">{t('tasks.col_status', 'الحالة')}</th>
                    <th className="p-4 text-left">{t('tasks.col_actions', 'الإجراءات')}</th>
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
                                 <ExternalLink className="h-3.5 w-3.5" /> {t('tasks.btn_details', 'التفاصيل')}
                              </Button>
                            </Link>

                            {/* End Task Action */}
                            {canCreate && !isClosed && (
                              <button
                                onClick={() => setEndTarget(task)}
                                 title={t('tasks.action_end', 'إنهاء المهمة وإغلاق التسليمات')}
                                className="p-2 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}

                            {/* Archive Task Action */}
                            {canCreate && task.status !== 'archived' && (
                              <button
                                onClick={() => setArchiveTarget(task)}
                                 title={t('tasks.action_archive', 'أرشفة المهمة')}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                            )}

                            {/* Delete Task Action */}
                            {canCreate && (
                              <button
                                onClick={() => setDeleteTarget(task)}
                                 title={t('tasks.action_delete', 'حذف المهمة نهائياً')}
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
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight flex-1 min-w-0">
                        {task.title}
                      </h3>
                      <div className="shrink-0">
                        <StatusBadge status={task.status} overdue={overdue} />
                      </div>
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
                           title={t('tasks.action_end_short', 'إنهاء المهمة')}
                          className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      {canCreate && (
                        <button
                          onClick={() => setDeleteTarget(task)}
                           title={t('tasks.action_delete_short', 'حذف المهمة')}
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
        title={t('tasks.confirm_end_title', 'تأكيد إنهاء المهمة')}
        description={t('tasks.confirm_end_desc', 'هل تريد إنهاء المهمة "{{title}}"؟ إنهاء المهمة سيغلق باب رفع التسليمات الجديدة ويحتفظ بجميع التسليمات والإحصائيات الحالية.').replace('{{title}}', endTarget?.title || '')}
        confirmLabel={t('tasks.confirm_end_btn', 'إنهاء المهمة الآن')}
        cancelLabel={t('action.cancel', 'إلغاء')}
        variant="warning"
        loading={actionLoading}
      />

      {/* Confirm Archive Dialog */}
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveTask}
        title={t('tasks.confirm_archive_title', 'تأكيد أرشفة المهمة')}
        description={t('tasks.confirm_archive_desc', 'هل تريد نقل المهمة "{{title}}" إلى الأرشيف؟').replace('{{title}}', archiveTarget?.title || '')}
        confirmLabel={t('tasks.confirm_archive_btn', 'أرشفة')}
        cancelLabel={t('action.cancel', 'إلغاء')}
        variant="default"
        loading={actionLoading}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTask}
        title={t('tasks.confirm_delete_title', 'تأكيد حذف المهمة')}
        description={t('tasks.confirm_delete_desc', 'هل أنت متأكد من حذف المهمة "{{title}}"؟ سيتم حذفها نهائياً من جميع اللوحات وشاشات الموظفين.').replace('{{title}}', deleteTarget?.title || '')}
        confirmLabel={t('tasks.confirm_delete_btn', 'تأكيد الحذف')}
        cancelLabel={t('action.cancel', 'إلغاء')}
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
