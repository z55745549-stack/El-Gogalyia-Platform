import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  db,
} from './supabase';
import { logActivity } from './database-service';
import type { AttendanceSession, AttendanceRecord, AttendanceSessionStatus } from '@/types/attendance';
import type { UserProfile } from '@/types';

// ─── 1. Unique Permanent Employee Code Generator ─────────────────────────────
// Format: GOGA-33001, GOGA-33002, etc.
export function generateEmployeeCode(seed?: string | number): string {
  if (typeof seed === 'number' && seed > 0) {
    const num = 33000 + seed;
    return `GOGA-${num}`;
  }
  // Generate deterministic or safe random unique code in the 33000-39999 range
  if (typeof seed === 'string' && seed.length > 0) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const num = 33000 + (Math.abs(hash) % 6999);
    return `GOGA-${num}`;
  }
  const randomNum = Math.floor(33001 + Math.random() * 6990);
  return `GOGA-${randomNum}`;
}

// Ensure every user has a permanent unique employeeCode
export async function ensureUserEmployeeCode(user: UserProfile): Promise<string> {
  if (user.employeeCode && user.employeeCode.startsWith('GOGA-')) {
    return user.employeeCode;
  }

  const generated = generateEmployeeCode(user.username || user.uid);
  try {
    if (user.uid) {
      await updateDoc(doc(db, 'users', user.uid), {
        employeeCode: generated,
      });
    }
  } catch (err) {
    console.warn('ensureUserEmployeeCode error:', err);
  }

  // Update local session
  try {
    const sessRaw = localStorage.getItem('elgogalyia_user_session');
    if (sessRaw) {
      const sess = JSON.parse(sessRaw);
      if (sess.uid === user.uid) {
        sess.employeeCode = generated;
        localStorage.setItem('elgogalyia_user_session', JSON.stringify(sess));
      }
    }
  } catch {}

  return generated;
}

// ─── 2. Create Attendance Session ────────────────────────────────────────────
export async function createAttendanceSession(params: {
  title: string;
  description?: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  creator: UserProfile;
}): Promise<string> {
  const { title, description = '', date, startTime, endTime, creator } = params;

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const secureToken = `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  const now = serverTimestamp();

  const sessionData: AttendanceSession = {
    id: sessionId,
    title: title.trim(),
    description: description.trim(),
    date,
    startTime,
    endTime,
    status: 'active',
    secureToken,
    sessionCode: secureToken,
    session_code: secureToken,
    createdBy: creator.uid,
    createdByName: creator.displayName || creator.username || 'المشرف',
    createdAt: now as any,
    closedAt: null,
    attendeesCount: 0,
    total_attended: 0 as any,
  };

  await setDoc(doc(db, 'attendance_sessions', sessionId), sessionData);

  // Log activity
  await logActivity({
    actor: creator.uid,
    actorName: creator.displayName || 'المشرف',
    actorPhoto: creator.photoURL || '',
    action: 'attendance.session_created' as any,
    targetType: 'attendance_session' as any,
    targetId: sessionId,
    targetName: title,
    metadata: { date, startTime, endTime },
  });

  return sessionId;
}

// ─── 3. Update Session Status (Active / Paused / Closed) ──────────────────────
export async function updateSessionStatus(
  sessionId: string,
  status: AttendanceSessionStatus,
  actor: UserProfile
): Promise<void> {
  const sessionRef = doc(db, 'attendance_sessions', sessionId);
  const updates: any = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (status === 'closed') {
    updates.closedAt = serverTimestamp();
  }

  await updateDoc(sessionRef, updates);

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: `attendance.session_${status}` as any,
    targetType: 'attendance_session' as any,
    targetId: sessionId,
    targetName: sessionId,
    metadata: { newStatus: status },
  });
}

// ─── 3.1. Delete Attendance Session ──────────────────────────────────────────
export async function deleteAttendanceSession(
  sessionId: string,
  actor?: UserProfile
): Promise<void> {
  const sessionRef = doc(db, 'attendance_sessions', sessionId);
  await deleteDoc(sessionRef);

  if (actor) {
    await logActivity({
      actor: actor.uid,
      actorName: actor.displayName || 'المشرف',
      actorPhoto: actor.photoURL || '',
      action: 'attendance.session_deleted' as any,
      targetType: 'attendance_session' as any,
      targetId: sessionId,
      targetName: sessionId,
      metadata: { deletedAt: new Date().toISOString() },
    }).catch(() => {});
  }
}

// ─── 4. Record Employee Attendance via QR Check-in ───────────────────────────
export async function recordAttendance(params: {
  sessionId: string;
  token: string;
  employee: UserProfile;
}): Promise<{ alreadyRecorded: boolean; record: AttendanceRecord }> {
  const { sessionId, token, employee } = params;

  if (!employee || !employee.uid) {
    throw new Error('يرجى تسجيل الدخول بحسابك أولاً لتسجيل الحضور.');
  }

  // 1. Fetch and validate session
  const sessionRef = doc(db, 'attendance_sessions', sessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) {
    throw new Error('جلسة تسجيل الحضور غير موجودة.');
  }

  const session = sessionSnap.data() as AttendanceSession;

  // Validate security token
  if (session.secureToken !== token) {
    throw new Error('رمز التحقق للجلسة غير صالح أو منتهي الصلاحية.');
  }

  // Validate status
  if (session.status !== 'active') {
    throw new Error(
      session.status === 'paused'
        ? 'تم إيقاف تسجيل الحضور مؤقتاً بواسطة المشرف.'
        : 'تم إغلاق جلسة تسجيل الحضور هذه ولم تعد تقبل تسجيلات جديدة.'
    );
  }

  // Ensure employee has a permanent employee code
  const code = employee.employeeCode || (await ensureUserEmployeeCode(employee));

  // 2. Check for duplicate registration (Idempotent check via atomic doc ID)
  const recordId = `${sessionId}_${employee.uid}`;
  const recordRef = doc(db, 'attendance_records', recordId);
  const existingSnap = await getDoc(recordRef);

  if (existingSnap.exists()) {
    return {
      alreadyRecorded: true,
      record: existingSnap.data() as AttendanceRecord,
    };
  }

  // Format current check-in time e.g. "5:14 PM"
  const now = new Date();
  const checkInTimeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Calculate if late: compare current time to session startTime
  let recordStatus: 'present' | 'late' = 'present';
  try {
    const [startH, startM] = (session.startTime || '00:00').split(':').map(Number);
    const startObj = new Date();
    startObj.setHours(startH, startM + 15, 0, 0); // 15 mins grace period
    if (now.getTime() > startObj.getTime()) {
      recordStatus = 'late';
    }
  } catch {}

  const newRecord: AttendanceRecord = {
    id: recordId,
    sessionId,
    sessionTitle: session.title,
    employeeId: employee.uid,
    employeeName: employee.displayName || employee.username || 'عضو الفريق',
    employeeCode: code,
    employeePhoto: employee.photoURL || '',
    checkInTime: checkInTimeStr,
    checkInTimestamp: serverTimestamp() as any,
    date: session.date || new Date().toISOString().split('T')[0],
    status: recordStatus,
    createdAt: serverTimestamp() as any,
  };

  // Atomic write: save record and increment session counter
  const batch = writeBatch(db);
  batch.set(recordRef, newRecord);
  batch.update(sessionRef, {
    attendeesCount: increment(1),
  });

  await batch.commit();

  // Log activity
  logActivity({
    actor: employee.uid,
    actorName: employee.displayName || employee.username || 'عضو الفريق',
    actorPhoto: employee.photoURL || '',
    action: 'attendance.check_in' as any,
    targetType: 'attendance_record' as any,
    targetId: recordId,
    targetName: `${session.title} (${code})`,
    metadata: { sessionId, checkInTime: checkInTimeStr, status: recordStatus },
  }).catch(() => {});

  return {
    alreadyRecorded: false,
    record: newRecord,
  };
}

// ─── 5. Realtime Subscriptions ───────────────────────────────────────────────

// Subscribe to all attendance sessions (Admin)
export function subscribeAttendanceSessions(
  callback: (sessions: AttendanceSession[]) => void
): () => void {
  const q = query(collection(db, 'attendance_sessions'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceSession));
      list.sort((a, b) => {
        const tA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : new Date(a.createdAt as any || 0).getTime();
        const tB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : new Date(b.createdAt as any || 0).getTime();
        return tB - tA;
      });
      callback(list);
    },
    (err) => console.warn('subscribeAttendanceSessions notice:', err)
  );
}

// Subscribe to records of a specific session (Admin)
export function subscribeSessionRecords(
  sessionId: string,
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const q = query(
    collection(db, 'attendance_records'),
    where('sessionId', '==', sessionId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
      list.sort((a, b) => {
        const tA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : new Date(a.createdAt as any || 0).getTime();
        const tB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : new Date(b.createdAt as any || 0).getTime();
        return tB - tA;
      });
      callback(list);
    },
    (err) => console.warn('subscribeSessionRecords notice:', err)
  );
}

// Subscribe to personal attendance records for an employee
export function subscribeEmployeeAttendance(
  employeeId: string,
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const q = query(
    collection(db, 'attendance_records'),
    where('employeeId', '==', employeeId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
      list.sort((a, b) => {
        const tA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : new Date(a.createdAt as any || 0).getTime();
        const tB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : new Date(b.createdAt as any || 0).getTime();
        return tB - tA;
      });
      callback(list);
    },
    (err) => console.warn('subscribeEmployeeAttendance notice:', err)
  );
}
