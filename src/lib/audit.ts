/**
 * Enterprise Audit Logging Engine
 * Captures sensitive administrative events, role modifications, financial changes, and data access.
 * Compliant with OWASP Security Logging and Monitoring requirements.
 */
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, db } from './supabase';

export interface AuditEntry {
  actorId: string;
  actorRole?: string;
  action: string;
  targetType: 'ban' | 'meeting' | 'committee' | 'user' | 'ocoin' | 'task' | 'course' | 'discount' | 'opportunity' | 'support' | 'system';
  targetId: string;
  metadata?: Record<string, any>;
  timestamp?: any;
  userAgent?: string;
}

export async function logAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  try {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'server/unknown';
    await addDoc(collection(db, 'auditLogs'), {
      ...entry,
      userAgent,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[Audit Log Write Notice]:', e);
    }
  }
}

export function logBanAccess(actorId: string, action: 'view_all' | 'view_own' | 'view_single' | 'create' | 'end', details?: string) {
  logAudit({
    actorId,
    action: `ban.${action}`,
    targetType: 'ban',
    targetId: action,
    metadata: { details },
  }).catch(() => {});
}

export async function fetchRecentAuditLogs(limitCount = 50): Promise<AuditEntry[]> {
  try {
    const q = query(
      collection(db, 'auditLogs'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as any));
  } catch {
    return [];
  }
}
