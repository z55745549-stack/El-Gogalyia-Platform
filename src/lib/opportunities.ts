import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  onSnapshot,
  serverTimestamp,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { logActivity, createNotification } from './firestore';
import { safeDate } from '@/utils';
import type { Opportunity, OpportunityCategory, OpportunityStatus } from '@/types';

const COLLECTION_NAME = 'opportunities';
const LOCAL_STORAGE_KEY = 'elgogalyia_local_opportunities';
const TOMBSTONES_KEY = 'elgogalyia_deleted_opp_ids';

function getTombstones(): Set<string> {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    // Always suppress legacy hardcoded mock items
    set.add('local_opp_1');
    set.add('local_opp_2');
    return set;
  } catch {
    return new Set(['local_opp_1', 'local_opp_2']);
  }
}

function addTombstone(id: string) {
  try {
    const set = getTombstones();
    set.add(id);
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function removeTombstone(id: string) {
  try {
    const set = getTombstones();
    if (set.delete(id)) {
      localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

function getLocalOpportunities(): Opportunity[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const list: Opportunity[] = JSON.parse(raw);
    const tombstones = getTombstones();
    return list.filter((o) => !tombstones.has(o.id));
  } catch {
    return [];
  }
}

function saveLocalOpportunities(list: Opportunity[]) {
  try {
    const tombstones = getTombstones();
    const filtered = list.filter((o) => !tombstones.has(o.id));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('elgogalyia_opportunities_change'));
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch (err) {
    console.warn('Failed to save local opportunities:', err);
  }
}

export function subscribeOpportunities(callback: (opportunities: Opportunity[]) => void) {
  let isFirestoreWorking = false;

  const q = query(collection(db, COLLECTION_NAME));
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      isFirestoreWorking = true;
      const tombstones = getTombstones();
      const fsList: Opportunity[] = [];

      snapshot.docs.forEach((d) => {
        if (!tombstones.has(d.id)) {
          fsList.push({
            id: d.id,
            ...d.data(),
          } as Opportunity);
        }
      });

      const sorted = fsList.sort(
        (a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime()
      );

      // Save authoritative list locally
      saveLocalOpportunities(sorted);
      callback(sorted);
    },
    (err) => {
      console.warn('Opportunities snapshot notice:', err);
      if (!isFirestoreWorking) {
        callback(getLocalOpportunities());
      }
    }
  );

  const handleLocalChange = () => {
    if (!isFirestoreWorking) {
      callback(getLocalOpportunities());
    }
  };
  window.addEventListener('elgogalyia_opportunities_change', handleLocalChange);
  window.addEventListener('elgogalyia_data_change', handleLocalChange);

  // Initial immediate call with local cache while Firestore connects
  const initialLocal = getLocalOpportunities();
  if (initialLocal.length > 0) {
    callback(initialLocal);
  }

  return () => {
    unsub();
    window.removeEventListener('elgogalyia_opportunities_change', handleLocalChange);
    window.removeEventListener('elgogalyia_data_change', handleLocalChange);
  };
}

export async function createOpportunity(
  data: {
    title: string;
    provider: string;
    description: string;
    requirements?: string;
    applicationUrl: string;
    deadline: Date | string | Timestamp;
    category: OpportunityCategory;
  },
  creator: { uid: string; email: string; displayName: string }
) {
  const docRef = doc(collection(db, COLLECTION_NAME));
  const docId = docRef.id;

  removeTombstone(docId);

  const oppPayload = {
    id: docId,
    title: data.title.trim(),
    provider: data.provider.trim(),
    description: data.description.trim(),
    requirements: data.requirements?.trim() || '',
    applicationUrl: data.applicationUrl.trim(),
    deadline: data.deadline instanceof Date ? Timestamp.fromDate(data.deadline) : data.deadline,
    category: data.category,
    status: 'active' as OpportunityStatus,
    isTeamExclusive: true,
    createdBy: creator.email || creator.uid,
    createdByName: creator.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, oppPayload);
  } catch (err) {
    console.warn('Firestore setDoc opportunity warning:', err);
  }

  // Update local cache immediately
  const localList = getLocalOpportunities().filter((o) => o.id !== docId);
  const localItem: Opportunity = {
    ...oppPayload,
    id: docId,
    createdAt: new Date().toISOString(),
    deadline: data.deadline instanceof Date ? data.deadline.toISOString() : (data.deadline as any),
  } as any;
  saveLocalOpportunities([localItem, ...localList]);

  // Log activity
  logActivity({
    actor: creator.email || creator.uid,
    actorName: creator.displayName,
    action: 'opportunity.created',
    targetType: 'opportunity',
    targetId: docId,
    targetName: data.title,
    metadata: { provider: data.provider, category: data.category },
  }).catch(() => {});

  // Send real-time notification to all team members
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.docs.forEach((u) => {
      const ud = u.data();
      const userTarget = (ud.email || ud.username || u.id).toLowerCase();
      createNotification({
        recipientEmail: userTarget,
        recipientUid: u.id,
        type: 'opportunity.created' as any,
        title: 'فرصة وتدريب جديد للفريق! 🎓✨',
        message: `تمت إضافة فرصة جديدة: "${data.title}" من "${data.provider}". التقديم متاح الآن!`,
        taskId: null,
      }).catch(() => {});
    });
  } catch (err) {
    console.warn('Failed to send opportunity notifications:', err);
  }

  return docId;
}

export async function updateOpportunity(
  id: string,
  data: Partial<Opportunity>,
  updater: { email: string; displayName: string }
) {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore updateOpportunity notice:', err);
  }

  const localList = getLocalOpportunities();
  const idx = localList.findIndex((o) => o.id === id);
  if (idx !== -1) {
    localList[idx] = {
      ...localList[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveLocalOpportunities(localList);
  }

  logActivity({
    actor: updater.email,
    actorName: updater.displayName,
    action: 'opportunity.updated',
    targetType: 'opportunity',
    targetId: id,
    targetName: data.title || id,
    metadata: {},
  }).catch(() => {});
}

export async function deleteOpportunity(
  id: string,
  title: string,
  deleter: { email: string; displayName: string }
) {
  // Add to tombstones first to ensure local caches never resurrect this item
  addTombstone(id);

  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (err) {
    console.warn('Firestore deleteDoc opportunity notice:', err);
  }

  const localList = getLocalOpportunities().filter((o) => o.id !== id);
  saveLocalOpportunities(localList);

  logActivity({
    actor: deleter.email,
    actorName: deleter.displayName,
    action: 'opportunity.deleted',
    targetType: 'opportunity',
    targetId: id,
    targetName: title,
    metadata: {},
  }).catch(() => {});
}

export function getOpportunityCountdown(deadlineDate: any): {
  isExpired: boolean;
  label: string;
  days: number;
  hours: number;
} {
  const d = safeDate(deadlineDate);
  const now = Date.now();
  const diff = d.getTime() - now;

  if (diff <= 0) {
    return { isExpired: true, label: 'انتهى موعد التقديم', days: 0, hours: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return { isExpired: false, label: `متبقي ${days} يوم و ${hours} ساعة`, days, hours };
  }
  return { isExpired: false, label: `متبقي ${hours} ساعة فقط!`, days: 0, hours };
}
