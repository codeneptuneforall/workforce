import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from './components/layout/AppShell';
import { RequirePayroll, RequireRole, RootRedirect } from './components/layout/RouteGuards';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/auth/PasswordRecoveryPages';
import { AccessDeniedPage, SessionExpiredPage } from './pages/auth/StatusPages';
import { ApplyLeavePage } from './pages/employee/ApplyLeavePage';
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard';
import { MyAttendancePage } from './pages/employee/MyAttendancePage';
import { MyLeavesPage } from './pages/employee/MyLeavesPage';
import { MyPayslipsPage } from './pages/employee/MyPayslipsPage';
import { MyProfilePage } from './pages/employee/MyProfilePage';
import { MyProjectsPage } from './pages/employee/MyProjectsPage';
import { MyTimesheetsPage } from './pages/employee/MyTimesheetsPage';
import { TimeTrackerPage } from './pages/employee/TimeTrackerPage';
import { WorkLogsPage } from './pages/employee/WorkLogsPage';
import { AttendancePage } from './pages/management/AttendancePage';
import { AuditLogPage } from './pages/management/AuditLogPage';
import { EmployeeDetailPage } from './pages/management/EmployeeDetailPage';
import { EmployeesPage } from './pages/management/EmployeesPage';
import { LeaveCalendarPage } from './pages/management/LeaveCalendarPage';
import { LeaveRequestsPage } from './pages/management/LeaveRequestsPage';
import { LeaveSettingsPage } from './pages/management/LeaveSettingsPage';
import { LiveTrackerPage } from './pages/management/LiveTrackerPage';
import { ManagementDashboard } from './pages/management/ManagementDashboard';
import { PayrollPage } from './pages/management/PayrollPage';
import { PayslipDetailPage } from './pages/management/PayslipDetailPage';
import { PayslipsPage } from './pages/management/PayslipsPage';
import { ProjectDetailPage } from './pages/management/ProjectDetailPage';
import { ProjectsPage } from './pages/management/ProjectsPage';
import { ReportsPage } from './pages/management/ReportsPage';
import { SalaryStructuresPage } from './pages/management/SalaryStructuresPage';
import { SettingsPage } from './pages/management/SettingsPage';
import { ShortfallsPage } from './pages/management/ShortfallsPage';
import { TasksPage } from './pages/management/TasksPage';
import { TeamDetailPage } from './pages/management/TeamDetailPage';
import { TeamsPage } from './pages/management/TeamsPage';
import { TimesheetReviewPage } from './pages/management/TimesheetReviewPage';
import { HolidayCalendarPage } from './pages/shared/HolidayCalendarPage';
import { NotificationsPage } from './pages/shared/NotificationsPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <ErrorBoundary>
            <Toaster position="top-right" richColors closeButton />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/session-expired" element={<SessionExpiredPage />} />
            <Route path="/access-denied" element={<AccessDeniedPage />} />

            <Route element={<RequireRole role="management" />}>
              <Route path="/management" element={<AppShell portal="management" />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ManagementDashboard />} />
                <Route path="time-tracker" element={<LiveTrackerPage />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="attendance/shortfalls" element={<ShortfallsPage />} />
                <Route path="timesheets" element={<TimesheetReviewPage />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="employees/:id" element={<EmployeeDetailPage />} />
                <Route path="teams" element={<TeamsPage />} />
                <Route path="teams/:id" element={<TeamDetailPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/:id" element={<ProjectDetailPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="leaves" element={<Navigate to="requests" replace />} />
                <Route path="leaves/requests" element={<LeaveRequestsPage />} />
                <Route path="leaves/calendar" element={<LeaveCalendarPage />} />
                <Route path="leaves/settings" element={<LeaveSettingsPage />} />
                <Route path="holidays" element={<HolidayCalendarPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route element={<RequirePayroll />}>
                  <Route path="payroll" element={<PayrollPage />} />
                  <Route path="payroll/salary-structures" element={<SalaryStructuresPage />} />
                  <Route path="payslips" element={<PayslipsPage />} />
                  <Route path="payslips/:id" element={<PayslipDetailPage />} />
                </Route>
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="audit-log" element={<AuditLogPage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Route>
            </Route>

            <Route element={<RequireRole role="employee" />}>
              <Route path="/employee" element={<AppShell portal="employee" />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<EmployeeDashboard />} />
                <Route path="time-tracker" element={<TimeTrackerPage />} />
                <Route path="work-logs" element={<WorkLogsPage />} />
                <Route path="timesheets" element={<MyTimesheetsPage />} />
                <Route path="projects" element={<MyProjectsPage />} />
                <Route path="attendance" element={<MyAttendancePage />} />
                <Route path="holidays" element={<HolidayCalendarPage />} />
                <Route path="leaves" element={<MyLeavesPage />} />
                <Route path="leaves/history" element={<MyLeavesPage />} />
                <Route path="leaves/apply" element={<ApplyLeavePage />} />
                <Route path="payslips" element={<MyPayslipsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<MyProfilePage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<RootRedirect />} />
          </Routes>
          </ErrorBoundary>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>);

}