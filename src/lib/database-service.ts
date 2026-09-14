import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  Timestamp,
  onSnapshot,
  db,
} from './supabase';
import type {
  Task,
  TaskStatus,
  UserTaskStatus,
  CreateTaskData,
  TaskSubmission,
  AuthorizedUser,
  AuthorizedAdmin,
  UserProfile,
  NotificationType,
  ActivityLog,
  OCoinTransaction,
  OCoinTransactionType,
} from '@/types';
import { safeDate } from '@/utils';

// ─── Activity Logs ─────────────────────────────────────────────────────────────

export async function logActivity(logData: {
  actor: string;
  actorName: string;
  actorPhoto?: string;
  action: ActivityLog['action'];
  targetType: ActivityLog['targetType'];
  targetId: string;
  targetName: string;
  metadata?: Record<string, any>;
}) {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      ...logData,
      actorPhoto: logData.actorPhoto || '',
      metadata: logData.metadata || {},
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Supabase logActivity notice:', err);
  }
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export async function createNotification(data: {
  recipientEmail: string;
  recipientUid?: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string | null;
  ticketId?: string | null;
  relatedEntityType?: 'task' | 'ticket' | 'meeting' | 'opportunity' | 'ocoin' | 'discount' | 'course' | 'system';
  relatedEntityId?: string | null;
  actionUrl?: string | null;
}) {
  try {
    await addDoc(collection(db, 'notifications'), {
      recipientEmail: data.recipientEmail.toLowerCase(),
      recipientUid: data.recipientUid || '',
      type: data.type,
      title: data.title,
      message: data.message,
      taskId: data.taskId || null,
      ticketId: data.ticketId || null,
      relatedEntityType: data.relatedEntityType || (data.taskId ? 'task' : data.ticketId ? 'ticket' : 'system'),
      relatedEntityId: data.relatedEntityId || data.taskId || data.ticketId || null,
      actionUrl: data.actionUrl || (data.taskId ? `/tasks/${data.taskId}` : data.ticketId ? `/support/${data.ticketId}` : null),
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Supabase createNotification notice:', err);
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
    });
  } catch (err) {
    console.warn('Supabase markNotificationAsRead notice:', err);
  }
}

// ─── Task Management ──────────────────────────────────────────────────────────

export async function createTask(
  data: CreateTaskData,
  creator: { email: string; displayName: string; committeeId?: string | null; committeeName?: string | null },
  assignedNames: string[]
): Promise<string> {
  const assignedToNormalized = data.assignedTo.map((e) => e.trim().toLowerCase());
  const nowIso = new Date().toISOString();

  const taskPayload = {
    title: data.title.trim(),
    description: data.description.trim(),
    requirements: (data.requirements || '').trim(),
    priority: data.priority,
    deadline: Timestamp.fromDate(data.deadline),
    oCoinsReward: Number(data.oCoinsReward) || 0,
    status: 'pending' as TaskStatus,
    assignedTo: assignedToNormalized,
    assignedToNames: assignedNames,
    createdBy: creator.email.toLowerCase(),
    createdByName: creator.displayName,
    committeeId: creator.committeeId || null,
    committeeName: creator.committeeName || null,
    attachments: [],
    latestSubmission: null,
  };

  let generatedId = 'task_' + Date.now();

  try {
    const taskDocRef = await addDoc(collection(db, 'tasks'), {
      ...taskPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    generatedId = taskDocRef.id;
  } catch (err) {
    console.warn('Supabase addDoc task notice:', err);
  }

  // Persist locally for instant multi-tab sync
  try {
    const localTasks: Task[] = JSON.parse(localStorage.getItem('elgogalyia_local_tasks') || '[]');
    const newTaskObject: Task = {
      id: generatedId,
      ...taskPayload,
      createdAt: nowIso as any,
      updatedAt: nowIso as any,
    };
    localTasks.unshift(newTaskObject);
    localStorage.setItem('elgogalyia_local_tasks', JSON.stringify(localTasks));
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch (e) {}

  // Send notifications to assigned employees
  for (const recipientId of assignedToNormalized) {
    createNotification({
      recipientEmail: recipientId,
      type: 'task_assigned',
      title: 'مهمة جديدة إسنادها إليك 📋',
      message: `تم إسناد المهمة: "${data.title}"`,
      taskId: generatedId,
    }).catch(() => {});
  }

  logActivity({
    actor: creator.email,
    actorName: creator.displayName,
    action: 'task.created',
    targetType: 'task',
    targetId: generatedId,
    targetName: data.title,
    metadata: { assignedTo: assignedToNormalized, priority: data.priority, reward: data.oCoinsReward },
  }).catch(() => {});

  return generatedId;
}

function patchLocalTask(taskId: string, patch: (t: Task) => Task) {
  try {
    const raw = localStorage.getItem('elgogalyia_local_tasks');
    if (!raw) return;
    const tasks: Task[] = JSON.parse(raw);
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    tasks[idx] = patch(tasks[idx]);
    localStorage.setItem('elgogalyia_local_tasks', JSON.stringify(tasks));
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch (e) {
    console.warn('patchLocalTask notice:', e);
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  updater: { email: string; displayName: string; photoURL?: string }
) {
  await updateDoc(doc(db, 'tasks', taskId), {
    status,
    updatedAt: serverTimestamp(),
  });

  patchLocalTask(taskId, (t) => ({ ...t, status, updatedAt: new Date().toISOString() as any }));

  logActivity({
    actor: updater.email,
    actorName: updater.displayName,
    actorPhoto: updater.photoURL || '',
    action: 'task.status_changed',
    targetType: 'task',
    targetId: taskId,
    targetName: taskId,
    metadata: { newStatus: status },
  }).catch(() => {});
}

export function getUserTaskStatus(task: Task | null | undefined, userIdentifiers: string[]): UserTaskStatus {
  if (!task) return { status: 'pending' };
  
  const cleanIdentifiers = (userIdentifiers || []).map((id) => (id || '').toLowerCase().trim()).filter(Boolean);

  // 1. Check explicit userStatuses dictionary
  if (task.userStatuses && typeof task.userStatuses === 'object') {
    for (const id of cleanIdentifiers) {
      if (task.userStatuses[id]) {
        return task.userStatuses[id];
      }
    }
  }

  // 2. Check latestSubmission
  if (task.latestSubmission) {
    const subBy = (task.latestSubmission.submittedBy || '').toLowerCase().trim();
    if (cleanIdentifiers.includes(subBy)) {
      const subStatus = task.latestSubmission.status === 'approved' ? 'approved' : task.latestSubmission.status === 'rejected' ? 'rejected' : 'submitted';
      return {
        status: subStatus,
        submissionId: task.latestSubmission.id,
        submittedAt: task.latestSubmission.submittedAt,
        reviewedBy: task.latestSubmission.reviewedBy,
        reviewedByName: task.latestSubmission.reviewedByName,
        reviewedAt: task.latestSubmission.reviewedAt,
        rejectionReason: task.latestSubmission.rejectionReason,
        note: task.latestSubmission.note,
        files: task.latestSubmission.files,
      };
    }
  }

  // 3. If task is completed/expired/archived globally
  if (task.status === 'completed' || task.status === 'expired' || task.status === 'archived') {
    return { status: task.status };
  }

  // 4. Default fallback based on task status if single assignee
  if (task.assignedTo && task.assignedTo.length <= 1) {
    return { status: task.status === 'approved' ? 'approved' : task.status === 'submitted' ? 'submitted' : (task.status as any) || 'pending' };
  }

  return { status: 'pending' };
}

export async function submitTask(
  taskId: string,
  submission: {
    note: string;
    files: Array<{ name: string; url: string; size: number; type: string }>;
  },
  submitter: { email: string; displayName: string; photoURL?: string; uid: string; username?: string }
) {
  // Check task status and deadline expiration
  try {
    const taskSnap = await getDoc(doc(db, 'tasks', taskId));
    if (taskSnap.exists()) {
      const taskData = taskSnap.data() as Task;
      if (taskData.status === 'completed' || taskData.status === 'expired' || taskData.status === 'archived') {
        throw new Error('هذه المهمة مغلقة ولم تعد تقبل أي تسليمات جديدة.');
      }
      if (taskData.deadline) {
        const deadlineDate = safeDate(taskData.deadline);
        if (Date.now() > deadlineDate.getTime()) {
          throw new Error('انتهى الموعد النهائي لهذه المهمة ولم تعد تقبل التسليم.');
        }
      }
    }
  } catch (e: any) {
    if (e?.message?.includes('مغلقة') || e?.message?.includes('الموعد النهائي')) throw e;
  }

  // Enforce ban: blocked if user is suspended / has active ban
  try {
    const userSnap = await getDoc(doc(db, 'users', submitter.uid));
    if (userSnap.exists() && (userSnap.data() as any).status === 'suspended') {
      const bansSnap = await getDocs(query(collection(db, 'bans'), where('employeeId', '==', submitter.uid), where('status', '==', 'active')));
      const hasActive = bansSnap.docs.some((d: any) => {
        const end = d.data().endAt?.toDate ? d.data().endAt.toDate() : new Date(d.data().endAt);
        return end.getTime() > Date.now();
      });
      if (hasActive) throw new Error('Account is suspended — submission blocked');
    }
  } catch (e: any) {
    if (e?.message?.includes('suspended') || e?.message?.includes('مغلقة') || e?.message?.includes('الموعد النهائي')) throw e;
  }
  try {
    const localBans: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_bans') || '[]');
    const active = localBans.find((b: any) => b.employeeId === submitter.uid && b.status === 'active' && new Date(b.endAt).getTime() > Date.now());
    if (active) throw new Error('Account is suspended — submission blocked');
  } catch {}

  const submitterIdentifier = (submitter.uid || submitter.email || submitter.username || '').toLowerCase().trim();

  const submissionData: Omit<TaskSubmission, 'id'> = {
    submittedBy: submitterIdentifier,
    submittedByName: submitter.displayName,
    submittedByPhoto: submitter.photoURL || '',
    files: submission.files,
    note: submission.note.trim(),
    submittedAt: serverTimestamp() as unknown as Timestamp,
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    status: 'pending',
    rejectionReason: null,
  };

  const subDocRef = await addDoc(
    collection(db, 'tasks', taskId, 'submissions'),
    submissionData
  );

  const userStatusObj: UserTaskStatus = {
    status: 'submitted',
    submissionId: subDocRef.id,
    submittedAt: serverTimestamp() as unknown as Timestamp,
    note: submission.note.trim(),
    files: submission.files,
    rejectionReason: null,
  };

  await updateDoc(doc(db, 'tasks', taskId), {
    status: 'submitted',
    latestSubmission: { ...submissionData, id: subDocRef.id },
    [`userStatuses.${submitterIdentifier}`]: userStatusObj,
    [`userStatuses.${(submitter.email || '').toLowerCase()}`]: userStatusObj,
    ...(submitter.username ? { [`userStatuses.${submitter.username.toLowerCase()}`]: userStatusObj } : {}),
    updatedAt: serverTimestamp(),
  });

  patchLocalTask(taskId, (t) => {
    const uStatuses = { ...(t.userStatuses || {}) };
    const localStatus: UserTaskStatus = {
      status: 'submitted',
      submissionId: subDocRef.id,
      submittedAt: new Date().toISOString() as any,
      note: submission.note.trim(),
      files: submission.files,
      rejectionReason: null,
    };
    uStatuses[submitterIdentifier] = localStatus;
    if (submitter.email) uStatuses[submitter.email.toLowerCase()] = localStatus;
    if (submitter.username) uStatuses[submitter.username.toLowerCase()] = localStatus;

    return {
      ...t,
      status: 'submitted',
      latestSubmission: { ...submissionData, id: subDocRef.id, submittedAt: new Date().toISOString() as any } as any,
      userStatuses: uStatuses,
      updatedAt: new Date().toISOString() as any,
    };
  });

  logActivity({
    actor: submitter.email || submitter.username || submitter.uid,
    actorName: submitter.displayName,
    actorPhoto: submitter.photoURL || '',
    action: 'task.submitted',
    targetType: 'task',
    targetId: taskId,
    targetName: taskId,
  }).catch(() => {});
}

export async function endTask(
  taskId: string,
  actor: { email: string; displayName: string; photoURL?: string }
) {
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Supabase endTask notice:', err);
  }

  patchLocalTask(taskId, (t) => ({ ...t, status: 'completed', updatedAt: new Date().toISOString() as any }));

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    actorPhoto: actor.photoURL || '',
    action: 'task.status_changed',
    targetType: 'task',
    targetId: taskId,
    targetName: taskId,
    metadata: { newStatus: 'completed', action: 'ended' },
  }).catch(() => {});
}

export async function archiveTask(
  taskId: string,
  actor: { email: string; displayName: string; photoURL?: string }
) {
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Supabase archiveTask notice:', err);
  }

  patchLocalTask(taskId, (t) => ({ ...t, status: 'archived', updatedAt: new Date().toISOString() as any }));

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    actorPhoto: actor.photoURL || '',
    action: 'task.status_changed',
    targetType: 'task',
    targetId: taskId,
    targetName: taskId,
    metadata: { newStatus: 'archived' },
  }).catch(() => {});
}

export async function approveTask(
  task: Task,
  reviewer: { email: string; displayName: string; photoURL?: string },
  targetAssignee?: { uid?: string; email?: string; username?: string; displayName?: string },
  submissionId?: string
) {
  // 1. Resolve target user identity
  let resolvedUid = targetAssignee?.uid || '';
  let targetIdentifier = (targetAssignee?.email || targetAssignee?.username || targetAssignee?.uid || '').toLowerCase().trim();

  if (!targetIdentifier && task.latestSubmission?.submittedBy) {
    targetIdentifier = task.latestSubmission.submittedBy.toLowerCase().trim();
  }
  if (!targetIdentifier && task.assignedTo && task.assignedTo.length > 0) {
    targetIdentifier = task.assignedTo[0].toLowerCase().trim();
  }

  // Resolve UID by looking up in Supabase or local users
  if (!resolvedUid && targetIdentifier) {
    if (targetIdentifier.startsWith('user_') || targetIdentifier === 'owner_super_admin') {
      resolvedUid = targetIdentifier;
    } else {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const found = usersSnap.docs.find((d) => {
          const data: any = d.data();
          return (
            (data.username || '').toLowerCase() === targetIdentifier ||
            (data.email || '').toLowerCase() === targetIdentifier ||
            d.id.toLowerCase() === targetIdentifier
          );
        });
        if (found) resolvedUid = found.id;
      } catch {}
      if (!resolvedUid) {
        const genUid = 'user_' + targetIdentifier.replace(/[^a-z0-9]/g, '_');
        resolvedUid = genUid;
      }
    }
  }

  // 2. Resolve display name and email for ledger & notifications
  let assigneeEmailForLedger = targetIdentifier;
  let assigneeDisplayForLedger = targetAssignee?.displayName || '';

  if (resolvedUid) {
    try {
      const uSnap = await getDoc(doc(db, 'users', resolvedUid));
      if (uSnap.exists()) {
        const ud: any = uSnap.data();
        assigneeEmailForLedger = (ud.email || ud.username || resolvedUid).toLowerCase();
        if (!assigneeDisplayForLedger) assigneeDisplayForLedger = ud.displayName || assigneeEmailForLedger;
      } else {
        const locals: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
        const found: any = locals.find((u) => u.uid === resolvedUid);
        if (found) {
          assigneeEmailForLedger = (found.email || found.username || resolvedUid).toLowerCase();
          if (!assigneeDisplayForLedger) assigneeDisplayForLedger = found.displayName || assigneeEmailForLedger;
        }
      }
    } catch {}
  }
  if (!assigneeDisplayForLedger) {
    assigneeDisplayForLedger = task.assignedToNames?.[0] || assigneeEmailForLedger;
  }

  // 3. Check idempotency: whether reward was ALREADY granted to this specific user for this specific task
  let alreadyRewarded = false;
  try {
    const dupQ = query(
      collection(db, 'oCoins'),
      where('taskId', '==', task.id),
      where('type', '==', 'task_reward')
    );
    const dupSnap = await getDocs(dupQ);
    alreadyRewarded = dupSnap.docs.some((d) => {
      const data = d.data();
      return (
        data.uid === resolvedUid ||
        (data.userEmail || '').toLowerCase() === assigneeEmailForLedger.toLowerCase()
      );
    });
  } catch (e) {
    console.warn('approveTask duplicate check notice:', e);
  }

  // 4. Calculate updated userStatuses and determine overall task status
  const currentStatuses: Record<string, UserTaskStatus> = { ...(task.userStatuses || {}) };
  const targetUserStatus: UserTaskStatus = {
    status: 'approved',
    submissionId: submissionId || task.latestSubmission?.id,
    reviewedBy: reviewer.email.toLowerCase(),
    reviewedByName: reviewer.displayName,
    reviewedAt: serverTimestamp() as unknown as Timestamp,
    oCoinsAwarded: task.oCoinsReward,
  };

  if (targetIdentifier) currentStatuses[targetIdentifier] = targetUserStatus;
  if (resolvedUid) currentStatuses[resolvedUid] = targetUserStatus;
  if (assigneeEmailForLedger) currentStatuses[assigneeEmailForLedger.toLowerCase()] = targetUserStatus;

  // Determine overall task status: are all assigned team members approved?
  const allAssigned = task.assignedTo || [];
  const areAllApproved = allAssigned.length > 0 && allAssigned.every((memberId) => {
    const mid = memberId.toLowerCase().trim();
    const st = currentStatuses[mid]?.status;
    return st === 'approved';
  });

  const overallTaskStatus: TaskStatus = areAllApproved ? 'completed' : 'in_progress';

  const batch = writeBatch(db);

  // Update Task Document
  batch.update(doc(db, 'tasks', task.id), {
    status: overallTaskStatus,
    'latestSubmission.status': 'approved',
    'latestSubmission.reviewedBy': reviewer.email.toLowerCase(),
    'latestSubmission.reviewedByName': reviewer.displayName,
    'latestSubmission.reviewedAt': serverTimestamp(),
    [`userStatuses.${targetIdentifier}`]: targetUserStatus,
    ...(resolvedUid ? { [`userStatuses.${resolvedUid}`]: targetUserStatus } : {}),
    ...(assigneeEmailForLedger ? { [`userStatuses.${assigneeEmailForLedger.toLowerCase()}`]: targetUserStatus } : {}),
    updatedAt: serverTimestamp(),
  });

  // If specific submission ID provided, update submission subdocument
  if (submissionId) {
    try {
      const subRef = doc(db, 'tasks', task.id, 'submissions', submissionId);
      batch.update(subRef, {
        status: 'approved',
        reviewedBy: reviewer.email.toLowerCase(),
        reviewedByName: reviewer.displayName,
        reviewedAt: serverTimestamp(),
      });
    } catch {}
  }

  // 5. Award O Coins Transaction ONLY if not already rewarded
  if (!alreadyRewarded) {
    const ocoinRef = doc(collection(db, 'oCoins'));
    batch.set(ocoinRef, {
      userEmail: assigneeEmailForLedger,
      userDisplayName: assigneeDisplayForLedger,
      uid: resolvedUid || '',
      amount: task.oCoinsReward,
      type: 'task_reward' as OCoinTransactionType,
      reason: `Task approved: ${task.title}`,
      taskId: task.id,
      taskTitle: task.title,
      createdBy: reviewer.email.toLowerCase(),
      createdByName: reviewer.displayName,
      createdAt: serverTimestamp(),
    });

    if (resolvedUid) {
      const userRef = doc(db, 'users', resolvedUid);
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentBalance = (userSnap.data() as any).oCoinsBalance ?? 0;
          batch.update(userRef, {
            oCoinsBalance: currentBalance + task.oCoinsReward,
          });
        }
      } catch {}
    }
  }

  await batch.commit();

  // 6. Update local session & cache for instant UI response
  try {
    if (resolvedUid && !alreadyRewarded) {
      const localUsers: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
      const idx = localUsers.findIndex((u: any) => u.uid === resolvedUid);
      if (idx !== -1) {
        localUsers[idx].oCoinsBalance = (localUsers[idx].oCoinsBalance ?? 0) + task.oCoinsReward;
        localStorage.setItem('elgogalyia_local_users', JSON.stringify(localUsers));
      }
      const sessRaw = localStorage.getItem('elgogalyia_user_session');
      if (sessRaw) {
        const sess: any = JSON.parse(sessRaw);
        if (sess.uid === resolvedUid || sess.email?.toLowerCase() === assigneeEmailForLedger.toLowerCase()) {
          sess.oCoinsBalance = (sess.oCoinsBalance ?? 0) + task.oCoinsReward;
          localStorage.setItem('elgogalyia_user_session', JSON.stringify(sess));
        }
      }
    }
  } catch {}

  patchLocalTask(task.id, (t) => {
    const uStatuses = { ...(t.userStatuses || {}) };
    const localStatus: UserTaskStatus = {
      status: 'approved',
      submissionId: submissionId || t.latestSubmission?.id,
      reviewedBy: reviewer.email.toLowerCase(),
      reviewedByName: reviewer.displayName,
      reviewedAt: new Date().toISOString() as any,
      oCoinsAwarded: task.oCoinsReward,
    };
    if (targetIdentifier) uStatuses[targetIdentifier] = localStatus;
    if (resolvedUid) uStatuses[resolvedUid] = localStatus;
    if (assigneeEmailForLedger) uStatuses[assigneeEmailForLedger.toLowerCase()] = localStatus;

    return {
      ...t,
      status: overallTaskStatus,
      latestSubmission: t.latestSubmission ? {
        ...t.latestSubmission,
        status: 'approved' as any,
        reviewedBy: reviewer.email.toLowerCase(),
        reviewedByName: reviewer.displayName,
        reviewedAt: new Date().toISOString() as any,
      } : t.latestSubmission,
      userStatuses: uStatuses,
      updatedAt: new Date().toISOString() as any,
    };
  });

  createNotification({
    recipientEmail: assigneeEmailForLedger,
    recipientUid: resolvedUid,
    type: 'task_approved',
    title: 'تم اعتماد المهمة وصرف النقاط! 🎉',
    message: `تمت الموافقة على تسليمك للمهمة "${task.title}". تمت إضافة +${task.oCoinsReward} O Coins إلى محفظتك.`,
    taskId: task.id,
  }).catch(() => {});

  logActivity({
    actor: reviewer.email,
    actorName: reviewer.displayName,
    actorPhoto: reviewer.photoURL || '',
    action: 'task.approved',
    targetType: 'task',
    targetId: task.id,
    targetName: task.title,
    metadata: { oCoinsAwarded: task.oCoinsReward, awardedTo: assigneeDisplayForLedger, uid: resolvedUid },
  }).catch(() => {});
}

export async function rejectTask(
  task: Task,
  reviewer: { email: string; displayName: string; photoURL?: string },
  reason: string,
  targetAssignee?: { uid?: string; email?: string; username?: string; displayName?: string },
  submissionId?: string
) {
  let resolvedUid = targetAssignee?.uid || '';
  let targetIdentifier = (targetAssignee?.email || targetAssignee?.username || targetAssignee?.uid || '').toLowerCase().trim();

  if (!targetIdentifier && task.latestSubmission?.submittedBy) {
    targetIdentifier = task.latestSubmission.submittedBy.toLowerCase().trim();
  }
  if (!targetIdentifier && task.assignedTo && task.assignedTo.length > 0) {
    targetIdentifier = task.assignedTo[0].toLowerCase().trim();
  }

  let notifyEmail = targetIdentifier;
  if (resolvedUid) {
    try {
      const uSnap = await getDoc(doc(db, 'users', resolvedUid));
      if (uSnap.exists()) {
        const ud: any = uSnap.data();
        notifyEmail = (ud.email || ud.username || resolvedUid).toLowerCase();
      }
    } catch {}
  }

  const currentStatuses: Record<string, UserTaskStatus> = { ...(task.userStatuses || {}) };
  const rejectedStatus: UserTaskStatus = {
    status: 'rejected',
    submissionId: submissionId || task.latestSubmission?.id,
    rejectionReason: reason.trim(),
    reviewedBy: reviewer.email.toLowerCase(),
    reviewedByName: reviewer.displayName,
    reviewedAt: serverTimestamp() as unknown as Timestamp,
  };

  if (targetIdentifier) currentStatuses[targetIdentifier] = rejectedStatus;
  if (resolvedUid) currentStatuses[resolvedUid] = rejectedStatus;
  if (notifyEmail) currentStatuses[notifyEmail.toLowerCase()] = rejectedStatus;

  await updateDoc(doc(db, 'tasks', task.id), {
    status: 'in_progress',
    'latestSubmission.status': 'rejected',
    'latestSubmission.rejectionReason': reason.trim(),
    'latestSubmission.reviewedBy': reviewer.email.toLowerCase(),
    'latestSubmission.reviewedByName': reviewer.displayName,
    'latestSubmission.reviewedAt': serverTimestamp(),
    [`userStatuses.${targetIdentifier}`]: rejectedStatus,
    ...(resolvedUid ? { [`userStatuses.${resolvedUid}`]: rejectedStatus } : {}),
    ...(notifyEmail ? { [`userStatuses.${notifyEmail.toLowerCase()}`]: rejectedStatus } : {}),
    updatedAt: serverTimestamp(),
  });

  if (submissionId) {
    try {
      const subRef = doc(db, 'tasks', task.id, 'submissions', submissionId);
      await updateDoc(subRef, {
        status: 'rejected',
        rejectionReason: reason.trim(),
        reviewedBy: reviewer.email.toLowerCase(),
        reviewedByName: reviewer.displayName,
        reviewedAt: serverTimestamp(),
      });
    } catch {}
  }

  patchLocalTask(task.id, (t) => {
    const uStatuses = { ...(t.userStatuses || {}) };
    const localStatus: UserTaskStatus = {
      status: 'rejected',
      submissionId: submissionId || t.latestSubmission?.id,
      rejectionReason: reason.trim(),
      reviewedBy: reviewer.email.toLowerCase(),
      reviewedByName: reviewer.displayName,
      reviewedAt: new Date().toISOString() as any,
    };
    if (targetIdentifier) uStatuses[targetIdentifier] = localStatus;
    if (resolvedUid) uStatuses[resolvedUid] = localStatus;
    if (notifyEmail) uStatuses[notifyEmail.toLowerCase()] = localStatus;

    return {
      ...t,
      status: 'in_progress' as any,
      latestSubmission: t.latestSubmission ? {
        ...t.latestSubmission,
        status: 'rejected' as any,
        rejectionReason: reason.trim(),
        reviewedBy: reviewer.email.toLowerCase(),
        reviewedByName: reviewer.displayName,
        reviewedAt: new Date().toISOString() as any,
      } : t.latestSubmission,
      userStatuses: uStatuses,
      updatedAt: new Date().toISOString() as any,
    };
  });

  createNotification({
    recipientEmail: notifyEmail,
    recipientUid: resolvedUid,
    type: 'task_rejected',
    title: 'المهمة بحاجة إلى تعديل ⚠️',
    message: `طلب المشرف تعديلاً على تسليمك للمهمة "${task.title}": ${reason.trim()}`,
    taskId: task.id,
  }).catch(() => {});

  logActivity({
    actor: reviewer.email,
    actorName: reviewer.displayName,
    actorPhoto: reviewer.photoURL || '',
    action: 'task.rejected',
    targetType: 'task',
    targetId: task.id,
    targetName: task.title,
    metadata: { reason: reason.trim() },
  }).catch(() => {});
}

export async function deleteTask(
  taskId: string,
  taskTitle: string,
  actor: { email: string; displayName: string; photoURL?: string }
) {
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (err) {
    console.warn('Supabase deleteDoc notice (proceeding with local cleanup):', err);
    // Re-throw only if we could not delete from Supabase and local also has no entry;
    // For offline-first resilience we still clean local below and let caller handle success.
    // To surface hard failures, rethrow if desired – but don't block local cleanup.
    // We intentionally do NOT rethrow here to allow offline deletion to appear successful via local cache.
  }

  // Clean local fallback storage so deleted task disappears from all cached views
  try {
    const localTasks: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_tasks') || '[]');
    const filtered = localTasks.filter((t: any) => t.id !== taskId);
    if (filtered.length !== localTasks.length || localTasks.length > 0) {
      localStorage.setItem('elgogalyia_local_tasks', JSON.stringify(filtered));
    }
    // Notify all listeners (TasksPage, MyTasksPage) to refresh from local cache immediately
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch (e) {
    console.warn('deleteTask local cleanup notice:', e);
  }

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    actorPhoto: actor.photoURL || '',
    action: 'task.deleted',
    targetType: 'task',
    targetId: taskId,
    targetName: taskTitle,
  }).catch(() => {});
}

// ─── O Coins (Audited Manual Adjustments) ────────────────────────────────────

export async function manualOCoinAdjustment(params: {
  targetUser: UserProfile;
  amount: number;
  type?: OCoinTransactionType;
  reason: string;
  description?: string;
  source?: string;
  actor: { email: string; displayName: string; photoURL?: string };
}) {
  const { targetUser, amount, reason, description, source = 'admin_manual', actor } = params;
  const isDeduction = params.type === 'manual_remove' || params.type === 'penalty_deduction';
  const finalType: OCoinTransactionType = params.type || (isDeduction ? 'penalty_deduction' : 'manual_reward');
  const delta = isDeduction ? -Math.abs(amount) : Math.abs(amount);

  // 1. Fetch fresh balance from Supabase to prevent race conditions
  let currentBalance = Number(targetUser.oCoinsBalance) || 0;
  if (targetUser.uid) {
    try {
      const userSnap = await getDoc(doc(db, 'users', targetUser.uid));
      if (userSnap.exists()) {
        const udata = userSnap.data();
        if (typeof udata.oCoinsBalance === 'number') {
          currentBalance = udata.oCoinsBalance;
        }
      }
    } catch (err) {
      console.warn('manualOCoinAdjustment fetch user balance warning:', err);
    }
  }

  const previousBalance = currentBalance;
  const newBalance = Math.max(0, previousBalance + delta);

  const batch = writeBatch(db);
  const ocoinRef = doc(collection(db, 'oCoins'));
  const userTargetId = (targetUser.username || targetUser.email || '').toLowerCase();

  const transactionData: any = {
    userEmail: userTargetId,
    userDisplayName: targetUser.displayName || targetUser.username || 'عضو الفريق',
    uid: targetUser.uid,
    employeeId: targetUser.uid,
    employeeName: targetUser.displayName || targetUser.username || 'عضو الفريق',
    amount: delta,
    type: finalType,
    reason: reason.trim(),
    description: (description || reason).trim(),
    source,
    previousBalance,
    newBalance,
    taskId: null,
    taskTitle: null,
    createdBy: (actor.email || 'admin').toLowerCase(),
    createdByName: actor.displayName || 'الإدارة',
    createdAt: serverTimestamp(),
  };

  batch.set(ocoinRef, transactionData);

  if (targetUser.uid) {
    batch.update(doc(db, 'users', targetUser.uid), {
      oCoinsBalance: newBalance,
      updatedAt: serverTimestamp(),
    });
  }

  // Atomic commit
  await batch.commit();

  // 2. Update local storage for immediate UI synchronization
  try {
    const localUsers: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
    const uIdx = localUsers.findIndex((u: any) => u.uid === targetUser.uid);
    if (uIdx !== -1) {
      localUsers[uIdx].oCoinsBalance = newBalance;
      localStorage.setItem('elgogalyia_local_users', JSON.stringify(localUsers));
    }
    const sessRaw = localStorage.getItem('elgogalyia_user_session');
    if (sessRaw) {
      const sess: any = JSON.parse(sessRaw);
      if (sess.uid === targetUser.uid) {
        sess.oCoinsBalance = newBalance;
        localStorage.setItem('elgogalyia_user_session', JSON.stringify(sess));
      }
    }
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch {}

  // 3. Send single rich notification with full context and direct link
  const formattedReason = reason.trim();
  const formattedDesc = (description && description.trim() !== formattedReason) ? description.trim() : '';
  const notifMessage = formattedDesc
    ? `السبب: ${formattedReason}\nالتفاصيل: ${formattedDesc}\nالرصيد الجديد: ${newBalance} OC`
    : `السبب: ${formattedReason}\nالرصيد الجديد: ${newBalance} OC`;

  createNotification({
    recipientEmail: userTargetId,
    recipientUid: targetUser.uid,
    type: delta > 0 ? 'ocoin_added' : 'ocoin_removed',
    title: delta > 0 ? `+${Math.abs(amount)} O Coins 🪙 مكافأة جديدة` : `-${Math.abs(amount)} O Coins 🪙 خصم رصيد`,
    message: notifMessage,
    taskId: null,
    relatedEntityType: 'ocoin',
    relatedEntityId: ocoinRef.id,
    actionUrl: '/ocoins',
  }).catch(() => {});

  // 4. Log activity
  logActivity({
    actor: actor.email || 'admin',
    actorName: actor.displayName || 'الإدارة',
    actorPhoto: actor.photoURL || '',
    action: delta > 0 ? 'ocoin.manual_add' : 'ocoin.manual_remove',
    targetType: 'ocoin',
    targetId: targetUser.uid,
    targetName: targetUser.displayName,
    metadata: {
      amount: delta,
      type: finalType,
      reason: formattedReason,
      previousBalance,
      newBalance,
      transactionId: ocoinRef.id,
    },
  }).catch(() => {});

  return ocoinRef.id;
}

export async function deleteOCoinTransaction(
  transactionId: string,
  actor: { email: string; displayName: string }
) {
  try {
    await deleteDoc(doc(db, 'oCoins', transactionId));
  } catch (err) {
    console.warn('deleteOCoinTransaction Supabase error:', err);
  }

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    action: 'ocoin.deleted' as any,
    targetType: 'ocoin',
    targetId: transactionId,
    targetName: 'حذف سجل معاملة O Coin',
    metadata: { transactionId },
  }).catch(() => {});
}

export async function clearAllOCoinTransactions(
  actor: { email: string; displayName: string }
) {
  try {
    const snap = await getDocs(collection(db, 'oCoins'));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.warn('clearAllOCoinTransactions Supabase error:', err);
  }

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    action: 'ocoin.deleted' as any,
    targetType: 'ocoin',
    targetId: 'all',
    targetName: 'مسح جميع سجلات معاملات O Coins',
    metadata: {},
  }).catch(() => {});
}

// ─── Access Management & Employees ───────────────────────────────────────────

export async function addAuthorizedUser(
  userData: Omit<AuthorizedUser, 'uid' | 'createdAt'>,
  actor: { email: string; displayName: string; photoURL?: string }
) {
  const emailKey = (userData.email || userData.username || '').trim().toLowerCase();
  const docRef = doc(db, 'authorizedUsers', emailKey);
  const newUser = {
    ...userData,
    email: emailKey,
    uid: null,
    createdAt: serverTimestamp(),
  };

  const generatedUid = 'user_' + emailKey.replace(/[^a-z0-9]/g, '_');
  const userProfileDoc = {
    uid: generatedUid,
    email: emailKey,
    username: userData.username || emailKey,
    displayName: userData.displayName || emailKey.split('@')[0],
    photoURL: userData.photoURL || '',
    role: userData.role || 'employee',
    permissions: userData.permissions || [],
    status: userData.status || 'active',
    oCoinsBalance: 0,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, newUser);
    await setDoc(doc(db, 'users', generatedUid), userProfileDoc);
  } catch (err) {
    console.warn('Supabase setDoc notice (synced locally):', err);
  }

  // Always update local stores & trigger event so UI updates instantly
  try {
    const localAuth = JSON.parse(localStorage.getItem('elgogalyia_local_authorized') || '[]');
    const filteredAuth = localAuth.filter((u: any) => (u.email || '').trim().toLowerCase() !== emailKey);
    filteredAuth.push({
      ...userData,
      email: emailKey,
      uid: generatedUid,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('elgogalyia_local_authorized', JSON.stringify(filteredAuth));

    const localUsers = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
    const filteredUsers = localUsers.filter((u: any) => (u.email || '').trim().toLowerCase() !== emailKey);
    filteredUsers.push({
      ...userProfileDoc,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('elgogalyia_local_users', JSON.stringify(filteredUsers));
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch (e) {
    console.warn('Local storage sync error:', e);
  }

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    actorPhoto: actor.photoURL || '',
    action: 'user.created',
    targetType: 'user',
    targetId: emailKey,
    targetName: userData.displayName,
    metadata: { role: userData.role },
  }).catch(() => {});
}

export async function updateUserAccess(
  email: string,
  updates: Partial<AuthorizedUser>,
  actor: { email: string; displayName: string; photoURL?: string }
) {
  const emailKey = email.trim().toLowerCase();
  const docRef = doc(db, 'authorizedUsers', emailKey);

  try {
    await updateDoc(docRef, updates);
  } catch (err) {
    console.warn('Supabase updateUserAccess notice:', err);
  }

  try {
    const localAuth = JSON.parse(localStorage.getItem('elgogalyia_local_authorized') || '[]');
    const updatedAuth = localAuth.map((u: any) =>
      (u.email || '').trim().toLowerCase() === emailKey ? { ...u, ...updates } : u
    );
    localStorage.setItem('elgogalyia_local_authorized', JSON.stringify(updatedAuth));

    const localUsers = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
    const updatedUsers = localUsers.map((u: any) =>
      (u.email || '').trim().toLowerCase() === emailKey ? { ...u, ...updates } : u
    );
    localStorage.setItem('elgogalyia_local_users', JSON.stringify(updatedUsers));
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch (e) {}

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    actorPhoto: actor.photoURL || '',
    action: updates.role ? 'user.role_changed' : 'user.status_changed',
    targetType: 'user',
    targetId: emailKey,
    targetName: emailKey,
    metadata: updates,
  }).catch(() => {});
}

export async function removeAuthorizedUser(
  email: string,
  actor: { email: string; displayName: string; photoURL?: string }
) {
  const emailKey = email.trim().toLowerCase();
  const docRef = doc(db, 'authorizedUsers', emailKey);

  try {
    await updateDoc(docRef, { status: 'disabled' });
  } catch (err) {
    console.warn('Supabase removeAuthorizedUser notice:', err);
  }

  try {
    const localAuth = JSON.parse(localStorage.getItem('elgogalyia_local_authorized') || '[]');
    const updatedAuth = localAuth.map((u: any) =>
      (u.email || '').trim().toLowerCase() === emailKey ? { ...u, status: 'disabled' } : u
    );
    localStorage.setItem('elgogalyia_local_authorized', JSON.stringify(updatedAuth));

    const localUsers = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
    const updatedUsers = localUsers.map((u: any) =>
      (u.email || '').trim().toLowerCase() === emailKey ? { ...u, status: 'disabled' } : u
    );
    localStorage.setItem('elgogalyia_local_users', JSON.stringify(updatedUsers));
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch (e) {}

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    actorPhoto: actor.photoURL || '',
    action: 'user.removed',
    targetType: 'user',
    targetId: emailKey,
    targetName: emailKey,
    metadata: {},
  }).catch(() => {});
}

// ─── Authorized Google Admins Whitelist ──────────────────────────────────────

export async function addAuthorizedAdmin(
  adminData: {
    email: string;
    displayName?: string;
    role: 'superAdmin' | 'admin';
  },
  actor: { email: string; displayName: string }
) {
  const emailKey = adminData.email.trim().toLowerCase();
  const docRef = doc(db, 'authorized_admins', emailKey);

  const payload = {
    email: emailKey,
    displayName: adminData.displayName?.trim() || emailKey.split('@')[0],
    role: adminData.role,
    status: 'active' as const,
    createdBy: actor.email.toLowerCase(),
    createdAt: serverTimestamp(),
  };

  await setDoc(docRef, payload, { merge: true });

  // Also sync with users collection for Supabase Rules and local storage
  const generatedUid = 'user_' + emailKey.replace(/[^a-z0-9]/g, '_');
  try {
    await setDoc(doc(db, 'users', generatedUid), {
      uid: generatedUid,
      email: emailKey,
      username: emailKey.split('@')[0],
      displayName: adminData.displayName?.trim() || emailKey.split('@')[0],
      role: adminData.role,
      status: 'active',
      permissions: [
        'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
        'tasks.review', 'tasks.view_all', 'employees.view', 'employees.manage',
        'ocoins.manage', 'ocoins.view_all', 'reports.view', 'reports.export',
        'access.manage', 'activity.view', 'notifications.send'
      ],
      oCoinsBalance: 1000,
      createdAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn('Sync admin profile notice:', e);
  }

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    action: 'user.created',
    targetType: 'user',
    targetId: emailKey,
    targetName: adminData.displayName || emailKey,
    metadata: { role: adminData.role, type: 'google_admin' },
  }).catch(() => {});
}

export async function removeAuthorizedAdmin(
  email: string,
  actor: { email: string; displayName: string }
) {
  const emailKey = email.trim().toLowerCase();
  try {
    await deleteDoc(doc(db, 'authorized_admins', emailKey));
  } catch (err) {
    console.warn('removeAuthorizedAdmin notice:', err);
  }

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    action: 'user.removed',
    targetType: 'user',
    targetId: emailKey,
    targetName: emailKey,
    metadata: { type: 'google_admin_removed' },
  }).catch(() => {});
}

export async function toggleAuthorizedAdminStatus(
  email: string,
  currentStatus: 'active' | 'inactive',
  actor: { email: string; displayName: string }
) {
  const emailKey = email.trim().toLowerCase();
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  await updateDoc(doc(db, 'authorized_admins', emailKey), {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  logActivity({
    actor: actor.email,
    actorName: actor.displayName,
    action: 'user.status_changed',
    targetType: 'user',
    targetId: emailKey,
    targetName: emailKey,
    metadata: { newStatus },
  }).catch(() => {});
}

export function subscribeAuthorizedAdmins(callback: (admins: AuthorizedAdmin[]) => void): () => void {
  try {
    const q = query(collection(db, 'authorized_admins'));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AuthorizedAdmin[];
      callback(list);
    }, (err) => {
      console.warn('subscribeAuthorizedAdmins notice:', err);
      callback([]);
    });
  } catch {
    callback([]);
    return () => {};
  }
}
