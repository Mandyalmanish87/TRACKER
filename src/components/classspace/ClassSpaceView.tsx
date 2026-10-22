import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  CheckCircle2,
  MessageSquare,
  Users,
  Settings,
  Plus,
  LogIn,
  Building,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { ClassSpaceHeader } from './ClassSpaceHeader';
import { ClassSpaceOverview } from './ClassSpaceOverview';
import { ClassTimetableTab } from './ClassTimetableTab';
import { ClassAttendanceTab } from './ClassAttendanceTab';
import { ClassCommunityTab } from './ClassCommunityTab';
import { ClassMembersTab } from './ClassMembersTab';
import { ClassSettingsTab } from './ClassSettingsTab';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { JoinWorkspaceModal } from './JoinWorkspaceModal';
import { ClassNotificationDrawer } from './ClassNotificationDrawer';

export type ClassSpaceSubTab = 'overview' | 'timetable' | 'attendance' | 'community' | 'members' | 'settings';

interface SubTabItem {
  id: ClassSpaceSubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const ClassSpaceView: React.FC = () => {
  const {
    activeWorkspace,
    isLoading,
    rules,
    members,
  } = useClassSpace();

  const [activeTab, setActiveTab] = useState<ClassSpaceSubTab>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  // Tab configuration
  const tabs: SubTabItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'timetable', label: 'Timetable', icon: Calendar, badge: rules.length > 0 ? `${rules.length}` : undefined },
    { id: 'attendance', label: 'My Attendance', icon: CheckCircle2 },
    { id: 'community', label: 'Community', icon: MessageSquare },
    { id: 'members', label: 'Classmates', icon: Users, badge: members.length > 0 ? `${members.length}` : undefined },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading ClassSpace...
        </p>
      </div>
    );
  }

  // If no active workspace and no workspaces exist
  if (!activeWorkspace) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 animate-in fade-in duration-300">
        {/* Welcome Hero */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner border border-primary/20">
            <Building className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
            Welcome to <span className="text-primary">ClassSpace</span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            A collaborative workspace for your class batch. Synchronize authoritative timetables, receive instant reschedule alerts, discuss coursework, and track your personal attendance with ease.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create ClassSpace (for CRs)</span>
            </button>
            <button
              onClick={() => setShowJoinModal(true)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold border border-border transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              <span>Join with Code</span>
            </button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Authoritative Class Timetable</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Maintained by your Class Representative. Single occurrences can be cancelled or rescheduled with notes without altering the semester schedule.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Personal Attendance Isolation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Track attendance directly linked to official class slots. Your present/absent record is strictly private and never visible to other students.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Community & Pinned Notices</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Direct discussions with reactions, reply threads, and pinned announcements so nobody misses sudden exam room updates or homework deadlines.
            </p>
          </div>
        </div>

        {/* Modals */}
        <CreateWorkspaceModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
        <JoinWorkspaceModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-200">
      {/* 1. Header with Workspace Switcher & Actions */}
      <ClassSpaceHeader
        onCreateClick={() => setShowCreateModal(true)}
        onJoinClick={() => setShowJoinModal(false)}
        onToggleNotifications={() => setShowNotificationDrawer(true)}
      />

      {/* 2. Sub-tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-px" aria-label="ClassSpace Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ClassSpaceSubTab)}
                className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors relative ${
                  isActive
                    ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Sub-tab Views */}
      <main className="min-h-[500px]">
        {activeTab === 'overview' && (
          <ClassSpaceOverview onNavigateTab={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === 'timetable' && <ClassTimetableTab />}
        {activeTab === 'attendance' && <ClassAttendanceTab />}
        {activeTab === 'community' && <ClassCommunityTab />}
        {activeTab === 'members' && <ClassMembersTab />}
        {activeTab === 'settings' && <ClassSettingsTab />}
      </main>

      {/* Modals & Notification Drawer */}
      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      <JoinWorkspaceModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />
      <ClassNotificationDrawer
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        onNavigateToTab={(tab) => {
          setActiveTab(tab as ClassSpaceSubTab);
          setShowNotificationDrawer(false);
        }}
      />
    </div>
  );
};
