import type { Permission, UserRole } from '@/types';
import { ROLE_PERMISSIONS } from '@/types';

export function hasPermission(
  userPermissions: Permission[],
  userRole: UserRole,
  permission: Permission
): boolean {
  // superAdmin and admin have all permissions
  if (userRole === 'superAdmin' || userRole === 'admin') return true;
  // Check explicit permissions first
  if (userPermissions.includes(permission)) return true;
  // Check role default permissions
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}

export function canAccessPage(role: UserRole, page: string): boolean {
  const pagePermissions: Record<string, UserRole[]> = {
    '/dashboard': ['superAdmin', 'admin', 'employee'],
    '/tasks': ['superAdmin', 'admin', 'employee'],
    '/my-tasks': ['employee'],
    '/employees': ['superAdmin', 'admin'],
    '/ocoins': ['superAdmin', 'admin', 'employee'],
    '/reports': ['superAdmin', 'admin'],
    '/access-management': ['superAdmin', 'admin'],
    '/activity-logs': ['superAdmin', 'admin'],
    '/notifications': ['superAdmin', 'admin', 'employee'],
    '/settings': ['superAdmin', 'admin', 'employee'],
  };
  return pagePermissions[page]?.includes(role) ?? false;
}

export function getDefaultRoute(role: UserRole): string {
  return '/dashboard';
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    superAdmin: 'Super Admin',
    admin: 'Admin',
    employee: 'Employee',
  };
  return labels[role] || 'Employee';
}

export function getRoleColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    superAdmin: 'bg-[#7C00FE]/10 text-[#7C00FE] ring-1 ring-[#7C00FE]/20',
    admin: 'bg-[#F5004F]/10 text-[#F5004F] ring-1 ring-[#F5004F]/20',
    employee: 'bg-[#FFAF00]/15 text-[#8a5a00] ring-1 ring-[#FFAF00]/30',
  };
  return colors[role] || 'bg-slate-100 text-slate-700';
}
