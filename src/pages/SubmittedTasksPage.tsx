import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, onSnapshot, db } from '@/lib/supabase';
import {
  Inbox,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
  Clock,
  Sparkles,
  MessageSquare,
  Paperclip,
  Check,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { approveTask, rejectTask } from '@/lib/database-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { formatDate, safeDate, formatRelative, cn } from '@/utils';
import { subscribeCommittees } from '@/lib/committees';
import type { Task, TaskSubmission, Committee } from '@/types';

interface SubmissionItem {
  task: Task;
  submission: TaskSubmission;
}

export function SubmittedTasksPage() {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [committeeFilter, setCommitteeFilter] = useState<string>(
    ((userProfile?.role === 'head' || userProfile?.role === 'vice_head') && userProfile?.committeeId) ? userProfile.committeeId : ''
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all, pending, approved, rejected

  // Review Modals state
  const [approveTarget, setApproveTarget] = useState<SubmissionItem | null>(null);
  const [coinsToAward, setCoinsToAward] = useState<number>(0);
  const [rejectTarget, setRejectTarget] = useState<SubmissionItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'tasks'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fsTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
        try {
          localStorage.setItem('elgogalyia_local_tasks', JSON.stringify(fsTasks));
        } catch {}
        const localTasks: Task[] = JSON.parse(localStorage.getItem('elgogalyia_local_tasks') || '[]');
        const map = new Map<string, Task>();
        fsTasks.forEach((t) => map.set(t.id, t));
        localTasks.forEach((t) => {
          if (!map.has(t.id)) map.set(t.id, t);
        });

        const allSorted = Array.from(map.values()).sort(
          (a, b) => safeDate(b.updatedAt || b.createdAt).getTime() - safeDate(a.updatedAt || a.createdAt).getTime()
        );
        setTasks(allSorted);
        setLoading(false);
      },
      (err) => {
        console.warn('SubmittedTasksPage snapshot notice:', err);
        const localTasks: Task[] = JSON.parse(localStorage.getItem('elgogalyia_local_tasks') || '[]');
        setTasks(localTasks);
        setLoading(false);
      }
    );

    const unsubCommittees = subscribeCommittees((list) => setCommittees(list));

    return () => {
      unsub();
      unsubCommittees();
    };
  }, []);

  const isViceHead = userProfile?.role === 'vice_head';
  const isHead = userProfile?.role === 'head';
  const isTopTier = userProfile?.role === 'lead' || userProfile?.role === 'co_lead';
  const isCommitteeRestricted = !isTopTier && Boolean(userProfile?.committeeId || userProfile?.committeeName);

  const isTaskInMyCommittee = (t: Task) => {
    if (!isCommitteeRestricted) return true;
    const commId = userProfile?.committeeId;
    const commName = (userProfile?.committeeName || '').trim().toLowerCase();
    if (commId && t.committeeId === commId) return true;
    if (commName && t.committeeName && t.committeeName.trim().toLowerCase() === commName) return true;
    return false;
  };

  // Extract all submission items from tasks (strictly restricted for vice_head)
  const submissionItems: SubmissionItem[] = [];
  tasks.forEach((task) => {
    if (!isTaskInMyCommittee(task)) return;

    if (task.latestSubmission) {
      submissionItems.push({
        task,
        submission: task.latestSubmission,
      });
    } else if (task.status === 'submitted') {
      // Fallback submission representation if latestSubmission wasn't nested
      submissionItems.push({
        task,
        submission: {
          id: `sub_${task.id}`,
          submittedBy: task.assignedTo[0] || 'Unknown',
          submittedByName: task.assignedToNames?.[0] || task.assignedTo[0] || 'Unknown',
          submittedByPhoto: '',
          files: task.attachments || [],
          note: 'تم رفع تسليم المهمة بواسطة الموظف.',
          submittedAt: task.updatedAt || task.createdAt,
          status: 'pending',
          reviewedBy: null,
          reviewedByName: null,
          reviewedAt: null,
          rejectionReason: null,
        },
      });
    }
  });

  // Calculate Metrics
  const totalCount = submissionItems.length;
  const pendingCount = submissionItems.filter((i) => i.submission.status === 'pending' || i.task.status === 'submitted').length;
  const approvedCount = submissionItems.filter((i) => i.submission.status === 'approved' || i.task.status === 'approved').length;
  const rejectedCount = submissionItems.filter((i) => i.submission.status === 'rejected').length;

  // Filter items
  const filteredItems = submissionItems.filter(({ task, submission }) => {
    const queryStr = search.toLowerCase().trim();
    const matchSearch =
      !queryStr ||
      (task.title || '').toLowerCase().includes(queryStr) ||
      (submission.submittedByName || '').toLowerCase().includes(queryStr) ||
      (submission.submittedBy || '').toLowerCase().includes(queryStr) ||
      (submission.note || '').toLowerCase().includes(queryStr);

    let matchStatus = true;
    if (statusFilter === 'pending') {
      matchStatus = submission.status === 'pending' || task.status === 'submitted';
    } else if (statusFilter === 'approved') {
      matchStatus = submission.status === 'approved' || task.status === 'approved' || task.status === 'completed';
    } else if (statusFilter === 'rejected') {
      matchStatus = submission.status === 'rejected';
    }

    const matchCommittee = isCommitteeRestricted
      ? true
      : (!committeeFilter || task.committeeId === committeeFilter);

    return matchSearch && matchStatus && matchCommittee;
  });

  const handleApprove = async () => {
    if (!approveTarget || !userProfile) return;
    if (isCommitteeRestricted && !isTaskInMyCommittee(approveTarget.task)) {
      toast.error('❌ ليس لديك صلاحية لاعتماد مهام خارج لجنتك.');
      return;
    }
    setActionLoading(true);
    try {
      await approveTask(
        approveTarget.task,
        {
          email: userProfile.email || userProfile.username || 'admin',
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL,
        },
        {
          uid: approveTarget.submission.submittedBy,
          email: approveTarget.submission.submittedBy,
          displayName: approveTarget.submission.submittedByName,
        },
        approveTarget.submission.id,
        coinsToAward
      );
      toast.success(`تم قبول تسليم (${approveTarget.submission.submittedByName}) وصرف +${coinsToAward} عملة O-Coins بنجاح! 🎉`);
      setApproveTarget(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'فشل قبول التسليم.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !userProfile || !rejectReason.trim()) {
      toast.error('يرجى كتابة سبب طلب التعديل أو الرفض.');
      return;
    }
    if (isCommitteeRestricted && !isTaskInMyCommittee(rejectTarget.task)) {
      toast.error('❌ ليس لديك صلاحية لمراجعة مهام خارج لجنتك.');
      return;
    }
    setActionLoading(true);
    try {
      await rejectTask(
        rejectTarget.task,
        {
          email: userProfile.email || userProfile.username || 'admin',
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL,
        },
        rejectReason.trim(),
        {
          uid: rejectTarget.submission.submittedBy,
          email: rejectTarget.submission.submittedBy,
          displayName: rejectTarget.submission.submittedByName,
        },
        rejectTarget.submission.id
      );
      toast.success(`تم إرسال ملاحظات التعديل إلى (${rejectTarget.submission.submittedByName}) بنجاح.`);
      setRejectTarget(null);
      setRejectReason('');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'فشل رفض التسليم.');
    } finally {
      setActionLoading(false);
    }
  };

  const QUICK_REJECT_REASONS = [
    'الملفات المرفقة غير مكتملة أو فارغة.',
    'يرجى مراجعة متطلبات المهمة وتحديث التسليم.',
    'المخرجات تحتاج إلى مراجعة وتنسيق إضافي.',
    'يرجى رفع الملف بصيغة PDF أو الرابط المباشر.',
  ];

  return (
    <div className="space-y-6 font-sans text-right dir-rtl">
      {/* Top Header */}
      <div className="card p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
                {isCommitteeRestricted 
                  ? `مراجعة تسليمات أعضاء لجنة ${userProfile?.committeeName || 'اللجنة'}`
                  : 'تسليمات المهام والتقييم'}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                {isCommitteeRestricted
                  ? 'مراجعة تسليمات أعضاء لجنتك، قبول الأعمال وصرف مكافآت O-Coins، أو طلب التعديل'
                  : 'مراجعة تسليمات الموظفين والطلاب، اعتماد الأعمال، وصرف مكافآت O-Coins'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={cn(
            'p-4 rounded-2xl border text-right transition-all cursor-pointer',
            statusFilter === 'all'
              ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-md'
              : 'card hover:border-[var(--brand-primary)] text-[var(--text-secondary)]'
          )}
        >
          <p className="text-xs font-bold opacity-75">إجمالي التسليمات</p>
          <p className="text-2xl font-black mt-1 text-[var(--text-primary)]">{totalCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter('pending')}
          className={cn(
            'p-4 rounded-2xl border text-right transition-all cursor-pointer',
            statusFilter === 'pending'
              ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
              : 'card hover:border-amber-500 text-[var(--text-secondary)]'
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold opacity-75">بانتظار المراجعة</p>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          </div>
          <p className="text-2xl font-black mt-1 text-amber-500">{pendingCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter('approved')}
          className={cn(
            'p-4 rounded-2xl border text-right transition-all cursor-pointer',
            statusFilter === 'approved'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
              : 'card hover:border-emerald-500 text-[var(--text-secondary)]'
          )}
        >
          <p className="text-xs font-bold opacity-75">تم قبولها وصرفها</p>
          <p className="text-2xl font-black mt-1 text-emerald-500">{approvedCount}</p>
        </button>

        <button
          onClick={() => setStatusFilter('rejected')}
          className={cn(
            'p-4 rounded-2xl border text-right transition-all cursor-pointer',
            statusFilter === 'rejected'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
              : 'card hover:border-rose-500 text-[var(--text-secondary)]'
          )}
        >
          <p className="text-xs font-bold opacity-75">بانتظار التعديل</p>
          <p className="text-2xl font-black mt-1 text-rose-500">{rejectedCount}</p>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="البحث باسم المهمة، الموظف، الملاحظات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-[var(--text-muted)]" />}
          />
        </div>
        <div className="w-full sm:w-56">
          {isCommitteeRestricted ? (
            <div className="w-full px-3 py-2.5 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 justify-center">
              <span>🏛️ لجنة {userProfile?.committeeName || 'لجنتك'} (مقيد)</span>
            </div>
          ) : (
            <select
              value={committeeFilter}
              onChange={(e) => setCommitteeFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-xs bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] cursor-pointer"
            >
              <option value="">جميع اللجان</option>
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
            options={[
              { value: 'all', label: 'جميع التسليمات' },
              { value: 'pending', label: 'قيد المراجعة فقط' },
              { value: 'approved', label: 'المقبولة فقط' },
              { value: 'rejected', label: 'المرفوضة / بحاجة لتعديل' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Submissions List */}
      <div className="card rounded-2xl overflow-hidden">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-10 w-10 text-slate-400" />}
            title="لا توجد تسليمات مسجلة"
            description={
              search || statusFilter !== 'all'
                ? 'لم يتم العثور على أي نتائج تطابق شروط البحث الحالية.'
                : 'لم يقم أي موظف أو طالب برفع تسليم للمهام حتى الآن.'
            }
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {filteredItems.map(({ task, submission }, idx) => {
              const isPending = submission.status === 'pending' || task.status === 'submitted';
              const isApproved = submission.status === 'approved' || task.status === 'approved';
              const isRejected = submission.status === 'rejected';

              return (
                <div
                  key={`${task.id}_${idx}`}
                  className="p-5 sm:p-6 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Submitter & Task info */}
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={submission.submittedByPhoto}
                          name={submission.submittedByName || submission.submittedBy}
                          size="md"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                              {submission.submittedByName || submission.submittedBy}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              ({submission.submittedBy})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              تم الرفع {submission.submittedAt ? formatRelative(submission.submittedAt) : 'مؤخراً'} (
                              {formatDate(submission.submittedAt || task.updatedAt || task.createdAt)})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Task Box */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">المهمة الأصلية:</span>
                            <Link
                              to={`/tasks/${task.id}`}
                              className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              {task.title}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-800 dark:text-amber-300 font-black text-xs border border-amber-400/30 flex items-center gap-1">
                            🪙 {task.oCoinsReward} OC
                          </span>
                        </div>
                      </div>

                      {/* Note / Message */}
                      {submission.note && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                            <span>ملاحظات ورسالة التسليم:</span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-[#0B0817] p-3 rounded-xl border border-slate-200 dark:border-white/10 leading-relaxed whitespace-pre-line">
                            {submission.note}
                          </p>
                        </div>
                      )}

                      {/* Files / Attachments */}
                      {submission.files && submission.files.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                            الملفات والمرفقات ({submission.files.length}):
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {submission.files.map((f, fi) => (
                              <a
                                key={fi}
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 text-xs font-bold hover:bg-blue-100 transition-colors"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                <span className="max-w-[200px] truncate">{f.name || `ملف مرفق ${fi + 1}`}</span>
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rejection notice if previously rejected */}
                      {isRejected && submission.rejectionReason && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">ملاحظات طلب التعديل السابقة:</span>
                            <span>{submission.rejectionReason}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions & Status Column */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5 flex-shrink-0">
                      {/* Status badge */}
                      <div>
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            بانتظار المراجعة
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            تم القبول والصرف
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                            <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            بانتظار التعديل
                          </span>
                        )}
                      </div>

                      {/* Review Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isPending && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setApproveTarget({ task, submission });
                                setCoinsToAward(task.oCoinsReward ?? 0);
                              }}
                              className="font-black text-xs gap-1.5 shadow-sm"
                            >
                              <Check className="h-3.5 w-3.5" /> قبول وصرف
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRejectTarget({ task, submission });
                                setRejectReason('');
                              }}
                              className="border-rose-300 text-rose-600 hover:bg-rose-50 text-xs gap-1.5"
                            >
                              <XCircle className="h-3.5 w-3.5" /> طلب تعديل
                            </Button>
                          </>
                        )}

                        {isApproved && (
                          <div className="text-left text-[11px] text-slate-400">
                            {submission.reviewedByName && (
                              <p>اعتمد بواسطة: {submission.reviewedByName}</p>
                            )}
                          </div>
                        )}

                        <Link to={`/tasks/${task.id}`}>
                          <Button size="sm" variant="ghost" className="text-xs gap-1">
                            <ExternalLink className="h-3.5 w-3.5" /> التفاصيل
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Approve & Award Coins */}
      <Modal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title="تأكيد قبول التسليم وصرف المكافأة"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setApproveTarget(null)} disabled={actionLoading}>
              إلغاء
            </Button>
            <Button
              onClick={handleApprove}
              loading={actionLoading}
              className="font-black"
            >
              <Sparkles className="h-4 w-4" /> تأكيد القبول والصرف
            </Button>
          </div>
        }
      >
        <div className="space-y-4 font-sans text-right dir-rtl">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            أنت على وشك قبول تسليم المهمة التالية وإيداع المكافأة تلقائياً في رصيد الموظف:
          </p>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">اسم المهمة:</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{approveTarget?.task.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">الموظف / الطالب:</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{approveTarget?.submission.submittedByName}</span>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  عدد عملات O-Coins الممنوحة للموظف:
                </label>
                <span className="text-[11px] text-slate-400">
                  (القيمة التقديرية للتاسك: {approveTarget?.task.oCoinsReward} OC)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={coinsToAward}
                  onChange={(e) => setCoinsToAward(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full h-11 px-3.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-black/40 text-base font-black text-amber-600 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <span className="font-bold text-xs text-slate-400 shrink-0">عملة OC</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                يمكنك تعديل القيمة بحرية (تقليلها إذا كان العمل غير مكتمل، أو زيادتها إن كان مميزاً، أو تركها كما هي).
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: Reject & Request Revisions */}
      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="طلب تعديل أو رفض التسليم"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={actionLoading}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              loading={actionLoading}
              className="font-bold"
            >
              إرسال الملاحظات وإعادة المهمة
            </Button>
          </div>
        }
      >
        <div className="space-y-4 font-sans text-right dir-rtl">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            سيتم إعادة حالة المهمة إلى "قيد التنفيذ" وإرسال إشعار فوري للموظف ({rejectTarget?.submission.submittedByName}) بملاحظاتك لإجراء التعديلات المطلوبة.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              سبب طلب التعديل أو الرفض:
            </label>
            <Textarea
              rows={3}
              placeholder="اكتب سبب طلب التعديل والمطلوب تعديله بالتفصيل..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-slate-500 font-semibold block">عبارات سريعة مقترحة:</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REJECT_REASONS.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRejectReason(r)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-right cursor-pointer"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
