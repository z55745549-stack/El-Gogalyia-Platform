// @ts-nocheck
import { collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Ban, UserProfile } from '@/types';
import { canViewAllBans, filterBansForUser, sanitizeBansForViewer } from './security';
import { createBanSchema, sanitizeInput } from './validation';
import { rateLimitOrThrow, RATE_LIMITS } from './rateLimiter';
import { logBanAccess } from './audit';

const LOCAL_BANS = 'elgogalyia_local_bans';

function readLocal(): Ban[] { try { return JSON.parse(localStorage.getItem(LOCAL_BANS) || '[]'); } catch { return []; } }
function writeLocal(list: Ban[]) {
  try {
    localStorage.setItem(LOCAL_BANS, JSON.stringify(list));
    window.dispatchEvent(new Event('elgogalyia_data_change'));
    window.dispatchEvent(new Event('elgogalyia_bans_change'));
  } catch {}
}

function getCurrentViewer(): UserProfile | null {
  try {
    const raw = localStorage.getItem('elgogalyia_user_session');
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch { return null; }
}

function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (v instanceof Date) return v;
  if (typeof v === 'object' && 'toDate' in v) try { return v.toDate(); } catch { return new Date(0); }
  if (typeof v === 'object' && typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  return new Date(v);
}

export function isBanActive(ban: Ban): boolean {
  if (ban.status !== 'active') return false;
  const end = toDate(ban.endAt);
  return end.getTime() > Date.now();
}

export function getActiveBan(bans: Ban[], uid: string): Ban | null {
  const now = Date.now();
  const active = bans.filter(b => b.employeeId === uid && b.status === 'active' && toDate(b.endAt).getTime() > now);
  if (active.length === 0) return null;
  active.sort((a,b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
  return active[0];
}

export async function createBan(params: {
  employee: UserProfile;
  startAt: Date;
  endAt: Date;
  reason: string;
  internalNote?: string;
  actor: { uid: string; email: string; displayName: string; photoURL?: string };
}): Promise<string> {
  const viewer = getCurrentViewer();
  // 1. RBAC check - only admin/super_admin/committee roles can ban
  if (!canViewAllBans(viewer)) {
    throw new Error('Forbidden: Only admins can create bans');
  }
  // 2. Rate limiting
  rateLimitOrThrow(`ban_create_${viewer?.uid || 'anon'}`, RATE_LIMITS.bans_write);
  // 3. Input validation with Zod
  const validation = createBanSchema.safeParse({
    employeeId: params.employee.uid,
    startAt: params.startAt,
    endAt: params.endAt,
    reason: params.reason,
    internalNote: params.internalNote,
  });
  if (!validation.success) {
    const issues: any = (validation.error as any).errors ?? (validation.error as any).issues ?? [];
    throw new Error(`Validation failed: ${issues.map((e: any) => e.message).join(', ')}`);
  }
  // 4. Sanitize inputs (XSS prevention)
  const sanitizedReason = sanitizeInput(params.reason);
  const sanitizedNote = params.internalNote ? sanitizeInput(params.internalNote) : undefined;

  const { employee, startAt, endAt, actor } = params;
  const reason = sanitizedReason;
  const internalNote = sanitizedNote;
  if (endAt.getTime() <= startAt.getTime()) throw new Error('End must be after start');
  const nowIso = new Date().toISOString();
  const banId = `ban_${employee.uid}_${Date.now()}`;
  const currentBalance = employee.oCoinsBalance ?? 0;
  const penalty = currentBalance;

  const existing = readLocal().find(b => b.employeeId === employee.uid && b.status === 'active' && toDate(b.endAt).getTime() > Date.now());
  if (existing) throw new Error('Employee already has an active ban');

  const ban: Ban = {
    id: banId,
    employeeId: employee.uid,
    employeeUsername: employee.username,
    employeeName: employee.displayName,
    employeePhoto: employee.photoURL || '',
    committeeId: (employee as any).committeeId || null,
    createdBy: actor.uid || actor.email,
    createdByName: actor.displayName,
    startAt: Timestamp.fromDate(startAt) as any,
    endAt: Timestamp.fromDate(endAt) as any,
    reason: reason.trim(),
    internalNote: (internalNote || '').trim() || undefined,
    status: 'active',
    coinPenalty: penalty,
    createdAt: serverTimestamp() as any,
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'bans', banId), ban);
  batch.update(doc(db, 'users', employee.uid), { status: 'suspended', oCoinsBalance: 0, updatedAt: serverTimestamp() });
  if (penalty > 0) {
    const ocoinRef = doc(collection(db, 'oCoins'));
    batch.set(ocoinRef, {
      userEmail: (employee.email || employee.username || '').toLowerCase(),
      userDisplayName: employee.displayName,
      uid: employee.uid,
      amount: -penalty,
      type: 'ban_penalty' as const,
      reason: `Ban penalty: ${reason.trim()}`,
      taskId: null,
      taskTitle: null,
      createdBy: actor.email.toLowerCase(),
      createdByName: actor.displayName,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (e: any) {
    console.warn('createBan batch notice, fallback local', e);
  }

  try {
    const bans = readLocal();
    const localBan: Ban = { ...ban, startAt: startAt.toISOString() as any, endAt: endAt.toISOString() as any, createdAt: nowIso as any };
    bans.push(localBan);
    writeLocal(bans);
    const users: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
    const idx = users.findIndex((u: any) => u.uid === employee.uid);
    if (idx !== -1) {
      users[idx].status = 'suspended';
      users[idx].oCoinsBalance = 0;
      localStorage.setItem('elgogalyia_local_users', JSON.stringify(users));
    }
    const sessRaw = localStorage.getItem('elgogalyia_user_session');
    if (sessRaw) {
      const sess: any = JSON.parse(sessRaw);
      if (sess.uid === employee.uid) {
        sess.status = 'suspended';
        sess.oCoinsBalance = 0;
        localStorage.setItem('elgogalyia_user_session', JSON.stringify(sess));
      }
    }
    try {
      const { createNotification } = await import('./firestore');
      await createNotification({
        recipientEmail: (employee.email || employee.username || '').toLowerCase(),
        recipientUid: employee.uid,
        type: 'ban.suspended' as any,
        title: 'Account suspended',
        message: `Your account is suspended until ${endAt.toLocaleString()}. Reason: ${reason}`,
        taskId: null,
      });
    } catch {}
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch {}

  try {
    const { logActivity } = await import('./firestore');
    await logActivity({ actor: actor.email, actorName: actor.displayName, action: 'user.banned' as any, targetType: 'ban' as any, targetId: banId, targetName: employee.displayName, metadata: { employeeId: employee.uid, reason, penalty, endAt: endAt.toISOString() } });
  } catch {}
  logBanAccess(actor.uid, 'create', `Created ban ${banId} for ${employee.uid} penalty ${penalty}`);
  return banId;
}

export async function endBan(banId: string, actor: { uid: string; email: string; displayName: string }): Promise<void> {
  const viewer = getCurrentViewer();
  if (!canViewAllBans(viewer)) throw new Error('Forbidden: Only admins can end bans');
  rateLimitOrThrow(`ban_end_${viewer?.uid || 'anon'}`, RATE_LIMITS.bans_write);
  const bans = readLocal();
  const ban = bans.find(b => b.id === banId);
  const employeeId = ban?.employeeId;
  try {
    await updateDoc(doc(db, 'bans', banId), { status: 'ended_early', endedAt: serverTimestamp(), endedBy: actor.uid || actor.email, endedByName: actor.displayName });
    if (employeeId) await updateDoc(doc(db, 'users', employeeId), { status: 'active', updatedAt: serverTimestamp() });
  } catch (e) { console.warn('endBan firestore notice', e); }
  const updated = readLocal().map(b => b.id === banId ? { ...b, status: 'ended_early' as const, endedAt: new Date().toISOString() as any, endedBy: actor.uid || actor.email } : b);
  writeLocal(updated);
  if (employeeId) {
    try {
      const users: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
      const idx = users.findIndex((u: any) => u.uid === employeeId);
      if (idx !== -1) {
        users[idx].status = 'active';
        localStorage.setItem('elgogalyia_local_users', JSON.stringify(users));
      }
      const sessRaw = localStorage.getItem('elgogalyia_user_session');
      if (sessRaw) {
        const sess: any = JSON.parse(sessRaw);
        if (sess.uid === employeeId) {
          sess.status = 'active';
          localStorage.setItem('elgogalyia_user_session', JSON.stringify(sess));
        }
      }
    } catch {}
  }
  try {
    const { logActivity, createNotification } = await import('./firestore');
    if (ban) await createNotification({ recipientEmail: (ban as any).employeeUsername?.toLowerCase() || ban.employeeId, recipientUid: ban.employeeId, type: 'ban.lifted' as any, title: 'Suspension lifted', message: 'Your suspension has been lifted. You may resume work.', taskId: null });
    await logActivity({ actor: actor.email, actorName: actor.displayName, action: 'user.unbanned' as any, targetType: 'ban' as any, targetId: banId, targetName: ban?.employeeName || banId, metadata: {} });
  } catch {}
  logBanAccess(actor.uid, 'end', `Ended ban ${banId}`);
  window.dispatchEvent(new Event('elgogalyia_data_change'));
}

export async function deleteBan(banId: string, actor: { uid: string; email: string; displayName: string }): Promise<void> {
  const viewer = getCurrentViewer();
  if (!canViewAllBans(viewer)) throw new Error('Forbidden: Only admins can delete ban records');
  
  const bans = readLocal();
  const ban = bans.find(b => b.id === banId);
  const employeeId = ban?.employeeId;

  // 1. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'bans', banId));
    // If the deleted ban was active, also reactivate the user in Firestore
    if (ban && ban.status === 'active' && employeeId) {
      await updateDoc(doc(db, 'users', employeeId), { status: 'active', updatedAt: serverTimestamp() }).catch(() => {});
    }
  } catch (e) {
    console.warn('deleteBan firestore notice', e);
  }

  // 2. Remove from local storage
  const updated = bans.filter(b => b.id !== banId);
  writeLocal(updated);

  // 3. If employee was suspended by this active ban, reactivate them locally
  if (ban && ban.status === 'active' && employeeId) {
    try {
      const users: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
      const idx = users.findIndex((u: any) => u.uid === employeeId);
      if (idx !== -1) {
        users[idx].status = 'active';
        localStorage.setItem('elgogalyia_local_users', JSON.stringify(users));
      }
    } catch {}
  }

  // 4. Activity log & audit
  try {
    const { logActivity } = await import('./firestore');
    await logActivity({
      actor: actor.email,
      actorName: actor.displayName,
      action: 'ban.deleted' as any,
      targetType: 'ban' as any,
      targetId: banId,
      targetName: `حذف سجل حظر ${ban?.employeeName || banId}`,
      metadata: { employeeId, reason: ban?.reason },
    });
  } catch {}

  logBanAccess(actor.uid, 'delete', `Deleted ban record ${banId}`);
  window.dispatchEvent(new Event('elgogalyia_data_change'));
}

export async function clearAllBans(actor: { uid: string; email: string; displayName: string }): Promise<void> {
  const viewer = getCurrentViewer();
  if (!canViewAllBans(viewer)) throw new Error('Forbidden: Only admins can clear ban records');

  try {
    const snap = await getDocs(collection(db, 'bans'));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    console.warn('clearAllBans firestore notice', e);
  }

  writeLocal([]);
  window.dispatchEvent(new Event('elgogalyia_data_change'));

  try {
    const { logActivity } = await import('./firestore');
    await logActivity({
      actor: actor.email,
      actorName: actor.displayName,
      action: 'ban.deleted' as any,
      targetType: 'ban' as any,
      targetId: 'all',
      targetName: 'مسح جميع سجلات الحظر',
      metadata: {},
    });
  } catch {}
}

export async function checkExpiredBans(): Promise<void> {
  const bans = readLocal();
  let changed = false;
  const now = Date.now();
  const updated = bans.map(b => {
    if (b.status === 'active' && toDate(b.endAt).getTime() <= now) {
      changed = true;
      return { ...b, status: 'expired' as const };
    }
    return b;
  });
  if (changed) {
    writeLocal(updated);
    try {
      const users: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
      let uChanged = false;
      updated.forEach(b => {
        if (b.status === 'expired') {
          const idx = users.findIndex((u: any) => u.uid === b.employeeId);
          if (idx !== -1 && users[idx].status === 'suspended') {
            users[idx].status = 'active';
            uChanged = true;
          }
        }
      });
      if (uChanged) localStorage.setItem('elgogalyia_local_users', JSON.stringify(users));
    } catch {}
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  }
  try {
    const snap = await getDocs(query(collection(db, 'bans'), where('status', '==', 'active')));
    for (const d of snap.docs) {
      const data: any = d.data();
      const end = toDate(data.endAt);
      if (end.getTime() <= Date.now()) {
        await updateDoc(doc(db, 'bans', d.id), { status: 'expired' });
        if (data.employeeId) await updateDoc(doc(db, 'users', data.employeeId), { status: 'active' }).catch(()=>{});
      }
    }
  } catch {}
}

export function subscribeBans(callback: (bans: Ban[]) => void): () => void {
  const viewer = getCurrentViewer();
  const isPrivileged = canViewAllBans(viewer);

  const loadLocal = () => {
    let list = readLocal();
    const now = Date.now();
    let changed = false;
    list = list.map(b => {
      if (b.status === 'active' && toDate(b.endAt).getTime() <= now) { changed = true; return { ...b, status: 'expired' as const }; }
      return b;
    });
    if (changed) writeLocal(list);
    // Apply RBAC filtering and field-level sanitization before returning
    const filtered = isPrivileged ? list : list.filter(b => b.employeeId === viewer?.uid);
    const sanitized = filtered.map(b => {
      // For non-admin, mask sensitive fields
      if (!isPrivileged) {
        const { internalNote, createdBy, endedBy, ...rest } = b as any;
        return { ...rest, internalNote: undefined, createdBy: '***', endedBy: endedBy ? '***' : undefined } as Ban;
      }
      return b;
    });
    if (!isPrivileged && viewer) {
      logBanAccess(viewer.uid, 'view_own', `Filtered to ${sanitized.length} own bans`);
    } else if (isPrivileged && viewer) {
      logBanAccess(viewer.uid, 'view_all', `Viewed ${sanitized.length} bans`);
    }
    callback(sanitized as Ban[]);
  };

  // Rate limiting for reads
  try {
    rateLimitOrThrow(`bans_read_${viewer?.uid || 'anon'}`, RATE_LIMITS.bans_read);
  } catch (e: any) {
    console.warn(e.message);
    loadLocal();
    return () => {};
  }

  try {
    // User-scoped query: non-admin only queries own bans
    const q = isPrivileged
      ? query(collection(db, 'bans'), orderBy('createdAt', 'desc'))
      : viewer?.uid
        ? query(collection(db, 'bans'), where('employeeId', '==', viewer.uid), orderBy('createdAt', 'desc'))
        : query(collection(db, 'bans'), where('employeeId', '==', '__none__'));

    const unsub = onSnapshot(q as any, (snap) => {
      const fsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ban));
      // For non-privileged, ensure we only have own data in localStorage as well
      let toStore = fsList;
      if (!isPrivileged && viewer) {
        toStore = fsList.filter(b => b.employeeId === viewer.uid);
      }
      if (toStore.length > 0) {
        const local = readLocal();
        const map = new Map<string, Ban>();
        toStore.forEach(b => map.set(b.id, b));
        // Only merge local that belongs to viewer if not privileged
        const relevantLocal = isPrivileged ? local : local.filter(b => b.employeeId === viewer?.uid);
        relevantLocal.forEach(b => { if (!map.has(b.id)) map.set(b.id, b); });
        const merged = Array.from(map.values()).sort((a,b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
        // Write back only relevant
        if (isPrivileged) {
          localStorage.setItem(LOCAL_BANS, JSON.stringify(merged));
        } else {
          // For employee, keep other users' bans out of localStorage
          const otherBans = local.filter(b => b.employeeId !== viewer?.uid);
          localStorage.setItem(LOCAL_BANS, JSON.stringify([...otherBans, ...merged].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i)));
        }
        let changed = false;
        const checked = merged.map(b => {
          if (b.status === 'active' && toDate(b.endAt).getTime() <= Date.now()) { changed = true; return { ...b, status: 'expired' as const }; }
          return b;
        });
        if (changed) writeLocal(checked);
        // Sanitize before callback
        const sanitized = checked.map(b => {
          if (!isPrivileged) {
            const { internalNote, createdBy, endedBy, ...rest } = b as any;
            return { ...rest, internalNote: undefined, createdBy: '***' } as Ban;
          }
          return b;
        });
        callback(sanitized as Ban[]);
        if (viewer) logBanAccess(viewer.uid, isPrivileged ? 'view_all' : 'view_own', `Snapshot ${sanitized.length} bans`);
      } else {
        loadLocal();
      }
    }, (err) => { console.warn('bans snapshot notice', err); loadLocal(); });
    const handle = () => loadLocal();
    window.addEventListener('elgogalyia_bans_change', handle);
    window.addEventListener('elgogalyia_data_change', handle);
    const iv = setInterval(() => checkExpiredBans(), 60*1000);
    return () => { unsub(); clearInterval(iv); window.removeEventListener('elgogalyia_bans_change', handle); window.removeEventListener('elgogalyia_data_change', handle); };
  } catch {
    loadLocal();
    return () => {};
  }
}
