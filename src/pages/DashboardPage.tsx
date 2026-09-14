import { useAuth } from '@/context/AuthContext';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import { isAdminRole } from '@/utils/permissions';

export function DashboardPage() {
  const { userProfile } = useAuth();

  if (userProfile && isAdminRole(userProfile.role)) {
    return <AdminDashboard />;
  }
  return <EmployeeDashboard />;
}
