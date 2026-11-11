import React, { useState, useEffect } from 'react';
import {
  Search,
  Building,
  RefreshCw,
  KeyRound,
  Trash2,
  Users,
  UserPlus,
  UserMinus,
  Megaphone,
  CheckCircle2,
  X,
  ArrowLeft,
  Crown,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { AdminWorkspaceRecord, PlatformAdminRole } from '../../types/admin';
import { Button } from '../common/Button';
import { AdminConfirmationModal } from './AdminConfirmationModal';

interface AdminWorkspacesViewProps {
  adminRole?: PlatformAdminRole;
}

interface SimulatedClassMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'cr' | 'member';
  joinedAt: string;
  attendancePct: number;
}

export const AdminWorkspacesView: React.FC<AdminWorkspacesViewProps> = ({ adminRole }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal States
  const [rotateTarget, setRotateTarget] = useState<AdminWorkspaceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminWorkspaceRecord | null>(null);

  // Class Deep Control State
  const [activeClass, setActiveClass] = useState<AdminWorkspaceRecord | null>(null);
  const [members, setMembers] = useState<SimulatedClassMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);

  const performSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);
    const { data, error: searchErr } = await adminService.searchWorkspaces(query, 25, 0);
    if (searchErr) {
      setError(searchErr);
    } else {
      setWorkspaces(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load class members when a class is selected
  const handleInspectClass = (ws: AdminWorkspaceRecord) => {
    setActiveClass(ws);
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('tracker_classspace_data_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          const realMembers = (parsed.members || [])
            .filter((m: any) => m.workspaceId === ws.id)
            .map((m: any) => ({
              id: m.id,
              name: m.displayName || m.name || (m.email ? m.email.split('@')[0] : 'Student Member'),
              email: m.email || `${m.userId || 'student'}@campus.edu`,
              role: m.role || 'member',
              joinedAt: m.joinedAt || new Date().toISOString(),
              attendancePct: 100,
            }));
          setMembers(realMembers);
          return;
        }
      }
    } catch {}
    setMembers([]);
  };

  const handleToggleRole = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const nextRole = m.role === 'cr' ? 'member' : 'cr';
          setFeedback(`Updated ${m.name}'s role to ${nextRole.toUpperCase()}`);
          adminService.logLocalActivity(
            'Change Member Role',
            'admin',
            `Changed ${m.name} role to ${nextRole} in ${activeClass?.name}`,
            'info'
          );

          // Update storage
          try {
            if (typeof window !== 'undefined') {
              const raw = localStorage.getItem('tracker_classspace_data_v1');
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.members)) {
                  parsed.members = parsed.members.map((mem: any) =>
                    mem.id === memberId ? { ...mem, role: nextRole } : mem
                  );
                  localStorage.setItem('tracker_classspace_data_v1', JSON.stringify(parsed));
                }
              }
            }
          } catch {}

          return { ...m, role: nextRole };
        }
        return m;
      })
    );
  };

  const handleRemoveMember = (member: SimulatedClassMember) => {
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    setFeedback(`Removed ${member.name} from ${activeClass?.name}`);
    adminService.logLocalActivity(
      'Remove Class Member',
      'admin',
      `Expelled ${member.name} (${member.email}) from ${activeClass?.name}`,
      'warning'
    );

    // Update storage
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('tracker_classspace_data_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.members)) {
            parsed.members = parsed.members.filter((m: any) => m.id !== member.id);
            localStorage.setItem('tracker_classspace_data_v1', JSON.stringify(parsed));
          }
        }
      }
    } catch {}
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !activeClass) return;

    const email = newMemberEmail.trim();
    const rawName = email.split('@')[0].replace(/[._-]/g, ' ');
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    const newMem: SimulatedClassMember = {
      id: `mem_${Date.now()}`,
      name: formattedName,
      email,
      role: 'member',
      joinedAt: new Date().toISOString(),
      attendancePct: 100,
    };

    setMembers((prev) => [newMem, ...prev]);

    // Persist to classspace storage
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('tracker_classspace_data_v1');
        const parsed = raw ? JSON.parse(raw) : { workspaces: [], members: [] };
        if (!Array.isArray(parsed.members)) parsed.members = [];
        parsed.members.push({
          id: newMem.id,
          workspaceId: activeClass.id,
          userId: `usr_${Date.now()}`,
          displayName: formattedName,
          email,
          role: 'member',
          joinedAt: newMem.joinedAt,
        });
        localStorage.setItem('tracker_classspace_data_v1', JSON.stringify(parsed));
      }
    } catch {}

    setFeedback(`Enrolled student ${formattedName} in class.`);
    adminService.logLocalActivity(
      'Enroll Class Member',
      'admin',
      `Directly enrolled ${newMem.email} into ${activeClass?.name}`,
      'success'
    );
    setNewMemberEmail('');
    setShowAddMember(false);
  };

  const handleSendAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim() || !activeClass) return;

    setFeedback(`Announcement broadcasted to all ${members.length} members of ${activeClass.name}!`);
    adminService.logLocalActivity(
      'Broadcast Class Announcement',
      'admin',
      `Admin Notice sent to ${activeClass.name}: "${announcementText.slice(0, 40)}..."`,
      'success'
    );
    setAnnouncementText('');
    setShowBroadcast(false);
  };

  const handleConfirmRotate = async (reason: string) => {
    if (!rotateTarget) return;
    const { newCode, error: rotErr } = await adminService.rotateWorkspaceJoinCode(
      rotateTarget.id,
      reason
    );
    if (rotErr) {
      throw new Error(rotErr);
    }
    setFeedback(`Join code for "${rotateTarget.name}" successfully rotated to ${newCode}`);
    performSearch(searchQuery);
  };

  const handleConfirmDelete = async (reason: string) => {
    if (!deleteTarget) return;
    const { success, error: delErr } = await adminService.deleteWorkspace(
      deleteTarget.id,
      reason
    );
    if (delErr || !success) {
      throw new Error(delErr || 'Workspace deletion failed');
    }
    setFeedback(`Workspace "${deleteTarget.name}" permanently removed.`);
    if (activeClass?.id === deleteTarget.id) {
      setActiveClass(null);
    }
    performSearch(searchQuery);
  };

  return (
    <div className="space-y-6">
      {/* ── CLASS DEEP CONTROL DRILLDOWN VIEW ── */}
      {activeClass ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ivory-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveClass(null)}
                className="gap-1.5 !bg-white/5 !text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to All Classes
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-espresso-950 dark:text-white">
                    {activeClass.name}
                  </h2>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Join Code: {activeClass.join_code}
                  </span>
                </div>
                <p className="text-xs text-espresso-500 dark:text-ivory-400 mt-0.5">
                  {activeClass.institution || 'Institutional Cohort'} · {members.length} Enrolled Students
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowBroadcast(true)}
                className="gap-1.5 !bg-blue-600 hover:!bg-blue-500 text-white text-xs"
              >
                <Megaphone className="w-3.5 h-3.5" />
                Broadcast Class Notice
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddMember(true)}
                className="gap-1.5 !bg-white/5 !text-white text-xs"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                Add Member
              </Button>
            </div>
          </div>

          {feedback && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between font-mono">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {feedback}
              </span>
              <button onClick={() => setFeedback(null)} className="font-bold underline ml-2 cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          {/* Members Table */}
          <div className="bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-ivory-200 dark:border-white/10 flex items-center justify-between">
              <h3 className="font-serif text-sm font-bold text-espresso-950 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Class Member Roster &amp; Authority Oversight
              </h3>
              <span className="text-[11px] font-mono text-ivory-400">
                {members.filter((m) => m.role === 'cr').length} Class Representatives · {members.length} Total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Student Name &amp; Email</th>
                    <th className="py-3 px-4">Class Role</th>
                    <th className="py-3 px-4">Attendance Health</th>
                    <th className="py-3 px-4">Enrolled Date</th>
                    <th className="py-3 px-4 text-right">Cohort Control Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-ivory-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-cyan-400" />
                        <p className="font-semibold text-white">No students joined this cohort yet</p>
                        <p className="text-[11px] text-ivory-400 mt-1 max-w-sm mx-auto">
                          Zero fake demo members. Share Join Code <span className="font-mono text-cyan-300 font-bold">{activeClass.join_code}</span> or click "Enroll Student" above to populate the roster.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    members.map((m) => (
                      <tr key={m.id} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-espresso-950 dark:text-white flex items-center gap-1.5">
                            {m.name}
                            {m.role === 'cr' && (
                              <span title="Class Representative">
                                <Crown className="w-3.5 h-3.5 text-amber-400" />
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-espresso-500 dark:text-ivory-400">
                            {m.email}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              m.role === 'cr'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {m.role === 'cr' ? 'Class Representative (CR)' : 'Enrolled Student'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className={m.attendancePct >= 75 ? 'text-emerald-400' : 'text-amber-400'}>
                            {m.attendancePct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-espresso-500 dark:text-ivory-400">
                          {new Date(m.joinedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleRole(m.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-white/5 hover:bg-white/10 text-blue-400 border border-white/10 transition cursor-pointer"
                              title={m.role === 'cr' ? 'Demote to Student' : 'Promote to Class Representative'}
                            >
                              {m.role === 'cr' ? 'Demote to Student' : 'Promote to CR'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m)}
                              className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                              title="Remove Member from Class"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Broadcast Announcement Modal */}
          {showBroadcast && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
              <div className="w-full max-w-md rounded-3xl bg-[#0A0F1D] border border-white/10 p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-blue-400" />
                    Broadcast Class Notice
                  </h3>
                  <button onClick={() => setShowBroadcast(false)} className="text-ivory-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSendAnnouncement} className="space-y-4 text-xs font-mono">
                  <p className="text-ivory-400">
                    This broadcast notice will be pushed instantly to the ClassSpace feed of all {members.length} students in <strong>{activeClass.name}</strong>.
                  </p>
                  <textarea
                    rows={4}
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Enter urgent class alert, schedule adjustment, or exam notice..."
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowBroadcast(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" className="!bg-blue-600 text-white">
                      Send Broadcast Notice
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Add Member Modal */}
          {showAddMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
              <div className="w-full max-w-md rounded-3xl bg-[#0A0F1D] border border-white/10 p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    Enroll Member to Class
                  </h3>
                  <button onClick={() => setShowAddMember(false)} className="text-ivory-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleAddMember} className="space-y-4 text-xs font-mono">
                  <div>
                    <label className="block text-ivory-400 mb-1">Student University Email</label>
                    <input
                      type="email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="student@university.edu"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowAddMember(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" type="submit" className="!bg-emerald-600 text-white">
                      Enroll Student
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── WORKSPACES & CLASSES MASTER LIST ── */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ivory-200 dark:border-white/10">
            <div>
              <h2 className="font-serif text-2xl font-bold text-espresso-950 dark:text-white">
                ClassSpace Workspace Moderation
              </h2>
              <p className="text-xs text-espresso-500 dark:text-ivory-400 mt-0.5">
                Oversee collaborative student cohorts, inspect class rosters, control member permissions, or rotate join codes.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ivory-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, join code, institution..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-white placeholder-ivory-400/60"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => performSearch(searchQuery)}
                disabled={isLoading}
                className="!bg-white/5 !text-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {feedback && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between font-mono">
              <span>{feedback}</span>
              <button onClick={() => setFeedback(null)} className="font-bold underline ml-2 cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-300 font-mono">
              <strong>Workspace Query Notice:</strong> {error}
            </div>
          )}

          {/* Workspaces Table */}
          <div className="bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Workspace Details</th>
                    <th className="py-3 px-4">Institution</th>
                    <th className="py-3 px-4">Join Code</th>
                    <th className="py-3 px-4">Enrolled Members</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                  {isLoading && workspaces.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-ivory-400 font-mono">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        Querying workspaces...
                      </td>
                    </tr>
                  ) : workspaces.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-ivory-400">
                        <Building className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-400" />
                        No workspaces found matching &quot;{searchQuery}&quot;.
                      </td>
                    </tr>
                  ) : (
                    workspaces.map((ws) => (
                      <tr key={ws.id} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-espresso-950 dark:text-white text-sm">
                            {ws.name}
                          </div>
                          <div className="text-[10px] text-espresso-400 dark:text-ivory-500 font-mono select-all">
                            {ws.id}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-espresso-600 dark:text-ivory-300">
                          {ws.institution || '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-ivory-100 dark:bg-white/5 text-espresso-900 dark:text-ivory-100 border border-ivory-300 dark:border-white/10 select-all">
                            {ws.join_code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-espresso-600 dark:text-ivory-300 font-mono">
                          {ws.member_count} members
                        </td>
                        <td className="py-3.5 px-4 text-espresso-600 dark:text-ivory-300 font-mono whitespace-nowrap">
                          {new Date(ws.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {adminRole === 'support' ? (
                            <span className="text-[11px] font-medium text-espresso-400 dark:text-espresso-500 italic">
                              Read-Only (Support Role)
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {/* Deep Class Control Trigger */}
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleInspectClass(ws)}
                                className="gap-1.5 text-xs py-1 px-2.5 !bg-blue-600 hover:!bg-blue-500 text-white"
                                title="Inspect and Control Class"
                              >
                                <Users className="w-3.5 h-3.5" />
                                Inspect Class
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setRotateTarget(ws)}
                                className="gap-1.5 text-xs py-1 px-2.5 !bg-white/5 !text-white"
                                title="Rotate Join Code"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                                Rotate Code
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setDeleteTarget(ws)}
                                className="gap-1.5 text-xs py-1 px-2.5 text-rose-400 hover:text-rose-300 border-rose-500/20 hover:bg-rose-500/10"
                                title="Delete Workspace"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rotate Join Code Modal */}
      {rotateTarget && (
        <AdminConfirmationModal
          isOpen={true}
          title={`Rotate Join Code for "${rotateTarget.name}"`}
          description="Rotating this join code will immediately invalidate the current code and generate a new random alphanumeric code. Existing members will retain their access."
          confirmButtonText="Rotate Join Code"
          requiresReason={true}
          onConfirm={handleConfirmRotate}
          onClose={() => setRotateTarget(null)}
        />
      )}

      {/* Dual-Step Deletion Modal */}
      {deleteTarget && (
        <AdminConfirmationModal
          isOpen={true}
          title={`Delete ClassSpace "${deleteTarget.name}"`}
          description="WARNING: This action is permanent and cannot be undone. All workspace timetable rules, shared notices, and co-admin memberships will be permanently deleted."
          confirmMatchText={deleteTarget.name}
          confirmButtonText="Permanently Delete Workspace"
          isDestructive={true}
          requiresReason={true}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
