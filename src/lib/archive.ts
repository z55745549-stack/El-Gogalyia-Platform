/**
 * Universal Enterprise Archive & Recovery System
 * Ensures all deletions of critical business records are reversible.
 * Records actor metadata, timestamps, previous state, and emits audit logs.
 */

import {
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { logActivity } from './firestore';
import { logAudit } from './audit';
import type { UserProfile } from '@/types';

export type ArchivableCollection =
  | 'tasks'
  | 'courses'
  | 'discounts'
  | 'meetings'
  | 'opportunities'
  | 'supportTickets'
  | 'users'
  | 'committees';

export interface ArchivedItemMeta {
  id: string;
  collectionName: ArchivableCollection;
  title: string;
  archivedAt: Timestamp | string;
  archivedBy: string;
  archivedByName: string;
  previousStatus?: string;
  data: Record<string, any>;
}

/**
 * Soft-deletes / Archives an entity document
 */
export async function archiveRecord(params: {
  collectionName: ArchivableCollection;
  docId: string;
  title: string;
  actor: UserProfile;
  reason?: string;
}): Promise<void> {
  const { collectionName, docId, title, actor, reason } = params;
  const docRef = doc(db, collectionName, docId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('العنصر المطلوب أرشفته غير موجود في قاعدة البيانات.');
  }

  const currentData = snap.data();
  const previousStatus = currentData.status || 'active';

  await updateDoc(docRef, {
    status: 'archived',
    isArchived: true,
    previousStatus,
    archivedAt: serverTimestamp(),
    archivedBy: actor.uid,
    archivedByName: actor.displayName || actor.username || 'المسؤول',
    archiveReason: reason || null,
    updatedAt: serverTimestamp(),
  });

  // Log to Activity Log & Audit Trail
  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || actor.username || 'المسؤول',
    actorPhoto: actor.photoURL || '',
    action: `${collectionName.slice(0, -1)}.archived` as any,
    targetType: collectionName as any,
    targetId: docId,
    targetName: title,
    metadata: { reason, previousStatus },
  });

  await logAudit({
    actorId: actor.uid,
    actorRole: actor.role,
    action: `${collectionName}.archive`,
    targetType: collectionName as any,
    targetId: docId,
    metadata: { title, previousStatus, reason },
  });
}

/**
 * Restores an archived document back to its active state
 */
export async function restoreRecord(params: {
  collectionName: ArchivableCollection;
  docId: string;
  title: string;
  actor: UserProfile;
}): Promise<void> {
  const { collectionName, docId, title, actor } = params;
  const docRef = doc(db, collectionName, docId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error('العنصر المطلوب استعادته غير موجود في قاعدة البيانات.');
  }

  const currentData = snap.data();
  const restoreStatus = currentData.previousStatus || 'active';

  await updateDoc(docRef, {
    status: restoreStatus,
    isArchived: false,
    restoredAt: serverTimestamp(),
    restoredBy: actor.uid,
    restoredByName: actor.displayName || actor.username || 'المسؤول',
    updatedAt: serverTimestamp(),
  });

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || actor.username || 'المسؤول',
    actorPhoto: actor.photoURL || '',
    action: `${collectionName.slice(0, -1)}.restored` as any,
    targetType: collectionName as any,
    targetId: docId,
    targetName: title,
    metadata: { restoredToStatus: restoreStatus },
  });

  await logAudit({
    actorId: actor.uid,
    actorRole: actor.role,
    action: `${collectionName}.restore`,
    targetType: collectionName as any,
    targetId: docId,
    metadata: { title, restoredToStatus: restoreStatus },
  });
}

/**
 * Permanently deletes a record — strictly restricted to superAdmin with confirmation
 */
export async function permanentlyDeleteRecord(params: {
  collectionName: ArchivableCollection;
  docId: string;
  title: string;
  actor: UserProfile;
}): Promise<void> {
  const { collectionName, docId, title, actor } = params;

  if (actor.role !== 'superAdmin') {
    throw new Error('الحذف النهائي مقصور فقط على المشرف العام للنظام (Super Admin).');
  }

  const docRef = doc(db, collectionName, docId);

  // Write permanent deletion audit trail before erasing doc
  await logAudit({
    actorId: actor.uid,
    actorRole: actor.role,
    action: `${collectionName}.permanent_delete`,
    targetType: collectionName as any,
    targetId: docId,
    metadata: { title },
  });

  await deleteDoc(docRef);
}

/**
 * Queries all archived records for a specific collection
 */
export async function fetchArchivedRecords(collectionName: ArchivableCollection): Promise<ArchivedItemMeta[]> {
  const q = query(
    collection(db, collectionName),
    where('status', '==', 'archived')
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      collectionName,
      title: data.title || data.name || data.subject || data.displayName || d.id,
      archivedAt: data.archivedAt || data.updatedAt || new Date().toISOString(),
      archivedBy: data.archivedBy || '',
      archivedByName: data.archivedByName || 'المسؤول',
      previousStatus: data.previousStatus,
      data,
    };
  });
}
