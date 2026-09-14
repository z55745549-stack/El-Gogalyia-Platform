import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, query, onSnapshot, db } from './supabase';
import type { Committee } from '@/types';
import { DEFAULT_COMMITTEES } from '@/types';

const LOCAL_KEY = 'elgogalyia_local_committees';
const OBSOLETE_IDS = new Set(['marketing', 'operations', 'content', 'tech', 'finance', 'outreach', 'design']);

function readLocal(): Committee[] {
  try {
    const parsed: Committee[] = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    // Filter out obsolete fake committees
    const cleaned = parsed.filter(c => !OBSOLETE_IDS.has(c.id));
    if (cleaned.length !== parsed.length) {
      writeLocal(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

function writeLocal(list: Committee[]) {
  try {
    const cleaned = list.filter(c => !OBSOLETE_IDS.has(c.id));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(cleaned));
    window.dispatchEvent(new Event('elgogalyia_data_change'));
    window.dispatchEvent(new Event('elgogalyia_committees_change'));
  } catch {}
}

export function getDefaultCommittees(seedBy = 'system'): Committee[] {
  const now = new Date().toISOString();
  return DEFAULT_COMMITTEES.map(c => ({ ...c, createdAt: now, updatedAt: now, createdBy: seedBy } as Committee));
}

export async function ensureDefaultCommittees(createdBy = 'system'): Promise<void> {
  const defaults = getDefaultCommittees(createdBy);

  try {
    const snap = await getDocs(collection(db, 'committees'));
    const existingMap = new Map(snap.docs.map(d => [d.id, d]));

    // Delete any obsolete fake committees from supabase
    for (const obsId of OBSOLETE_IDS) {
      if (existingMap.has(obsId)) {
        deleteDoc(doc(db, 'committees', obsId)).catch(() => {});
      }
    }

    // Seed missing official committees
    const batchPromises = defaults.map(async (c) => {
      if (!existingMap.has(c.id)) {
        await setDoc(doc(db, 'committees', c.id), {
          ...c,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });
    await Promise.all(batchPromises);
    writeLocal(defaults);
  } catch {
    const local = readLocal();
    if (local.length === 0 || local.some(c => OBSOLETE_IDS.has(c.id))) {
      writeLocal(defaults);
    }
  }
}

export async function createCommittee(data: { name: string; description?: string; color?: string }, creator: string): Promise<string> {
  const slug = data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = slug || `committee_${Date.now()}`;
  const now = new Date().toISOString();
  const committee: Committee = {
    id,
    name: data.name.trim(),
    slug,
    description: (data.description || '').trim(),
    color: data.color || '#7C00FE',
    status: 'active',
    createdAt: now as any,
    updatedAt: now as any,
    createdBy: creator,
  };
  try {
    await setDoc(doc(db, 'committees', id), { ...committee, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (e) { console.warn('createCommittee supabase notice', e); }
  const list = readLocal();
  if (!list.find(c => c.id === id)) {
    list.push(committee);
    writeLocal(list);
  }
  return id;
}

export async function updateCommittee(id: string, updates: Partial<Committee>): Promise<void> {
  try {
    await updateDoc(doc(db, 'committees', id), { ...updates, updatedAt: serverTimestamp() });
  } catch (e) { console.warn('updateCommittee notice', e); }
  const list = readLocal();
  const idx = list.findIndex(c => c.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() as any };
    writeLocal(list);
  }
}

export async function deleteCommittee(id: string): Promise<void> {
  try { await deleteDoc(doc(db, 'committees', id)); } catch (e) { console.warn('deleteCommittee notice', e); }
  const list = readLocal().filter(c => c.id !== id);
  writeLocal(list);
}

export async function assignUserCommittee(uid: string, committeeId: string | null, committeeName: string | null): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { committeeId: committeeId || null, committeeName: committeeName || null, updatedAt: serverTimestamp() });
  } catch (e) { console.warn('assignUserCommittee supabase notice', e); }
  try {
    const users: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
    const idx = users.findIndex((u: any) => u.uid === uid);
    if (idx !== -1) {
      users[idx].committeeId = committeeId || null;
      users[idx].committeeName = committeeName || null;
      localStorage.setItem('elgogalyia_local_users', JSON.stringify(users));
    }
    const sessRaw = localStorage.getItem('elgogalyia_user_session');
    if (sessRaw) {
      const sess: any = JSON.parse(sessRaw);
      if (sess.uid === uid) {
        sess.committeeId = committeeId || null;
        sess.committeeName = committeeName || null;
        localStorage.setItem('elgogalyia_user_session', JSON.stringify(sess));
      }
    }
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch {}
}

export function subscribeCommittees(callback: (committees: Committee[]) => void, onError?: (e: any) => void): () => void {
  const loadLocal = () => {
    const local = readLocal();
    if (local.length === 0) {
      const defaults = getDefaultCommittees('system');
      writeLocal(defaults);
      callback(defaults);
    } else {
      callback(local);
    }
  };

  // Run ensureDefaultCommittees in the background
  ensureDefaultCommittees('system').catch(() => {});

  try {
    const q = query(collection(db, 'committees'));
    const unsub = onSnapshot(q, (snap) => {
      const fsList = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Committee))
        .filter(c => !OBSOLETE_IDS.has(c.id));

      if (fsList.length > 0) {
        writeLocal(fsList);
        callback(fsList);
      } else {
        loadLocal();
      }
    }, (err) => {
      console.warn('committees snapshot notice', err);
      loadLocal();
      if (onError) onError(err);
    });

    const handle = () => {
      const local = readLocal();
      callback(local.length ? local : getDefaultCommittees('system'));
    };
    window.addEventListener('elgogalyia_committees_change', handle);
    window.addEventListener('elgogalyia_data_change', handle);

    return () => {
      unsub();
      window.removeEventListener('elgogalyia_committees_change', handle);
      window.removeEventListener('elgogalyia_data_change', handle);
    };
  } catch (e) {
    loadLocal();
    return () => {};
  }
}

