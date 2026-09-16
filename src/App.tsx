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
import { CompliancePage } from '@/pages/CompliancePage';
import { OperationsPage } from '@/pages/OperationsPage';

import { AccessDenied } from '@/components/auth/AccessDenied';


function RootRedirect() {
  const { user, userProfile, loading, unauthorized } = useAuth();

  if (loading) return <PageLoader />;
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
              <Route path="/wallet" element={<OCoinsPage />} />
              <Route path="/discounts" element={<Navigate to="/ocoins?tab=store" replace />} />
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
                <Route path="/my-discounts" element={<Navigate to="/ocoins?tab=purchases" replace />} />
              </Route>

              {/* Unified Operations & Tasks Review (Leadership, Head, and Vice-Head) */}
              <Route element={<ProtectedRoute allowedRoles={['lead', 'co_lead', 'head', 'vice_head']} />}>
                <Route path="/operations" element={<OperationsPage />} />
                <Route path="/tasks" element={<Navigate to="/operations?tab=tasks" replace />} />
                <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
                <Route path="/submitted-tasks" element={<Navigate to="/operations?tab=submissions" replace />} />
              </Route>

              {/* Leadership & Head exclusive admin routes */}
              <Route element={<ProtectedRoute allowedRoles={['lead', 'co_lead', 'head']} />}>
                {/* Unified Compliance Hub: Attendance + Bans */}
                <Route path="/compliance" element={<CompliancePage />} />
                <Route path="/attendance" element={<Navigate to="/compliance?tab=attendance" replace />} />
                <Route path="/bans" element={<Navigate to="/compliance?tab=bans" replace />} />

                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/admin/discounts" element={<Navigate to="/ocoins?tab=manage_discounts" replace />} />
                <Route path="/admin/courses" element={<Navigate to="/courses?tab=manage" replace />} />
                <Route path="/admin/support" element={<Navigate to="/support?tab=manage" replace />} />
                <Route path="/activity-logs" element={<ActivityLogsPage />} />
                <Route path="/reports" element={<Navigate to="/dashboard" replace />} />
                <Route path="/access-management" element={<Navigate to="/dashboard" replace />} />
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
