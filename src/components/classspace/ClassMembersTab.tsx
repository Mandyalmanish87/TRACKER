import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  GraduationCap,
  Calendar,
  UserX,
  Mail,
  Check,
  X,
  ArrowRightLeft,
  Megaphone,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { ClassSpaceMember, ClassSpaceRole } from '../../types/classSpace';
import { getAvatarInitials, getAvatarBgColor } from '../../utils/classSpaceUtils';
import { ConfirmModal } from '../common/ConfirmModal';

export const ClassMembersTab: React.FC = () => {
  const {
    activeWorkspace,
    members,
    currentMember,
    isCR,
    removeMember,
    joinRequests,
    reviewJoinRequest,
    updateMemberRole,
    transferCRRole,
    updateCoAdminNoticePermission,
  } = useClassSpace();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'cr' | 'co_admin' | 'member'>('all');
  const [memberToRemove, setMemberToRemove] = useState<ClassSpaceMember | null>(null);
  const [memberForCRTransfer, setMemberForCRTransfer] = useState<ClassSpaceMember | null>(null);
  const [previousCRRoleChoice, setPreviousCRRoleChoice] = useState<'co_admin' | 'member'>('co_admin');
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewingReqId, setReviewingReqId] = useState<string | null>(null);

  // Filter members based on query and role filter
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const isCurrentUser = m.id === currentMember?.id || m.userId === currentMember?.userId;
      const name = isCurrentUser ? (currentMember?.displayName || m.displayName) : (m.displayName || 'Member');
      const email = isCurrentUser ? (currentMember?.email || m.email || '') : (m.email || '');
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [members, currentMember, searchQuery, roleFilter]);

  // Role counts
  const counts = useMemo(() => {
    return {
      total: members.length,
      crs: members.filter((m) => m.role === 'cr').length,
      coAdmins: members.filter((m) => m.role === 'co_admin').length,
      students: members.filter((m) => m.role === 'member').length,
    };
  }, [members]);

  const getRoleBadge = (role: ClassSpaceRole) => {
    switch (role) {
      case 'cr':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Shield className="w-3.5 h-3.5" />
            Class Representative
          </span>
        );
      case 'co_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Co-Admin
          </span>
        );
      case 'member':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
            <GraduationCap className="w-3.5 h-3.5" />
            Student
          </span>
        );
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Joined recently';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Joined recently';
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Pending Join Requests Review Panel for CR ── */}
      {isCR && joinRequests.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>Pending Join Requests</span>
                <span className="px-2 py-0.2 rounded-full text-xs bg-amber-500 text-white font-mono font-bold">
                  {joinRequests.length}
                </span>
              </h4>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">CR approval required before students can join</span>
          </div>

          <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card overflow-hidden">
            {joinRequests.map((req) => (
              <div key={req.id} className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-2xs shrink-0"
                    style={{ backgroundColor: getAvatarBgColor(req.displayName) }}
                  >
                    {getAvatarInitials(req.displayName)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-foreground block truncate">
                      {req.displayName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Requested {formatDate(req.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={reviewingReqId === req.id}
                    onClick={async () => {
                      setReviewingReqId(req.id);
                      const res = await reviewJoinRequest(req.id, 'approve');
                      if (!res.success) setActionError(res.error || 'Failed to approve request.');
                      setReviewingReqId(null);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    disabled={reviewingReqId === req.id}
                    onClick={async () => {
                      setReviewingReqId(req.id);
                      const res = await reviewJoinRequest(req.id, 'reject');
                      if (!res.success) setActionError(res.error || 'Failed to decline request.');
                      setReviewingReqId(null);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header Summary & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Enrolled</div>
            <div className="text-2xl font-bold text-foreground mt-1">{counts.total}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Class Reps</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{counts.crs}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Co-Admins</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{counts.coAdmins}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Students</div>
            <div className="text-2xl font-bold text-foreground mt-1">{counts.students}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name or email..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              roleFilter === 'all'
                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            All Members ({counts.total})
          </button>
          <button
            onClick={() => setRoleFilter('cr')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              roleFilter === 'cr'
                ? 'bg-amber-600 text-white font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            CRs ({counts.crs})
          </button>
          <button
            onClick={() => setRoleFilter('co_admin')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              roleFilter === 'co_admin'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            Co-Admins ({counts.coAdmins})
          </button>
          <button
            onClick={() => setRoleFilter('member')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              roleFilter === 'member'
                ? 'bg-secondary text-foreground font-semibold'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            Students ({counts.students})
          </button>
        </div>
      </div>

      {/* Members List */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-secondary/20 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Enrolled Classmates ({filteredMembers.length})
          </h3>
          <span className="text-xs text-muted-foreground">
            {activeWorkspace?.name} &bull; Section {activeWorkspace?.section || 'Default'}
          </span>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h4 className="text-base font-semibold text-foreground">No members found</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              No students or class leaders match your search criteria. Try a different keyword or filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredMembers.map((member) => {
              const isCurrentUser = member.id === currentMember?.id || member.userId === currentMember?.userId;
              const name = isCurrentUser ? (currentMember?.displayName || member.displayName) : (member.displayName || 'Member');
              const email = isCurrentUser ? (currentMember?.email || member.email || 'No email provided') : (member.email || 'classmate@edu.com');
              const initials = getAvatarInitials(name);
              const fallbackBg = getAvatarBgColor(name);

              return (
                <div
                  key={member.id}
                  className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={name}
                          className="w-10 h-10 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-inner"
                          style={{ backgroundColor: fallbackBg }}
                        >
                          {initials}
                        </div>
                      )}
                      {member.role === 'cr' && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] shadow-sm">
                          ★
                        </span>
                      )}
                    </div>

                    {/* Member Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {name}
                        </span>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary border border-primary/20">
                            You
                          </span>
                        )}
                        {getRoleBadge(member.role)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 text-muted-foreground/70" />
                          {email}
                        </span>
                        <span className="hidden md:flex items-center gap-1 text-muted-foreground/80">
                          <Calendar className="w-3 h-3" />
                          Joined {formatDate(member.joinedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Info */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                    {/* Notice publishing badge for Co-Admins */}
                    {member.role === 'co_admin' && member.canPublishNotices && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Megaphone className="w-3 h-3" />
                        Can Post Notices
                      </span>
                    )}

                    <span className="text-xs text-muted-foreground md:hidden">
                      Joined {formatDate(member.joinedAt)}
                    </span>

                    {isCR && !isCurrentUser && member.role !== 'cr' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Co-Admin notice permission toggle */}
                        {member.role === 'co_admin' && (
                          <button
                            onClick={async () => {
                              setActionError(null);
                              const res = await updateCoAdminNoticePermission(member.userId, !member.canPublishNotices);
                              if (!res.success) setActionError(res.error || 'Failed to update notice permission.');
                            }}
                            className={`px-2 py-1 text-xs font-medium rounded-lg transition border flex items-center gap-1 cursor-pointer ${
                              member.canPublishNotices
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                : 'text-muted-foreground hover:bg-secondary border-border'
                            }`}
                            title={member.canPublishNotices ? 'Revoke notice publishing' : 'Allow posting official notices'}
                          >
                            <Megaphone className="w-3 h-3" />
                            <span>{member.canPublishNotices ? 'Notice Rights' : '+ Notice Rights'}</span>
                          </button>
                        )}

                        {/* Promote to Co-Admin / Demote to Student */}
                        {member.role === 'member' ? (
                          <button
                            onClick={async () => {
                              setActionError(null);
                              const res = await updateMemberRole(member.userId, 'co_admin');
                              if (!res.success) setActionError(res.error || 'Failed to promote member.');
                            }}
                            className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-500/10 rounded-lg transition border border-blue-500/20 cursor-pointer"
                            title="Promote to Co-Admin"
                          >
                            Promote Co-Admin
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              setActionError(null);
                              const res = await updateMemberRole(member.userId, 'member');
                              if (!res.success) setActionError(res.error || 'Failed to demote member.');
                            }}
                            className="px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg transition border border-border cursor-pointer"
                            title="Demote to Student"
                          >
                            Demote Student
                          </button>
                        )}

                        {/* Transfer CR Role */}
                        <button
                          onClick={() => setMemberForCRTransfer(member)}
                          className="px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/10 rounded-lg transition border border-amber-500/20 flex items-center gap-1 cursor-pointer"
                          title="Transfer Class Representative Role"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Transfer CR</span>
                        </button>

                        {/* Remove Member */}
                        <button
                          onClick={() => setMemberToRemove(member)}
                          className="px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-1 border border-destructive/20 cursor-pointer"
                          title="Remove member from workspace"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Error notification */}
      {actionError && (
        <div className="p-3 text-xs rounded-xl bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-destructive font-bold hover:opacity-80"
          >
            &times;
          </button>
        </div>
      )}

      {/* Confirmation Modal for Removing Member */}
      <ConfirmModal
        isOpen={Boolean(memberToRemove)}
        title="Remove Member from ClassSpace?"
        message={`Are you sure you want to remove ${memberToRemove?.displayName || 'this student'} from ${activeWorkspace?.name}? They will lose access to shared class timetables and community discussions.`}
        confirmLabel="Remove Member"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (memberToRemove) {
            setActionError(null);
            const res = await removeMember(memberToRemove.userId);
            if (!res.success) {
              setActionError(res.error || 'Failed to remove member.');
            }
            setMemberToRemove(null);
          }
        }}
        onCancel={() => setMemberToRemove(null)}
      />

      {/* CR Role Transfer Modal */}
      {Boolean(memberForCRTransfer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-amber-500">
              <ArrowRightLeft className="w-5 h-5" />
              <h3 className="text-base font-bold text-foreground">Transfer Class Representative Role</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              You are about to transfer the primary <strong>Class Representative (CR)</strong> role for{' '}
              <span className="font-semibold text-foreground">{activeWorkspace?.name}</span> to{' '}
              <span className="font-semibold text-foreground">{memberForCRTransfer?.displayName}</span>.
              There can only be one CR at a time.
            </p>

            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-foreground">Select your new role after transfer:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreviousCRRoleChoice('co_admin')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    previousCRRoleChoice === 'co_admin'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Co-Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviousCRRoleChoice('member')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    previousCRRoleChoice === 'member'
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Student</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setMemberForCRTransfer(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:bg-secondary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (memberForCRTransfer) {
                    setActionError(null);
                    const res = await transferCRRole(memberForCRTransfer.userId, previousCRRoleChoice);
                    if (!res.success) {
                      setActionError(res.error || 'Failed to transfer CR role.');
                    }
                    setMemberForCRTransfer(null);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs cursor-pointer"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
