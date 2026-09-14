import { useAuth } from '@/context/AuthContext';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';

export function DashboardPage() {
  const { userProfile } = useAuth();
  
  if (userProfile?.role === 'superAdmin' || userProfile?.role === 'admin') {
    return <AdminDashboard />;
  }
  return <EmployeeDashboard />;
}
