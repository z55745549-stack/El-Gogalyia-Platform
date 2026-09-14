import type { Permission, UserRole } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';

// ─── Role Hierarchy ────────────────────────────────────────────────────────────
// LEAD (100) > CO-LEAD (90) > HEAD (80) > VICE-HEAD (20) > MEMBER (10)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  lead:       100, // أعلى رتبة وسلطة كاملة
  co_lead:    90,  // نائب القائد - سلطة عليا فوق الجميع
  head:       80,  // رئيس لجنة - بديل السوبر أدمن (إدارة المنصة واللجان والمهام)
  superAdmin: 75,  // Legacy fallback
  admin:      50,  // Legacy fallback
  vice_head:  20,  // نائب رئيس لجنة - مثل الموظف في المهام والتسليم والحضور
  member:     10,  // عضو - بديل رتبة الموظف
  employee:   10,  // Legacy fallback
};

export function getRoleRank(role: UserRole): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

/** True if actorRole is strictly above targetRole in the hierarchy */
export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return getRoleRank(actorRole) > getRoleRank(targetRole);
}

/** True if actor can view/edit ALL users including any management/superAdmin accounts */
export function isTopTierRole(role: UserRole): boolean {
  return role === 'lead' || role === 'co_lead';
}

/** 
 * True if role has management/administrative access to the platform 
 * LEAD, CO-LEAD, and HEAD (which replaces Super Admin)
 */
export function isAdminRole(role: UserRole): boolean {
  return role === 'lead' || role === 'co_lead' || role === 'head' || role === 'superAdmin' || role === 'admin';
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
    superAdmin: '⭐ Super Admin',
    admin:      '🛡️ Admin',
    employee:   '👤 MEMBER',
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
    superAdmin: 'bg-purple-500/15 text-purple-800 dark:text-purple-200 border border-purple-500/40',
    admin:      'bg-blue-500/15 text-blue-800 dark:text-blue-200 border border-blue-500/40',
    employee:   'bg-slate-500/15 text-slate-800 dark:text-slate-200 border border-slate-500/30',
  };
  return colors[role] || 'bg-slate-500/15 text-slate-800 dark:text-slate-200 border border-slate-500/30';
}
