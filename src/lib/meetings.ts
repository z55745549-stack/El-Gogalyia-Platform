// @ts-nocheck
import { collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, db } from './supabase';
import type { Meeting } from '@/types';
import { canViewAllBans } from './security';
import { createMeetingSchema, sanitizeInput } from './validation';
import { rateLimitOrThrow, RATE_LIMITS } from './rateLimiter';

const LOCAL_KEY = 'elgogalyia_local_meetings';

function readLocal(): Meeting[] { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } }
function writeLocal(list: Meeting[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('elgogalyia_data_change'));
    window.dispatchEvent(new Event('elgogalyia_meetings_change'));
  } catch {}
}

export async function createMeeting(data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>, creator: { uid: string; email: string; displayName: string }): Promise<string> {
  // RBAC: only admin can create meetings
  const viewerRaw = localStorage.getItem('elgogalyia_user_session');
  const viewer = viewerRaw ? JSON.parse(viewerRaw) : null;
  if (!canViewAllBans(viewer)) throw new Error('Forbidden: Only admins can create meetings');
  rateLimitOrThrow(`meeting_create_${viewer?.uid || 'anon'}`, RATE_LIMITS.meetings_write);
  // Validation
  const validation = createMeetingSchema.safeParse({ title: data.title, description: data.description, date: data.date as any, startTime: data.startTime, durationMinutes: Number(data.durationMinutes), location: data.location, type: data.type, status: data.status });
  if (!validation.success) {
    const issues: any = (validation.error as any).errors ?? (validation.error as any).issues ?? [];
    throw new Error(`Validation failed: ${issues.map((e: any)=>e.message).join(', ')}`);
  }

  const id = `meeting_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const now = new Date().toISOString();
  const meeting: Meeting = {
    id,
    title: sanitizeInput(data.title.trim()),
    description: sanitizeInput((data.description || '').trim()),
    date: data.date as any,
    startTime: data.startTime,
    durationMinutes: Number(data.durationMinutes) || 60,
    location: sanitizeInput(data.location.trim()),
    type: data.type,
    status: data.status,
    createdBy: creator.email.toLowerCase(),
    createdByName: creator.displayName,
    createdAt: now as any,
    updatedAt: now as any,
  };
  if (data.date instanceof Date) (meeting as any).date = Timestamp.fromDate(data.date);
  else if (typeof data.date === 'string') (meeting as any).date = Timestamp.fromDate(new Date(data.date));

  try {
    await setDoc(doc(db, 'meetings', id), { ...meeting, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (e) { console.warn('createMeeting Supabase notice', e); }

  const localMeeting: any = { ...meeting, date: (meeting as any).date?.toDate ? (meeting as any).date.toDate().toISOString() : now };
  const existing = readLocal();
  existing.unshift(localMeeting);
  writeLocal(existing);

  // notify all employees (best effort)
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const { createNotification } = await import('./database-service');
    for (const d of usersSnap.docs) {
      const u: any = d.data();
      if (u.status !== 'active') continue;
      const recipient = (u.email || u.username || '').toLowerCase();
      if (!recipient) continue;
      await createNotification({
        recipientEmail: recipient,
        recipientUid: d.id,
        type: 'meeting.created' as any,
        title: `New meeting: ${meeting.title}`,
        message: `${meeting.title} on ${new Date((meeting as any).date?.toDate ? (meeting as any).date.toDate() : meeting.date as any).toLocaleDateString()} at ${meeting.startTime} — ${meeting.location}`,
        taskId: null,
      }).catch(()=>{});
    }
  } catch {}

  try {
    const { logActivity } = await import('./database-service');
    await logActivity({ actor: creator.email, actorName: creator.displayName, action: 'meeting.created' as any, targetType: 'meeting' as any, targetId: id, targetName: meeting.title, metadata: { location: meeting.location } });
  } catch {}

  return id;
}

export async function updateMeeting(id: string, updates: Partial<Meeting>, actor: { email: string; displayName: string }): Promise<void> {
  const viewerRaw = localStorage.getItem('elgogalyia_user_session');
  const viewer = viewerRaw ? JSON.parse(viewerRaw) : null;
  if (!canViewAllBans(viewer)) throw new Error('Forbidden');
  rateLimitOrThrow(`meeting_update_${viewer?.uid || 'anon'}`, RATE_LIMITS.meetings_write);
  try {
    await updateDoc(doc(db, 'meetings', id), { ...updates, updatedAt: serverTimestamp() });
  } catch (e) { console.warn('updateMeeting notice', e); }
  const list = readLocal();
  const idx = list.findIndex(m => m.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() as any };
    writeLocal(list);
  }
  try {
    const { logActivity } = await import('./database-service');
    await logActivity({ actor: actor.email, actorName: actor.displayName, action: 'meeting.updated' as any, targetType: 'meeting' as any, targetId: id, targetName: updates.title || id, metadata: updates as any });
  } catch {}
}

export async function deleteMeeting(id: string, title: string, actor: { email: string; displayName: string }): Promise<void> {
  const viewerRaw = localStorage.getItem('elgogalyia_user_session');
  const viewer = viewerRaw ? JSON.parse(viewerRaw) : null;
  if (!canViewAllBans(viewer)) throw new Error('Forbidden: Only admins can delete meetings');
  rateLimitOrThrow(`meeting_delete_${viewer?.uid || 'anon'}`, RATE_LIMITS.meetings_write);
  try {
    await deleteDoc(doc(db, 'meetings', id));
  } catch (e) { console.warn('deleteMeeting Supabase notice', e); }
  const list = readLocal().filter(m => m.id !== id);
  writeLocal(list);
  try {
    const { logActivity } = await import('./database-service');
    await logActivity({ actor: actor.email, actorName: actor.displayName, action: 'meeting.deleted' as any, targetType: 'meeting' as any, targetId: id, targetName: title, metadata: {} });
  } catch {}
}

export function subscribeMeetings(callback: (meetings: Meeting[]) => void): () => void {
  // 1. Initial immediate paint from cached local storage (if any) before network connects
  const initialLocal = readLocal();
  if (initialLocal.length > 0) {
    initialLocal.sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime());
    callback(initialLocal);
  }

  try {
    const q = query(collection(db, 'meetings'), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        // Canonical source of truth: documents currently in Supabase
        const fsList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting));
        fsList.sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime());
        
        // Sync local cache strictly to server truth so deletions propagate immediately everywhere
        writeLocal(fsList);
        callback(fsList);
      },
      (err) => {
        console.warn('meetings snapshot error, using cached data:', err);
        const local = readLocal();
        local.sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime());
        callback(local);
      }
    );

    const handleLocalChange = () => {
      const local = readLocal();
      local.sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime());
      callback(local);
    };

    window.addEventListener('elgogalyia_meetings_change', handleLocalChange);
    return () => {
      unsub();
      window.removeEventListener('elgogalyia_meetings_change', handleLocalChange);
    };
  } catch (err) {
    console.error('subscribeMeetings init error:', err);
    const local = readLocal();
    callback(local);
    return () => {};
  }
}

export function getCountdown(date: any, startTime: string): string {
  try {
    const d = date?.toDate ? date.toDate() : new Date(date);
    const [h,m] = startTime.split(':').map(Number);
    const start = new Date(d);
    start.setHours(h||0, m||0, 0, 0);
    const diff = start.getTime() - Date.now();
    if (diff <= 0) return 'Started';
    const days = Math.floor(diff / (1000*60*60*24));
    const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    if (days > 0) return `in ${days}d ${hours}h`;
    const mins = Math.floor((diff % (1000*60*60)) / (1000*60));
    if (hours > 0) return `in ${hours}h ${mins}m`;
    return `in ${mins}m`;
  } catch { return ''; }
}
