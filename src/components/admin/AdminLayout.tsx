import React, { useState } from 'react';
import { PlatformAdminRole, AdminNavTab, AdminTimeframe } from '../../types/admin';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

// Subviews
import { AdminDashboardView } from './views/AdminDashboardView';
import { AdminUsersView } from './AdminUsersView';
import { AdminPaymentsView } from './views/AdminPaymentsView';
import { AdminAnalyticsView } from './views/AdminAnalyticsView';
import { AdminLicensesView } from './views/AdminLicensesView';
import { AdminWorkspacesView } from './AdminWorkspacesView';
import { AdminWebsiteEditorView } from './views/AdminWebsiteEditorView';
import { AdminNutritionManagerView } from './views/AdminNutritionManagerView';
import { AdminActivityLogsView } from './views/AdminActivityLogsView';
import { AdminDataManagementView } from './views/AdminDataManagementView';
import { AdminSecurityView } from './views/AdminSecurityView';
import { AdminConfigurationView } from './views/AdminConfigurationView';
import { AdminProfileView } from './views/AdminProfileView';

// Legacy Views preserved for seamless routing fallback
import { AdminAcademicView } from './views/AdminAcademicView';
import { AdminTimetableView } from './views/AdminTimetableView';
import { AdminAttendanceView } from './views/AdminAttendanceView';
import { AdminSyllabusView } from './views/AdminSyllabusView';
import { AdminEventsTasksView } from './views/AdminEventsTasksView';
import { AdminFitnessView } from './views/AdminFitnessView';
import { AdminNutritionView } from './views/AdminNutritionView';

export type AdminTab = AdminNavTab;

interface AdminLayoutProps {
  adminRole: PlatformAdminRole;
  userId?: string;
  onExit: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ adminRole, userId, onExit }) => {
  const [currentTab, setCurrentTab] = useState<AdminNavTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<AdminTimeframe>('30d');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen flex bg-[#070B14] text-ivory-100 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Cirrel-inspired decorative spatial lighting orbs */}
      <div
        className="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="fixed top-1/3 -right-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="fixed -bottom-40 left-1/3 w-96 h-96 rounded-full bg-amber-500/5 blur-[140px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Accessible product title for the administrative portal. */}
      <div className="sr-only" aria-hidden="false">
        <h1>TRAKIFY Administrative Portal</h1>
      </div>

      {/* Left Persistent Navigation Sidebar */}
      <AdminSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        adminRole={adminRole}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onExit={onExit}
      />

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen relative z-10">
        {/* Cirrel Top Header Bar */}
        <AdminHeader
          currentTab={currentTab}
          adminRole={adminRole}
          userId={userId}
          timeframe={timeframe}
          onSelectTimeframe={setTimeframe}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onExit={onExit}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1680px] w-full mx-auto space-y-6">
          {currentTab === 'overview' && (
            <AdminDashboardView
              adminRole={adminRole}
              userId={userId}
              timeframe={timeframe}
              onSelectTab={setCurrentTab}
            />
          )}
          {currentTab === 'payments' && <AdminPaymentsView />}
          {currentTab === 'analytics' && <AdminAnalyticsView timeframe={timeframe} />}
          {currentTab === 'licenses' && <AdminLicensesView />}
          {currentTab === 'users' && <AdminUsersView />}
          {currentTab === 'workspaces' && <AdminWorkspacesView adminRole={adminRole} />}
          {currentTab === 'website_editor' && <AdminWebsiteEditorView />}
          {currentTab === 'nutrition_recalibrator' && <AdminNutritionManagerView />}
          {currentTab === 'audit' && <AdminActivityLogsView />}
          {currentTab === 'data_management' && <AdminDataManagementView />}
          {currentTab === 'configuration' && <AdminConfigurationView />}
          {currentTab === 'security' && <AdminSecurityView adminRole={adminRole} />}
          {currentTab === 'profile' && (
            <AdminProfileView adminRole={adminRole} userId={userId} onExit={onExit} />
          )}
          {currentTab === 'admin_settings' && <AdminConfigurationView />}

          {/* Legacy Tab Fallbacks */}
          {currentTab === 'academics' && <AdminAcademicView />}
          {currentTab === 'timetable' && <AdminTimetableView />}
          {currentTab === 'attendance' && <AdminAttendanceView />}
          {currentTab === 'syllabus' && <AdminSyllabusView />}
          {currentTab === 'events_tasks' && <AdminEventsTasksView />}
          {currentTab === 'fitness' && <AdminFitnessView />}
          {currentTab === 'nutrition' && <AdminNutritionView />}
        </main>
      </div>
    </div>
  );
};
