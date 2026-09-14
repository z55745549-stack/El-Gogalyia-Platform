import type { Permission, UserRole } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';

// ─── Role Hierarchy ────────────────────────────────────────────────────────────
// LEAD (100) = CO-LEAD (100) > HEAD (80) > VICE-HEAD (10) = MEMBER (10)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  lead:       100, // قائد المنصة (متساوي مع الكو ليد 100٪ فوق الجميع)
  co_lead:    100, // نائب القائد (متساوي مع الليد 100٪ فوق الجميع)
  head:        80, // رئيس لجنة (مثل السوبر أدمن سابقاً - صلاحيات كاملة في كل شيء أسفله)
  vice_head:   10, // نائب رئيس لجنة (متساوي تماماً مع الميمبر مثل صلاحيات الموظف)
  member:      10, // عضو (متساوي تماماً مع الفايس هيد مثل صلاحيات الموظف)
};

export function getRoleRank(role: UserRole): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

/** 
 * True if actorRole can manage targetRole:
 * - LEAD and CO-LEAD are equal and have supreme authority over all roles
 * - HEAD can manage everything below it (vice_head and member)
 * - VICE-HEAD and MEMBER cannot manage others
 */
export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'lead' || actorRole === 'co_lead') return true;
  return getRoleRank(actorRole) > getRoleRank(targetRole);
}

/** True if actor is top tier leadership (LEAD or CO-LEAD) */
export function isTopTierRole(role: UserRole): boolean {
  return role === 'lead' || role === 'co_lead';
}

/** 
 * True if role has management/administrative access:
 * LEAD, CO-LEAD, and HEAD (which replaces Super Admin)
 */
export function isAdminRole(role: UserRole): boolean {
  return role === 'lead' || role === 'co_lead' || role === 'head';
}

export function hasPermission(
  userPermissions: Permission[],
  userRole: UserRole,
  permission: Permission
): boolean {
  // lead, co_lead, head have all administrative permissions
  if (isAdminRole(userRole)) return true;
  // Check explicit user permissions
  if (userPermissions?.includes(permission)) return true;
  // Check role default permissions
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}

export function canAccessPage(role: UserRole, page: string): boolean {
  const adminPages = [
    '/employees', '/reports', '/access-management', '/activity-logs',
    '/tasks', '/submitted-tasks', '/attendance', '/bans',
  ];
  if (adminPages.includes(page)) return isAdminRole(role);
  return true;
}

export function getDefaultRoute(role: UserRole): string {
  return '/dashboard';
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    lead:       '🏆 LEAD',
    co_lead:    '🌟 CO-LEAD',
    head:       '👑 HEAD',
    vice_head:  '🔹 VICE-HEAD',
    member:     '👤 MEMBER',
  };
  return labels[role] || '👤 MEMBER';
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    lead:       'bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/40 ring-1 ring-amber-500/20',
    co_lead:    'bg-purple-500/15 text-purple-800 dark:text-purple-200 border border-purple-500/40 ring-1 ring-purple-500/20',
    head:       'bg-blue-500/15 text-blue-800 dark:text-blue-200 border border-blue-500/40 ring-1 ring-blue-500/20',
    vice_head:  'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 ring-1 ring-emerald-500/20',
    member:     'bg-slate-500/15 text-slate-800 dark:text-slate-200 border border-slate-500/30',
  };
  return colors[role] || 'bg-slate-500/15 text-slate-800 dark:text-slate-200 border border-slate-500/30';
}
