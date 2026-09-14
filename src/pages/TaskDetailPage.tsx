import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Calendar, Coins, User, AlertTriangle, CheckCircle, CheckCircle2,
  Clock, Upload, X, Check, Trash2, Ban, Archive, FileCheck, Users,
  Sparkles, ExternalLink, ShieldCheck, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
  approveTask,
  rejectTask,
  submitTask,
  deleteTask,
  endTask,
  archiveTask,
  getUserTaskStatus,
} from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { formatDate, isOverdue, cn, safeDate } from '@/utils';
import type { Task, TaskSubmission, UserTaskStatus } from '@/types';
import { uploadTaskAttachment, type UploadedFile } from '@/lib/storage';

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isEmployee = userProfile?.role === 'employee';
  const isAdmin = userProfile?.role === 'superAdmin' || userProfile?.role === 'admin';

  const [task, setTask] = useState<Task | null>(null);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitNote, setSubmitNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Review Modals & Target Assignee State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTargetSubmission, setRejectTargetSubmission] = useState<TaskSubmission | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [approvingSubmissionId, setApprovingSubmissionId] = useState<string | null>(null);

  // Lifecycle Modals
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const backPath = location.pathname.startsWith('/my-tasks') ? '/my-tasks' : '/tasks';

  // Current user identifiers
  const userIdentifiers = [
    userProfile?.uid || '',
    (userProfile?.username || '').toLowerCase(),
    (userProfile?.email || '').toLowerCase(),
    ('user_' + (userProfile?.username || '').replace(/[^a-z0-9]/g, '_')).toLowerCase(),
  ].filter(Boolean);

  // Robust assignment check
  const isAssignedToCurrentUser = (() => {
    if (!task || !userProfile) return false;
    if (!isEmployee) return true;
    return (task.assignedTo || []).some((a: string) => {
      const al = (a || '').toLowerCase().trim();
      return userIdentifiers.includes(al);
    });
  })();

  useEffect(() => {
    if (!taskId) return;

    let unsubTask: (() => void) | null = null;
    let unsubSubs: (() => void) | null = null;
    let didResolve = false;

    const fallbackLocal = () => {
      const localTasks: Task[] = JSON.parse(localStorage.getItem('elgogalyia_local_tasks') || '[]');
      const found = localTasks.find((t) => t.id === taskId) || null;
      if (found && isEmployee) {
        const assigned = (found.assignedTo || []).map((a) => a.toLowerCase().trim());
        const isAllowed = userIdentifiers.some((id) => assigned.includes(id));
        if (!isAllowed) {
          setTask(null);
          setLoading(false);
          return;
        }
      }
      setTask(found);
      setLoading(false);
    };

    try {
      const ref = doc(db, 'tasks', taskId);
      unsubTask = onSnapshot(
        ref,
        (snap) => {
          didResolve = true;
          if (snap.exists()) {
            const fetched = { id: snap.id, ...snap.data() } as Task;
            if (isEmployee) {
              const assigned = (fetched.assignedTo || []).map((a) => a.toLowerCase().trim());
              const isAllowed = userIdentifiers.some((id) => assigned.includes(id));
              if (!isAllowed) {
                setTask(null);
                setLoading(false);
                return;
              }
            }
            setTask(fetched);
            setLoading(false);
          } else {
            fallbackLocal();
          }
        },
        (err) => {
          console.warn('TaskDetailPage snapshot notice:', err);
          if (!didResolve) fallbackLocal();
          else setLoading(false);
        }
      );

      // Listen to submissions subcollection for Admin review and history
      const subsQuery = query(collection(db, 'tasks', taskId, 'submissions'), orderBy('submittedAt', 'desc'));
      unsubSubs = onSnapshot(
        subsQuery,
        (snap) => {
          const fetchedSubs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskSubmission));
          setSubmissions(fetchedSubs);
        },
        (err) => {
          console.warn('Submissions snapshot notice:', err);
        }
      );
    } catch (err) {
      fallbackLocal();
    }

    const handleLocalChange = () => {
      if (!didResolve) fallbackLocal();
    };
    window.addEventListener('elgogalyia_data_change', handleLocalChange);

    return () => {
      if (unsubTask) unsubTask();
      if (unsubSubs) unsubSubs();
      window.removeEventListener('elgogalyia_data_change', handleLocalChange);
    };
  }, [taskId, userProfile?.uid, userProfile?.username, userProfile?.email, userProfile?.role]);

  // Determine personal task status for the current employee
  const myStatusObj: UserTaskStatus = getUserTaskStatus(task, userIdentifiers);
  const myPersonalStatus = myStatusObj.status;

  const handleSubmit = async () => {
    if (!task || !userProfile) return;

    if (isEmployee && !isAssignedToCurrentUser) {
      toast.error('لا يمكنك التسليم لهذه المهمة لأنها غير مُسندة إليك.');
      return;
    }

    if (task.status === 'completed' || task.status === 'expired' || task.status === 'archived') {
      toast.error('هذه المهمة مغلقة ولم تعد تقبل أي تسليمات جديدة.');
      return;
    }

    if (task.deadline) {
      const deadlineDate = safeDate(task.deadline);
      if (Date.now() > deadlineDate.getTime()) {
        toast.error('انتهى الموعد النهائي لهذه المهمة ولم تعد تقبل التسليم.');
        return;
      }
    }

    if (myPersonalStatus === 'submitted') {
      toast.error('تم تسليم عملك بالفعل وهو بانتظار مراجعة الإدارة.');
      return;
    }

    if (myPersonalStatus === 'approved') {
      toast.error('تمت الموافقة على تسليمك وصرف النقاط بنجاح بالفعل.');
      return;
    }

    if (!submitNote.trim() && !selectedFile) {
      toast.error('يرجى إضافة ملاحظة أو إرفاق رابط / ملف للتسليم.');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedFiles: UploadedFile[] = [];
      if (selectedFile) {
        toast.info('جاري رفع الملف المرفق...');
        const fileRes = await uploadTaskAttachment(
          task.id,
          userProfile.uid,
          selectedFile,
          (prog) => setUploadProgress(prog)
        );
        uploadedFiles.push(fileRes);
      }

      const actorEmail = (userProfile.email || userProfile.username || '').toLowerCase();
      await submitTask(
        task.id,
        { note: submitNote, files: uploadedFiles },
        {
          email: actorEmail,
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || '',
          uid: userProfile.uid,
          username: userProfile.username,
        }
      );

      toast.success('تم تسليم عملك بنجاح ووصل لإدارة الفريق للمراجعة! 🚀');
      setSubmitNote('');
      setSelectedFile(null);
      setUploadProgress(null);
    } catch (err: any) {
      toast.error(err?.message || 'فشل تسليم المهمة.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveSubmission = async (submission: TaskSubmission) => {
    if (!task || !userProfile) return;
    setApprovingSubmissionId(submission.id);
    try {
      const reviewerEmail = (userProfile.email || userProfile.username || 'admin').toLowerCase();
      await approveTask(
        task,
        {
          email: reviewerEmail,
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || '',
        },
        {
          uid: submission.submittedBy,
          email: submission.submittedBy,
          username: submission.submittedBy,
          displayName: submission.submittedByName,
        },
        submission.id
      );
      toast.success(`تمت الموافقة على تسليم (${submission.submittedByName}) وتم صرف +${task.oCoinsReward} O Coins لمحفظته بنجاح! 🎉`);
    } catch (err) {
      console.error(err);
      toast.error('فشل اعتماد تسليم المهمة.');
    } finally {
      setApprovingSubmissionId(null);
    }
  };

  const handleOpenRejectModal = (submission: TaskSubmission) => {
    setRejectTargetSubmission(submission);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmission = async () => {
    if (!task || !userProfile || !rejectTargetSubmission || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      const reviewerEmail = (userProfile.email || userProfile.username || 'admin').toLowerCase();
      await rejectTask(
        task,
        {
          email: reviewerEmail,
          displayName: userProfile.displayName,
          photoURL: userProfile.photoURL || '',
        },
        rejectReason.trim(),
        {
          uid: rejectTargetSubmission.submittedBy,
          email: rejectTargetSubmission.submittedBy,
          username: rejectTargetSubmission.submittedBy,
          displayName: rejectTargetSubmission.submittedByName,
        },
        rejectTargetSubmission.id
      );

      toast.success(`تم إرسال ملاحظات التعديل إلى (${rejectTargetSubmission.submittedByName}) بنجاح.`);
      setShowRejectModal(false);
      setRejectTargetSubmission(null);
      setRejectReason('');
    } catch (err) {
      console.error(err);
      toast.error('فشل إرسال طلب التعديل.');
    } finally {
      setRejecting(false);
    }
  };

  const handleEndTask = async () => {
    if (!task || !userProfile) return;
    setEnding(true);
    try {
      await endTask(task.id, {
        email: userProfile.email || userProfile.username,
        displayName: userProfile.displayName,
      });
      toast.success(`تم إنهاء المهمة "${task.title}" وإغلاق التسليمات مع الحفاظ على كافة البيانات.`);
      setShowEndConfirm(false);
    } catch (err) {
      toast.error('فشل إنهاء المهمة.');
    } finally {
      setEnding(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task || !userProfile) return;
    setDeleting(true);
    try {
      await deleteTask(task.id, task.title, {
        email: userProfile.username || userProfile.email || 'admin',
        displayName: userProfile.displayName,
      });
      toast.success(`تم حذف المهمة "${task.title}" بنجاح!`);
      navigate(backPath);
    } catch (err) {
      toast.error('فشل حذف المهمة.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!task && isEmployee) {
    return (
      <div className="text-center py-16 bg-white dark:bg-[#140e29] rounded-2xl border border-rose-200 dark:border-rose-900/60 p-8 max-w-xl mx-auto">
        <AlertTriangle className="h-10 w-10 text-rose-600 mx-auto mb-3" />
        <p className="text-rose-600 dark:text-rose-400 font-bold text-base">هذه المهمة غير مُسندة إليك أو تم حذفها.</p>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">ليس لديك صلاحية للوصول إلى هذه المهمة.</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate(backPath)}>
          العودة لمهامي
        </Button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-16 bg-white dark:bg-[#140e29] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 max-w-xl mx-auto">
        <p className="text-slate-600 dark:text-slate-400 font-medium">لم يتم العثور على المهمة أو تم إزالتها.</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate(backPath)}>
          العودة للخلف
        </Button>
      </div>
    );
  }

  const overdue = isOverdue(task.deadline, task.status);
  const isGloballyClosed = task.status === 'completed' || task.status === 'expired' || task.status === 'archived';

  // Submissions list resolution (Firestore subcollection + latestSubmission fallback)
  const allSubmissions: TaskSubmission[] = [...submissions];
  if (allSubmissions.length === 0 && task.latestSubmission) {
    allSubmissions.push(task.latestSubmission);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans text-right dir-rtl pb-10">
      {/* Back Button */}
      <button
        onClick={() => navigate(backPath)}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" /> العودة إلى {isEmployee ? 'مهامي الخاصة' : 'قائمة المهام'}
      </button>

      {/* Main Task Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 sm:p-8 space-y-6 transition-colors"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} overdue={overdue} />
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            {isAdmin && task.status !== 'completed' && task.status !== 'archived' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowEndConfirm(true)}
                className="gap-1.5 h-8 text-xs py-1 px-3 border border-[var(--brand-warm)]/40 text-[var(--brand-warm)] bg-[var(--brand-warm)]/10 hover:bg-[var(--brand-warm)]/20 rounded-xl"
              >
                <Ban className="h-3.5 w-3.5" /> إنهاء المهمة للجميع
              </Button>
            )}

            {isAdmin && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-1.5 h-8 text-xs py-1 px-3 rounded-xl"
              >
                <Trash2 className="h-3.5 w-3.5" /> حذف المهمة
              </Button>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[var(--text-primary)] leading-snug">
            {task.title}
          </h1>
        </div>

        {/* Metas Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[var(--bg-elevated)]/50 rounded-2xl border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5 text-xs">
            <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">الموعد النهائي</span>
              <strong className={cn(overdue ? 'text-[var(--brand-danger)] font-bold' : 'text-[var(--text-primary)] font-bold')}>
                {formatDate(task.deadline)}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <Coins className="h-4 w-4 text-[var(--brand-warm)]" />
            <div>
              <span className="text-[var(--brand-warm)] block text-[10px] uppercase font-bold">المكافأة لكل عضو</span>
              <strong className="text-[var(--text-primary)] font-extrabold">{task.oCoinsReward} O Coins</strong>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <User className="h-4 w-4 text-[var(--text-muted)]" />
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">المسؤول عن التكليف</span>
              <strong className="text-[var(--text-primary)] font-semibold">{task.createdByName || task.createdBy}</strong>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">تفاصيل المهمة</h3>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
            {task.description}
          </p>
        </div>

        {/* Requirements */}
        {task.requirements && (
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <h3 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">شروط ومتطلبات التسليم</h3>
            <div className="p-4 bg-[var(--bg-elevated)]/40 rounded-xl border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line font-medium">
              {task.requirements}
            </div>
          </div>
        )}

        {/* Assigned Team Members Section */}
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <h3 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2.5">
            {isAdmin ? 'الأعضاء المكلفون وحالة كل منهم' : 'التكليف'}
          </h3>

          {isAdmin ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(task.assignedTo || []).map((assigneeId, i) => {
                const cleanId = (assigneeId || '').toLowerCase().trim();
                const userStatusObj = task.userStatuses?.[cleanId] || { status: 'pending' };
                const memberName = task.assignedToNames?.[i] || assigneeId;

                const isApproved = userStatusObj.status === 'approved';
                const isSubmitted = userStatusObj.status === 'submitted';
                const isRejected = userStatusObj.status === 'rejected';

                return (
                  <div
                    key={i}
                    className={cn(
                      'p-3.5 rounded-2xl border flex items-center justify-between gap-3',
                      isApproved
                        ? 'bg-[var(--brand-success)]/10 border-[var(--brand-success)]/30'
                        : isSubmitted
                        ? 'bg-[var(--brand-warm)]/10 border-[var(--brand-warm)]/30'
                        : isRejected
                        ? 'bg-[var(--brand-danger)]/10 border-[var(--brand-danger)]/30'
                        : 'bg-[var(--bg-elevated)]/50 border-[var(--border-subtle)]'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={memberName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{memberName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{assigneeId}</p>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isApproved ? (
                        <span className="badge bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> تم القبول (+{task.oCoinsReward} OC)
                        </span>
                      ) : isSubmitted ? (
                        <span className="badge bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] flex items-center gap-1">
                          <Clock className="h-3 w-3" /> تم التسليم (بانتظار القرار)
                        </span>
                      ) : isRejected ? (
                        <span className="badge bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-extrabold text-[10px] flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> بحاجة لتعديل
                        </span>
                      ) : (
                        <span className="badge bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[10px]">
                          قيد التنفيذ ولم يسلم بعد
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-[#1b1437] rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-[#2f2552]">
              <Avatar name={userProfile?.displayName || 'أنت'} size="xs" />
              <span>{userProfile?.displayName || 'أنت (مسندة إليك)'}</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold mr-1 bg-amber-400/15 px-2 py-0.5 rounded-md">
                خاص بك 🔒
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Global Task Closed Banner */}
      {isGloballyClosed && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-semibold">
          <Ban className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <span>تم إغلاق هذه المهمة أو انتهاء موعدها ولم تعد تقبل تسليمات جديدة، وجميع التسليمات السابقة وسجلات النقاط محفوظة بالكامل.</span>
        </div>
      )}

      {/* ─── EMPLOYEE SECTION: INDIVIDUAL STATUS & SUBMISSION FORM ─── */}
      {isEmployee && (
        <div className="space-y-4">
          {/* 1. Approved Status Banner for current user */}
          {myPersonalStatus === 'approved' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-5"
            >
              <div className="flex items-center gap-3">
                <CheckCircle className="h-7 w-7 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                    تمت الموافقة على تسليمك للمهمة وصرف المكافأة! 🎉
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5 font-bold">
                    تم إضافة +{task.oCoinsReward} O Coins إلى رصيد محفظتك بنجاح. أحسنت عملاً!
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 2. Submitted & Awaiting Review Status Banner for current user */}
          {myPersonalStatus === 'submitted' && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-6 text-center space-y-2">
              <Clock className="h-8 w-8 text-amber-600 mx-auto mb-1 animate-pulse" />
              <p className="font-black text-amber-900 dark:text-amber-200 text-sm">
                تم تسليم عملك وبانتظار مراجعة الإدارة
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto leading-relaxed">
                تم استلام ملفاتك وملاحظاتك بنجاح. سيقوم المشرف بمراجعة عملك وصرف مكافأة الـ O Coins المحددة (+{task.oCoinsReward} OC) قريباً.
              </p>
            </div>
          )}

          {/* 3. Rejection Feedback Box for current user */}
          {myPersonalStatus === 'rejected' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-black text-rose-900 dark:text-rose-200">تسليمك بحاجة إلى تعديل</p>
                  <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                    <strong>ملاحظة المشرف:</strong> {myStatusObj.rejectionReason || 'يرجى مراجعة العمل وإعادة التسليم.'}
                  </p>
                  {myStatusObj.reviewedByName && (
                    <p className="text-[11px] text-rose-500 font-bold">تمت المراجعة بواسطة: {myStatusObj.reviewedByName}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* 4. Submission Form for current user if pending/rejected */}
          {!isGloballyClosed && (myPersonalStatus === 'pending' || myPersonalStatus === 'in_progress' || myPersonalStatus === 'rejected') && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <Upload className="h-5 w-5 text-[var(--brand-accent)]" />
                <h2 className="text-sm sm:text-base font-black text-[var(--text-primary)]">
                  تسليم عمل المهمة للمراجعة والاعتماد
                </h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="form-label text-xs font-bold text-[var(--text-secondary)]">ملاحظات ورابط التسليم (GitHub, Drive, Figma, Docs...) *</label>
                  <textarea
                    value={submitNote}
                    onChange={(e) => setSubmitNote(e.target.value)}
                    placeholder="اكتب تفاصيل وملاحظات التسليم وروابط المشروع هنا..."
                    className="form-input min-h-[110px] resize-y text-xs sm:text-sm bg-[var(--bg-elevated)]/40 border-[var(--border-subtle)]"
                  />
                </div>

                <div>
                  <label className="form-label text-xs font-bold text-[var(--text-secondary)]">إرفاق ملف للتسليم (اختياري)</label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-[var(--text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[var(--bg-elevated)] file:text-[var(--text-primary)] hover:file:brightness-110 cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-xs text-[var(--brand-accent)] font-semibold mt-1">
                      الملف المحدد: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                  {uploadProgress !== null && (
                    <div className="w-full bg-[var(--bg-elevated)] rounded-full h-2 mt-2">
                      <div className="bg-[var(--brand-accent)] h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSubmit}
                  loading={submitting}
                  variant="accent"
                  className="w-full gap-2 mt-2 font-black text-xs sm:text-sm py-3 rounded-2xl shadow-md shadow-[var(--brand-accent)]/20"
                >
                  <Upload className="h-4 w-4" /> تسليم المهمة واعتمادها
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ─── ADMIN SECTION: REVIEW EACH EMPLOYEE'S SUBMISSION INDIVIDUALLY ─── */}
      {isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-[var(--brand-accent)]" />
              <span>تسليمات الأعضاء ومراجعة الاعتماد</span>
            </h2>
            <span className="text-xs font-bold text-[var(--text-muted)]">
              إجمالي {allSubmissions.length} تسليم
            </span>
          </div>

          {allSubmissions.length === 0 ? (
            <div className="card p-8 text-center text-[var(--text-muted)] text-xs sm:text-sm">
              لم يقم أي من الأعضاء المكلفين برفع تسليمات لهذه المهمة حتى الآن.
            </div>
          ) : (
            <div className="space-y-4">
              {allSubmissions.map((sub) => {
                const isApproved = sub.status === 'approved';
                const isRejected = sub.status === 'rejected';
                const isPending = !isApproved && !isRejected;

                return (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'card p-5 sm:p-6 space-y-4',
                      isApproved
                        ? 'border-[var(--brand-success)]/40 bg-[var(--brand-success)]/[0.04]'
                        : isRejected
                        ? 'border-[var(--brand-danger)]/40 bg-[var(--brand-danger)]/[0.04]'
                        : 'border-[var(--brand-warm)]/40 bg-[var(--brand-warm)]/[0.04]'
                    )}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={sub.submittedByPhoto} name={sub.submittedByName} size="md" />
                        <div>
                          <p className="text-sm font-black text-[var(--text-primary)]">{sub.submittedByName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{sub.submittedBy}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isApproved ? (
                          <span className="badge bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-black">
                            تمت الموافقة والصرف (+{task.oCoinsReward} OC)
                          </span>
                        ) : isRejected ? (
                          <span className="badge bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-xs font-black">
                            مرفوض / طلب تعديل
                          </span>
                        ) : (
                          <span className="badge bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-black animate-pulse">
                            بانتظار المراجعة والقرار
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {sub.submittedAt ? formatDate(sub.submittedAt) : 'مؤخراً'}
                        </span>
                      </div>
                    </div>

                    {/* Note Content */}
                    <div className="p-3.5 bg-slate-50 dark:bg-[#181132] rounded-xl border border-slate-200/80 dark:border-[#2a214b] text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line font-medium leading-relaxed">
                      {sub.note || 'لا توجد ملاحظات نصية مرفقة.'}
                    </div>

                    {/* Files */}
                    {sub.files && sub.files.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-xs font-bold text-slate-500">الملفات المرفقة للتسليم:</span>
                        <div className="flex flex-wrap gap-2">
                          {sub.files.map((f, idx) => (
                            <a
                              key={idx}
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[var(--brand-accent)] transition-colors shadow-xs"
                            >
                              📄 {f.name} <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Review Action Buttons */}
                    {isPending && (
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                          variant="default"
                          onClick={() => handleApproveSubmission(sub)}
                          loading={approvingSubmissionId === sub.id}
                          className="flex-1 gap-2 py-2.5 btn-primary font-black rounded-xl"
                        >
                          <Check className="h-4 w-4 font-bold" /> قبول وصرف (+{task.oCoinsReward} OC) لـ {sub.submittedByName}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleOpenRejectModal(sub)}
                          className="flex-1 gap-2 py-2.5 font-black rounded-xl"
                        >
                          <X className="h-4 w-4 font-bold" /> طلب تعديل / رفض لـ {sub.submittedByName}
                        </Button>
                      </div>
                    )}

                    {isApproved && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 pt-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>تم الصرف بواسطة: {sub.reviewedByName || 'المشرف'}</span>
                      </div>
                    )}

                    {isRejected && sub.rejectionReason && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-xs text-rose-800 dark:text-rose-300 font-medium">
                        <strong>ملاحظة الرفض المرسلة للموظف:</strong> {sub.rejectionReason}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rejection Feedback Modal */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={`طلب تعديل على تسليم (${rejectTargetSubmission?.submittedByName || 'الموظف'})`}
        description="اكتب بوضوح ما يحتاج الموظف لتعديله لكي يتمكن من إعادة رفع التسليم مرة أخرى."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRejectModal(false)} disabled={rejecting}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmission}
              loading={rejecting}
              disabled={!rejectReason.trim()}
              className="font-bold"
            >
              إرسال طلب التعديل
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-right font-sans">
          <label className="form-label text-xs font-bold">ملاحظات التعديل المطلوبة *</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="مثال: يرجى مراجعة الرابط المرفق، أو تصحيح الأخطاء في الملف..."
            className="form-input min-h-[100px] text-xs sm:text-sm bg-slate-50 dark:bg-[#181132]"
            required
          />
        </div>
      </Modal>

      {/* End Task Confirmation Dialog */}
      <ConfirmDialog
        open={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        onConfirm={handleEndTask}
        title="تأكيد إنهاء المهمة للجميع"
        description="هل أنت متأكد من إنهاء هذه المهمة؟ سيتم إغلاق إمكانية استقبال تسليمات جديدة من جميع الطلاب مع الحفاظ الكامل على كافة التسليمات السابقة وسجل النقاط والإحصائيات."
        confirmLabel="نعم، إنهاء المهمة"
        cancelLabel="تراجع"
        variant="warning"
        loading={ending}
      />

      {/* Delete Task Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteTask}
        title="تأكيد حذف المهمة"
        description={`هل أنت متأكد من حذف المهمة "${task.title}" نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`}
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
