import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PageLoader } from '@/components/ui/loading-spinner';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { MaintenanceScreen } from '@/components/maintenance/MaintenanceScreen';
import { useMaintenance } from '@/hooks/useMaintenance';
import type { UserRole } from '@/types';
import { isAdminRole } from '@/utils/permissions';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, userProfile, loading, unauthorized } = useAuth();
  const { isMaintenanceActive, maintenance } = useMaintenance();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (unauthorized) {
    return <AccessDenied />;
  }

  if (!userProfile) {
    return <Navigate to="/" replace />;
  }

  // If maintenance mode is active, only management roles (lead, co_lead, head) are allowed through
  const isAdmin = isAdminRole(userProfile.role);
  if (isMaintenanceActive && !isAdmin) {
    return <MaintenanceScreen message={maintenance.message} />;
  }

  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

