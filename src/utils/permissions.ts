import type { Permission, UserRole } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';

// ─── Role Hierarchy ────────────────────────────────────────────────────────────
// lead > co_lead > superAdmin > head > vice_head > admin > member = employee
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  lead:      100,
  co_lead:   90,
  superAdmin: 80,
  head:      70,
  vice_head: 60,
  admin:     50,
  member:    10,
  employee:  10,
};

export function getRoleRank(role: UserRole): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

/** True if actorRole is strictly above targetRole in the hierarchy */
export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return getRoleRank(actorRole) > getRoleRank(targetRole);
}

/** True if actor can view/edit ALL users including superAdmins */
export function isTopTierRole(role: UserRole): boolean {
  return role === 'lead' || role === 'co_lead';
}

/** True if role has admin-level access or above (can use admin pages) */
export function isAdminRole(role: UserRole): boolean {
  return getRoleRank(role) >= ROLE_HIERARCHY['admin'];
}

export function hasPermission(
  userPermissions: Permission[],
  userRole: UserRole,
  permission: Permission
): boolean {
  // lead, co_lead, superAdmin, head have all permissions
  if (isAdminRole(userRole)) return true;
  // Check explicit permissions first
  if (userPermissions.includes(permission)) return true;
  // Check role default permissions
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}

export function canAccessPage(role: UserRole, page: string): boolean {
  const adminPages = [
    '/employees', '/reports', '/access-management', '/activity-logs',
    '/tasks', '/submitted-tasks', '/ocoins',
  ];
  const allPages = ['/dashboard', '/notifications', '/settings', '/my-tasks', '/meetings'];

  if (adminPages.includes(page)) return isAdminRole(role);
  if (allPages.includes(page)) return true;

  const pagePermissions: Record<string, UserRole[]> = {
    '/dashboard':          ['lead', 'co_lead', 'superAdmin', 'head', 'vice_head', 'admin', 'member', 'employee'],
    '/tasks':              ['lead', 'co_lead', 'superAdmin', 'head', 'vice_head', 'admin', 'member', 'employee'],
    '/my-tasks':           ['member', 'employee', 'vice_head'],
    '/employees':          ['lead', 'co_lead', 'superAdmin', 'head', 'admin'],
    '/ocoins':             ['lead', 'co_lead', 'superAdmin', 'head', 'admin', 'vice_head', 'member', 'employee'],
    '/reports':            ['lead', 'co_lead', 'superAdmin', 'head', 'admin'],
    '/access-management':  ['lead', 'co_lead', 'superAdmin', 'admin'],
    '/activity-logs':      ['lead', 'co_lead', 'superAdmin', 'head', 'admin'],
    '/notifications':      ['lead', 'co_lead', 'superAdmin', 'head', 'vice_head', 'admin', 'member', 'employee'],
    '/settings':           ['lead', 'co_lead', 'superAdmin', 'head', 'vice_head', 'admin', 'member', 'employee'],
  };
  return pagePermissions[page]?.includes(role) ?? false;
}

export function getDefaultRoute(role: UserRole): string {
  return '/dashboard';
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    lead:      'LEAD',
    co_lead:   'CO-LEAD',
    superAdmin: 'Super Admin',
    head:      'HEAD',
    vice_head: 'VICE-HEAD',
    admin:     'Admin',
    member:    'MEMBER',
    employee:  'MEMBER',
  };
  return labels[role] || 'MEMBER';
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    lead:       'bg-[#FFD700]/20 text-[#7a5900] ring-1 ring-[#FFD700]/50',
    co_lead:    'bg-[#C0A000]/15 text-[#5c4300] ring-1 ring-[#C0A000]/40',
    superAdmin: 'bg-[#7C00FE]/10 text-[#7C00FE] ring-1 ring-[#7C00FE]/20',
    head:       'bg-[#F5004F]/10 text-[#F5004F] ring-1 ring-[#F5004F]/20',
    vice_head:  'bg-[#FF7A00]/10 text-[#a35000] ring-1 ring-[#FF7A00]/20',
    admin:      'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    member:     'bg-[#FFAF00]/15 text-[#8a5a00] ring-1 ring-[#FFAF00]/30',
    employee:   'bg-[#FFAF00]/15 text-[#8a5a00] ring-1 ring-[#FFAF00]/30',
  };
  return colors[role] || 'bg-slate-100 text-slate-700';
}
