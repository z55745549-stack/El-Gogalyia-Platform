import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { LoginPage } from '@/components/auth/LoginPage';
import { PageLoader } from '@/components/ui/loading-spinner';
import { AppLayout } from '@/components/layout/AppLayout';

// Pages (lazy-friendly imports)
import { DashboardPage } from '@/pages/DashboardPage';
import { TasksPage } from '@/pages/TasksPage';
import { MyTasksPage } from '@/pages/MyTasksPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { OCoinsPage } from '@/pages/OCoinsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AccessManagementPage } from '@/pages/AccessManagementPage';
import { ActivityLogsPage } from '@/pages/ActivityLogsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { MeetingsPage } from '@/pages/MeetingsPage';
import { OpportunitiesPage } from '@/pages/OpportunitiesPage';
import { BansPage } from '@/pages/BansPage';
import { SubmittedTasksPage } from '@/pages/SubmittedTasksPage';
import { SupportPage } from '@/pages/SupportPage';
import { SupportTicketDetailPage } from '@/pages/SupportTicketDetailPage';
import { AdminSupportPage } from '@/pages/AdminSupportPage';
import { AttendanceAdminPage } from '@/pages/AttendanceAdminPage';
import { AttendanceCheckInPage } from '@/pages/AttendanceCheckInPage';
import { MyAttendancePage } from '@/pages/MyAttendancePage';
import { DiscountsPage } from '@/pages/DiscountsPage';
import { MyDiscountsPage } from '@/pages/MyDiscountsPage';
import { AdminDiscountsPage } from '@/pages/AdminDiscountsPage';
import { CoursesPage } from '@/pages/CoursesPage';
import { CoursePlayerPage } from '@/pages/CoursePlayerPage';
import { AdminCoursesPage } from '@/pages/AdminCoursesPage';

import { AccessDenied } from '@/components/auth/AccessDenied';

import { MaintenanceScreen } from '@/components/maintenance/MaintenanceScreen';
import { useMaintenance } from '@/hooks/useMaintenance';
import { isAdminRole } from '@/utils/permissions';

function RootRedirect() {
  const { user, userProfile, loading, unauthorized } = useAuth();
  const { isMaintenanceActive, maintenance } = useMaintenance();

  if (loading) return <PageLoader />;

  // If maintenance is active, only Admins are allowed to access dashboard
  if (isMaintenanceActive) {
    const isAdmin = userProfile && isAdminRole(userProfile.role);
    if (!isAdmin) {
      return <MaintenanceScreen message={maintenance.message} />;
    }
  }

  if (!user) return <LoginPage />;
  if (unauthorized) return <AccessDenied />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatePresence>
        <Routes>
          {/* Public */}
          <Route path="/" element={<RootRedirect />} />

          {/* Protected — all roles */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/ocoins" element={<OCoinsPage />} />
              <Route path="/discounts" element={<DiscountsPage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:courseId/learn" element={<CoursePlayerPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/meetings" element={<MeetingsPage />} />
              <Route path="/opportunities" element={<OpportunitiesPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/support/:ticketId" element={<SupportTicketDetailPage />} />
              <Route path="/attendance/check" element={<AttendanceCheckInPage />} />

              {/* Member & Vice-Head routes (like employee) */}
              <Route element={<ProtectedRoute allowedRoles={['member', 'vice_head']} />}>
                <Route path="/my-tasks" element={<MyTasksPage />} />
                <Route path="/my-tasks/:taskId" element={<TaskDetailPage />} />
                <Route path="/my-attendance" element={<MyAttendancePage />} />
                <Route path="/my-discounts" element={<MyDiscountsPage />} />
              </Route>

              {/* Leadership & Head routes (replaces Super Admin & Admin) */}
              <Route element={<ProtectedRoute allowedRoles={['lead', 'co_lead', 'head']} />}>
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
                <Route path="/submitted-tasks" element={<SubmittedTasksPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/attendance" element={<AttendanceAdminPage />} />
                <Route path="/admin/discounts" element={<AdminDiscountsPage />} />
                <Route path="/admin/courses" element={<AdminCoursesPage />} />
                <Route path="/bans" element={<BansPage />} />
                <Route path="/admin/support" element={<AdminSupportPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/activity-logs" element={<ActivityLogsPage />} />
                <Route path="/access-management" element={<AccessManagementPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  );
}
