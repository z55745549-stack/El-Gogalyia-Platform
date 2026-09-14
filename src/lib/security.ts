/**
 * Security layer for ban data and RBAC
 * Addresses: unauthorized ban history access, field-level security, data masking
 */
import type { Ban, UserProfile } from '@/types';
import { logBanAccess } from './audit';

/**
 * RBAC: Only admin, super_admin, or privileged committee roles can view all bans
 * Regular employees can NEVER view other users' bans
 */
export function canViewAllBans(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === 'superAdmin' || user.role === 'admin') return true;
  // Committee-based privileged roles (e.g., tech, hr) - check committee
  const privilegedCommittees = ['tech', 'hr', 'operations'];
  if (user.committeeId && privilegedCommittees.includes(user.committeeId)) return true;
  // Also check permissions
  if (user.permissions?.includes('employees.manage' as any) || user.permissions?.includes('access.manage' as any)) return true;
  return false;
}

export function canViewBanHistory(user: UserProfile | null): boolean {
  return canViewAllBans(user);
}

export function canCreateBan(user: UserProfile | null): boolean {
  if (!user) return false;
  return canViewAllBans(user);
}

/**
 * User-scoped isolation: non-admin only sees own bans
 */
export function filterBansForUser(bans: Ban[], viewer: UserProfile | null): Ban[] {
  if (!viewer) return [];
  if (canViewAllBans(viewer)) {
    logBanAccess(viewer.uid, 'view_all', `Admin viewed all bans (${bans.length} records)`);
    return bans;
  }
  // Employee: only own bans
  const own = bans.filter(b => b.employeeId === viewer.uid);
  if (own.length > 0) {
    logBanAccess(viewer.uid, 'view_own', `User viewed own bans (${own.length} records)`);
  }
  return own;
}

/**
 * Field-level security: sensitive fields only visible to admins
 * internalNote, createdBy, endedBy are sensitive
 */
export function sanitizeBanForViewer(ban: Ban, viewer: UserProfile | null): Partial<Ban> & { _masked?: boolean } {
  const isPrivileged = canViewAllBans(viewer);
  if (isPrivileged) {
    return { ...ban };
  }
  // Non-admin: return only safe fields, mask sensitive
  const { internalNote, createdBy, endedBy, endedByName, createdByName, ...safe } = ban as any;
  // Also mask employeeId partially for non-owner? but owner needs to see own
  // If viewer is owner, they can see their own ban but not internalNote/createdBy
  return {
    id: ban.id,
    employeeId: maskId(ban.employeeId),
    employeeName: ban.employeeName,
    employeeUsername: ban.employeeUsername,
    reason: ban.reason,
    status: ban.status,
    startAt: ban.startAt,
    endAt: ban.endAt,
    coinPenalty: ban.coinPenalty,
    createdAt: ban.createdAt,
    endedAt: ban.endedAt,
    committeeId: ban.committeeId,
    _masked: true,
  } as any;
}

export function maskId(id: string): string {
  if (!id || id.length <= 3) return '***';
  return id.substring(0, 3) + '***' + id.substring(id.length - 2);
}

export function sanitizeBansForViewer(bans: Ban[], viewer: UserProfile | null): any[] {
  return bans.map(b => sanitizeBanForViewer(b, viewer));
}

/**
 * Middleware-like guard for API endpoints
 */
export function requireBanAccess(viewer: UserProfile | null, ban?: Ban): { allowed: boolean; reason?: string } {
  if (!viewer) return { allowed: false, reason: 'Not authenticated' };
  if (canViewAllBans(viewer)) return { allowed: true };
  if (ban && ban.employeeId === viewer.uid) return { allowed: true };
  // Non-admin trying to access all bans or another user's ban
  if (!ban) {
    // Trying to list all
    return { allowed: false, reason: 'Forbidden: Only admins can view all ban history' };
  }
  return { allowed: false, reason: 'Forbidden: Can only view own ban history' };
}

// XSS prevention: sanitize string inputs
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Validate and reject unexpected fields
export function rejectUnexpectedFields(data: Record<string, any>, allowedFields: string[]): { valid: boolean; extra?: string[] } {
  const extra = Object.keys(data).filter(k => !allowedFields.includes(k));
  if (extra.length > 0) return { valid: false, extra };
  return { valid: true };
}
